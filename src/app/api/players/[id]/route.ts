import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { players } from "@/db/schema";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import { hashPlayerCode } from "@/lib/security/player-auth";
import { updatePlayerInputSchema } from "@/lib/validation/player-input";

const idParamSchema = z.object({ id: z.uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

const playerColumns = {
  id: players.id,
  campaignId: players.campaignId,
  name: players.name,
  active: players.active,
  lastSeenAt: players.lastSeenAt,
  createdAt: players.createdAt,
  updatedAt: players.updatedAt,
} as const;

async function resolveId(ctx: RouteContext): Promise<string> {
  return idParamSchema.parse(await ctx.params).id;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const rows = await db
      .select(playerColumns)
      .from(players)
      .where(eq(players.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("player", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updatePlayerInputSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }

    const updateValues: Partial<typeof players.$inferInsert> = {};
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.active !== undefined) updateValues.active = input.active;
    if (input.code !== undefined) {
      const codeHash = hashPlayerCode(input.code);
      const [existing] = await db
        .select({ id: players.id })
        .from(players)
        .where(eq(players.codeHash, codeHash))
        .limit(1);
      if (existing && existing.id !== id) {
        throw new ConflictError("Codice gia' in uso. Scegline uno diverso.");
      }
      updateValues.codeHash = codeHash;
    }

    try {
      const [row] = await db
        .update(players)
        .set(updateValues)
        .where(eq(players.id, id))
        .returning(playerColumns);
      if (!row) throw new NotFoundError("player", id);
      return ok(row);
    } catch (err) {
      if (err instanceof Error && /uq_players_campaign_name/.test(err.message)) {
        throw new ConflictError(
          "Esiste gia' un player con questo nome in questa campagna.",
        );
      }
      throw err;
    }
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(players)
      .where(eq(players.id, id))
      .returning({ id: players.id });
    if (!row) throw new NotFoundError("player", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
