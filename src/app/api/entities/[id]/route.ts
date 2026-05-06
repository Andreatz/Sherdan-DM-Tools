import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { entities } from "@/db/schema";
import {
  BadRequestError,
  NotFoundError,
  ValidationFailedError,
} from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import { updateEntityInputSchema } from "@/lib/validation/entity-input";
import { validateEntityProperties } from "@/lib/validation";

const idParamSchema = z.object({ id: z.uuid() });

const detailQuerySchema = z
  .object({
    include_embedding: z.coerce.boolean().default(false),
  })
  .strict();

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

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveId(ctx: RouteContext): Promise<string> {
  return idParamSchema.parse(await ctx.params).id;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const url = new URL(req.url);
    const q = detailQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const cols = q.include_embedding ? baseColumnsWithEmbedding : baseColumns;
    const rows = await db
      .select(cols)
      .from(entities)
      .where(eq(entities.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("entity", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updateEntityInputSchema.parse(body);

    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }

    // Per validare le `properties` serve il `type` effettivo. Se non e'
    // nel body, lo prendiamo dal record esistente (lookup necessario).
    if (input.properties) {
      let effectiveType = input.type;
      if (!effectiveType) {
        const [existing] = await db
          .select({ type: entities.type })
          .from(entities)
          .where(eq(entities.id, id))
          .limit(1);
        if (!existing) throw new NotFoundError("entity", id);
        effectiveType = existing.type;
      }
      try {
        validateEntityProperties(effectiveType, input.properties);
      } catch (zerr) {
        throw new ValidationFailedError(
          zerr,
          `'properties' non valide per type='${effectiveType}'`,
        );
      }
    }

    // Costruisci il set update con solo i campi presenti (no overwrite a
    // null se il caller non lo vuole esplicitamente). I campi nullable
    // (description, publicDescription, parentId) accettano `null`
    // esplicito per cancellare il valore.
    const updateValues: Partial<typeof entities.$inferInsert> = {};
    if (input.type !== undefined) updateValues.type = input.type;
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined)
      updateValues.description = input.description;
    if (input.publicDescription !== undefined)
      updateValues.publicDescription = input.publicDescription;
    if (input.properties !== undefined) updateValues.properties = input.properties;
    if (input.tags !== undefined) updateValues.tags = input.tags;
    if (input.parentId !== undefined) updateValues.parentId = input.parentId;
    if (input.visibility !== undefined) updateValues.visibility = input.visibility;

    const [row] = await db
      .update(entities)
      .set(updateValues)
      .where(eq(entities.id, id))
      .returning(baseColumns);

    if (!row) throw new NotFoundError("entity", id);
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(entities)
      .where(eq(entities.id, id))
      .returning({ id: entities.id });
    if (!row) throw new NotFoundError("entity", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
