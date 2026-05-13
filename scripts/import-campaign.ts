// pnpm db:import:campaign -- backups/campaign-sherdan-YYYYMMDD-HHMMSS.json
// pnpm db:import:campaign -- <file> --name "Sherdan copia"
//
// Importa un export JSON creato da `pnpm db:export:campaign` come nuova
// campagna. Per default rigenera gli UUID e rimappa tutte le FK: questo evita
// collisioni quando si importa una campagna condivisa o una copia locale.

import "dotenv/config";

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

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

const log = getLogger("import-campaign");

interface Args {
  file?: string;
  name?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;
    if (!arg.startsWith("--") && !out.file) {
      out.file = arg;
      continue;
    }
    if (arg === "--name" && argv[i + 1]) {
      out.name = argv[++i];
      continue;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    log.error("Specifica il file JSON esportato.");
    process.exitCode = 1;
    return;
  }

  const payload = JSON.parse(readFileSync(args.file, "utf8")) as ExportPayload;
  if (payload.formatVersion !== 1 || !payload.campaign || !payload.data) {
    log.error({ file: args.file }, "formato export non riconosciuto");
    process.exitCode = 1;
    return;
  }

  const maps = buildIdMaps(payload);
  const importedName = args.name ?? `${payload.campaign.name} (import)`;
  const importedCampaignId = maps.campaign.get(payload.campaign.id)!;
  const data = {
    entities: rows(payload, "entities"),
    sessions: rows(payload, "sessions"),
    plotThreads: rows(payload, "plotThreads"),
    truthClues: rows(payload, "truthClues"),
    encounters: rows(payload, "encounters"),
    identities: rows(payload, "identities"),
    secrets: rows(payload, "secrets"),
    links: rows(payload, "links"),
    pcHooks: rows(payload, "pcHooks"),
    sessionEntities: rows(payload, "sessionEntities"),
    plotThreadEntities: rows(payload, "plotThreadEntities"),
    plotThreadEvents: rows(payload, "plotThreadEvents"),
    encounterParticipants: rows(payload, "encounterParticipants"),
    lootBundles: rows(payload, "lootBundles"),
  };

  await db.transaction(async (tx) => {
    await insertMany(tx, campaigns, [
      prepareRow({
        ...payload.campaign,
        id: importedCampaignId,
        name: importedName,
      }),
    ]);

    await insertMany(
      tx,
      entities,
      data.entities.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.entities, row.id),
          campaignId: importedCampaignId,
          parentId: mapNullable(maps.entities, row.parentId),
          embedding: null,
        }),
      ),
    );

    await insertMany(
      tx,
      sessions,
      data.sessions.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.sessions, row.id),
          campaignId: importedCampaignId,
        }),
      ),
    );

    await insertMany(
      tx,
      plotThreads,
      data.plotThreads.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.plotThreads, row.id),
          campaignId: importedCampaignId,
        }),
      ),
    );

    await insertMany(
      tx,
      truthClues,
      data.truthClues.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.truthClues, row.id),
          campaignId: importedCampaignId,
          relatedPlotThreadId: mapNullable(
            maps.plotThreads,
            row.relatedPlotThreadId,
          ),
          plantedInSession: mapNullable(maps.sessions, row.plantedInSession),
          relatedEntities: mapStringList(row.relatedEntities ?? [], maps.entities),
        }),
      ),
    );

    await insertMany(
      tx,
      encounters,
      data.encounters.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.encounters, row.id),
          campaignId: importedCampaignId,
          locationId: mapNullable(maps.entities, row.locationId),
          plotThreadId: mapNullable(maps.plotThreads, row.plotThreadId),
          usedInSession: mapNullable(maps.sessions, row.usedInSession),
        }),
      ),
    );

    await insertMany(
      tx,
      entityIdentities,
      data.identities.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.identities, row.id),
          entityId: mapped(maps.entities, row.entityId),
          activeFromSession: mapNullable(
            maps.sessions,
            row.activeFromSession,
          ),
          activeUntilSession: mapNullable(
            maps.sessions,
            row.activeUntilSession,
          ),
        }),
      ),
    );

    await insertMany(
      tx,
      entitySecrets,
      data.secrets.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.secrets, row.id),
          campaignId: importedCampaignId,
          entityId: mapNullable(maps.entities, row.entityId),
          plotThreadId: mapNullable(maps.plotThreads, row.plotThreadId),
          discoveredAtSession: mapNullable(
            maps.sessions,
            row.discoveredAtSession,
          ),
        }),
      ),
    );

    await insertMany(
      tx,
      entityLinks,
      data.links.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.links, row.id),
          campaignId: importedCampaignId,
          sourceEntityId: mapped(maps.entities, row.sourceEntityId),
          targetEntityId: mapped(maps.entities, row.targetEntityId),
        }),
      ),
    );

    await insertMany(
      tx,
      pcHooks,
      data.pcHooks.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.pcHooks, row.id),
          campaignId: importedCampaignId,
          pcEntityId: mapped(maps.entities, row.pcEntityId),
          targetEntityId: mapped(maps.entities, row.targetEntityId),
          usedInSession: mapNullable(maps.sessions, row.usedInSession),
        }),
      ),
    );

    await insertMany(
      tx,
      sessionEntities,
      data.sessionEntities.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.sessionEntities, row.id),
          sessionId: mapped(maps.sessions, row.sessionId),
          entityId: mapped(maps.entities, row.entityId),
        }),
      ),
    );

    await insertMany(
      tx,
      plotThreadEntities,
      data.plotThreadEntities.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.plotThreadEntities, row.id),
          plotThreadId: mapped(maps.plotThreads, row.plotThreadId),
          entityId: mapped(maps.entities, row.entityId),
        }),
      ),
    );

    await insertMany(
      tx,
      plotThreadEvents,
      data.plotThreadEvents.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.plotThreadEvents, row.id),
          plotThreadId: mapped(maps.plotThreads, row.plotThreadId),
          sessionId: mapNullable(maps.sessions, row.sessionId),
        }),
      ),
    );

    await insertMany(
      tx,
      encounterParticipants,
      data.encounterParticipants.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.encounterParticipants, row.id),
          encounterId: mapped(maps.encounters, row.encounterId),
          entityId: mapped(maps.entities, row.entityId),
        }),
      ),
    );

    await insertMany(
      tx,
      lootBundles,
      data.lootBundles.map((row) =>
        prepareRow({
          ...row,
          id: mapped(maps.lootBundles, row.id),
          campaignId: importedCampaignId,
          encounterId: mapNullable(maps.encounters, row.encounterId),
          sessionId: mapNullable(maps.sessions, row.sessionId),
          items: remapLootItems(row.items, maps.entities),
        }),
      ),
    );
  });

  log.info(
    { id: importedCampaignId, name: importedName, counts: payload.counts },
    "import campagna completato",
  );
  process.stdout.write(`${importedCampaignId}\n`);
}

