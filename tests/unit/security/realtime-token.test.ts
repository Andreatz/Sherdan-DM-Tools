import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createRealtimeAccessToken,
  requireRealtimeTokenFromUrl,
  verifyRealtimeAccessToken,
} from "@/lib/security/realtime-token";

const campaignId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const playerId = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const now = new Date("2026-05-13T10:00:00.000Z");

describe("realtime signed tokens", () => {
  const previousSecret = process.env.SHERDAN_PLAYER_ACCESS_CODE;

  beforeEach(() => {
    process.env.SHERDAN_PLAYER_ACCESS_CODE = "test-realtime-secret";
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.SHERDAN_PLAYER_ACCESS_CODE;
    } else {
      process.env.SHERDAN_PLAYER_ACCESS_CODE = previousSecret;
    }
  });

  it("creates and verifies a campaign-scoped token", () => {
    const { token, expiresAt } = createRealtimeAccessToken({
      campaignId,
      playerId,
      now,
    });

    expect(verifyRealtimeAccessToken(token, { now })).toEqual({
      campaignId,
      playerId,
      expiresAt,
    });
  });

  it("rejects tampered tokens", () => {
    const { token } = createRealtimeAccessToken({ campaignId, playerId, now });
    const tampered = `${token.slice(0, -1)}x`;

    expect(() => verifyRealtimeAccessToken(tampered, { now })).toThrow(
      "Realtime token invalido.",
    );
  });

  it("rejects expired tokens", () => {
    const { token } = createRealtimeAccessToken({
      campaignId,
      playerId,
      now,
      ttlMs: 1_000,
    });

    expect(() =>
      verifyRealtimeAccessToken(token, {
        now: new Date(now.getTime() + 1_001),
      }),
    ).toThrow("Realtime token scaduto.");
  });

  it("rejects campaign query mismatches", () => {
    const { token } = createRealtimeAccessToken({ campaignId, playerId });
    const url = new URL(
      `http://localhost/api/realtime?campaign_id=cccccccc-cccc-4ccc-cccc-cccccccccccc&token=${token}`,
    );

    expect(() => requireRealtimeTokenFromUrl(url)).toThrow(
      "Realtime token scoped a un'altra campagna.",
    );
  });
});
