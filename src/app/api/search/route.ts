import type { NextRequest } from "next/server";
import { type SQL, and, asc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/db/client";
import { entities } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import { searchEntitiesQuerySchema } from "@/lib/validation/search-input";

// Ritorna le entities il cui name/description/publicDescription matcha `q`.
// `embedding` escluso di default (rumoroso).
const baseColumns = {
  id: entities.id,
  campaignId: entities.campaignId,
  type: entities.type,
  name: entities.name,
  description: entities.description,
  publicDescription: entities.publicDescription,
  tags: entities.tags,
  visibility: entities.visibility,
  createdAt: entities.createdAt,
  updatedAt: entities.updatedAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = searchEntitiesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    // Pattern ILIKE: i % e _ in `q` sono interpretati come wildcard.
    // Per uso single-user e' un comportamento accettabile (chi scrive
    // "%" probabilmente sta cercando il carattere stesso e l'ILIKE lo
    // trattera' come "qualunque cosa").
    const pattern = `%${q.q}%`;

    const conditions: SQL[] = [];
    const matchOr = or(
      ilike(entities.name, pattern),
      ilike(entities.description, pattern),
      ilike(entities.publicDescription, pattern),
    );
    if (matchOr) conditions.push(matchOr);
    if (q.campaign_id) conditions.push(eq(entities.campaignId, q.campaign_id));
    if (q.type) conditions.push(eq(entities.type, q.type));

    const rows = await db
      .select(baseColumns)
      .from(entities)
      .where(and(...conditions))
      .orderBy(asc(entities.name))
      .limit(q.limit)
      .offset(q.offset);

    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}
