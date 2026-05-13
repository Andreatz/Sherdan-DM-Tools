import { createHmac, timingSafeEqual } from "node:crypto";

import { BadRequestError, ServiceUnavailableError, UnauthorizedError } from "@/lib/api/errors";

export const REALTIME_TOKEN_TTL_MS = 10 * 60 * 1000;

export interface RealtimeTokenPayload {
  campaignId: string;
  playerId: string | null;
  expiresAt: string;
}

export function createRealtimeAccessToken(input: {
  campaignId: string;
  playerId: string | null;
  now?: Date;
  ttlMs?: number;
}): { token: string; expiresAt: string } {
  const now = input.now ?? new Date();
  const expiresAt = new Date(
    now.getTime() + (input.ttlMs ?? REALTIME_TOKEN_TTL_MS),
  ).toISOString();
  const payload: RealtimeTokenPayload = {
    campaignId: input.campaignId,
    playerId: input.playerId,
    expiresAt,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = sign(body);
  return { token: `${body}.${sig}`, expiresAt };
}

export function verifyRealtimeAccessToken(
  token: string,
  options: { now?: Date } = {},
): RealtimeTokenPayload {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex <= 0) {
    throw new UnauthorizedError("Realtime token invalido.");
  }

  const body = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  const expected = sign(body);
  if (!timingSafeStringEqual(sig, expected)) {
    throw new UnauthorizedError("Realtime token invalido.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new UnauthorizedError("Realtime token invalido.");
  }

  if (!isRealtimeTokenPayload(parsed)) {
    throw new UnauthorizedError("Realtime token invalido.");
  }

  const now = options.now ?? new Date();
  const expiresAt = new Date(parsed.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new UnauthorizedError("Realtime token invalido.");
  }
  if (expiresAt.getTime() <= now.getTime()) {
    throw new UnauthorizedError("Realtime token scaduto.");
  }

  return parsed;
}

export function requireRealtimeTokenFromUrl(url: URL): RealtimeTokenPayload {
  const token = url.searchParams.get("token");
  if (!token) {
    throw new BadRequestError("Parametro token richiesto per il canale realtime.");
  }
  const payload = verifyRealtimeAccessToken(token);
  const requestedCampaignId =
    url.searchParams.get("campaign_id") ?? url.searchParams.get("campaignId");
  if (requestedCampaignId && requestedCampaignId !== payload.campaignId) {
    throw new BadRequestError("Realtime token scoped a un'altra campagna.");
  }
  return payload;
}

function sign(body: string): string {
  return createHmac("sha256", requireSecret()).update(body).digest("base64url");
}

function requireSecret(): string {
  const value = process.env.SHERDAN_PLAYER_ACCESS_CODE?.trim();
  if (!value) {
    throw new ServiceUnavailableError(
      "Realtime auth non configurata. Imposta SHERDAN_PLAYER_ACCESS_CODE lato server.",
    );
  }
  return value;
}

function isRealtimeTokenPayload(value: unknown): value is RealtimeTokenPayload {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.campaignId === "string" &&
    (obj.playerId === null || typeof obj.playerId === "string") &&
    typeof obj.expiresAt === "string"
  );
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}
