import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import { getPlayerDashboardSnapshot } from "@/lib/player-dashboard";
import { dashboardQuerySchema } from "@/lib/player-dashboard/schema";
import {
  assertCampaignScope,
  requirePlayerAccess,
} from "@/lib/security/player-access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const payload = requirePlayerAccess(req);
    const q = dashboardQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const campaignId = assertCampaignScope(payload, q.campaign_id);
    return ok(await getPlayerDashboardSnapshot(campaignId, payload));
  } catch (err) {
    return fail(err);
  }
}
