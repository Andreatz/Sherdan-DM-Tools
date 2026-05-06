import type { NextRequest } from "next/server";
import { type SQL, and, asc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { entities } from "@/db/schema";
import { ValidationFailedError } from "@/lib/api/errors";
import { created, fail, ok } from "@/lib/api/respond";
import {
  createEntityInputSchema,
  listEntitiesQuerySchema,
} from "@/lib/validation/entity-input";
import { validateEntityProperties } from "@/lib/validation";

// Colonne ritornate di default. `embedding` (vector(1024)) e' escluso
// perche' pesante e raramente utile; passa `?include_embedding=true`
// per averlo in lista (e in GET singolo via flag analoga).
const baseColumns = {
  id: entities.id,
  campaignId: entities.campaignId,
  type: entities.type,
  name: entities.name,
  description: entities.description,
  publicDescription: entities.publicDescription,
  properties: entities.properties,
  tags: entities.tags,
  parentId: entities.parentId,
  visibility: entities.visibility,
  createdAt: entities.createdAt,
  updatedAt: entities.updatedAt,
} as const;

const baseColumnsWithEmbedding = {
  ...baseColumns,
  embedding: entities.embedding,
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listEntitiesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [];
    if (q.campaign_id) conditions.push(eq(entities.campaignId, q.campaign_id));
    if (q.type) conditions.push(eq(entities.type, q.type));
    if (q.parent_id) conditions.push(eq(entities.parentId, q.parent_id));
    if (q.tag) {
      // Filtro su array Postgres: tag presente nel campo tags TEXT[].
      conditions.push(sql`${q.tag} = ANY(${entities.tags})`);
    }
    if (q.search) {
      const pattern = `%${q.search}%`;
      const searchCondition = or(
        ilike(entities.name, pattern),
        ilike(entities.description, pattern),
        ilike(entities.publicDescription, pattern),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const cols = q.include_embedding ? baseColumnsWithEmbedding : baseColumns;
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select(cols)
      .from(entities)
      .where(whereClause)
      .orderBy(asc(entities.name))
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
    const input = createEntityInputSchema.parse(body);

    // Validazione type-specific delle properties (NPC, PC, location, ecc.).
    // Usa il discriminator gia' tipato.
    try {
      validateEntityProperties(input.type, input.properties);
    } catch (zerr) {
      throw new ValidationFailedError(
        zerr,
        `'properties' non valide per type='${input.type}'`,
      );
    }

    const [row] = await db
      .insert(entities)
      .values({
        campaignId: input.campaignId,
        type: input.type,
        name: input.name,
        description: input.description ?? null,
        publicDescription: input.publicDescription ?? null,
        properties: input.properties,
        tags: input.tags,
        parentId: input.parentId ?? null,
        visibility: input.visibility,
      })
      .returning(baseColumns);

    return created(row);
  } catch (err) {
    return fail(err);
  }
}
