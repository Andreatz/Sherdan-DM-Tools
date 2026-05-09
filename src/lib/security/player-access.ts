import { createHmac, timingSafeEqual } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

import { ServiceUnavailableError, UnauthorizedError } from "@/lib/api/errors";

export const PLAYER_ACCESS_COOKIE = "sherdan_player_access";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export function isPlayerAccessConfigured(): boolean {
  return Boolean(getAccessCode());
}

export function requirePlayerAccess(req: NextRequest): void {
  const code = getAccessCode();
  if (!code) {
    throw new ServiceUnavailableError(
      "Player access non configurato. Imposta SHERDAN_PLAYER_ACCESS_CODE lato server.",
    );
  }

  const cookieValue = req.cookies.get(PLAYER_ACCESS_COOKIE)?.value;
  if (!cookieValue || !verifySignedValue(cookieValue, code)) {
    throw new UnauthorizedError("Player access richiesto");
  }
}

export function verifyPlayerAccessCode(input: string): boolean {
  const code = getAccessCode();
  if (!code) return false;
  return timingSafeStringEqual(input, code);
}

export function setPlayerAccessCookie(res: NextResponse): void {
  const code = getAccessCode();
  if (!code) {
    throw new ServiceUnavailableError(
      "Player access non configurato. Imposta SHERDAN_PLAYER_ACCESS_CODE lato server.",
    );
  }

  res.cookies.set({
    name: PLAYER_ACCESS_COOKIE,
    value: signValue("player", code),
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

function getAccessCode(): string | undefined {
  const value = process.env.SHERDAN_PLAYER_ACCESS_CODE?.trim();
  return value && value.length > 0 ? value : undefined;
}

function signValue(value: string, code: string): string {
  return `${value}.${hmac(value, code)}`;
}

function verifySignedValue(signedValue: string, code: string): boolean {
  const [value, signature, extra] = signedValue.split(".");
  if (!value || !signature || extra !== undefined) return false;
  return timingSafeStringEqual(signature, hmac(value, code));
}

function hmac(value: string, code: string): string {
  return createHmac("sha256", code).update(value).digest("base64url");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}
