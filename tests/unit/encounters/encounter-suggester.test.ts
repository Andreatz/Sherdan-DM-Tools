import { describe, expect, it } from "vitest";

import {
  encounterSuggesterInputSchema,
  filterSuggesterMonsters,
  monsterRecordToSuggesterMonster,
  suggestEncounterCompositions,
  type MonsterBrowserRecord,
  type SuggesterMonster,
} from "@/lib/encounters";

describe("encounter suggester", () => {
  it("validates form-shaped suggester input", () => {
    const input = encounterSuggesterInputSchema.parse({
      campaignId: "11111111-1111-4111-8111-111111111111",
      partyLevel: "5",
      partySize: "4",
      difficulty: "medium",
      maxSuggestions: "3",
    });

    expect(input).toMatchObject({
      partyLevel: 5,
      partySize: 4,
      difficulty: "medium",
      maxSuggestions: 3,
    });
  });

  it("maps browser records with XP to suggester monsters", () => {
    const monster = monsterRecordToSuggesterMonster(
      monsterRecordFixture({ id: "m1", name: "Wight", xp: 700 }),
    );

    expect(monster).toMatchObject({
      id: "m1",
      name: "Wight",
      xp: 700,
      challengeRating: "3",
      creatureType: "undead",
      size: "medium",
      environment: ["Ruins"],
    });
  });

  it("filters candidate monsters by tactical facets", () => {
    const monsters = monstersFixture();

    expect(
      filterSuggesterMonsters(monsters, {
        creatureType: "undead",
        environment: "Ruins",
        size: "medium",
      }).map((monster) => monster.name),
    ).toEqual(["Wight", "Skeleton"]);
  });

  it("suggests compositions matching requested difficulty", () => {
    const suggestions = suggestEncounterCompositions({
      partyLevel: 5,
      partySize: 4,
      difficulty: "medium",
      monsters: monstersFixture(),
      maxSuggestions: 4,
    });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).toHaveLength(4);
    expect(
      suggestions.every(
        (suggestion) => suggestion.difficulty.difficulty === "medium",
      ),
    ).toBe(true);
    expect(suggestions[0]?.participants.length).toBeGreaterThanOrEqual(1);
  });

  it("returns an empty list when no candidate can match the band", () => {
    const suggestions = suggestEncounterCompositions({
      partyLevel: 20,
      partySize: 8,
      difficulty: "deadly",
      monsters: [{ ...monstersFixture()[0]!, xp: 10 }],
    });

    expect(suggestions).toEqual([]);
  });
});

function monstersFixture(): SuggesterMonster[] {
  return [
    {
      id: "wight",
      name: "Wight",
      xp: 700,
      challengeRating: "3",
      creatureType: "undead",
      size: "medium",
      environment: ["Ruins"],
    },
    {
      id: "skeleton",
      name: "Skeleton",
      xp: 50,
      challengeRating: "1/4",
      creatureType: "undead",
      size: "medium",
      environment: ["Ruins"],
    },
    {
      id: "ogre",
      name: "Ogre",
      xp: 450,
      challengeRating: "2",
      creatureType: "giant",
      size: "large",
      environment: ["Hills"],
    },
    {
      id: "cultist",
      name: "Cultist",
      xp: 25,
      challengeRating: "1/8",
      creatureType: "humanoid",
      size: "medium",
      environment: ["Urban"],
    },
  ];
}

function monsterRecordFixture(input: {
  id: string;
  name: string;
  xp: number;
}): MonsterBrowserRecord {
  return {
    id: input.id,
    name: input.name,
    description: null,
    publicDescription: null,
    tags: [],
    updatedAt: new Date("2026-05-09T00:00:00Z"),
    properties: {
      size: "medium",
      creature_type: "undead",
      ac: 14,
      hp_average: 45,
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
      challenge_rating: "3",
      xp: input.xp,
      traits: [],
      actions: [],
      bonus_actions: [],
      reactions: [],
      legendary_actions: [],
      lair_actions: [],
      environment: ["Ruins"],
    },
  };
}
