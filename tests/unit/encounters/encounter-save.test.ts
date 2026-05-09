import { describe, expect, it } from "vitest";

import {
  normalizeOptionalText,
  saveEncounterInputSchema,
  storableEncounterDifficulty,
} from "@/lib/encounters/encounter-save";

const campaignId = "11111111-1111-4111-8111-111111111111";
const locationId = "22222222-2222-4222-8222-222222222222";
const plotThreadId = "33333333-3333-4333-8333-333333333333";
const monsterId = "44444444-4444-4444-8444-444444444444";

describe("saveEncounterInputSchema", () => {
  it("accepts a save payload with location and optional plot thread", () => {
    const parsed = saveEncounterInputSchema.parse({
      campaignId,
      title: "La chiusa corrotta",
      description: "Agguato nel canale.",
      locationId,
      plotThreadId,
      difficulty: "medium",
      partyLevel: "5",
      xpTotal: "1400",
      tacticalNotes: "# Note\n\nAprire con terreno difficile.",
      participants: [{ entityId: monsterId, count: "2" }],
    });

    expect(parsed.partyLevel).toBe(5);
    expect(parsed.xpTotal).toBe(1400);
    expect(parsed.participants).toEqual([{ entityId: monsterId, count: 2 }]);
  });

  it("requires a location and at least one participant", () => {
    const result = saveEncounterInputSchema.safeParse({
      campaignId,
      title: "Vuoto",
      participants: [],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["locationId", "participants"]),
    );
  });

  it("normalizes blank optional text and non-storable difficulty", () => {
    expect(normalizeOptionalText("  nota  ")).toBe("nota");
    expect(normalizeOptionalText("   ")).toBeNull();
    expect(storableEncounterDifficulty("hard")).toBe("hard");
    expect(storableEncounterDifficulty("trivial")).toBeNull();
  });
});
