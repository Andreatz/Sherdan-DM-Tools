import type { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { plotThreads } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";

const listPlotThreadsQuerySchema = z
  .object({
    campaign_id: z.uuid(),
  })
  .strict();

const plotThreadListColumns = {
  id: plotThreads.id,
  campaignId: plotThreads.campaignId,
  title: plotThreads.title,
  status: plotThreads.status,
  priority: plotThreads.priority,
  updatedAt: plotThreads.updatedAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listPlotThreadsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const rows = await db
      .select(plotThreadListColumns)
      .from(plotThreads)
      .where(eq(plotThreads.campaignId, q.campaign_id))
      .orderBy(asc(plotThreads.title));

    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}
