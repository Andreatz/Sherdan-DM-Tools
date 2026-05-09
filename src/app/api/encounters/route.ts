import type { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { encounters } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";

const listEncountersQuerySchema = z
  .object({
    campaign_id: z.uuid(),
  })
  .strict();

const encounterListColumns = {
  id: encounters.id,
  campaignId: encounters.campaignId,
  title: encounters.title,
  description: encounters.description,
  locationId: encounters.locationId,
  plotThreadId: encounters.plotThreadId,
  difficulty: encounters.difficulty,
  partyLevel: encounters.partyLevel,
  usedInSession: encounters.usedInSession,
  createdAt: encounters.createdAt,
  updatedAt: encounters.updatedAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listEncountersQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const rows = await db
      .select(encounterListColumns)
      .from(encounters)
      .where(eq(encounters.campaignId, q.campaign_id))
      .orderBy(asc(encounters.title));

    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}
