// pnpm db:export:campaign:markdown -- --name "Sherdan"
// pnpm db:export:campaign:markdown -- --id <uuid> [--out exports/markdown/sherdan]
//
// Re-esporta i contenuti strutturati in Markdown leggibile, separato in file
// vicini ai sorgenti originali Sherdan. Non pretende un round-trip perfetto:
// serve come snapshot umano, sync editoriale e ponte verso repo narrative.

import "dotenv/config";

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  campaigns,
  entities,
  entityIdentities,
  entityLinks,
  entitySecrets,
  pcHooks,
  plotThreads,
  sessions,
  truthClues,
} from "@/db/schema";
import { getLogger } from "@/lib/logger";

const log = getLogger("export-campaign-markdown");

interface Args {
  id?: string;
  name?: string;
  out?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--id" && argv[i + 1]) out.id = argv[++i];
    else if (arg === "--name" && argv[i + 1]) out.name = argv[++i];
    else if (arg === "--out" && argv[i + 1]) out.out = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.id && !args.name) {
    log.error("Specifica --id <uuid> oppure --name <campagna>");
    process.exitCode = 1;
    return;
  }

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(args.id ? eq(campaigns.id, args.id) : eq(campaigns.name, args.name!))
    .limit(1);
  if (!campaign) {
    log.error({ args }, "campagna non trovata");
    process.exitCode = 1;
    return;
  }

  const campaignEntities = await db
    .select()
    .from(entities)
    .where(eq(entities.campaignId, campaign.id));
  const entityIds = campaignEntities.map((row) => row.id);

  const [
    identities,
    secrets,
    links,
    hooks,
    campaignSessions,
    threads,
    clues,
  ] = await Promise.all([
    entityIds.length > 0
      ? db
          .select()
          .from(entityIdentities)
          .where(inArray(entityIdentities.entityId, entityIds))
      : [],
    db.select().from(entitySecrets).where(eq(entitySecrets.campaignId, campaign.id)),
    db.select().from(entityLinks).where(eq(entityLinks.campaignId, campaign.id)),
    db.select().from(pcHooks).where(eq(pcHooks.campaignId, campaign.id)),
    db.select().from(sessions).where(eq(sessions.campaignId, campaign.id)),
    db.select().from(plotThreads).where(eq(plotThreads.campaignId, campaign.id)),
    db.select().from(truthClues).where(eq(truthClues.campaignId, campaign.id)),
  ]);

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..*$/, "")
    .replace("T", "-");
  const outDir =
    args.out ??
    path.join(
      process.cwd(),
      "exports",
      "markdown",
      `${slug(campaign.name)}-${timestamp}`,
    );
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const entityById = new Map(campaignEntities.map((row) => [row.id, row]));
  const identitiesByEntity = groupBy(identities, "entityId");
  const secretsByEntity = groupBy(
    secrets.filter((row) => row.entityId),
    "entityId",
  );
  const linksBySource = groupBy(links, "sourceEntityId");
  const hooksByTarget = groupBy(hooks, "targetEntityId");

  const byType = groupBy(campaignEntities, "type");
  writeFileSync(
    path.join(outDir, "NPC.md"),
    renderEntities(
      "NPC",
      [...(byType.get("npc") ?? []), ...(byType.get("pc") ?? [])],
      { identitiesByEntity, secretsByEntity, linksBySource, hooksByTarget, entityById },
    ),
    "utf8",
  );
  writeFileSync(
    path.join(outDir, "Fazioni.md"),
    renderEntities("Fazioni", byType.get("faction") ?? [], {
      identitiesByEntity,
      secretsByEntity,
      linksBySource,
      hooksByTarget,
      entityById,
    }),
    "utf8",
  );
  writeFileSync(
    path.join(outDir, "Lore.md"),
    renderEntities(
      "Lore",
      [
        ...(byType.get("location") ?? []),
        ...(byType.get("organization") ?? []),
        ...(byType.get("deity") ?? []),
        ...(byType.get("item") ?? []),
        ...(byType.get("monster") ?? []),
      ],
      { identitiesByEntity, secretsByEntity, linksBySource, hooksByTarget, entityById },
    ),
    "utf8",
  );
  writeFileSync(
    path.join(outDir, "Campagna.md"),
    renderCampaign(campaignSessions, threads, clues),
    "utf8",
  );

  log.info(
    {
      outDir,
      entities: campaignEntities.length,
      sessions: campaignSessions.length,
      plotThreads: threads.length,
      truthClues: clues.length,
    },
    "export markdown completato",
  );
  process.stdout.write(`${outDir}\n`);
}

