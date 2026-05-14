import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db/client";
import {
  campaigns,
  entities,
  entitySecrets,
  pcHooks,
  playerDashboardStates,
  plotThreads,
  sessions,
  truthClues,
} from "@/db/schema";

import type { ChatGptBridgeAudience, ChatGptBridgeContext } from "./types";

function visibilityFilter(audience: ChatGptBridgeAudience) {
  return audience === "player" ? ne(entities.visibility, "dm_only") : undefined;
}

export async function getCampaignSnapshot(campaignId: string) {
  const [row] = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      description: campaigns.description,
      settings: campaigns.settings,
    })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  return row ?? null;
}

export async function getRecentSessions(
  campaignId: string,
  limit: number,
  audience: ChatGptBridgeAudience,
) {
  const rows = await db
    .select({
      id: sessions.id,
      number: sessions.number,
      title: sessions.title,
      date: sessions.date,
      recap: sessions.recap,
      dmNotes: sessions.dmNotes,
      prepNotes: sessions.prepNotes,
    })
    .from(sessions)
    .where(eq(sessions.campaignId, campaignId))
    .orderBy(desc(sessions.number))
    .limit(limit);

  return rows.reverse().map((row) =>
    audience === "player"
      ? { ...row, dmNotes: undefined, prepNotes: undefined }
      : row,
  );
}

export async function getActivePlotThreads(
  campaignId: string,
  audience: ChatGptBridgeAudience,
) {
  const conditions = [eq(plotThreads.campaignId, campaignId)];
  if (audience === "player") conditions.push(ne(plotThreads.visibility, "dm_only"));
  const rows = await db
    .select({
      id: plotThreads.id,
      title: plotThreads.title,
      description: plotThreads.description,
      publicDescription: plotThreads.publicDescription,
      status: plotThreads.status,
      priority: plotThreads.priority,
      visibility: plotThreads.visibility,
    })
    .from(plotThreads)
    .where(and(...conditions))
    .orderBy(desc(plotThreads.priority), plotThreads.title)
    .limit(50);

  return rows.map((row) =>
    audience === "player" ? { ...row, description: undefined } : row,
  );
}

export async function getTruthClues(
  campaignId: string,
  audience: ChatGptBridgeAudience,
) {
  const rows = await db
    .select({
      id: truthClues.id,
      description: truthClues.description,
      truthRevealed: truthClues.truthRevealed,
      status: truthClues.status,
      statusNotes: truthClues.statusNotes,
    })
    .from(truthClues)
    .where(eq(truthClues.campaignId, campaignId))
    .orderBy(desc(truthClues.createdAt))
    .limit(80);

  return rows.map((row) =>
    audience === "player" ? { ...row, truthRevealed: undefined } : row,
  );
}

export async function getRelevantEntitySecrets(campaignId: string) {
  return db
    .select({
      id: entitySecrets.id,
      layer: entitySecrets.layer,
      content: entitySecrets.content,
      exploitHint: entitySecrets.exploitHint,
      entityName: entities.name,
      plotThreadTitle: plotThreads.title,
    })
    .from(entitySecrets)
    .leftJoin(entities, eq(entitySecrets.entityId, entities.id))
    .leftJoin(plotThreads, eq(entitySecrets.plotThreadId, plotThreads.id))
    .where(eq(entitySecrets.campaignId, campaignId))
    .orderBy(desc(entitySecrets.createdAt))
    .limit(80);
}

export async function getPcHooks(campaignId: string) {
  const pc = alias(entities, "pc_entities");
  const target = alias(entities, "target_entities");
  return db
    .select({
      id: pcHooks.id,
      pcName: pc.name,
      targetName: target.name,
      hookDescription: pcHooks.hookDescription,
      potentialArc: pcHooks.potentialArc,
      status: pcHooks.status,
    })
    .from(pcHooks)
    .innerJoin(pc, eq(pcHooks.pcEntityId, pc.id))
    .innerJoin(target, eq(pcHooks.targetEntityId, target.id))
    .where(eq(pcHooks.campaignId, campaignId))
    .orderBy(desc(pcHooks.createdAt))
    .limit(80);
}

