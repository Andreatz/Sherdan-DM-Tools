import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { entityLinks } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import { updateEntityLinkInputSchema } from "@/lib/validation/entity-link-input";

const idParamSchema = z.object({ id: z.uuid() });

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
      .from(entityLinks)
      .where(eq(entityLinks.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("entity-link", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updateEntityLinkInputSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }

    const updateValues: Partial<typeof entityLinks.$inferInsert> = {};
    if (input.relationType !== undefined)
      updateValues.relationType = input.relationType;
    if (input.publicRelationType !== undefined)
      updateValues.publicRelationType = input.publicRelationType;
    if (input.strength !== undefined) updateValues.strength = input.strength;
    if (input.description !== undefined)
      updateValues.description = input.description;
    if (input.visibility !== undefined)
      updateValues.visibility = input.visibility;

    const [row] = await db
      .update(entityLinks)
      .set(updateValues)
      .where(eq(entityLinks.id, id))
      .returning();
    if (!row) throw new NotFoundError("entity-link", id);
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(entityLinks)
      .where(eq(entityLinks.id, id))
      .returning({ id: entityLinks.id });
    if (!row) throw new NotFoundError("entity-link", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
