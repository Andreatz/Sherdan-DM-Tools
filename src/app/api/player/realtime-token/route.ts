import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import { withApiTelemetry } from "@/lib/api/request-telemetry";
import { writeAuditLog } from "@/lib/audit-log";
import { createRealtimeAccessToken } from "@/lib/security/realtime-token";
import { assertCampaignScope, requirePlayerAccess } from "@/lib/security/player-access";
import { clientKey } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return withApiTelemetry(req, "/api/player/realtime-token", async ({ requestId }) => {
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
    await writeAuditLog({
      action: "player.realtime_token",
      actorType: "player",
      playerId: payload.playerId,
      campaignId,
      outcome: "succeeded",
      requestId,
      ip: clientKey(req),
      userAgent: req.headers.get("user-agent"),
      metadata: { expiresAt: token.expiresAt },
    });
    return ok({
      token: token.token,
      expiresAt: token.expiresAt,
      websocketPath: `/api/realtime?token=${encodeURIComponent(token.token)}`,
    });
  } catch (err) {
    return fail(err);
  }
  });
}
