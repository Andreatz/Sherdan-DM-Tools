import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  campaigns,
  entities,
  entitySecrets,
  playerDashboardStates,
  playerEntityExposures,
} from "@/db/schema";
import { NotFoundError } from "@/lib/api/errors";
import type { PlayerCookiePayload } from "@/lib/security/player-access";
import { loadPlayerOverrides } from "@/lib/security/player-overrides";

import type {
  DashboardHandout,
  DashboardInitiative,
  DashboardMapFog,
  ExposureMode,
} from "./schema";
import {
  dashboardHandoutSchema,
  dashboardInitiativeSchema,
  dashboardMapFogSchema,
} from "./schema";

type Visibility = "dm_only" | "discovered" | "public";

interface DashboardStateRow {
  id: string;
  campaignId: string;
  sceneTitle: string | null;
  sceneText: string | null;
  imageUrl: string | null;
  mapImageUrl: string | null;
  mapFogData: DashboardMapFog;
  handouts: DashboardHandout[];
  activeEntityIds: string[];
  initiative: DashboardInitiative | null;
  updatedAt: Date;
}

interface EntityRow {
  id: string;
  campaignId: string;
  type: string;
  name: string;
  description: string | null;
  publicDescription: string | null;
  parentId: string | null;
  visibility: Visibility;
  updatedAt: Date;
}

interface SecretRow {
  id: string;
  entityId: string | null;
  layer: string;
  content: string;
  discoveryNotes: string | null;
  discoveredAtSession: string | null;
}

export interface DmDashboardEntity {
  id: string;
  type: string;
  name: string;
  visibility: Visibility;
  exposureMode: ExposureMode;
  publicDescription: string | null;
}

export interface PlayerDashboardEntity {
  id: string;
  campaignId: string;
  type: string;
  name: string;
  parentId: string | null;
  visibility: "public" | "discovered";
  exposureMode: ExposureMode;
  description: string;
  discoveredSecrets: Array<{
    id: string;
    layer: string;
    content: string;
    discoveryNotes: string | null;
  }>;
  updatedAt: Date;
}

export interface PlayerDashboardSnapshot {
  campaign: {
    id: string;
    name: string;
  };
  scene: {
    title: string;
    text: string;
    imageUrl: string | null;
    updatedAt: Date | null;
  };
  entities: PlayerDashboardEntity[];
  map: {
    imageUrl: string | null;
    fog: DashboardMapFog;
  };
  handouts: DashboardHandout[];
  initiative: DashboardInitiative | null;
}

export async function ensureDashboardState(
  campaignId: string,
): Promise<DashboardStateRow> {
  const existing = await fetchDashboardState(campaignId);
  if (existing) return existing;

  const [row] = await db
    .insert(playerDashboardStates)
    .values({
      campaignId,
      sceneTitle: "",
      sceneText: "",
      imageUrl: null,
      mapImageUrl: null,
      mapFogData: { reveals: [] },
      handouts: [],
      activeEntityIds: [],
      initiative: null,
    })
    .returning();

  if (!row) throw new NotFoundError("campaign", campaignId);
  return normalizeDashboardState(row);
}

export async function fetchDashboardState(
  campaignId: string,
): Promise<DashboardStateRow | null> {
  const [row] = await db
    .select()
    .from(playerDashboardStates)
    .where(eq(playerDashboardStates.campaignId, campaignId))
    .limit(1);
  return row ? normalizeDashboardState(row) : null;
}

export async function getDmDashboard(campaignId: string): Promise<{
  state: DashboardStateRow;
  entities: DmDashboardEntity[];
}> {
  const state = await ensureDashboardState(campaignId);
  const rows = await db
    .select({
      id: entities.id,
      type: entities.type,
      name: entities.name,
      publicDescription: entities.publicDescription,
      visibility: entities.visibility,
      exposureMode: playerEntityExposures.mode,
    })
    .from(entities)
    .leftJoin(
      playerEntityExposures,
      eq(playerEntityExposures.entityId, entities.id),
    )
    .where(eq(entities.campaignId, campaignId))
    .orderBy(asc(entities.name));

  return {
    state,
    entities: rows.map((row) => ({
      ...row,
      exposureMode: row.exposureMode ?? "public_description",
    })),
  };
}

export async function getPlayerDashboardSnapshot(
  campaignId: string,
  payload: PlayerCookiePayload,
): Promise<PlayerDashboardSnapshot> {
  const [campaign] = await db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new NotFoundError("campaign", campaignId);

  const state = await ensureDashboardState(campaignId);
  const activeEntityIds = uniqueIds(state.activeEntityIds);
  const entityRows =
    activeEntityIds.length > 0
      ? await fetchPlayerVisibleEntities(campaignId, activeEntityIds, payload)
      : [];
  const entitiesForPlayer = await projectDashboardEntitiesForPlayer(
    entityRows,
    payload,
  );

  return {
    campaign,
    scene: {
      title: state.sceneTitle ?? "",
      text: state.sceneText ?? "",
      imageUrl: state.imageUrl,
      updatedAt: state.updatedAt ?? null,
    },
    entities: entitiesForPlayer,
    map: {
      imageUrl: state.mapImageUrl,
      fog: state.mapFogData,
    },
    handouts: state.handouts,
    initiative: state.initiative,
  };
}

