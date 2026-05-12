import type { NextRequest } from "next/server";
import { type SQL, and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { lootBundles } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import { listLootBundlesQuerySchema } from "@/lib/validation/loot-bundle-input";

// Lista loot bundles persisitti (creati dal `loot-generator/save`). Solo
// read-only: la creazione passa dalla generate/save pipeline. Filtri:
// `campaign_id` (required), `encounter_id`, `session_id`.

const bundleColumns = {
  id: lootBundles.id,
  campaignId: lootBundles.campaignId,
  title: lootBundles.title,
  description: lootBundles.description,
  goldAmount: lootBundles.goldAmount,
  items: lootBundles.items,
  encounterId: lootBundles.encounterId,
  sessionId: lootBundles.sessionId,
  createdAt: lootBundles.createdAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listLootBundlesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [eq(lootBundles.campaignId, q.campaign_id)];
    if (q.encounter_id) {
      conditions.push(eq(lootBundles.encounterId, q.encounter_id));
    }
    if (q.session_id) {
      conditions.push(eq(lootBundles.sessionId, q.session_id));
    }

    const rows = await db
      .select(bundleColumns)
      .from(lootBundles)
      .where(and(...conditions))
      .orderBy(desc(lootBundles.createdAt))
      .limit(q.limit)
      .offset(q.offset);

    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}
