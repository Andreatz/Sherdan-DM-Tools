import type { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";

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
    const payload = requirePlayerAccess(req);

    // Per-player: filtra alla sola campagna scoped. Legacy: lista tutto.
    const baseQuery = db.select(playerSafeColumns).from(campaigns);
    const rows = await (payload.campaignId
      ? baseQuery.where(eq(campaigns.id, payload.campaignId))
      : baseQuery.orderBy(asc(campaigns.name)));

    return ok(projectCampaignsForPlayer(rows));
  } catch (err) {
    return fail(err);
  }
}
