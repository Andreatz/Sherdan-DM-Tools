import { afterEach, describe, expect, it, vi } from "vitest";

import { BadRequestError } from "@/lib/api/errors";
import { assertCampaignScope } from "@/lib/security/player-access";
import { hashPlayerCode } from "@/lib/security/player-auth";

const SECRET = "sherdan-test-secret";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hashPlayerCode", () => {
  it("produces a deterministic HMAC under the configured secret", () => {
    vi.stubEnv("SHERDAN_PLAYER_ACCESS_CODE", SECRET);
    const a = hashPlayerCode("alice-code");
    const b = hashPlayerCode("alice-code");
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("differs for different inputs and different secrets", () => {
    vi.stubEnv("SHERDAN_PLAYER_ACCESS_CODE", SECRET);
    const alice = hashPlayerCode("alice-code");
    const bob = hashPlayerCode("bob-code");
    expect(alice).not.toBe(bob);

    vi.stubEnv("SHERDAN_PLAYER_ACCESS_CODE", "different-secret");
    const aliceRotated = hashPlayerCode("alice-code");
    expect(aliceRotated).not.toBe(alice);
  });

  it("throws ServiceUnavailable if SHERDAN_PLAYER_ACCESS_CODE is missing", () => {
    vi.stubEnv("SHERDAN_PLAYER_ACCESS_CODE", "");
    expect(() => hashPlayerCode("x")).toThrow(
      /Player access non configurato/,
    );
  });
});

describe("assertCampaignScope", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";

  it("per-player: allows when requested matches cookie campaign", () => {
    expect(
      assertCampaignScope({ playerId: "p", campaignId: A }, A),
    ).toBe(A);
  });

  it("per-player: allows when requested is omitted (cookie defaults the scope)", () => {
    expect(
      assertCampaignScope({ playerId: "p", campaignId: A }, null),
    ).toBe(A);
  });

  it("per-player: rejects mismatch with BadRequestError", () => {
    expect(() =>
      assertCampaignScope({ playerId: "p", campaignId: A }, B),
    ).toThrow(BadRequestError);
  });

  it("legacy: returns requested when payload has no campaign scope", () => {
    expect(
      assertCampaignScope({ playerId: null, campaignId: null }, A),
    ).toBe(A);
  });

  it("legacy: rejects when neither cookie nor query specify a campaign", () => {
    expect(() =>
      assertCampaignScope({ playerId: null, campaignId: null }, null),
    ).toThrow(BadRequestError);
  });
});
