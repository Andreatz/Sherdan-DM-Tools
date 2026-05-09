import type { NextRequest } from "next/server";
import { type SQL, and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { entities, plotThreadEntities, plotThreads } from "@/db/schema";
import { BadRequestError } from "@/lib/api/errors";
import { created, fail, ok } from "@/lib/api/respond";
import {
  createPlotThreadEntityInputSchema,
  listPlotThreadEntitiesQuerySchema,
  normalizePlotThreadEntityNotes,
} from "@/lib/validation/plot-thread-entity-input";

const plotThreadEntityColumns = {
  id: plotThreadEntities.id,
  plotThreadId: plotThreadEntities.plotThreadId,
  entityId: plotThreadEntities.entityId,
  role: plotThreadEntities.role,
  notes: plotThreadEntities.notes,
  createdAt: plotThreadEntities.createdAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listPlotThreadEntitiesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [];
    if (q.plot_thread_id) {
      conditions.push(eq(plotThreadEntities.plotThreadId, q.plot_thread_id));
    }
    if (q.entity_id) conditions.push(eq(plotThreadEntities.entityId, q.entity_id));

    const rows = await db
      .select(plotThreadEntityColumns)
      .from(plotThreadEntities)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(plotThreadEntities.createdAt))
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
    const input = createPlotThreadEntityInputSchema.parse(body);
    await assertSameCampaign(input.plotThreadId, input.entityId);

    const [row] = await db
      .insert(plotThreadEntities)
      .values({
        plotThreadId: input.plotThreadId,
        entityId: input.entityId,
        role: input.role,
        notes: normalizePlotThreadEntityNotes(input.notes),
      })
      .returning(plotThreadEntityColumns);

    return created(row);
  } catch (err) {
    return fail(err);
  }
}

async function assertSameCampaign(plotThreadId: string, entityId: string) {
  const [[thread], [entity]] = await Promise.all([
    db
      .select({ id: plotThreads.id, campaignId: plotThreads.campaignId })
      .from(plotThreads)
      .where(eq(plotThreads.id, plotThreadId))
      .limit(1),
    db
      .select({ id: entities.id, campaignId: entities.campaignId })
      .from(entities)
      .where(eq(entities.id, entityId))
      .limit(1),
  ]);

  if (!thread) throw new BadRequestError("Plot thread non trovato.");
  if (!entity) throw new BadRequestError("Entity non trovata.");
  if (thread.campaignId !== entity.campaignId) {
    throw new BadRequestError(
      "Plot thread ed entity devono appartenere alla stessa campagna.",
    );
  }
}
