import type { NextRequest } from "next/server";
import { type SQL, and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";

import { db } from "@/db/client";
import { entities } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import {
  assertCampaignScope,
  requirePlayerAccess,
} from "@/lib/security/player-access";
import { projectEntitiesForPlayer } from "@/lib/security/player-entities";
import { listPlayerEntitiesQuerySchema } from "@/lib/validation/player-entity-input";

const playerSafeColumns = {
  id: entities.id,
  campaignId: entities.campaignId,
  type: entities.type,
  name: entities.name,
  publicDescription: entities.publicDescription,
  parentId: entities.parentId,
  visibility: entities.visibility,
  updatedAt: entities.updatedAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    const payload = requirePlayerAccess(req);

    const url = new URL(req.url);
    const q = listPlayerEntitiesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const campaignId = assertCampaignScope(payload, q.campaign_id ?? null);

    const conditions: SQL[] = [
      eq(entities.campaignId, campaignId),
      inArray(entities.visibility, ["public", "discovered"]),
    ];

    if (q.type) conditions.push(eq(entities.type, q.type));
    if (q.parent_id) conditions.push(eq(entities.parentId, q.parent_id));
    if (q.search) {
      const pattern = `%${q.search}%`;
      const searchCondition = or(
        ilike(entities.name, pattern),
        ilike(entities.publicDescription, pattern),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const rows = await db
      .select(playerSafeColumns)
      .from(entities)
      .where(and(...conditions))
      .orderBy(q.sort === "updated_desc" ? desc(entities.updatedAt) : asc(entities.name))
      .limit(q.limit)
      .offset(q.offset);

    return ok(projectEntitiesForPlayer(rows));
  } catch (err) {
    return fail(err);
  }
}
