import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { plotThreads } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import {
  normalizePlotThreadText,
  updatePlotThreadInputSchema,
} from "@/lib/validation/plot-thread-input";

const idParamSchema = z.object({ id: z.uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

const plotThreadColumns = {
  id: plotThreads.id,
  campaignId: plotThreads.campaignId,
  title: plotThreads.title,
  description: plotThreads.description,
  publicDescription: plotThreads.publicDescription,
  status: plotThreads.status,
  priority: plotThreads.priority,
  visibility: plotThreads.visibility,
  lastAdvancedAt: plotThreads.lastAdvancedAt,
  createdAt: plotThreads.createdAt,
  updatedAt: plotThreads.updatedAt,
} as const;

async function resolveId(ctx: RouteContext): Promise<string> {
  return idParamSchema.parse(await ctx.params).id;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const rows = await db
      .select(plotThreadColumns)
      .from(plotThreads)
      .where(eq(plotThreads.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("plot-thread", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updatePlotThreadInputSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }

    const updateValues: Partial<typeof plotThreads.$inferInsert> = {};
    if (input.title !== undefined) updateValues.title = input.title;
    if (input.description !== undefined)
      updateValues.description = normalizePlotThreadText(input.description);
    if (input.publicDescription !== undefined) {
      updateValues.publicDescription = normalizePlotThreadText(
        input.publicDescription,
      );
    }
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.priority !== undefined) updateValues.priority = input.priority;
    if (input.visibility !== undefined) updateValues.visibility = input.visibility;

    const [row] = await db
      .update(plotThreads)
      .set(updateValues)
      .where(eq(plotThreads.id, id))
      .returning(plotThreadColumns);

    if (!row) throw new NotFoundError("plot-thread", id);
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(plotThreads)
      .where(eq(plotThreads.id, id))
      .returning({ id: plotThreads.id });
    if (!row) throw new NotFoundError("plot-thread", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