type EntityRow = typeof entities.$inferSelect;
type LinkRow = typeof entityLinks.$inferSelect;
type IdentityRow = typeof entityIdentities.$inferSelect;
type SecretRow = typeof entitySecrets.$inferSelect;
type HookRow = typeof pcHooks.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;
type ThreadRow = typeof plotThreads.$inferSelect;
type ClueRow = typeof truthClues.$inferSelect;

function renderEntities(
  title: string,
  rows: EntityRow[],
  deps: {
    identitiesByEntity: Map<string, IdentityRow[]>;
    secretsByEntity: Map<string, SecretRow[]>;
    linksBySource: Map<string, LinkRow[]>;
    hooksByTarget: Map<string, HookRow[]>;
    entityById: Map<string, EntityRow>;
  },
) {
  const parts = [`# ${title}`, ""];
  for (const entity of rows.sort((a, b) => a.name.localeCompare(b.name))) {
    parts.push(`## ${entity.name}`, "");
    parts.push(`- Tipo: ${entity.type}`);
    parts.push(`- Visibilita': ${entity.visibility}`);
    if (entity.tags.length > 0) parts.push(`- Tag: ${entity.tags.join(", ")}`);
    if (entity.publicDescription) {
      parts.push("", "### Versione pubblica", "", entity.publicDescription);
    }
    if (entity.description) {
      parts.push("", "### Verita' GM", "", entity.description);
    }

    const identities = deps.identitiesByEntity.get(entity.id) ?? [];
    if (identities.length > 0) {
      parts.push("", "### Identita'", "");
      for (const identity of identities) {
        parts.push(
          `- **${identity.name}**${identity.isTrueIdentity ? " (vera)" : ""}`,
        );
        if (identity.appearance) parts.push(`  - Aspetto: ${identity.appearance}`);
        if (identity.voice) parts.push(`  - Voce: ${identity.voice}`);
      }
    }

    const secrets = deps.secretsByEntity.get(entity.id) ?? [];
    if (secrets.length > 0) {
      parts.push("", "### Segreti", "");
      for (const secret of secrets) {
        parts.push(`- **${secret.layer}**: ${secret.content}`);
        if (secret.exploitHint) parts.push(`  - Sfruttabile: ${secret.exploitHint}`);
      }
    }

    const outgoing = deps.linksBySource.get(entity.id) ?? [];
    if (outgoing.length > 0) {
      parts.push("", "### Link", "");
      for (const link of outgoing) {
        const target = deps.entityById.get(link.targetEntityId);
        parts.push(
          `- ${link.relationType} -> ${target?.name ?? link.targetEntityId}`,
        );
      }
    }

    const hooks = deps.hooksByTarget.get(entity.id) ?? [];
    if (hooks.length > 0) {
      parts.push("", "### Hook PG", "");
      for (const hook of hooks) {
        const pc = deps.entityById.get(hook.pcEntityId);
        parts.push(`- ${pc?.name ?? hook.pcEntityId}: ${hook.hookDescription}`);
        if (hook.potentialArc) parts.push(`  - Arco: ${hook.potentialArc}`);
      }
    }
    parts.push("");
  }
  return `${parts.join("\n").trim()}\n`;
}

function renderCampaign(
  campaignSessions: SessionRow[],
  threads: ThreadRow[],
  clues: ClueRow[],
) {
  const parts = ["# Campagna", "", "## Sessioni", ""];
  for (const session of campaignSessions.sort((a, b) => a.number - b.number)) {
    parts.push(`### Sessione ${session.number}${session.title ? ` - ${session.title}` : ""}`, "");
    if (session.date) parts.push(`Data: ${session.date}`, "");
    if (session.recap) parts.push(session.recap, "");
    if (session.dmNotes) parts.push("#### Note DM", "", session.dmNotes, "");
    if (session.prepNotes) parts.push("#### Prep", "", session.prepNotes, "");
  }

  parts.push("## Plot thread", "");
  for (const thread of threads.sort((a, b) => a.title.localeCompare(b.title))) {
    parts.push(`### ${thread.title}`, "", `Status: ${thread.status}`, "");
    if (thread.publicDescription) parts.push(thread.publicDescription, "");
    if (thread.description) parts.push("#### Verita' GM", "", thread.description, "");
  }

  parts.push("## Briciole di verita'", "");
  for (const clue of clues) {
    parts.push(`- **${clue.status}** ${clue.description}`);
    parts.push(`  - Verita': ${clue.truthRevealed}`);
  }
  return `${parts.join("\n").trim()}\n`;
}

function groupBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value !== "string") continue;
    const bucket = map.get(value) ?? [];
    bucket.push(row);
    map.set(value, bucket);
  }
  return map;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

void main();