export async function projectDashboardEntitiesForPlayer(
  rows: EntityRow[],
  payload: Pick<PlayerCookiePayload, "playerId">,
): Promise<PlayerDashboardEntity[]> {
  if (rows.length === 0) return [];

  const overrides = payload.playerId
    ? await loadPlayerOverrides(payload.playerId)
    : null;
  const entityOverride = overrides?.entity ?? {
    hidden: new Set<string>(),
    revealed: new Set<string>(),
  };
  const secretOverride = overrides?.entity_secret ?? {
    hidden: new Set<string>(),
    revealed: new Set<string>(),
  };

  const visibleRows = rows
    .filter((row) => !entityOverride.hidden.has(row.id))
    .filter(
      (row) =>
        row.visibility === "public" ||
        row.visibility === "discovered" ||
        entityOverride.revealed.has(row.id),
    )
    .map((row) =>
      row.visibility === "dm_only" && entityOverride.revealed.has(row.id)
        ? { ...row, visibility: "discovered" as const }
        : row,
    );

  if (visibleRows.length === 0) return [];

  const [exposures, secrets] = await Promise.all([
    db
      .select({
        entityId: playerEntityExposures.entityId,
        mode: playerEntityExposures.mode,
      })
      .from(playerEntityExposures)
      .where(
        inArray(
          playerEntityExposures.entityId,
          visibleRows.map((row) => row.id),
        ),
      ),
    fetchVisibleSecrets(
      visibleRows.map((row) => row.id),
      secretOverride.hidden,
      secretOverride.revealed,
    ),
  ]);

  const exposureByEntityId = new Map(
    exposures.map((row) => [row.entityId, row.mode] as const),
  );
  const secretsByEntityId = groupSecretsByEntityId(secrets);

  return visibleRows.map((row) => {
    const exposureMode = exposureByEntityId.get(row.id) ?? "public_description";
    const discoveredSecrets = secretsByEntityId.get(row.id) ?? [];
    return {
      id: row.id,
      campaignId: row.campaignId,
      type: row.type,
      name: row.name,
      parentId: row.parentId,
      visibility: row.visibility === "public" ? "public" : "discovered",
      exposureMode,
      description: composeEntityDescription(row, exposureMode, discoveredSecrets),
      discoveredSecrets: discoveredSecrets.map((secret) => ({
        id: secret.id,
        layer: secret.layer,
        content: secret.content,
        discoveryNotes: secret.discoveryNotes,
      })),
      updatedAt: row.updatedAt,
    };
  });
}

async function fetchPlayerVisibleEntities(
  campaignId: string,
  ids: string[],
  payload: Pick<PlayerCookiePayload, "playerId">,
): Promise<EntityRow[]> {
  const overrides = payload.playerId
    ? (await loadPlayerOverrides(payload.playerId)).entity
    : { hidden: new Set<string>(), revealed: new Set<string>() };

  const rows = await db
    .select({
      id: entities.id,
      campaignId: entities.campaignId,
      type: entities.type,
      name: entities.name,
      description: entities.description,
      publicDescription: entities.publicDescription,
      parentId: entities.parentId,
      visibility: entities.visibility,
      updatedAt: entities.updatedAt,
    })
    .from(entities)
    .where(and(eq(entities.campaignId, campaignId), inArray(entities.id, ids)));

  return rows.filter(
    (row) =>
      !overrides.hidden.has(row.id) &&
      (row.visibility === "public" ||
        row.visibility === "discovered" ||
        overrides.revealed.has(row.id)),
  );
}

async function fetchVisibleSecrets(
  entityIds: string[],
  hidden: ReadonlySet<string>,
  revealed: ReadonlySet<string>,
): Promise<SecretRow[]> {
  if (entityIds.length === 0) return [];
  const rows = await db
    .select({
      id: entitySecrets.id,
      entityId: entitySecrets.entityId,
      layer: entitySecrets.layer,
      content: entitySecrets.content,
      discoveryNotes: entitySecrets.discoveryNotes,
      discoveredAtSession: entitySecrets.discoveredAtSession,
    })
    .from(entitySecrets)
    .where(inArray(entitySecrets.entityId, entityIds));

  return rows.filter(
    (row) =>
      row.entityId &&
      !hidden.has(row.id) &&
      (row.discoveredAtSession !== null || revealed.has(row.id)),
  );
}

function composeEntityDescription(
  row: EntityRow,
  exposureMode: ExposureMode,
  secrets: SecretRow[],
): string {
  if (exposureMode === "name_only") return "";

  const base = row.publicDescription?.trim() ?? "";
  if (exposureMode === "public_description" || secrets.length === 0) {
    return base;
  }

  const secretText = secrets
    .map((secret) => `- ${secret.content.trim()}`)
    .filter((line) => line !== "-")
    .join("\n");
  if (!secretText) return base;
  return [base, `Segreti scoperti:\n${secretText}`].filter(Boolean).join("\n\n");
}

function groupSecretsByEntityId(rows: SecretRow[]): Map<string, SecretRow[]> {
  const map = new Map<string, SecretRow[]>();
  for (const row of rows) {
    if (!row.entityId) continue;
    const list = map.get(row.entityId) ?? [];
    list.push(row);
    map.set(row.entityId, list);
  }
  return map;
}

function normalizeDashboardState(
  row: typeof playerDashboardStates.$inferSelect,
): DashboardStateRow {
  return {
    ...row,
    mapFogData: dashboardMapFogSchema.catch({ reveals: [] }).parse(row.mapFogData),
    handouts: dashboardHandoutSchema.array().catch([]).parse(row.handouts),
    activeEntityIds: row.activeEntityIds ?? [],
    initiative: row.initiative
      ? dashboardInitiativeSchema.catch({ active: false, turns: [] }).parse(row.initiative)
      : null,
  };
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}
