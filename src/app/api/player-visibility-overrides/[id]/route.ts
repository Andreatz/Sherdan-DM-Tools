import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { players, playerVisibilityOverrides } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import { withApiTelemetry } from "@/lib/api/request-telemetry";
import { writeAuditLog } from "@/lib/audit-log";
import { updatePlayerOverrideInputSchema } from "@/lib/validation/player-override-input";

const idParamSchema = z.object({ id: z.uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

const overrideColumns = {
  id: playerVisibilityOverrides.id,
  playerId: playerVisibilityOverrides.playerId,
  targetType: playerVisibilityOverrides.targetType,
  targetId: playerVisibilityOverrides.targetId,
  mode: playerVisibilityOverrides.mode,
  notes: playerVisibilityOverrides.notes,
  createdAt: playerVisibilityOverrides.createdAt,
} as const;

async function resolveId(ctx: RouteContext): Promise<string> {
  return idParamSchema.parse(await ctx.params).id;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const rows = await db
      .select(overrideColumns)
      .from(playerVisibilityOverrides)
      .where(eq(playerVisibilityOverrides.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("player-visibility-override", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return withApiTelemetry(req, "/api/player-visibility-overrides/[id]", async ({ requestId }) => {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updatePlayerOverrideInputSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }

    const updateValues: Partial<typeof playerVisibilityOverrides.$inferInsert> =
      {};
    if (input.mode !== undefined) updateValues.mode = input.mode;
    if (input.notes !== undefined) {
      const trimmed = input.notes?.trim();
      updateValues.notes = trimmed ? trimmed : null;
    }

    const [row] = await db
      .update(playerVisibilityOverrides)
      .set(updateValues)
      .where(eq(playerVisibilityOverrides.id, id))
      .returning(overrideColumns);
    if (!row) throw new NotFoundError("player-visibility-override", id);
    const [player] = await db
      .select({ campaignId: players.campaignId })
      .from(players)
      .where(eq(players.id, row.playerId))
      .limit(1);
    await writeAuditLog({
      action: "player_visibility_override.update",
      actorType: "dm",
      playerId: row.playerId,
      campaignId: player?.campaignId ?? null,
      targetType: row.targetType,
      targetId: row.targetId,
      outcome: "succeeded",
      requestId,
      metadata: { mode: row.mode },
    });
    return ok(row);
  } catch (err) {
    return fail(err);
  }
  });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  return withApiTelemetry(_req, "/api/player-visibility-overrides/[id]", async ({ requestId }) => {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(playerVisibilityOverrides)
      .where(eq(playerVisibilityOverrides.id, id))
      .returning(overrideColumns);
    if (!row) throw new NotFoundError("player-visibility-override", id);
    const [player] = await db
      .select({ campaignId: players.campaignId })
      .from(players)
      .where(eq(players.id, row.playerId))
      .limit(1);
    await writeAuditLog({
      action: "player_visibility_override.delete",
      actorType: "dm",
      playerId: row.playerId,
      campaignId: player?.campaignId ?? null,
      targetType: row.targetType,
      targetId: row.targetId,
      outcome: "succeeded",
      requestId,
      metadata: { mode: row.mode },
    });
    return noContent();
  } catch (err) {
    return fail(err);
  }
  });
}