interface AnyRow extends Record<string, unknown> {
  id: string;
  name?: string;
  parentId?: string | null;
  relatedPlotThreadId?: string | null;
  plantedInSession?: string | null;
  relatedEntities?: string[];
  locationId?: string | null;
  plotThreadId?: string | null;
  usedInSession?: string | null;
  entityId?: string | null;
  entity_id?: string | null;
  activeFromSession?: string | null;
  activeUntilSession?: string | null;
  discoveredAtSession?: string | null;
  sourceEntityId?: string;
  targetEntityId?: string;
  pcEntityId?: string;
  sessionId?: string | null;
  encounterId?: string | null;
  items?: unknown;
}

interface ExportPayload {
  formatVersion: number;
  campaign: AnyRow;
  counts: Record<string, number>;
  data: Record<string, AnyRow[]>;
}

function buildIdMaps(payload: ExportPayload) {
  return {
    campaign: mapRows([payload.campaign]),
    entities: mapRows(payload.data.entities ?? []),
    identities: mapRows(payload.data.identities ?? []),
    secrets: mapRows(payload.data.secrets ?? []),
    links: mapRows(payload.data.links ?? []),
    pcHooks: mapRows(payload.data.pcHooks ?? []),
    sessions: mapRows(payload.data.sessions ?? []),
    sessionEntities: mapRows(payload.data.sessionEntities ?? []),
    plotThreads: mapRows(payload.data.plotThreads ?? []),
    plotThreadEntities: mapRows(payload.data.plotThreadEntities ?? []),
    plotThreadEvents: mapRows(payload.data.plotThreadEvents ?? []),
    truthClues: mapRows(payload.data.truthClues ?? []),
    encounters: mapRows(payload.data.encounters ?? []),
    encounterParticipants: mapRows(payload.data.encounterParticipants ?? []),
    lootBundles: mapRows(payload.data.lootBundles ?? []),
  };
}

function rows(payload: ExportPayload, key: string): AnyRow[] {
  return payload.data[key] ?? [];
}

function mapRows(rows: AnyRow[]) {
  return new Map(rows.map((row) => [String(row.id), randomUUID()]));
}

function mapped(map: Map<string, string>, id: unknown) {
  if (typeof id !== "string") throw new Error("ID mancante nel payload import");
  const value = map.get(id);
  if (!value) throw new Error(`ID non rimappato nel payload import: ${id}`);
  return value;
}

function mapNullable(map: Map<string, string>, id: unknown) {
  return typeof id === "string" ? (map.get(id) ?? null) : null;
}

function mapStringList(ids: string[], map: Map<string, string>) {
  return ids.map((id) => mapped(map, id));
}

function prepareRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    if (key.endsWith("At") && typeof value === "string") {
      out[key] = new Date(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Drizzle table-specific insert builders are intentionally generic. This
// import script works across many tables with a normalized object payload, so
// a tiny dynamic boundary is cleaner than duplicating 15 insert helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertMany(tx: any, table: any, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  await tx.insert(table).values(rows);
}

function remapLootItems(items: unknown, entityMap: Map<string, string>) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const clone = { ...(item as Record<string, unknown>) };
    if (typeof clone.entityId === "string") {
      clone.entityId = entityMap.get(clone.entityId) ?? clone.entityId;
    }
    if (typeof clone.entity_id === "string") {
      clone.entity_id = entityMap.get(clone.entity_id) ?? clone.entity_id;
    }
    return clone;
  });
}

void main();
