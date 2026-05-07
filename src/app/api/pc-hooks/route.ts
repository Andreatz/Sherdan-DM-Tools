import type { NextRequest } from "next/server";
import { type SQL, and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { pcHooks } from "@/db/schema";
import { created, fail, ok } from "@/lib/api/respond";
import {
  createPcHookInputSchema,
  listPcHooksQuerySchema,
} from "@/lib/validation/pc-hook-input";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listPcHooksQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [];
    if (q.campaign_id) conditions.push(eq(pcHooks.campaignId, q.campaign_id));
    if (q.pc_entity_id)
      conditions.push(eq(pcHooks.pcEntityId, q.pc_entity_id));
    if (q.target_entity_id)
      conditions.push(eq(pcHooks.targetEntityId, q.target_entity_id));
    if (q.status) conditions.push(eq(pcHooks.status, q.status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(pcHooks)
      .where(whereClause)
      .orderBy(asc(pcHooks.createdAt))
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
    const input = createPcHookInputSchema.parse(body);

    const [row] = await db
      .insert(pcHooks)
      .values({
        campaignId: input.campaignId,
        pcEntityId: input.pcEntityId,
        targetEntityId: input.targetEntityId,
        hookDescription: input.hookDescription,
        potentialArc: input.potentialArc ?? null,
        usedInSession: input.usedInSession ?? null,
        status: input.status,
      })
      .returning();

    return created(row);
  } catch (err) {
    return fail(err);
  }
}