export async function getFactionSnapshot(
  campaignId: string,
  audience: ChatGptBridgeAudience,
) {
  const conditions = [eq(entities.campaignId, campaignId), eq(entities.type, "faction")];
  const visible = visibilityFilter(audience);
  if (visible) conditions.push(visible);
  const rows = await db
    .select({
      id: entities.id,
      type: entities.type,
      name: entities.name,
      description: entities.description,
      publicDescription: entities.publicDescription,
      tags: entities.tags,
      visibility: entities.visibility,
      properties: entities.properties,
    })
    .from(entities)
    .where(and(...conditions))
    .orderBy(entities.name)
    .limit(60);

  return rows.map((row) =>
    audience === "player" ? { ...row, description: undefined, properties: undefined } : row,
  );
}

export async function getLocationContext(
  locationId: string,
  audience: ChatGptBridgeAudience,
) {
  const conditions = [eq(entities.id, locationId)];
  const visible = visibilityFilter(audience);
  if (visible) conditions.push(visible);
  const [row] = await db
    .select({
      id: entities.id,
      type: entities.type,
      name: entities.name,
      description: entities.description,
      publicDescription: entities.publicDescription,
      tags: entities.tags,
      visibility: entities.visibility,
      properties: entities.properties,
    })
    .from(entities)
    .where(and(...conditions))
    .limit(1);
  if (!row) return null;
  return audience === "player"
    ? { ...row, description: undefined, properties: undefined }
    : row;
}

export async function getPlayerFacingState(campaignId: string) {
  const [state] = await db
    .select()
    .from(playerDashboardStates)
    .where(eq(playerDashboardStates.campaignId, campaignId))
    .limit(1);
  if (!state) return null;

  const activeEntities =
    state.activeEntityIds.length > 0
      ? await db
          .select({
            id: entities.id,
            name: entities.name,
            publicDescription: entities.publicDescription,
          })
          .from(entities)
          .where(inArray(entities.id, state.activeEntityIds))
      : [];

  return {
    sceneTitle: state.sceneTitle,
    sceneText: state.sceneText,
    handouts: state.handouts,
    activeEntities,
  };
}

export async function collectChatGptBridgeContext(input: {
  campaignId: string;
  audience: ChatGptBridgeAudience;
  locationId?: string;
  includeCampaignSnapshot: boolean;
  includeRecentSessions: boolean;
  recentSessionsLimit: number;
  includePlotThreads: boolean;
  includeTruthClues: boolean;
  includeSecrets: boolean;
  includePcHooks: boolean;
  includeFactions: boolean;
  includePlayerFacingState: boolean;
}): Promise<ChatGptBridgeContext> {
  const [
    campaign,
    recentSessions,
    plotThreadRows,
    clueRows,
    secretRows,
    hookRows,
    factionRows,
    location,
    playerFacingState,
  ] = await Promise.all([
    input.includeCampaignSnapshot
      ? getCampaignSnapshot(input.campaignId)
      : Promise.resolve(null),
    input.includeRecentSessions
      ? getRecentSessions(input.campaignId, input.recentSessionsLimit, input.audience)
      : Promise.resolve([]),
    input.includePlotThreads
      ? getActivePlotThreads(input.campaignId, input.audience)
      : Promise.resolve([]),
    input.includeTruthClues
      ? getTruthClues(input.campaignId, input.audience)
      : Promise.resolve([]),
    input.includeSecrets && input.audience === "gm"
      ? getRelevantEntitySecrets(input.campaignId)
      : Promise.resolve([]),
    input.includePcHooks && input.audience === "gm" ? getPcHooks(input.campaignId) : Promise.resolve([]),
    input.includeFactions
      ? getFactionSnapshot(input.campaignId, input.audience)
      : Promise.resolve([]),
    input.locationId
      ? getLocationContext(input.locationId, input.audience)
      : Promise.resolve(null),
    input.includePlayerFacingState
      ? getPlayerFacingState(input.campaignId)
      : Promise.resolve(null),
  ]);

  return {
    campaign,
    recentSessions,
    plotThreads: plotThreadRows,
    truthClues: clueRows,
    secrets: secretRows,
    pcHooks: hookRows,
    factions: factionRows,
    location,
    playerFacingState,
  };
}
