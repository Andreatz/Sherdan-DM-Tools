import type { NextRequest } from "next/server";
import { type SQL, and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { randomTables } from "@/db/schema";
import { created, fail, ok } from "@/lib/api/respond";
import {
  createRandomTableInputSchema,
  listRandomTablesQuerySchema,
} from "@/lib/validation/random-table-input";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listRandomTablesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [];
    if (q.campaign_id) conditions.push(eq(randomTables.campaignId, q.campaign_id));
    if (q.tag) conditions.push(sql`${q.tag} = ANY(${randomTables.tags})`);
    if (q.search) {
      const pattern = `%${q.search}%`;
      const searchCondition = or(
        ilike(randomTables.name, pattern),
        ilike(randomTables.description, pattern),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const orderBy =
      q.sort === "updated_desc"
        ? desc(randomTables.updatedAt)
        : asc(randomTables.name);

    const rows = await db
      .select()
      .from(randomTables)
      .where(whereClause)
      .orderBy(orderBy)
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
    const input = createRandomTableInputSchema.parse(body);

    const [row] = await db
      .insert(randomTables)
      .values({
        campaignId: input.campaignId ?? null,
        name: input.name,
        description: input.description ?? null,
        entries: input.entries,
        tags: input.tags,
      })
      .returning();

    return created(row);
  } catch (err) {
    return fail(err);
  }
}
