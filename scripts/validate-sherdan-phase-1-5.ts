import "dotenv/config";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import {
  buildSherdanBootstrapPlan,
  type SherdanBootstrapSources,
} from "@/lib/import/sherdan-bootstrap-plan";
import {
  countResolvedPcHookAssignments,
  resolvePcHookEntityKeys,
} from "@/lib/import/sherdan-pc-hook-resolution";

const SHERDAN_NAME = "Sherdan";
const OUTPUT = path.join("docs", "sherdan-phase-1-5-validation.md");
const PRIVATE_MARKERS = ["\u{1F512}", "\u{1F4A1}", "GM-Only"];

interface ValidationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

async function main() {
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    const plan = buildSherdanBootstrapPlan(readSherdanSources());
    const [campaign] = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.name, SHERDAN_NAME))
      .limit(1);

    if (!campaign) {
      throw new Error("Campagna Sherdan non trovata nel DB.");
    }

    const entities = await db
      .select()
      .from(schema.entities)
      .where(eq(schema.entities.campaignId, campaign.id));
    const importedEntities = entities.filter((entity) =>
      entity.tags.includes("sherdan-import"),
    );
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));

    const identities = await db.select().from(schema.entityIdentities);
    const secrets = await db
      .select()
      .from(schema.entitySecrets)
      .where(eq(schema.entitySecrets.campaignId, campaign.id));
    const pcHooks = await db
      .select()
      .from(schema.pcHooks)
      .where(eq(schema.pcHooks.campaignId, campaign.id));
    const sessions = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.campaignId, campaign.id));

    const checks = buildChecks({
      plan,
      importedEntities,
      identities,
      secrets,
      pcHooks,
      sessions,
      entityById,
    });

    const markdown = renderReport(checks);
    const outputPath = path.resolve(process.cwd(), OUTPUT);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, markdown, "utf8");

    const failed = checks.filter((check) => !check.passed);
    console.log("[ok] Validazione Sherdan Fase 1.5 completata");
    console.log(`output: ${OUTPUT}`);
    console.log(
      JSON.stringify(
        {
          checks: checks.length,
          passed: checks.length - failed.length,
          failed: failed.length,
          pcHooks: pcHooks.length,
          secrets: secrets.length,
          importedEntities: importedEntities.length,
        },
        null,
        2,
      ),
    );

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await sql.end();
  }
}

