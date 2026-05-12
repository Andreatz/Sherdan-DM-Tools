import { describe, expect, it } from "vitest";

import {
  createPlayerOverrideInputSchema,
  listPlayerOverridesQuerySchema,
  updatePlayerOverrideInputSchema,
} from "@/lib/validation/player-override-input";

const playerId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";

describe("player-visibility-override input validation", () => {
  it("accepts a full create payload", () => {
    const parsed = createPlayerOverrideInputSchema.parse({
      playerId,
      targetType: "entity",
      targetId,
      mode: "hidden",
      notes: " spoiler protection ",
    });
    expect(parsed).toEqual({
      playerId,
      targetType: "entity",
      targetId,
      mode: "hidden",
      notes: "spoiler protection",
    });
  });

  it("rejects unknown target_type / mode", () => {
    expect(() =>
      createPlayerOverrideInputSchema.parse({
        playerId,
        targetType: "campaign",
        targetId,
        mode: "hidden",
      }),
    ).toThrow();
    expect(() =>
      createPlayerOverrideInputSchema.parse({
        playerId,
        targetType: "entity",
        targetId,
        mode: "kinda-visible",
      }),
    ).toThrow();
  });

  it("update schema is restricted to mode/notes (no target reassignment)", () => {
    expect(updatePlayerOverrideInputSchema.parse({ mode: "revealed" })).toEqual(
      { mode: "revealed" },
    );
    expect(() =>
      updatePlayerOverrideInputSchema.parse({
        playerId,
        targetId,
      }),
    ).toThrow();
  });

  it("list query supports filters and empty body", () => {
    expect(listPlayerOverridesQuerySchema.parse({})).toEqual({});
    expect(
      listPlayerOverridesQuerySchema.parse({
        player_id: playerId,
        target_type: "truth_clue",
      }),
    ).toMatchObject({ player_id: playerId, target_type: "truth_clue" });
  });
});
