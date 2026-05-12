import { describe, expect, it } from "vitest";

import {
  createPlayerInputSchema,
  listPlayersQuerySchema,
  updatePlayerInputSchema,
} from "@/lib/validation/player-input";

const campaignId = "11111111-1111-4111-8111-111111111111";

describe("player input validation", () => {
  it("accepts a fully populated create payload", () => {
    const parsed = createPlayerInputSchema.parse({
      campaignId,
      name: " Alice ",
      code: "  super-secret-code  ",
    });
    expect(parsed.name).toBe("Alice");
    expect(parsed.code).toBe("super-secret-code");
    expect(parsed.active).toBeUndefined();
  });

  it("rejects names too short and codes too short", () => {
    expect(() =>
      createPlayerInputSchema.parse({ campaignId, name: "", code: "long-code" }),
    ).toThrow();
    expect(() =>
      createPlayerInputSchema.parse({ campaignId, name: "Alice", code: "abc" }),
    ).toThrow();
  });

  it("update schema accepts partial payloads and rejects empties", () => {
    expect(updatePlayerInputSchema.parse({ active: false })).toEqual({
      active: false,
    });
    expect(() => updatePlayerInputSchema.parse({ name: "" })).toThrow();
  });

  it("list query parses active=true/false via preprocess", () => {
    expect(
      listPlayersQuerySchema.parse({
        campaign_id: campaignId,
        active: "true",
      }),
    ).toEqual({ campaign_id: campaignId, active: true });
    expect(
      listPlayersQuerySchema.parse({
        campaign_id: campaignId,
        active: "false",
      }),
    ).toEqual({ campaign_id: campaignId, active: false });
  });
});
