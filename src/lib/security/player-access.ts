import type { NextRequest } from "next/server";

import { BadRequestError } from "@/lib/api/errors";
import { getLogger } from "@/lib/logger";
import { clientKey, enforceRateLimit } from "@/lib/security/rate-limit";

import {
  PLAYER_ACCESS_COOKIE,
  clearPlayerAccessCookie,
  hashPlayerCode,
  isPlayerAccessConfigured,
  readPlayerCookie,
  setPlayerAccessCookie,
  verifyGlobalAccessCode,
  type PlayerCookiePayload,
} from "./player-auth";

const audit = getLogger("audit.player");

const PLAYER_API_RATE_LIMIT = {
  bucket: "player-api",
  limit: 120,
  windowMs: 60 * 1000, // 1 minuto
};

// Pre-condizione per ogni route player-facing:
// 1. Rate limit (anche a cookie valido, per fermare abuso).
// 2. Lettura + verifica firma cookie.
// 3. Ritorna il payload (playerId/campaignId), cosi' chi chiama puo'
//    applicare scoping per campagna ed eventuali override di visibilita'.
//
// `playerId === null` significa modalita' legacy "codice globale": il
// chiamante puo' scoping per qualsiasi campagna dal query param.
// `playerId !== null` significa per-player: il chiamante DEVE scoping
// alla `campaignId` del payload (la enforce e' fatta dai route handler).
export function requirePlayerAccess(req: NextRequest): PlayerCookiePayload {
  enforceRateLimit(req, PLAYER_API_RATE_LIMIT);
  try {
    return readPlayerCookie(req);
  } catch (err) {
    audit.warn(
      {
        ip: clientKey(req),
        path: new URL(req.url).pathname,
        outcome: "denied",
      },
      "player API access denied (cookie mancante o invalido)",
    );
    throw err;
  }
}

// Enforcer di scoping per campagna. In modalita' per-player, il payload del
// cookie fissa la campagna: il route handler DEVE allinearsi. In modalita'
// legacy (`payload.campaignId === null`) accetta qualsiasi `requested`,
// preservando il comportamento pre-multi-player.
//
// Ritorna l'id della campagna effettiva (mai null), cosi' il route handler
// puo' usarlo direttamente nel filtro WHERE.
export function assertCampaignScope(
  payload: PlayerCookiePayload,
  requested: string | null | undefined,
): string {
  if (payload.campaignId) {
    if (requested && requested !== payload.campaignId) {
      throw new BadRequestError(
        "Campaign scope: il cookie player e' scoped a un'altra campagna.",
        { allowed: payload.campaignId },
      );
    }
    return payload.campaignId;
  }
  if (!requested) {
    throw new BadRequestError(
      "Campaign scope: il parametro campaign_id e' richiesto in modalita' legacy.",
    );
  }
  return requested;
}

export {
  PLAYER_ACCESS_COOKIE,
  clearPlayerAccessCookie,
  hashPlayerCode,
  isPlayerAccessConfigured,
  readPlayerCookie,
  setPlayerAccessCookie,
  verifyGlobalAccessCode,
};

export type { PlayerCookiePayload };
