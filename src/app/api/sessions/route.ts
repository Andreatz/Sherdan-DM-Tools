import type { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";

const listSessionsQuerySchema = z
  .object({
    campaign_id: z.uuid(),
  })
  .strict();

const sessionListColumns = {
  id: sessions.id,
  campaignId: sessions.campaignId,
  number: sessions.number,
  title: sessions.title,
  date: sessions.date,
} as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listSessionsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const rows = await db
      .select(sessionListColumns)
      .from(sessions)
      .where(eq(sessions.campaignId, q.campaign_id))
      .orderBy(asc(sessions.number));

    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}
