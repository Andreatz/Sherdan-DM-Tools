import "dotenv/config";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import {
  buildSherdanImportReport,
  renderSherdanImportReportMarkdown,
  type SherdanImportDbSnapshot,
  type SherdanImportReport,
} from "@/lib/import/sherdan-import-report";
import type { SherdanBootstrapSources } from "@/lib/import/sherdan-bootstrap-plan";

const SHERDAN_NAME = "Sherdan";
const DEFAULT_OUTPUT = path.join("docs", "sherdan-import-report.md");

interface Args {
  output: string;
  stdout: boolean;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sqlClient = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sqlClient, { schema });

  try {
    const report = buildSherdanImportReport(readSherdanSources(), {
      db: await readDbSnapshot(db),
    });
    const markdown = renderSherdanImportReportMarkdown(report);

    if (args.stdout) {
      console.log(markdown);
    } else {
      const outputPath = path.resolve(process.cwd(), args.output);
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, markdown, "utf8");
      printSummary(report, args.output);
    }
  } finally {
    await sqlClient.end();
  }
}

function readSherdanSources(): SherdanBootstrapSources {
  const publicDir = path.join(process.cwd(), "public");
  return {
    npc: readFileSync(path.join(publicDir, "NPC.md"), "utf8"),
    factions: readFileSync(path.join(publicDir, "Fazioni.md"), "utf8"),
    lore: readFileSync(path.join(publicDir, "Lore.md"), "utf8"),
    campaign: readFileSync(path.join(publicDir, "Campagna.md"), "utf8"),
    backgrounds: readFileSync(
      path.join(publicDir, "Background Personaggi.md"),
      "utf8",
    ),
    playerManual: readFileSync(
      path.join(publicDir, "Manuale del Giocatore.md"),
      "utf8",
    ),
  };
}

async function readDbSnapshot(
  db: ReturnType<typeof drizzle<typeof schema>>,
): Promise<SherdanImportDbSnapshot> {
  const campaign = await db
    .select({ id: schema.campaigns.id })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.name, SHERDAN_NAME))
    .limit(1);
  const campaignId = campaign[0]?.id;

  const empty: SherdanImportDbSnapshot = {
    campaignFound: Boolean(campaignId),
    entitiesTotal: 0,
    importedEntities: 0,
    importedEntitiesByType: {},
    importedEntitiesWithEmbedding: 0,
    importedEntitiesMissingEmbedding: 0,
    identities: 0,
    secrets: 0,
    pcHooks: 0,
    entityLinks: 0,
    sessions: 0,
    plotThreads: 0,
    ruleDocuments: 0,
  };

  if (!campaignId) return empty;

  const entityRows = await db
    .select({
      id: schema.entities.id,
      type: schema.entities.type,
      tags: schema.entities.tags,
      embedding: schema.entities.embedding,
    })
    .from(schema.entities)
    .where(eq(schema.entities.campaignId, campaignId));

  const importedEntities = entityRows.filter((entity) =>
    entity.tags.includes("sherdan-import"),
  );
  const importedEntityIds = new Set(importedEntities.map((entity) => entity.id));
  const identities = await db
    .select({ entityId: schema.entityIdentities.entityId })
    .from(schema.entityIdentities);
  const secrets = await db
    .select({ id: schema.entitySecrets.id })
    .from(schema.entitySecrets)
    .where(eq(schema.entitySecrets.campaignId, campaignId));
  const pcHooks = await db
    .select({ id: schema.pcHooks.id })
    .from(schema.pcHooks)
    .where(eq(schema.pcHooks.campaignId, campaignId));
  const entityLinks = await db
    .select({ id: schema.entityLinks.id })
    .from(schema.entityLinks)
    .where(eq(schema.entityLinks.campaignId, campaignId));
  const sessions = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(eq(schema.sessions.campaignId, campaignId));
  const plotThreads = await db
    .select({ id: schema.plotThreads.id })
    .from(schema.plotThreads)
    .where(eq(schema.plotThreads.campaignId, campaignId));
  const ruleDocuments = await db
    .select({ id: schema.ruleDocuments.id })
    .from(schema.ruleDocuments)
    .where(
      and(
        eq(schema.ruleDocuments.source, "sherdan-custom"),
        sql`${schema.ruleDocuments.title} = 'Manuale del Giocatore'`,
      ),
    );

  return {
    campaignFound: true,
    entitiesTotal: entityRows.length,
    importedEntities: importedEntities.length,
    importedEntitiesByType: countBy(importedEntities, (entity) => entity.type),
    importedEntitiesWithEmbedding: importedEntities.filter(
      (entity) => entity.embedding !== null,
    ).length,
    importedEntitiesMissingEmbedding: importedEntities.filter(
      (entity) => entity.embedding === null,
    ).length,
    identities: identities.filter((identity) =>
      importedEntityIds.has(identity.entityId),
    ).length,
    secrets: secrets.length,
    pcHooks: pcHooks.length,
    entityLinks: entityLinks.length,
    sessions: sessions.length,
    plotThreads: plotThreads.length,
    ruleDocuments: ruleDocuments.length,
  };
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    output: DEFAULT_OUTPUT,
    stdout: false,
  };

  for (const arg of argv) {
    if (arg === "--stdout") {
      args.stdout = true;
      continue;
    }
    if (arg.startsWith("--output=")) {
      args.output = arg.slice("--output=".length);
      continue;
    }
    throw new Error(`Argomento non riconosciuto: ${arg}`);
  }

  return args;
}

function printSummary(report: SherdanImportReport, output: string) {
  console.log("[ok] Report import Sherdan generato");
  console.log(`output: ${output}`);
  console.log(
    JSON.stringify(
      {
        plannedEntityRows: report.plannedEntityRows,
        uniqueEntityRecords: report.uniqueEntityRecords,
        importedEntities: report.db?.importedEntities ?? null,
        parserWarnings: report.parserWarnings.length,
        unresolvedEntityLinks: report.plan.unresolvedLinks.length,
        unresolvedPcHooks: report.unresolvedPcHooks.length,
      },
      null,
      2,
    ),
  );
}

function countBy<T>(items: T[], keyFor: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFor(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
