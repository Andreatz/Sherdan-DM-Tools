import type { NextRequest } from "next/server";
import { type SQL, and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { plotThreads } from "@/db/schema";
import { created, fail, ok } from "@/lib/api/respond";
import {
  createPlotThreadInputSchema,
  listPlotThreadsQuerySchema,
  normalizePlotThreadText,
} from "@/lib/validation/plot-thread-input";

const plotThreadListColumns = {
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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listPlotThreadsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [eq(plotThreads.campaignId, q.campaign_id)];
    if (q.status) conditions.push(eq(plotThreads.status, q.status));

    const rows = await db
      .select(plotThreadListColumns)
      .from(plotThreads)
      .where(and(...conditions))
      .orderBy(asc(plotThreads.title))
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
    const input = createPlotThreadInputSchema.parse(body);

    const [row] = await db
      .insert(plotThreads)
      .values({
        campaignId: input.campaignId,
        title: input.title,
        description: normalizePlotThreadText(input.description),
        publicDescription: normalizePlotThreadText(input.publicDescription),
        status: input.status,
        priority: input.priority ?? null,
        visibility: input.visibility,
      })
      .returning(plotThreadListColumns);

    return created(row);
  } catch (err) {
    return fail(err);
  }
}
