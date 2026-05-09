import type { NextRequest } from "next/server";
import { type SQL, and, asc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/db/client";
import { entities } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import {
  buildMonsterFacets,
  filterMonsterRecords,
  listMonstersQuerySchema,
  paginateMonsterRecords,
  parseMonsterRecord,
} from "@/lib/encounters";

const monsterColumns = {
  id: entities.id,
  name: entities.name,
  description: entities.description,
  publicDescription: entities.publicDescription,
  properties: entities.properties,
  tags: entities.tags,
  updatedAt: entities.updatedAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listMonstersQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [
      eq(entities.campaignId, q.campaign_id),
      eq(entities.type, "monster"),
    ];

    if (q.search) {
      const pattern = `%${q.search}%`;
      const searchCondition = or(
        ilike(entities.name, pattern),
        ilike(entities.description, pattern),
        ilike(entities.publicDescription, pattern),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const rows = await db
      .select(monsterColumns)
      .from(entities)
      .where(and(...conditions))
      .orderBy(asc(entities.name))
      .limit(500);

    const parsed = rows
      .map(parseMonsterRecord)
      .filter((record): record is NonNullable<typeof record> => record !== null);
    const facets = buildMonsterFacets(parsed);
    const filtered = filterMonsterRecords(parsed, q);
    const paged = paginateMonsterRecords(filtered, q);

    return ok({
      rows: paged,
      total: filtered.length,
      limit: q.limit,
      offset: q.offset,
      facets,
    });
  } catch (err) {
    return fail(err);
  }
}
