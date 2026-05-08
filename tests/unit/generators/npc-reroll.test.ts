import { describe, expect, it } from "vitest";

import {
  buildNpcRerollPrompt,
  npcRerollPatchSchemaForField,
  type NpcGeneratorContext,
  type NpcGeneratorOutput,
} from "@/lib/generators";

describe("NPC reroll helpers", () => {
  it("builds a focused prompt for a single field", () => {
    const prompt = buildNpcRerollPrompt({
      context: contextFixture(),
      output: outputFixture(),
      field: "voice",
    });

    expect(prompt.options).toEqual({
      temperature: 0.65,
      maxTokens: 500,
      thinking: false,
    });
    expect(JSON.stringify(prompt.input)).toContain("# Target Field");
    expect(JSON.stringify(prompt.input)).toContain("voice");
    expect(JSON.stringify(prompt.input)).toContain("Capitana Rame");
    expect(JSON.stringify(prompt.input)).toContain("Porto di Ferro");
  });

  it("returns patch schemas for supported reroll fields", () => {
    expect(npcRerollPatchSchemaForField("name").parse({ name: " Mara " })).toEqual({
      name: "Mara",
    });
    expect(
      npcRerollPatchSchemaForField("voice").parse({
        voice: { tone: "bassa", speech_patterns: ["frasi brevi"] },
      }),
    ).toEqual({
      voice: { tone: "bassa", speech_patterns: ["frasi brevi"] },
    });
    expect(
      npcRerollPatchSchemaForField("deep_secret").parse({
        secret: { layer: "deep", content: "Ha venduto una rotta." },
      }),
    ).toEqual({
      secret: { layer: "deep", content: "Ha venduto una rotta." },
    });
  });
});

function contextFixture(): NpcGeneratorContext {
  return {
    input: {
      campaignId: "11111111-1111-4111-8111-111111111111",
      locationId: "22222222-2222-4222-8222-222222222222",
      npcType: "capitano",
      partyLevel: 7,
      tone: "cupo",
      narrativeDepth: "secondario",
    },
    location: {
      id: "22222222-2222-4222-8222-222222222222",
      campaignId: "11111111-1111-4111-8111-111111111111",
      type: "location",
      name: "Porto di Ferro",
      description: "Moli, vapore e obsidium.",
      publicDescription: null,
      properties: {},
      tags: [],
      parentId: null,
      visibility: "dm_only",
      sources: ["anchor"],
      relations: [],
      similarity: null,
      identities: [],
      secrets: [],
    },
    nearbyFactions: [],
    nearbyNpcs: [],
    nearbyEntities: [],
    retrieved: {
      anchor: undefined as never,
      related: [],
      similar: [],
      entities: [],
      relations: [],
      metadata: { maxRelated: 0, maxSimilar: 0, similaritySkipped: false },
    },
    style: {
      profile: {
        entitiesAnalyzed: 0,
        entityTypes: {},
        description: {
          describedEntities: 0,
          averageWords: 0,
          medianWords: 0,
          averageChars: 0,
        },
        features: {
          sensoryDetailsRatio: 0,
          voiceRatio: 0,
          ticsRatio: 0,
          goalsRatio: 0,
          weaknessesRatio: 0,
          publicDescriptionRatio: 0,
        },
        secretsByLayer: { surface: 0, intermediate: 0, deep: 0 },
        toneSignals: [],
        guidance: [],
      },
      examples: [],
      promptBlock: "",
    },
    metadata: {
      maxNearbyEntities: 0,
      maxSimilarEntities: 0,
      maxStyleEntities: 0,
      styleEntitiesAnalyzed: 0,
      similaritySkipped: false,
    },
  };
}

function outputFixture(): NpcGeneratorOutput {
  return {
    name: "Capitana Rame",
    public_description: "Capitana severa.",
    description: "Tiene il porto stabile.",
    tags: ["npc"],
    properties: {
      race: "umana",
      appearance_summary: "Uniforme cerata.",
      sensory_details: {
        sight: "rame",
        smell: "sale",
        sound: "voce bassa",
      },
      voice: { tone: "calma", speech_patterns: ["frasi brevi"] },
      tics: ["controlla le uscite"],
      mannerisms: ["resta in piedi"],
      motivations: ["proteggere il porto"],
      goals: {
        short_term: "fermare un sabotaggio",
        medium_term: "scoprire un traditore",
        long_term: "liberare il porto",
      },
      weaknesses: [
        {
          description: "Non sacrifica innocenti.",
          who_could_exploit: "Un nemico con ostaggi.",
        },
      ],
      extra: {
        npc_type: "capitano",
        tone: "cupo",
        narrative_depth: "secondario",
        location_id: "22222222-2222-4222-8222-222222222222",
        nearby_faction_ids: [],
        nearby_npc_ids: [],
        plot_hooks: [],
        differentiation_note: "Diversa dagli NPC esistenti.",
      },
    },
    secrets: [],
  };
}
