import { describe, expect, it } from "vitest";

import {
  lootGeneratorInputSchema,
  lootNarrativeDensityOptions,
  lootSourcePresetOptions,
} from "@/lib/loot";

const campaignId = "11111111-1111-4111-8111-111111111111";
const anchorEntityId = "22222222-2222-4222-8222-222222222222";

describe("lootGeneratorInputSchema", () => {
  it("normalizes loot generator input from form-shaped values", () => {
    const result = lootGeneratorInputSchema.parse({
      campaignId,
      source: "  bandit  ",
      anchorEntityId: "",
      partyLevel: "7",
      narrativeDensity: "ricco",
    });

    expect(result).toEqual({
      campaignId,
      source: "bandit",
      anchorEntityId: undefined,
      partyLevel: 7,
      narrativeDensity: "ricco",
    });
  });

  it("accepts an optional wiki anchor entity for narrative context", () => {
    const result = lootGeneratorInputSchema.parse({
      campaignId,
      source: "setta",
      anchorEntityId,
      partyLevel: 11,
      narrativeDensity: "sobrio",
    });

    expect(result.anchorEntityId).toBe(anchorEntityId);
  });

  it("keeps explicit option lists for the UI", () => {
    expect(lootSourcePresetOptions).toEqual(
      expect.arrayContaining(["bandit", "dragon", "merchant", "vinculator"]),
    );
    expect(lootNarrativeDensityOptions).toEqual(["sobrio", "ricco"]);
  });

  it("rejects invalid levels, empty source and unknown density", () => {
    const result = lootGeneratorInputSchema.safeParse({
      campaignId,
      source: "x",
      partyLevel: "21",
      narrativeDensity: "opulento",
      extra: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toEqual(
        expect.arrayContaining(["source", "partyLevel", "narrativeDensity", ""]),
      );
    }
  });
});
