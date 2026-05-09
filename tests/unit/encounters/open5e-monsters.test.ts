import { describe, expect, it } from "vitest";

import {
  buildOpen5eCreaturesUrl,
  open5eCreatureSchema,
  open5eCreatureToEntityDraft,
  OPEN5E_DEFAULT_SRD_DOCUMENT,
  type Open5eCreature,
} from "@/lib/encounters";

describe("open5e monster importer", () => {
  it("builds a V2 SRD creatures URL with nested document filtering", () => {
    const url = new URL(buildOpen5eCreaturesUrl());

    expect(url.origin).toBe("https://api.open5e.com");
    expect(url.pathname).toBe("/v2/creatures/");
    expect(url.searchParams.get("document__key__in")).toBe(
      OPEN5E_DEFAULT_SRD_DOCUMENT,
    );
    expect(url.searchParams.get("ordering")).toBe("name");
  });

  it("maps an Open5e creature to a valid monster entity draft", () => {
    const draft = open5eCreatureToEntityDraft(abolethFixture());

    expect(draft).toMatchObject({
      name: "Aboleth",
      publicDescription: "Aboleth, large aberration, CR 10.",
      tags: expect.arrayContaining([
        "monster",
        "srd",
        "open5e",
        "open5e:srd-2014_aboleth",
        "source:srd-2014",
        "cr:10",
        "type:aberration",
        "size:large",
        "environment:underdark",
      ]),
    });
    expect(draft.properties).toMatchObject({
      size: "large",
      creature_type: "aberration",
      ac: 17,
      hp_average: 135,
      speed: { walk: 10, swim: 40 },
      abilities: {
        str: 21,
        dex: 9,
        con: 15,
        int: 18,
        wis: 15,
        cha: 18,
      },
      challenge_rating: "10",
      xp: 5900,
      source: "open5e:srd-2014",
      senses: expect.arrayContaining([
        "darkvision 120 ft.",
        "passive Perception 20",
      ]),
      languages: ["Deep Speech", "telepathy 120 ft."],
      environment: ["Underdark"],
    });
    expect(draft.properties.traits[0]).toMatchObject({
      name: "Amphibious",
    });
    expect(draft.properties.actions[0]).toMatchObject({
      name: "Multiattack",
    });
    expect(draft.properties.legendary_actions[0]).toMatchObject({
      name: "Detect",
      usage: "cost 1",
    });
  });

  it("keeps fractional CR values in D&D notation", () => {
    const creature = abolethFixture({
      key: "srd-2014_crawling-claw",
      name: "Crawling Claw",
      challenge_rating: 0.125,
      experience_points: 25,
    });

    const draft = open5eCreatureToEntityDraft(creature);

    expect(draft.properties.challenge_rating).toBe("1/8");
    expect(draft.tags).toContain("cr:1/8");
  });
});

function abolethFixture(
  override: Partial<Open5eCreature> = {},
): Open5eCreature {
  return open5eCreatureSchema.parse({
    key: "srd-2014_aboleth",
    name: "Aboleth",
    document: { name: "System Reference Document 5.1", key: "srd-2014" },
    type: { name: "Aberration", key: "aberration" },
    size: { name: "Large", key: "large" },
    challenge_rating: 10,
    proficiency_bonus: 4,
    speed_all: {
      walk: 10,
      swim: 40,
      unit: "feet",
      hover: false,
    },
    category: "Monsters",
    subcategory: null,
    alignment: "lawful evil",
    languages: {
      as_string: "Deep Speech, telepathy 120 ft.",
    },
    armor_class: 17,
    armor_detail: "natural armor",
    hit_points: 135,
    hit_dice: "18d10+36",
    experience_points: 5900,
    ability_scores: {
      strength: 21,
      dexterity: 9,
      constitution: 15,
      intelligence: 18,
      wisdom: 15,
      charisma: 18,
    },
    saving_throws: { constitution: 6, intelligence: 8, wisdom: 6 },
    skill_bonuses: { history: 12, perception: 10 },
    passive_perception: 20,
    resistances_and_immunities: {
      damage_immunities: [],
      damage_resistances: [{ name: "Psychic", key: "psychic" }],
      damage_vulnerabilities: [],
      condition_immunities: [],
    },
    darkvision_range: 120,
    blindsight_range: null,
    tremorsense_range: null,
    truesight_range: null,
    actions: [
      {
        name: "Detect",
        desc: "The aboleth makes a Wisdom (Perception) check.",
        action_type: "LEGENDARY_ACTION",
        order_in_statblock: 1,
        legendary_action_cost: 1,
        usage_limits: null,
      },
      {
        name: "Multiattack",
        desc: "The aboleth makes three tentacle attacks.",
        action_type: "ACTION",
        order_in_statblock: 0,
      },
    ],
    traits: [
      {
        name: "Amphibious",
        desc: "The aboleth can breathe air and water.",
      },
    ],
    environments: [{ name: "Underdark", key: "underdark" }],
    illustration: null,
    ...override,
  });
}
