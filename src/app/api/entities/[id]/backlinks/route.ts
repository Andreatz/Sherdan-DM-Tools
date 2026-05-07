import type { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { entities, entityLinks } from "@/db/schema";
import { NotFoundError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/respond";

// "Backlinks" = lista degli entity_links che PUNTANO a questa entity
// (target_entity_id = id). Risponde alla domanda del Wiki "chi mi cita?".
// Output con info denormalizzate sulla entity sorgente (id, type, name)
// per evitare al client una seconda chiamata.
//
// I forward-link (source_entity_id = id) si recuperano gia' via
// /api/entity-links?source_entity_id=ID, niente endpoint dedicato.

const idParamSchema = z.object({ id: z.uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = idParamSchema.parse(await ctx.params);

    // Verifica che l'entity esista. Senza questo check, una entity
    // inesistente ritornerebbe semplicemente [] — ambiguo.
    const [exists] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.id, id))
      .limit(1);
    if (!exists) throw new NotFoundError("entity", id);

    const rows = await db
      .select({
        linkId: entityLinks.id,
        relationType: entityLinks.relationType,
        publicRelationType: entityLinks.publicRelationType,
        strength: entityLinks.strength,
        description: entityLinks.description,
        visibility: entityLinks.visibility,
        createdAt: entityLinks.createdAt,
        source: {
          id: entities.id,
          type: entities.type,
          name: entities.name,
        },
      })
      .from(entityLinks)
      .innerJoin(entities, eq(entityLinks.sourceEntityId, entities.id))
      .where(eq(entityLinks.targetEntityId, id))
      .orderBy(asc(entities.name));

    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}
