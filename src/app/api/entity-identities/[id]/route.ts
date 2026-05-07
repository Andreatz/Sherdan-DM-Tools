import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { entityIdentities } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import { updateEntityIdentityInputSchema } from "@/lib/validation/entity-identity-input";

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
      .from(entityIdentities)
      .where(eq(entityIdentities.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("entity-identity", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updateEntityIdentityInputSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }

    const updateValues: Partial<typeof entityIdentities.$inferInsert> = {};
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.isTrueIdentity !== undefined)
      updateValues.isTrueIdentity = input.isTrueIdentity;
    if (input.appearance !== undefined) updateValues.appearance = input.appearance;
    if (input.voice !== undefined) updateValues.voice = input.voice;
    if (input.mannerisms !== undefined) updateValues.mannerisms = input.mannerisms;
    if (input.activeFromSession !== undefined)
      updateValues.activeFromSession = input.activeFromSession;
    if (input.activeUntilSession !== undefined)
      updateValues.activeUntilSession = input.activeUntilSession;
    if (input.visibility !== undefined) updateValues.visibility = input.visibility;
    if (input.notes !== undefined) updateValues.notes = input.notes;

    const [row] = await db
      .update(entityIdentities)
      .set(updateValues)
      .where(eq(entityIdentities.id, id))
      .returning();

    if (!row) throw new NotFoundError("entity-identity", id);
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(entityIdentities)
      .where(eq(entityIdentities.id, id))
      .returning({ id: entityIdentities.id });
    if (!row) throw new NotFoundError("entity-identity", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
