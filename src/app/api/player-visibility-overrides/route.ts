import type { NextRequest } from "next/server";
import { type SQL, and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { players, playerVisibilityOverrides } from "@/db/schema";
import { BadRequestError, ConflictError } from "@/lib/api/errors";
import { created, fail, ok } from "@/lib/api/respond";
import {
  createPlayerOverrideInputSchema,
  listPlayerOverridesQuerySchema,
} from "@/lib/validation/player-override-input";

// Override di visibilita' per (player, target). Solo CRUD lato DM: nessuna
// route player-facing usa direttamente questi endpoint (gli override
// vengono applicati nelle route `/api/player/*`).

const overrideColumns = {
  id: playerVisibilityOverrides.id,
  playerId: playerVisibilityOverrides.playerId,
  targetType: playerVisibilityOverrides.targetType,
  targetId: playerVisibilityOverrides.targetId,
  mode: playerVisibilityOverrides.mode,
  notes: playerVisibilityOverrides.notes,
  createdAt: playerVisibilityOverrides.createdAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listPlayerOverridesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [];
    if (q.player_id) {
      conditions.push(eq(playerVisibilityOverrides.playerId, q.player_id));
    }
    if (q.target_type) {
      conditions.push(eq(playerVisibilityOverrides.targetType, q.target_type));
    }
    if (q.target_id) {
      conditions.push(eq(playerVisibilityOverrides.targetId, q.target_id));
    }
    if (q.campaign_id) {
      // Filtro indiretto: solo override di player appartenenti alla
      // campagna richiesta. Usiamo un INNER JOIN.
      const rows = await db
        .select(overrideColumns)
        .from(playerVisibilityOverrides)
        .innerJoin(players, eq(players.id, playerVisibilityOverrides.playerId))
        .where(
          and(eq(players.campaignId, q.campaign_id), ...conditions),
        )
        .orderBy(asc(playerVisibilityOverrides.createdAt));
      return ok(rows);
    }

    const rows = await db
      .select(overrideColumns)
      .from(playerVisibilityOverrides)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(playerVisibilityOverrides.createdAt));
    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = createPlayerOverrideInputSchema.parse(body);

    const [player] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, input.playerId))
      .limit(1);
    if (!player) throw new BadRequestError("Player non trovato.");

    try {
      const [row] = await db
        .insert(playerVisibilityOverrides)
        .values({
          playerId: input.playerId,
          targetType: input.targetType,
          targetId: input.targetId,
          mode: input.mode,
          notes: input.notes?.trim() ? input.notes.trim() : null,
        })
        .returning(overrideColumns);
      return created(row);
    } catch (err) {
      if (err instanceof Error && /uq_pvo_player_target/.test(err.message)) {
        throw new ConflictError(
          "Esiste gia' un override per questa coppia player + target. Modificalo via PATCH.",
        );
      }
      throw err;
    }
  } catch (err) {
    return fail(err);
  }
}
