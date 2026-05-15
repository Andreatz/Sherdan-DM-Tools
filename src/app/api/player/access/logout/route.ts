import { NextResponse, type NextRequest } from "next/server";

import { withApiTelemetry } from "@/lib/api/request-telemetry";
import { writeAuditLog } from "@/lib/audit-log";
import {
  clearPlayerAccessCookie,
  readPlayerCookie,
} from "@/lib/security/player-access";
import { clientKey } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  return withApiTelemetry(req, "/api/player/access/logout", async ({ requestId }) => {
    let payload: ReturnType<typeof readPlayerCookie> | null = null;
    try {
      payload = readPlayerCookie(req);
    } catch {
      payload = null;
    }
    await writeAuditLog({
      action: "player.logout",
      actorType: "player",
      playerId: payload?.playerId ?? null,
      campaignId: payload?.campaignId ?? null,
      outcome: "succeeded",
      requestId,
      ip: clientKey(req),
      userAgent: req.headers.get("user-agent"),
      metadata: { mode: payload?.playerId ? "per-player" : "legacy-or-empty" },
    });
  const res = NextResponse.json({ ok: true }, { status: 200 });
  clearPlayerAccessCookie(res);
  return res;
  });
}