function buildChecks(input: {
  plan: ReturnType<typeof buildSherdanBootstrapPlan>;
  importedEntities: (typeof schema.entities.$inferSelect)[];
  identities: (typeof schema.entityIdentities.$inferSelect)[];
  secrets: (typeof schema.entitySecrets.$inferSelect)[];
  pcHooks: (typeof schema.pcHooks.$inferSelect)[];
  sessions: (typeof schema.sessions.$inferSelect)[];
  entityById: Map<string, typeof schema.entities.$inferSelect>;
}): ValidationCheck[] {
  const {
    plan,
    importedEntities,
    identities,
    secrets,
    pcHooks,
    sessions,
    entityById,
  } = input;
  const requiredEntities = [
    "Malakor",
    "La Synapse",
    "L'Eclissi",
    "Loggia",
    "Lunacupa",
    "Noel Estragon",
  ];
  const missingRequiredEntities = requiredEntities.filter(
    (name) => !importedEntities.some((entity) => entity.name.includes(name)),
  );
  const publicMarkerEntities = importedEntities.filter((entity) =>
    containsPrivateMarker(entity.publicDescription),
  );
  const gmMarkerEntities = importedEntities.filter((entity) =>
    containsPrivateMarker(entity.description),
  );
  const malakor = importedEntities.find((entity) => entity.name.includes("Malakor"));
  const malakorIdentities = identities.filter(
    (identity) => identity.entityId === malakor?.id,
  );
  const noel = importedEntities.find((entity) => entity.name === "Noel Estragon");
  const noelIdentities = identities.filter((identity) => identity.entityId === noel?.id);
  const secretsByLayer = countBy(secrets, (secret) => secret.layer);
  const hookCountsByPc = countBy(pcHooks, (hook) => {
    return entityById.get(hook.pcEntityId)?.name ?? "unknown";
  });
  const expectedHookAssignments = countResolvedPcHookAssignments(plan);
  const unresolvedPlanHooks = plan.pcHooks.filter(
    (hook) => resolvePcHookEntityKeys(plan.entities, hook.pcName).length === 0,
  );

  return [
    {
      name: "Wiki Sherdan navigabile",
      passed:
        importedEntities.length >= 50 &&
        missingRequiredEntities.length === 0 &&
        sessions.length === 6,
      detail: `${importedEntities.length} entita' importate, ${sessions.length} sessioni, mancanti: ${missingRequiredEntities.length === 0 ? "nessuna" : missingRequiredEntities.join(", ")}.`,
    },
    {
      name: "Marker privati fuori dal publicDescription",
      passed: publicMarkerEntities.length === 0 && gmMarkerEntities.length > 0,
      detail: `${publicMarkerEntities.length} publicDescription con marker privati (${publicMarkerEntities.map((entity) => entity.name).join(", ") || "nessuna"}); ${gmMarkerEntities.length} descrizioni GM conservano marker/nota privata.`,
    },
    {
      name: "Identita' multiple di Malakor",
      passed:
        malakorIdentities.some((identity) => identity.isTrueIdentity) &&
        malakorIdentities.some((identity) =>
          identity.name.toLocaleLowerCase("it-IT").includes("dante"),
        ),
      detail: malakorIdentities
        .map((identity) => `${identity.name} (${identity.isTrueIdentity ? "true" : "cover"})`)
        .join("; "),
    },
    {
      name: "Identita' multiple di Noel",
      passed: ["noel", "yancarlos", "lust"].every((name) =>
        noelIdentities.some((identity) =>
          identity.name.toLocaleLowerCase("it-IT").includes(name),
        ),
      ),
      detail: noelIdentities
        .map((identity) => `${identity.name} (${identity.isTrueIdentity ? "true" : "cover"})`)
        .join("; "),
    },
    {
      name: "Segreti stratificati sui tre layer",
      passed:
        (secretsByLayer.surface ?? 0) > 0 &&
        (secretsByLayer.intermediate ?? 0) > 0 &&
        (secretsByLayer.deep ?? 0) > 0,
      detail: `surface=${secretsByLayer.surface ?? 0}, intermediate=${secretsByLayer.intermediate ?? 0}, deep=${secretsByLayer.deep ?? 0}, totale=${secrets.length}.`,
    },
    {
      name: "Agganci PG popolati come pc_hooks",
      passed:
        unresolvedPlanHooks.length === 0 && pcHooks.length === expectedHookAssignments,
      detail: `${plan.pcHooks.length} righe sorgente risolte in ${expectedHookAssignments} assegnazioni; DB=${pcHooks.length}; per PG: ${Object.entries(hookCountsByPc)
        .map(([name, count]) => `${name}=${count}`)
        .join(", ")}.`,
    },
  ];
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

function renderReport(checks: ValidationCheck[]): string {
  return [
    "# Sherdan Fase 1.5 validation",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    table([
      ["Check", "Status", "Detail"],
      ...checks.map((check) => [
        check.name,
        check.passed ? "PASS" : "FAIL",
        check.detail,
      ]),
    ]),
    "",
  ].join("\n");
}

function containsPrivateMarker(value: string | null): boolean {
  return PRIVATE_MARKERS.some((marker) => value?.includes(marker));
}

function countBy<T>(
  items: T[],
  keyFor: (item: T) => string,
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFor(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function table(rows: string[][]): string {
  const [header, ...body] = rows;
  if (!header) return "";
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
