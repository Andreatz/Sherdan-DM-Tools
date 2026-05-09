import type { NextRequest } from "next/server";
import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { created, fail, ok } from "@/lib/api/respond";
import {
  createSessionInputSchema,
  listSessionsQuerySchema,
  normalizeSessionText,
} from "@/lib/validation/session-input";

const sessionListColumns = {
  id: sessions.id,
  campaignId: sessions.campaignId,
  number: sessions.number,
  title: sessions.title,
  date: sessions.date,
} as const;

const sessionDetailColumns = {
  ...sessionListColumns,
  recap: sessions.recap,
  dmNotes: sessions.dmNotes,
  prepNotes: sessions.prepNotes,
  createdAt: sessions.createdAt,
  updatedAt: sessions.updatedAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listSessionsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const rows = await db
      .select(q.include_notes ? sessionDetailColumns : sessionListColumns)
      .from(sessions)
      .where(eq(sessions.campaignId, q.campaign_id))
      .orderBy(asc(sessions.number))
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
    const input = createSessionInputSchema.parse(body);

    const [row] = await db.transaction(async (tx) => {
      const [next] = await tx
        .select({
          number: sql<number>`coalesce(max(${sessions.number}), 0) + 1`,
        })
        .from(sessions)
        .where(eq(sessions.campaignId, input.campaignId));

      return tx
        .insert(sessions)
        .values({
          campaignId: input.campaignId,
          number: next?.number ?? 1,
          title: normalizeSessionText(input.title),
          date: input.date ?? null,
          recap: normalizeSessionText(input.recap),
          dmNotes: normalizeSessionText(input.dmNotes),
          prepNotes: normalizeSessionText(input.prepNotes),
        })
        .returning(sessionDetailColumns);
    });

    return created(row);
  } catch (err) {
    return fail(err);
  }
}
