import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { plotThreadEvents, plotThreads, sessions } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import {
  normalizePlotThreadEventText,
  updatePlotThreadEventInputSchema,
} from "@/lib/validation/plot-thread-event-input";

const idParamSchema = z.object({ id: z.uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

const plotThreadEventColumns = {
  id: plotThreadEvents.id,
  plotThreadId: plotThreadEvents.plotThreadId,
  sessionId: plotThreadEvents.sessionId,
  eventType: plotThreadEvents.eventType,
  description: plotThreadEvents.description,
  publicDescription: plotThreadEvents.publicDescription,
  visibility: plotThreadEvents.visibility,
  occurredAt: plotThreadEvents.occurredAt,
} as const;

async function resolveId(ctx: RouteContext): Promise<string> {
  return idParamSchema.parse(await ctx.params).id;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const rows = await db
      .select(plotThreadEventColumns)
      .from(plotThreadEvents)
      .where(eq(plotThreadEvents.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("plot-thread-event", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updatePlotThreadEventInputSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }
    if (input.sessionId !== undefined && input.sessionId !== null) {
      await assertUpdatedSessionMatchesThread(id, input.sessionId);
    }

    const updateValues: Partial<typeof plotThreadEvents.$inferInsert> = {};
    if (input.sessionId !== undefined) updateValues.sessionId = input.sessionId;
    if (input.eventType !== undefined) updateValues.eventType = input.eventType;
    if (input.description !== undefined)
      updateValues.description = input.description;
    if (input.publicDescription !== undefined) {
      updateValues.publicDescription = normalizePlotThreadEventText(
        input.publicDescription,
      );
    }
    if (input.occurredAt !== undefined) updateValues.occurredAt = input.occurredAt;

    const [row] = await db
      .update(plotThreadEvents)
      .set(updateValues)
      .where(eq(plotThreadEvents.id, id))
      .returning(plotThreadEventColumns);

    if (!row) throw new NotFoundError("plot-thread-event", id);
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

async function assertUpdatedSessionMatchesThread(
  eventId: string,
  sessionId: string,
) {
  const [event] = await db
    .select({
      id: plotThreadEvents.id,
      plotThreadId: plotThreadEvents.plotThreadId,
    })
    .from(plotThreadEvents)
    .where(eq(plotThreadEvents.id, eventId))
    .limit(1);
  if (!event) throw new NotFoundError("plot-thread-event", eventId);

  const [[thread], [session]] = await Promise.all([
    db
      .select({ id: plotThreads.id, campaignId: plotThreads.campaignId })
      .from(plotThreads)
      .where(eq(plotThreads.id, event.plotThreadId))
      .limit(1),
    db
      .select({ id: sessions.id, campaignId: sessions.campaignId })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1),
  ]);
  if (!thread) throw new BadRequestError("Plot thread non trovato.");
  if (!session) throw new BadRequestError("Sessione non trovata.");
  if (thread.campaignId !== session.campaignId) {
    throw new BadRequestError(
      "Plot thread e sessione devono appartenere alla stessa campagna.",
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(plotThreadEvents)
      .where(eq(plotThreadEvents.id, id))
      .returning({ id: plotThreadEvents.id });
    if (!row) throw new NotFoundError("plot-thread-event", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
