import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { pcHooks } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import { updatePcHookInputSchema } from "@/lib/validation/pc-hook-input";

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
      .from(pcHooks)
      .where(eq(pcHooks.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("pc-hook", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updatePcHookInputSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }

    const updateValues: Partial<typeof pcHooks.$inferInsert> = {};
    if (input.hookDescription !== undefined)
      updateValues.hookDescription = input.hookDescription;
    if (input.potentialArc !== undefined)
      updateValues.potentialArc = input.potentialArc;
    if (input.usedInSession !== undefined)
      updateValues.usedInSession = input.usedInSession;
    if (input.status !== undefined) updateValues.status = input.status;

    const [row] = await db
      .update(pcHooks)
      .set(updateValues)
      .where(eq(pcHooks.id, id))
      .returning();

    if (!row) throw new NotFoundError("pc-hook", id);
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(pcHooks)
      .where(eq(pcHooks.id, id))
      .returning({ id: pcHooks.id });
    if (!row) throw new NotFoundError("pc-hook", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
