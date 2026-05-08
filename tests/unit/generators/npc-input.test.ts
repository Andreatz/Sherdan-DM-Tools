import { describe, expect, it } from "vitest";

import {
  npcGeneratorInputSchema,
  npcGeneratorToneOptions,
  npcGeneratorTypeOptions,
  npcNarrativeDepthOptions,
} from "@/lib/generators";

const campaignId = "11111111-1111-4111-8111-111111111111";
const locationId = "22222222-2222-4222-8222-222222222222";

describe("npcGeneratorInputSchema", () => {
  it("normalizes form input for the NPC generator", () => {
    const result = npcGeneratorInputSchema.parse({
      campaignId,
      locationId,
      npcType: "  capitano  ",
      partyLevel: "7",
      tone: "cupo",
      narrativeDepth: "principale",
    });

    expect(result).toEqual({
      campaignId,
      locationId,
      npcType: "capitano",
      partyLevel: 7,
      tone: "cupo",
      narrativeDepth: "principale",
    });
  });

  it("keeps explicit option lists for the UI", () => {
    expect(npcGeneratorTypeOptions).toContain("taverniere");
    expect(npcGeneratorToneOptions).toEqual([
      "serio",
      "comico",
      "cupo",
      "grimdark",
    ]);
    expect(npcNarrativeDepthOptions).toEqual([
      "comparsa",
      "secondario",
      "principale",
    ]);
  });

  it("rejects invalid levels, missing location and unknown modes", () => {
    const result = npcGeneratorInputSchema.safeParse({
      campaignId,
      locationId: "",
      npcType: "x",
      partyLevel: "21",
      tone: "solenne",
      narrativeDepth: "epica",
      extra: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toEqual(
        expect.arrayContaining([
          "locationId",
          "npcType",
          "partyLevel",
          "tone",
          "narrativeDepth",
          "",
        ]),
      );
    }
  });
});
