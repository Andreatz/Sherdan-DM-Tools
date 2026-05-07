import type { NextRequest } from "next/server";
import { type SQL, and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { entityIdentities } from "@/db/schema";
import { created, fail, ok } from "@/lib/api/respond";
import {
  createEntityIdentityInputSchema,
  listEntityIdentitiesQuerySchema,
} from "@/lib/validation/entity-identity-input";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listEntityIdentitiesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [];
    if (q.entity_id) conditions.push(eq(entityIdentities.entityId, q.entity_id));
    if (q.is_true_identity !== undefined)
      conditions.push(eq(entityIdentities.isTrueIdentity, q.is_true_identity));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(entityIdentities)
      .where(whereClause)
      .orderBy(asc(entityIdentities.createdAt))
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
    const input = createEntityIdentityInputSchema.parse(body);

    const [row] = await db
      .insert(entityIdentities)
      .values({
        entityId: input.entityId,
        name: input.name,
        isTrueIdentity: input.isTrueIdentity,
        appearance: input.appearance ?? null,
        voice: input.voice ?? null,
        mannerisms: input.mannerisms,
        activeFromSession: input.activeFromSession ?? null,
        activeUntilSession: input.activeUntilSession ?? null,
        visibility: input.visibility,
        notes: input.notes ?? null,
      })
      .returning();

    return created(row);
  } catch (err) {
    return fail(err);
  }
}
