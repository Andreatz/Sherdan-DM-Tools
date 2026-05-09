import { describe, expect, it } from "vitest";

import {
  calculateEncounterDifficulty,
  calculatePartyThresholds,
  encounterXpMultiplier,
  partyFromAverageLevel,
} from "@/lib/encounters";

describe("CR calculator", () => {
  it("calculates DMG XP thresholds for a mixed-level party", () => {
    const thresholds = calculatePartyThresholds([
      { level: 1 },
      { level: 5 },
      { level: 10 },
    ]);

    expect(thresholds).toEqual({
      easy: 875,
      medium: 1750,
      hard: 2725,
      deadly: 4000,
    });
  });

  it("creates a party from average level and size", () => {
    expect(partyFromAverageLevel({ partyLevel: 7, partySize: 4 })).toEqual([
      { level: 7 },
      { level: 7 },
      { level: 7 },
      { level: 7 },
    ]);
  });

  it("applies encounter multipliers including small and large party adjustments", () => {
    expect(encounterXpMultiplier(1, 4)).toBe(1);
    expect(encounterXpMultiplier(2, 4)).toBe(1.5);
    expect(encounterXpMultiplier(5, 4)).toBe(2);
    expect(encounterXpMultiplier(8, 4)).toBe(2.5);
    expect(encounterXpMultiplier(12, 4)).toBe(3);
    expect(encounterXpMultiplier(15, 4)).toBe(4);

    expect(encounterXpMultiplier(2, 2)).toBe(2);
    expect(encounterXpMultiplier(8, 6)).toBe(2);
  });

  it("classifies adjusted XP against party thresholds", () => {
    const party = partyFromAverageLevel({ partyLevel: 5, partySize: 4 });

    expect(
      calculateEncounterDifficulty({
        party,
        monsters: [{ xp: 100, count: 2 }],
      }),
    ).toMatchObject({
      baseXp: 200,
      multiplier: 1.5,
      adjustedXp: 300,
      difficulty: "trivial",
    });

    expect(
      calculateEncounterDifficulty({
        party,
        monsters: [{ xp: 450, count: 2 }],
      }),
    ).toMatchObject({
      baseXp: 900,
      multiplier: 1.5,
      adjustedXp: 1350,
      difficulty: "easy",
    });

    expect(
      calculateEncounterDifficulty({
        party,
        monsters: [{ xp: 700, count: 2 }],
      }),
    ).toMatchObject({
      adjustedXp: 2100,
      difficulty: "medium",
    });

    expect(
      calculateEncounterDifficulty({
        party,
        monsters: [{ xp: 1100, count: 2 }],
      }),
    ).toMatchObject({
      adjustedXp: 3300,
      difficulty: "hard",
    });

    expect(
      calculateEncounterDifficulty({
        party,
        monsters: [{ xp: 1800, count: 2 }],
      }),
    ).toMatchObject({
      adjustedXp: 5400,
      difficulty: "deadly",
    });
  });

  it("rejects invalid party and monster input", () => {
    expect(() => calculatePartyThresholds([{ level: 0 }])).toThrow(
      /Livello party/,
    );
    expect(() =>
      calculateEncounterDifficulty({
        party: [{ level: 5 }],
        monsters: [],
      }),
    ).toThrow(/Encounter senza mostri/);
    expect(() =>
      calculateEncounterDifficulty({
        party: [{ level: 5 }],
        monsters: [{ xp: 50, count: 0 }],
      }),
    ).toThrow(/count mostro/);
  });
});
