import type { NextRequest } from "next/server";
import { type SQL, and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { plotThreadEvents, plotThreads, sessions } from "@/db/schema";
import { BadRequestError } from "@/lib/api/errors";
import { created, fail, ok } from "@/lib/api/respond";
import {
  createPlotThreadEventInputSchema,
  listPlotThreadEventsQuerySchema,
  normalizePlotThreadEventText,
} from "@/lib/validation/plot-thread-event-input";

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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listPlotThreadEventsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [];
    if (q.plot_thread_id) {
      conditions.push(eq(plotThreadEvents.plotThreadId, q.plot_thread_id));
    }
    if (q.session_id) conditions.push(eq(plotThreadEvents.sessionId, q.session_id));

    const rows = await db
      .select(plotThreadEventColumns)
      .from(plotThreadEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(plotThreadEvents.occurredAt))
      .limit(q.limit)
      .offset(q.offset);

    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = createPlotThreadEventInputSchema.parse(body);
    await assertSessionMatchesThread(input.plotThreadId, input.sessionId ?? null);

    const [row] = await db
      .insert(plotThreadEvents)
      .values({
        plotThreadId: input.plotThreadId,
        sessionId: input.sessionId ?? null,
        eventType: input.eventType,
        description: input.description,
        publicDescription: normalizePlotThreadEventText(input.publicDescription),
        occurredAt: input.occurredAt,
      })
      .returning(plotThreadEventColumns);

    return created(row);
  } catch (err) {
    return fail(err);
  }
}

async function assertSessionMatchesThread(
  plotThreadId: string,
  sessionId: string | null,
) {
  const [thread] = await db
    .select({ id: plotThreads.id, campaignId: plotThreads.campaignId })
    .from(plotThreads)
    .where(eq(plotThreads.id, plotThreadId))
    .limit(1);
  if (!thread) throw new BadRequestError("Plot thread non trovato.");
  if (!sessionId) return;

  const [session] = await db
    .select({ id: sessions.id, campaignId: sessions.campaignId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) throw new BadRequestError("Sessione non trovata.");
  if (session.campaignId !== thread.campaignId) {
    throw new BadRequestError(
      "Plot thread e sessione devono appartenere alla stessa campagna.",
    );
  }
}
