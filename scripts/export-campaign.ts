// pnpm db:export:campaign -- --id <uuid> [--out backups/<name>.json]
// pnpm db:export:campaign -- --name "Sherdan"
//
// Esporta una singola campagna come JSON autoportante: include tutte le
// righe collegate (entities, identita', segreti, link, hooks, sessioni,
// session_entities, plot_threads, plot_thread_entities, plot_thread_events,
// truth_clues, encounters, encounter_participants, loot_bundles).
//
// Non include: rule_documents, random_tables (sono globali o non scoped),
// generation_log (log operativo, non parte dei contenuti campagna),
// embeddings (rumorosi e ricalcolabili — usa `pnpm db:embed:sherdan`).
//
// Lo script e' read-only: nessuna scrittura sul DB.

import "dotenv/config";

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  campaigns,
  encounterParticipants,
  encounters,
  entities,
  entityIdentities,
  entityLinks,
  entitySecrets,
  lootBundles,
  pcHooks,
  plotThreadEntities,
  plotThreadEvents,
  plotThreads,
  sessionEntities,
  sessions,
  truthClues,
} from "@/db/schema";
import { getLogger } from "@/lib/logger";

const log = getLogger("export-campaign");

interface CliArgs {
  id?: string;
  name?: string;
  out?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--id" && argv[i + 1]) {
      out.id = argv[++i];
      continue;
    }
    if (arg === "--name" && argv[i + 1]) {
      out.name = argv[++i];
      continue;
    }
    if (arg === "--out" && argv[i + 1]) {
      out.out = argv[++i];
      continue;
    }
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

  const campaignId = campaign.id;
  log.info({ id: campaignId, name: campaign.name }, "export in corso");

  // Tutto in parallelo: le query sono indipendenti tra loro.
  const [
    campaignEntities,
    campaignSessions,
    campaignPlotThreads,
    campaignTruthClues,
    campaignEncounters,
    campaignLootBundles,
  ] = await Promise.all([
    db.select().from(entities).where(eq(entities.campaignId, campaignId)),
    db.select().from(sessions).where(eq(sessions.campaignId, campaignId)),
    db
      .select()
      .from(plotThreads)
      .where(eq(plotThreads.campaignId, campaignId)),
    db
      .select()
      .from(truthClues)
      .where(eq(truthClues.campaignId, campaignId)),
    db.select().from(encounters).where(eq(encounters.campaignId, campaignId)),
    db
      .select()
      .from(lootBundles)
      .where(eq(lootBundles.campaignId, campaignId)),
  ]);

  const entityIds = campaignEntities.map((e) => e.id);
  const sessionIds = campaignSessions.map((s) => s.id);
  const plotThreadIds = campaignPlotThreads.map((p) => p.id);
  const encounterIds = campaignEncounters.map((e) => e.id);

  // Strip embedding dai payload (rumoroso, ricalcolabile).
  const slimEntities = campaignEntities.map(({ embedding: _, ...rest }) => {
    void _;
    return rest;
  });

  const [
    identitiesRows,
    secretsRows,
    linksRows,
    hooksRows,
    sessionEntitiesRows,
    plotThreadEntitiesRows,
    plotThreadEventsRows,
    encounterParticipantsRows,
  ] = await Promise.all([
    entityIds.length > 0
      ? db
          .select()
          .from(entityIdentities)
          .where(inArray(entityIdentities.entityId, entityIds))
      : Promise.resolve([] as (typeof entityIdentities.$inferSelect)[]),
    entityIds.length > 0
      ? db
          .select()
          .from(entitySecrets)
          .where(eq(entitySecrets.campaignId, campaignId))
      : Promise.resolve([] as (typeof entitySecrets.$inferSelect)[]),
    db.select().from(entityLinks).where(eq(entityLinks.campaignId, campaignId)),
    db.select().from(pcHooks).where(eq(pcHooks.campaignId, campaignId)),
    sessionIds.length > 0
      ? db
          .select()
          .from(sessionEntities)
          .where(inArray(sessionEntities.sessionId, sessionIds))
      : Promise.resolve([] as (typeof sessionEntities.$inferSelect)[]),
    plotThreadIds.length > 0
      ? db
          .select()
          .from(plotThreadEntities)
          .where(inArray(plotThreadEntities.plotThreadId, plotThreadIds))
      : Promise.resolve([] as (typeof plotThreadEntities.$inferSelect)[]),
    plotThreadIds.length > 0
      ? db
          .select()
          .from(plotThreadEvents)
          .where(inArray(plotThreadEvents.plotThreadId, plotThreadIds))
      : Promise.resolve([] as (typeof plotThreadEvents.$inferSelect)[]),
    encounterIds.length > 0
      ? db
          .select()
          .from(encounterParticipants)
          .where(
            and(
              inArray(encounterParticipants.encounterId, encounterIds),
            ),
          )
      : Promise.resolve([] as (typeof encounterParticipants.$inferSelect)[]),
  ]);

  const payload = {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    campaign,
    counts: {
      entities: slimEntities.length,
      identities: identitiesRows.length,
      secrets: secretsRows.length,
      links: linksRows.length,
      pcHooks: hooksRows.length,
      sessions: campaignSessions.length,
      sessionEntities: sessionEntitiesRows.length,
      plotThreads: campaignPlotThreads.length,
      plotThreadEntities: plotThreadEntitiesRows.length,
      plotThreadEvents: plotThreadEventsRows.length,
      truthClues: campaignTruthClues.length,
      encounters: campaignEncounters.length,
      encounterParticipants: encounterParticipantsRows.length,
      lootBundles: campaignLootBundles.length,
    },
    data: {
      entities: slimEntities,
      identities: identitiesRows,
      secrets: secretsRows,
      links: linksRows,
      pcHooks: hooksRows,
      sessions: campaignSessions,
      sessionEntities: sessionEntitiesRows,
      plotThreads: campaignPlotThreads,
      plotThreadEntities: plotThreadEntitiesRows,
      plotThreadEvents: plotThreadEventsRows,
      truthClues: campaignTruthClues,
      encounters: campaignEncounters,
      encounterParticipants: encounterParticipantsRows,
      lootBundles: campaignLootBundles,
    },
  };

  const backupsDir = path.join(process.cwd(), "backups");
  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true });
  }
  const safeName = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..*$/, "")
    .replace("T", "-");
  const outFile =
    args.out ?? path.join(backupsDir, `campaign-${safeName}-${timestamp}.json`);

  writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");

  log.info(
    { outFile, counts: payload.counts },
    "export campagna completato",
  );
  process.stdout.write(`${outFile}\n`);
}

void main();
