import { describe, expect, it, vi } from "vitest";

import {
  isPlayerAccessConfigured,
  verifyPlayerAccessCode,
} from "@/lib/security/player-access";

describe("player access helpers", () => {
  it("is closed when no access code is configured", () => {
    vi.stubEnv("SHERDAN_PLAYER_ACCESS_CODE", "");

    expect(isPlayerAccessConfigured()).toBe(false);
    expect(verifyPlayerAccessCode("anything")).toBe(false);

    vi.unstubAllEnvs();
  });

  it("validates the configured access code", () => {
    vi.stubEnv("SHERDAN_PLAYER_ACCESS_CODE", "sherdan-test-code");

    expect(isPlayerAccessConfigured()).toBe(true);
    expect(verifyPlayerAccessCode("sherdan-test-code")).toBe(true);
    expect(verifyPlayerAccessCode("wrong-code")).toBe(false);

    vi.unstubAllEnvs();
  });
});
