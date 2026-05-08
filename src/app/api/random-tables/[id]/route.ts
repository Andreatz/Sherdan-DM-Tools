import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { randomTables } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import { updateRandomTableInputSchema } from "@/lib/validation/random-table-input";

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
      .from(randomTables)
      .where(eq(randomTables.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("random-table", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updateRandomTableInputSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }

    const updateValues: Partial<typeof randomTables.$inferInsert> = {};
    if (input.campaignId !== undefined) updateValues.campaignId = input.campaignId;
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined)
      updateValues.description = input.description;
    if (input.entries !== undefined) updateValues.entries = input.entries;
    if (input.tags !== undefined) updateValues.tags = input.tags;

    const [row] = await db
      .update(randomTables)
      .set(updateValues)
      .where(eq(randomTables.id, id))
      .returning();

    if (!row) throw new NotFoundError("random-table", id);
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(randomTables)
      .where(eq(randomTables.id, id))
      .returning({ id: randomTables.id });
    if (!row) throw new NotFoundError("random-table", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
