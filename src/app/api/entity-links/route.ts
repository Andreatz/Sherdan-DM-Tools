import type { NextRequest } from "next/server";
import { type SQL, and, asc, eq, or } from "drizzle-orm";

import { db } from "@/db/client";
import { entityLinks } from "@/db/schema";
import { BadRequestError } from "@/lib/api/errors";
import { created, fail, ok } from "@/lib/api/respond";
import {
  createEntityLinkInputSchema,
  listEntityLinksQuerySchema,
} from "@/lib/validation/entity-link-input";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listEntityLinksQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    // Mutua esclusione: `involves_entity_id` e' uno shorthand per (source
    // OR target). Combinarlo con i filtri puntuali sui due lati ha
    // semantica ambigua, lo blocchiamo con un 400 esplicito.
    if (
      q.involves_entity_id &&
      (q.source_entity_id || q.target_entity_id)
    ) {
      throw new BadRequestError(
        "'involves_entity_id' e' mutuamente esclusivo con 'source_entity_id'/'target_entity_id'.",
      );
    }

    const conditions: SQL[] = [];
    if (q.campaign_id) conditions.push(eq(entityLinks.campaignId, q.campaign_id));
    if (q.source_entity_id)
      conditions.push(eq(entityLinks.sourceEntityId, q.source_entity_id));
    if (q.target_entity_id)
      conditions.push(eq(entityLinks.targetEntityId, q.target_entity_id));
    if (q.involves_entity_id) {
      const involves = or(
        eq(entityLinks.sourceEntityId, q.involves_entity_id),
        eq(entityLinks.targetEntityId, q.involves_entity_id),
      );
      if (involves) conditions.push(involves);
    }
    if (q.relation_type)
      conditions.push(eq(entityLinks.relationType, q.relation_type));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(entityLinks)
      .where(whereClause)
      .orderBy(asc(entityLinks.createdAt))
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
    const input = createEntityLinkInputSchema.parse(body);

    const [row] = await db
      .insert(entityLinks)
      .values({
        campaignId: input.campaignId,
        sourceEntityId: input.sourceEntityId,
        targetEntityId: input.targetEntityId,
        relationType: input.relationType,
        publicRelationType: input.publicRelationType ?? null,
        strength: input.strength ?? null,
        description: input.description ?? null,
        visibility: input.visibility,
      })
      .returning();

    return created(row);
  } catch (err) {
    return fail(err);
  }
}
