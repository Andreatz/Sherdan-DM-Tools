import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { entitySecrets } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import { updateEntitySecretInputSchema } from "@/lib/validation/entity-secret-input";

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
      .from(entitySecrets)
      .where(eq(entitySecrets.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("entity-secret", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updateEntitySecretInputSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }

    const updateValues: Partial<typeof entitySecrets.$inferInsert> = {};
    if (input.entityId !== undefined) updateValues.entityId = input.entityId;
    if (input.plotThreadId !== undefined)
      updateValues.plotThreadId = input.plotThreadId;
    if (input.layer !== undefined) updateValues.layer = input.layer;
    if (input.content !== undefined) updateValues.content = input.content;
    if (input.exploitHint !== undefined)
      updateValues.exploitHint = input.exploitHint;
    if (input.discoveredAtSession !== undefined)
      updateValues.discoveredAtSession = input.discoveredAtSession;
    if (input.discoveryNotes !== undefined)
      updateValues.discoveryNotes = input.discoveryNotes;

    const [row] = await db
      .update(entitySecrets)
      .set(updateValues)
      .where(eq(entitySecrets.id, id))
      .returning();

    if (!row) throw new NotFoundError("entity-secret", id);
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(entitySecrets)
      .where(eq(entitySecrets.id, id))
      .returning({ id: entitySecrets.id });
    if (!row) throw new NotFoundError("entity-secret", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
