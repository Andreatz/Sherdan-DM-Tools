import type { NextRequest } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  entities,
  entitySecrets,
  players,
  playerVisibilityOverrides,
  plotThreads,
  truthClues,
} from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";

const querySchema = z
  .object({
    campaign_id: z.uuid(),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = querySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const [playerRows, clueRows, secretRows] = await Promise.all([
      db
        .select({
          id: players.id,
          name: players.name,
          active: players.active,
        })
        .from(players)
        .where(and(eq(players.campaignId, q.campaign_id), eq(players.active, true)))
        .orderBy(asc(players.name)),
      db
        .select({
          id: truthClues.id,
          kind: truthClues.status,
          label: truthClues.description,
          truthRevealed: truthClues.truthRevealed,
          status: truthClues.status,
          plotThreadTitle: plotThreads.title,
          updatedAt: truthClues.statusUpdatedAt,
        })
        .from(truthClues)
        .leftJoin(plotThreads, eq(plotThreads.id, truthClues.relatedPlotThreadId))
        .where(eq(truthClues.campaignId, q.campaign_id))
        .orderBy(asc(truthClues.statusUpdatedAt)),
      db
        .select({
          id: entitySecrets.id,
          layer: entitySecrets.layer,
          content: entitySecrets.content,
          exploitHint: entitySecrets.exploitHint,
          discoveredAtSession: entitySecrets.discoveredAtSession,
          discoveryNotes: entitySecrets.discoveryNotes,
          entityName: entities.name,
          plotThreadTitle: plotThreads.title,
          createdAt: entitySecrets.createdAt,
        })
        .from(entitySecrets)
        .leftJoin(entities, eq(entities.id, entitySecrets.entityId))
        .leftJoin(plotThreads, eq(plotThreads.id, entitySecrets.plotThreadId))
        .where(eq(entitySecrets.campaignId, q.campaign_id))
        .orderBy(asc(entitySecrets.createdAt)),
    ]);

    const targetIds = [
      ...clueRows.map((clue) => clue.id),
      ...secretRows.map((secret) => secret.id),
    ];

    const overrides =
      playerRows.length === 0 || targetIds.length === 0
        ? []
        : await db
            .select({
              id: playerVisibilityOverrides.id,
              playerId: playerVisibilityOverrides.playerId,
              targetType: playerVisibilityOverrides.targetType,
              targetId: playerVisibilityOverrides.targetId,
              mode: playerVisibilityOverrides.mode,
              notes: playerVisibilityOverrides.notes,
            })
            .from(playerVisibilityOverrides)
            .where(
              and(
                inArray(
                  playerVisibilityOverrides.playerId,
                  playerRows.map((player) => player.id),
                ),
                inArray(playerVisibilityOverrides.targetType, [
                  "truth_clue",
                  "entity_secret",
                ]),
                inArray(playerVisibilityOverrides.targetId, targetIds),
              ),
            );

    const overrideByTarget = new Map<string, Record<string, (typeof overrides)[number]>>();
    for (const override of overrides) {
      const key = `${override.targetType}:${override.targetId}`;
      const row = overrideByTarget.get(key) ?? {};
      row[override.playerId] = override;
      overrideByTarget.set(key, row);
    }

    const targets = [
      ...clueRows.map((clue) => ({
        id: clue.id,
        targetType: "truth_clue" as const,
        label: clue.label,
        detail: clue.truthRevealed,
        status: clue.status === "understood" ? "party_revealed" : "protected",
        layer: null,
        source: clue.plotThreadTitle,
        overrides: overrideByTarget.get(`truth_clue:${clue.id}`) ?? {},
        updatedAt: clue.updatedAt,
      })),
      ...secretRows.map((secret) => ({
        id: secret.id,
        targetType: "entity_secret" as const,
        label: secret.entityName ?? secret.plotThreadTitle ?? "Segreto senza titolo",
        detail: secret.content,
        status: secret.discoveredAtSession ? "party_revealed" : "protected",
        layer: secret.layer,
        source: secret.entityName ? secret.plotThreadTitle : null,
        overrides: overrideByTarget.get(`entity_secret:${secret.id}`) ?? {},
        updatedAt: secret.createdAt,
      })),
    ];

    return ok({ players: playerRows, targets });
  } catch (err) {
    return fail(err);
  }
}
