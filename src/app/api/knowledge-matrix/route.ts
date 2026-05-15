import type { NextRequest } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  entities,
  entityType,
  players,
  playerVisibilityOverrides,
} from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";

const querySchema = z
  .object({
    campaign_id: z.uuid(),
    type: z.enum(entityType.enumValues).default("npc"),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = querySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const [playerRows, entityRows] = await Promise.all([
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
          id: entities.id,
          name: entities.name,
          type: entities.type,
          visibility: entities.visibility,
          publicDescription: entities.publicDescription,
        })
        .from(entities)
        .where(and(eq(entities.campaignId, q.campaign_id), eq(entities.type, q.type)))
        .orderBy(asc(entities.name))
        .limit(120),
    ]);

    const overrides =
      playerRows.length === 0 || entityRows.length === 0
        ? []
        : await db
            .select({
              id: playerVisibilityOverrides.id,
              playerId: playerVisibilityOverrides.playerId,
              targetId: playerVisibilityOverrides.targetId,
              mode: playerVisibilityOverrides.mode,
              notes: playerVisibilityOverrides.notes,
            })
            .from(playerVisibilityOverrides)
            .where(
              and(
                eq(playerVisibilityOverrides.targetType, "entity"),
                inArray(
                  playerVisibilityOverrides.playerId,
                  playerRows.map((player) => player.id),
                ),
                inArray(
                  playerVisibilityOverrides.targetId,
                  entityRows.map((entity) => entity.id),
                ),
              ),
            );

    const overrideByTarget = new Map<string, Record<string, (typeof overrides)[number]>>();
    for (const override of overrides) {
      const row = overrideByTarget.get(override.targetId) ?? {};
      row[override.playerId] = override;
      overrideByTarget.set(override.targetId, row);
    }

    return ok({
      players: playerRows,
      entities: entityRows.map((entity) => ({
        ...entity,
        overrides: overrideByTarget.get(entity.id) ?? {},
      })),
    });
  } catch (err) {
    return fail(err);
  }
}
