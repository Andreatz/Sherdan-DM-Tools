import { describe, expect, it } from "vitest";

import {
  buildMonsterFacets,
  challengeRatingToNumber,
  filterMonsterRecords,
  listMonstersQuerySchema,
  type MonsterBrowserRecord,
} from "@/lib/encounters";

describe("monster browser filters", () => {
  it("validates query params from URL-shaped values", () => {
    const query = listMonstersQuerySchema.parse({
      campaign_id: "11111111-1111-4111-8111-111111111111",
      cr_min: "0.25",
      cr_max: "5",
      creature_type: "undead",
      environment: "Ruins",
      size: "medium",
      limit: "25",
      offset: "0",
    });

    expect(query).toMatchObject({
      cr_min: 0.25,
      cr_max: 5,
      creature_type: "undead",
      environment: "Ruins",
      size: "medium",
      limit: 25,
    });
  });

  it("converts fractional CR strings to sortable numbers", () => {
    expect(challengeRatingToNumber("1/8")).toBe(0.125);
    expect(challengeRatingToNumber("1/4")).toBe(0.25);
    expect(challengeRatingToNumber("1/2")).toBe(0.5);
    expect(challengeRatingToNumber("12")).toBe(12);
  });

  it("filters by CR, type, environment and size", () => {
    const filtered = filterMonsterRecords(monstersFixture(), {
      cr_min: 0.25,
      cr_max: 5,
      creature_type: "undead",
      environment: "Ruins",
      size: "medium",
    });

    expect(filtered.map((monster) => monster.name)).toEqual(["Wight"]);
  });

  it("builds browser facets from valid monster records", () => {
    const facets = buildMonsterFacets(monstersFixture());

    expect(facets).toEqual({
      creatureTypes: ["aberration", "undead"],
      environments: ["Coast", "Ruins", "Underdark"],
      sizes: ["large", "medium"],
      crRange: { min: 3, max: 10 },
    });
  });
});

function monstersFixture(): MonsterBrowserRecord[] {
  return [
    monsterFixture({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Aboleth",
      creature_type: "aberration",
      size: "large",
      challenge_rating: "10",
      environment: ["Coast", "Underdark"],
    }),
    monsterFixture({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Wight",
      creature_type: "undead",
      size: "medium",
      challenge_rating: "3",
      environment: ["Ruins"],
    }),
  ];
}

function monsterFixture(
  override: {
    id: string;
    name: string;
    creature_type: string;
    size: "medium" | "large";
    challenge_rating: string;
    environment: string[];
  },
): MonsterBrowserRecord {
  return {
    id: override.id,
    name: override.name,
    description: null,
    publicDescription: null,
    tags: [],
    updatedAt: new Date("2026-05-09T00:00:00Z"),
    properties: {
      size: override.size,
      creature_type: override.creature_type,
      ac: 12,
      hp_average: 30,
      speed: { walk: 30 },
      abilities: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
      damage_resistances: [],
      damage_immunities: [],
      damage_vulnerabilities: [],
      condition_immunities: [],
      senses: [],
      languages: [],
      challenge_rating: override.challenge_rating,
      traits: [],
      actions: [],
      bonus_actions: [],
      reactions: [],
      legendary_actions: [],
      lair_actions: [],
      environment: override.environment,
    },
  };
}
