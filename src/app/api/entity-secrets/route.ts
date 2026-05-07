import type { NextRequest } from "next/server";
import { type SQL, and, asc, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { entitySecrets } from "@/db/schema";
import { created, fail, ok } from "@/lib/api/respond";
import {
  createEntitySecretInputSchema,
  listEntitySecretsQuerySchema,
} from "@/lib/validation/entity-secret-input";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listEntitySecretsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [];
    if (q.campaign_id) conditions.push(eq(entitySecrets.campaignId, q.campaign_id));
    if (q.entity_id) conditions.push(eq(entitySecrets.entityId, q.entity_id));
    if (q.plot_thread_id)
      conditions.push(eq(entitySecrets.plotThreadId, q.plot_thread_id));
    if (q.layer) conditions.push(eq(entitySecrets.layer, q.layer));
    if (q.discovered !== undefined) {
      // `discovered=true` -> discoveredAtSession popolata
      // `discovered=false` -> discoveredAtSession ancora null
      conditions.push(
        q.discovered
          ? isNotNull(entitySecrets.discoveredAtSession)
          : isNull(entitySecrets.discoveredAtSession),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(entitySecrets)
      .where(whereClause)
      .orderBy(asc(entitySecrets.createdAt))
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
    const input = createEntitySecretInputSchema.parse(body);

    const [row] = await db
      .insert(entitySecrets)
      .values({
        campaignId: input.campaignId,
        entityId: input.entityId ?? null,
        plotThreadId: input.plotThreadId ?? null,
        layer: input.layer,
        content: input.content,
        exploitHint: input.exploitHint ?? null,
        discoveredAtSession: input.discoveredAtSession ?? null,
        discoveryNotes: input.discoveryNotes ?? null,
      })
      .returning();

    return created(row);
  } catch (err) {
    return fail(err);
  }
}
