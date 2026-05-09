import { describe, expect, it } from "vitest";

import {
  lootGeneratorSaveRequestSchema,
  lootGeneratorInputSchema,
  lootNarrativeDensityOptions,
  lootSourcePresetOptions,
} from "@/lib/loot";
import {
  calculateDmgBaseGold,
  type LootGeneratorOutput,
} from "@/lib/loot";

const campaignId = "11111111-1111-4111-8111-111111111111";
const anchorEntityId = "22222222-2222-4222-8222-222222222222";
const encounterId = "33333333-3333-4333-8333-333333333333";

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

describe("lootGeneratorSaveRequestSchema", () => {
  it("accepts an optional encounter target for save", () => {
    const result = lootGeneratorSaveRequestSchema.parse({
      output: outputFixture(),
      encounterId,
    });

    expect(result.encounterId).toBe(encounterId);
  });

  it("normalizes empty encounter target from form-shaped values", () => {
    const result = lootGeneratorSaveRequestSchema.parse({
      output: outputFixture(),
      encounterId: "",
    });

    expect(result.encounterId).toBeUndefined();
  });
});

function outputFixture(): LootGeneratorOutput {
  const baseGold = calculateDmgBaseGold({ partyLevel: 5, mode: "hoard" });

  return {
    baseGold,
    narrativeSummary: "Una cassa chiusa con sigilli rotti.",
    gmNotes: null,
    hooks: [],
    items: [
      {
        name: "Gemma incrinata",
        kind: "material",
        rarity: "common",
        quantity: 1,
        value_gp: 25,
        attunement: false,
        description: "Una pietra lattiginosa segnata da una crepa netta.",
        effects: [],
        tags: ["loot"],
        lore_references: [],
        extra: {},
      },
    ],
    totalEstimatedValueGp: baseGold.totalGp + 25,
    metadata: {
      campaignId,
      source: "bandit",
      anchorEntityId: null,
      partyLevel: 5,
      narrativeDensity: "sobrio",
      contextEntitiesUsed: 0,
    },
  };
}
