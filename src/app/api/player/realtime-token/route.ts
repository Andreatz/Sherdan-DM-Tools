import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import { createRealtimeAccessToken } from "@/lib/security/realtime-token";
import { assertCampaignScope, requirePlayerAccess } from "@/lib/security/player-access";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  try {
    const payload = requirePlayerAccess(req);
    const campaignId = assertCampaignScope(
      payload,
      req.nextUrl.searchParams.get("campaign_id"),
    );
    const token = createRealtimeAccessToken({
      campaignId,
      playerId: payload.playerId,
    });
    return ok({
      token: token.token,
      expiresAt: token.expiresAt,
      websocketPath: `/api/realtime?token=${encodeURIComponent(token.token)}`,
    });
  } catch (err) {
    return fail(err);
  }
}
