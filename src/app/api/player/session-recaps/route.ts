import type { NextRequest } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import { requirePlayerAccess } from "@/lib/security/player-access";
import { projectSessionRecapsForPlayer } from "@/lib/security/player-sessions";
import { listPlayerSessionRecapsQuerySchema } from "@/lib/validation/player-session-input";

const playerSafeColumns = {
  id: sessions.id,
  campaignId: sessions.campaignId,
  number: sessions.number,
  title: sessions.title,
  date: sessions.date,
  recap: sessions.recap,
  updatedAt: sessions.updatedAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    requirePlayerAccess(req);

    const url = new URL(req.url);
    const q = listPlayerSessionRecapsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const rows = await db
      .select(playerSafeColumns)
      .from(sessions)
      .where(and(eq(sessions.campaignId, q.campaign_id), isNotNull(sessions.recap)))
      .orderBy(desc(sessions.number))
      .limit(q.limit)
      .offset(q.offset);

    return ok(projectSessionRecapsForPlayer(rows));
  } catch (err) {
    return fail(err);
  }
}
