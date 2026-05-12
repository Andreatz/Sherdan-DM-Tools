import { createHmac, timingSafeEqual } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

import { ServiceUnavailableError, UnauthorizedError } from "@/lib/api/errors";

export const PLAYER_ACCESS_COOKIE = "sherdan_player_access";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

// Hash deterministico del codice player. Usa HMAC-SHA256 con
// `SHERDAN_PLAYER_ACCESS_CODE` come chiave, cosi':
// - non serve salt per-riga (lookup O(1) via index su `code_hash`);
// - se la chiave globale viene ruotata, tutti i codici diventano
//   automaticamente invalidi (privilegia security a UX in casi di leak).
export function hashPlayerCode(plainCode: string): string {
  const secret = requireSecret();
  return createHmac("sha256", secret).update(plainCode).digest("base64url");
}

export interface PlayerCookiePayload {
  /** UUID del player (per-row in `players`). `null` per modalita' legacy. */
  playerId: string | null;
  /** UUID della campagna scoped. `null` per modalita' legacy (no scoping). */
  campaignId: string | null;
}

// Cookie payload firmato: `<base64url(json)>.<hmac>` con HMAC sul payload.
// Il payload contiene playerId+campaignId; restano backward-compatible con
// la modalita' "codice globale" (entrambi `null`).
export function setPlayerAccessCookie(
  res: NextResponse,
  payload: PlayerCookiePayload,
): void {
  const secret = requireSecret();
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  res.cookies.set({
    name: PLAYER_ACCESS_COOKIE,
    value: `${body}.${sig}`,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  });
}

export function clearPlayerAccessCookie(res: NextResponse): void {
  res.cookies.set({
    name: PLAYER_ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

// Decoder/verifier del cookie. Lancia `UnauthorizedError` se firma o
// payload sono invalidi. Ritorna sempre `PlayerCookiePayload` valorizzato
// (i null sono semanticamente "modalita' legacy globale"). Backward-compat
// con il formato precedente che era solo `<value>.<hmac>` con value="player":
// quel formato viene interpretato come `{ playerId: null, campaignId: null }`.
export function readPlayerCookie(req: NextRequest): PlayerCookiePayload {
  const secret = requireSecret();
  const cookieValue = req.cookies.get(PLAYER_ACCESS_COOKIE)?.value;
  if (!cookieValue) {
    throw new UnauthorizedError("Player access richiesto");
  }
  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex <= 0) {
    throw new UnauthorizedError("Player access richiesto");
  }
  const body = cookieValue.slice(0, dotIndex);
  const sig = cookieValue.slice(dotIndex + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (!timingSafeStringEqual(sig, expected)) {
    throw new UnauthorizedError("Player access richiesto");
  }

  // Cookie legacy: body=="player" (firmato con la stessa chiave). Diamo
  // accesso "globale" (campaignId=null, playerId=null). Le route player
  // scoping-aware ricadono sul vecchio comportamento (filtro per
  // `campaign_id` da query string).
  if (body === "player") {
    return { playerId: null, campaignId: null };
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(body)) as unknown;
    if (!isCookiePayload(parsed)) {
      throw new UnauthorizedError("Player access richiesto");
    }
    return parsed;
  } catch {
    throw new UnauthorizedError("Player access richiesto");
  }
}

export function isPlayerAccessConfigured(): boolean {
  return Boolean(getSecret());
}

// Verifica del codice di accesso "globale" legacy (env-based). Restituisce
// true se l'input combacia byte-per-byte con `SHERDAN_PLAYER_ACCESS_CODE`.
// Mantenuto per la modalita' "single-DM, codice unico" pre-multi-player.
export function verifyGlobalAccessCode(input: string): boolean {
  const code = getSecret();
  if (!code) return false;
  return timingSafeStringEqual(input, code);
}

function requireSecret(): string {
  const code = getSecret();
  if (!code) {
    throw new ServiceUnavailableError(
      "Player access non configurato. Imposta SHERDAN_PLAYER_ACCESS_CODE lato server.",
    );
  }
  return code;
}

function getSecret(): string | undefined {
  const value = process.env.SHERDAN_PLAYER_ACCESS_CODE?.trim();
  return value && value.length > 0 ? value : undefined;
}

function isCookiePayload(value: unknown): value is PlayerCookiePayload {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  const pid = obj.playerId;
  const cid = obj.campaignId;
  return (
    (pid === null || typeof pid === "string") &&
    (cid === null || typeof cid === "string")
  );
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}
