import { describe, expect, it } from "vitest";

import {
  averageDice,
  calculateDmgBaseGold,
  normalizeChallengeRating,
  resolveDmgGoldTier,
} from "@/lib/loot";

describe("DMG base gold tables", () => {
  it("maps challenge ratings to DMG treasure tiers", () => {
    expect(resolveDmgGoldTier({ challengeRating: "0" }).id).toBe("0-4");
    expect(resolveDmgGoldTier({ challengeRating: "1/8" }).id).toBe("0-4");
    expect(resolveDmgGoldTier({ challengeRating: 4 }).id).toBe("0-4");
    expect(resolveDmgGoldTier({ challengeRating: 5 }).id).toBe("5-10");
    expect(resolveDmgGoldTier({ challengeRating: 10 }).id).toBe("5-10");
    expect(resolveDmgGoldTier({ challengeRating: 11 }).id).toBe("11-16");
    expect(resolveDmgGoldTier({ challengeRating: 16 }).id).toBe("11-16");
    expect(resolveDmgGoldTier({ challengeRating: 17 }).id).toBe("17+");
    expect(resolveDmgGoldTier({ challengeRating: 30 }).id).toBe("17+");
  });

  it("maps party levels to the same treasure tiers", () => {
    expect(resolveDmgGoldTier({ partyLevel: 1 }).id).toBe("0-4");
    expect(resolveDmgGoldTier({ partyLevel: 4 }).id).toBe("0-4");
    expect(resolveDmgGoldTier({ partyLevel: 5 }).id).toBe("5-10");
    expect(resolveDmgGoldTier({ partyLevel: 10 }).id).toBe("5-10");
    expect(resolveDmgGoldTier({ partyLevel: 11 }).id).toBe("11-16");
    expect(resolveDmgGoldTier({ partyLevel: 16 }).id).toBe("11-16");
    expect(resolveDmgGoldTier({ partyLevel: 17 }).id).toBe("17+");
    expect(resolveDmgGoldTier({ partyLevel: 20 }).id).toBe("17+");
  });

  it("calculates deterministic expected hoard gold values", () => {
    expect(calculateDmgBaseGold({ challengeRating: 0 }).totalGp).toBe(196);
    expect(calculateDmgBaseGold({ challengeRating: 5 }).totalGp).toBe(3857);
    expect(calculateDmgBaseGold({ partyLevel: 11 }).totalGp).toBe(31500);
    expect(calculateDmgBaseGold({ partyLevel: 17 }).totalGp).toBe(322000);
  });

  it("calculates deterministic expected individual treasure values", () => {
    expect(
      calculateDmgBaseGold({
        challengeRating: 2,
        mode: "individual",
      }).totalGp,
    ).toBe(5.37);
    expect(
      calculateDmgBaseGold({
        challengeRating: 5,
        mode: "individual",
      }).totalGp,
    ).toBe(92.75);
    expect(
      calculateDmgBaseGold({
        challengeRating: 11,
        mode: "individual",
      }).totalGp,
    ).toBe(946.75);
    expect(
      calculateDmgBaseGold({
        challengeRating: 17,
        mode: "individual",
      }).totalGp,
    ).toBe(8470);
  });

  it("multiplies by quantity and exposes average coin breakdown", () => {
    const result = calculateDmgBaseGold({
      challengeRating: 5,
      mode: "hoard",
      quantity: 2,
    });

    expect(result).toMatchObject({
      tier: "5-10",
      mode: "hoard",
      quantity: 2,
      gpPerUnit: 3857,
      totalGp: 7714,
    });
    expect(result.averageCoinsPerUnit).toEqual({
      cp: 700,
      sp: 7000,
      gp: 2100,
      pp: 105,
    });
  });

  it("normalizes fractional CR aliases and rejects ambiguous inputs", () => {
    expect(normalizeChallengeRating("1/4")).toBe(0.25);
    expect(normalizeChallengeRating("1/2")).toBe(0.5);
    expect(averageDice({ dice: 2, sides: 6, multiplier: 10 })).toBe(70);
    expect(() => resolveDmgGoldTier({})).toThrow(/esattamente uno/);
    expect(() =>
      resolveDmgGoldTier({ challengeRating: 1, partyLevel: 1 }),
    ).toThrow(/esattamente uno/);
    expect(() => resolveDmgGoldTier({ partyLevel: 21 })).toThrow(/1 e 20/);
    expect(() => calculateDmgBaseGold({ partyLevel: 1, quantity: 0 })).toThrow(
      /intero positivo/,
    );
  });
});
