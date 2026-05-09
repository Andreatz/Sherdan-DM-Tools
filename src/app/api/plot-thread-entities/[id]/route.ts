import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { plotThreadEntities } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import {
  normalizePlotThreadEntityNotes,
  updatePlotThreadEntityInputSchema,
} from "@/lib/validation/plot-thread-entity-input";

const idParamSchema = z.object({ id: z.uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

const plotThreadEntityColumns = {
  id: plotThreadEntities.id,
  plotThreadId: plotThreadEntities.plotThreadId,
  entityId: plotThreadEntities.entityId,
  role: plotThreadEntities.role,
  notes: plotThreadEntities.notes,
  createdAt: plotThreadEntities.createdAt,
} as const;

async function resolveId(ctx: RouteContext): Promise<string> {
  return idParamSchema.parse(await ctx.params).id;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const rows = await db
      .select(plotThreadEntityColumns)
      .from(plotThreadEntities)
      .where(eq(plotThreadEntities.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("plot-thread-entity", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updatePlotThreadEntityInputSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }

    const updateValues: Partial<typeof plotThreadEntities.$inferInsert> = {};
    if (input.role !== undefined) updateValues.role = input.role;
    if (input.notes !== undefined) {
      updateValues.notes = normalizePlotThreadEntityNotes(input.notes);
    }

    const [row] = await db
      .update(plotThreadEntities)
      .set(updateValues)
      .where(eq(plotThreadEntities.id, id))
      .returning(plotThreadEntityColumns);

    if (!row) throw new NotFoundError("plot-thread-entity", id);
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(plotThreadEntities)
      .where(eq(plotThreadEntities.id, id))
      .returning({ id: plotThreadEntities.id });
    if (!row) throw new NotFoundError("plot-thread-entity", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
