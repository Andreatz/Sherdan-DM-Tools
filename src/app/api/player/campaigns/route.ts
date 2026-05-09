import type { NextRequest } from "next/server";
import { asc } from "drizzle-orm";

import { db } from "@/db/client";
import { campaigns } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import { requirePlayerAccess } from "@/lib/security/player-access";
import { projectCampaignsForPlayer } from "@/lib/security/player-campaigns";

const playerSafeColumns = {
  id: campaigns.id,
  name: campaigns.name,
  updatedAt: campaigns.updatedAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    requirePlayerAccess(req);

    const rows = await db
      .select(playerSafeColumns)
      .from(campaigns)
      .orderBy(asc(campaigns.name));

    return ok(projectCampaignsForPlayer(rows));
  } catch (err) {
    return fail(err);
  }
}
