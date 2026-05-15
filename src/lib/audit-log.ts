import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";
import { getLogger } from "@/lib/logger";
import { clientKey } from "@/lib/security/rate-limit";

const log = getLogger("audit.persist");

export type AuditAction =
  | "player.login"
  | "player.logout"
  | "player.realtime_token"
  | "player_visibility_override.create"
  | "player_visibility_override.update"
  | "player_visibility_override.delete"
  | "chatgpt_bridge.apply_update_pack";

export interface AuditLogInput {
  action: AuditAction;
  actorType?: "player" | "dm" | "system";
  playerId?: string | null;
  campaignId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  outcome?: "succeeded" | "denied" | "failed";
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      action: input.action,
      actorType: input.actorType ?? "system",
      playerId: input.playerId ?? null,
      campaignId: input.campaignId ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      outcome: input.outcome ?? "succeeded",
      requestId: input.requestId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    log.warn(
      {
        action: input.action,
        err: err instanceof Error ? err.message : String(err),
      },
      "audit log persist failed",
    );
  }
}

export function auditRequestMetadata(req: NextRequest) {
  return {
    ip: clientKey(req),
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  };
}
