import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { campaigns } from "@/db/schema";
import {
  BadRequestError,
  NotFoundError,
} from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";

// CRUD `campaigns` — item-level (GET, PATCH, DELETE per id).

const idParamSchema = z.object({ id: z.uuid() });

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().nullable().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveId(ctx: RouteContext): Promise<string> {
  return idParamSchema.parse(await ctx.params).id;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const rows = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("campaign", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updateSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }
    const [row] = await db
      .update(campaigns)
      .set(input)
      .where(eq(campaigns.id, id))
      .returning();
    if (!row) throw new NotFoundError("campaign", id);
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(campaigns)
      .where(eq(campaigns.id, id))
      .returning({ id: campaigns.id });
    if (!row) throw new NotFoundError("campaign", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
