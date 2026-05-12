import { describe, expect, it, vi } from "vitest";

import {
  isPlayerAccessConfigured,
  verifyGlobalAccessCode,
} from "@/lib/security/player-access";

describe("player access helpers", () => {
  it("is closed when no access code is configured", () => {
    vi.stubEnv("SHERDAN_PLAYER_ACCESS_CODE", "");

    expect(isPlayerAccessConfigured()).toBe(false);
    expect(verifyGlobalAccessCode("anything")).toBe(false);

    vi.unstubAllEnvs();
  });

  it("validates the configured global access code (legacy mode)", () => {
    vi.stubEnv("SHERDAN_PLAYER_ACCESS_CODE", "sherdan-test-code");

    expect(isPlayerAccessConfigured()).toBe(true);
    expect(verifyGlobalAccessCode("sherdan-test-code")).toBe(true);
    expect(verifyGlobalAccessCode("wrong-code")).toBe(false);

    vi.unstubAllEnvs();
  });
});
