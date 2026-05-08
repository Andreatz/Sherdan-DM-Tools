import { describe, expect, it } from "vitest";

import {
  applyNpcRerollPatch,
  summarizeNpcGeneratorContext,
  type ContextEntity,
  type NpcGeneratorContext,
  type NpcGeneratorOutput,
  type RetrievedGeneratorContext,
} from "@/lib/generators";

const campaignId = "11111111-1111-4111-8111-111111111111";
const locationId = "22222222-2222-4222-8222-222222222222";

describe("NPC preview utilities", () => {
  it("summarizes generator context for the preview UI", () => {
    const summary = summarizeNpcGeneratorContext(contextFixture());

    expect(summary).toEqual({
      location: { id: locationId, name: "Arborea" },
      nearbyFactions: [{ id: "faction-1", name: "Synapse" }],
      nearbyNpcs: [{ id: "npc-1", name: "Ivar" }],
      styleEntitiesAnalyzed: 12,
      similaritySkipped: false,
    });
  });

  it("applies name and voice reroll patches", () => {
    const renamed = applyNpcRerollPatch(sampleOutput(), "name", {
      name: "  Mara Rame  ",
    });
    expect(renamed.name).toBe("Mara Rame");

    const revoiced = applyNpcRerollPatch(sampleOutput(), "voice", {
      voice: {
        tone: "bassa, ironica",
        speech_patterns: ["fa pause prima dei nomi"],
      },
    });
    expect(revoiced.properties.voice).toEqual({
      tone: "bassa, ironica",
      speech_patterns: ["fa pause prima dei nomi"],
    });
  });

  it("replaces an existing secret layer or appends it when missing", () => {
    const replaced = applyNpcRerollPatch(sampleOutput(), "surface_secret", {
      secret: {
        layer: "surface",
        content: "Deve denaro alla Loggia.",
      },
    });
    expect(replaced.secrets[0]).toEqual({
      layer: "surface",
      content: "Deve denaro alla Loggia.",
    });

    const appended = applyNpcRerollPatch(
      { ...sampleOutput(), secrets: [] },
      "deep_secret",
      {
        secret: {
          layer: "surface",
          content: "Ha venduto una rotta proibita.",
        },
      },
    );
    expect(appended.secrets).toEqual([
      {
        layer: "deep",
        content: "Ha venduto una rotta proibita.",
      },
    ]);
  });
});

function contextFixture(): NpcGeneratorContext {
  const location = entity({ id: locationId, name: "Arborea", type: "location" });
  const faction = entity({ id: "faction-1", name: "Synapse", type: "faction" });
  const npc = entity({ id: "npc-1", name: "Ivar", type: "npc" });
  const retrieved: RetrievedGeneratorContext = {
    anchor: location,
    related: [faction, npc],
    similar: [],
    entities: [location, faction, npc],
    relations: [],
    metadata: { maxRelated: 2, maxSimilar: 0, similaritySkipped: false },
  };

  return {
    input: {
      campaignId,
      locationId,
      npcType: "capitano",
      partyLevel: 7,
      tone: "cupo",
      narrativeDepth: "secondario",
    },
    location,
    nearbyFactions: [faction],
    nearbyNpcs: [npc],
    nearbyEntities: [faction, npc],
    retrieved,
    style: {
      profile: {
        entitiesAnalyzed: 12,
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
      maxNearbyEntities: 2,
      maxSimilarEntities: 0,
      maxStyleEntities: 12,
      styleEntitiesAnalyzed: 12,
      similaritySkipped: false,
    },
  };
}

function entity(
  overrides: Partial<ContextEntity> & Pick<ContextEntity, "id" | "name">,
): ContextEntity {
  return {
    campaignId,
    type: "npc",
    description: null,
    publicDescription: null,
    properties: {},
    tags: [],
    parentId: null,
    visibility: "dm_only",
    sources: ["relation"],
    relations: [],
    similarity: null,
    identities: [],
    secrets: [],
    ...overrides,
  };
}

function sampleOutput(): NpcGeneratorOutput {
  return {
    name: "Capitana Rame",
    public_description: "Capitana portuale severa.",
    description: "Tiene Arborea stabile con accordi sporchi.",
    tags: ["npc", "generated"],
    properties: {
      race: "umana",
      appearance_summary: "Uniforme cerata e occhi duri.",
      sensory_details: {
        sight: "rame ossidato",
        smell: "sale",
        sound: "voce bassa",
      },
      voice: {
        tone: "calma",
        speech_patterns: ["frasi brevi"],
      },
      tics: ["controlla le uscite"],
      mannerisms: ["resta in piedi"],
      motivations: ["proteggere il porto"],
      goals: {
        short_term: "fermare un sabotaggio",
        medium_term: "scoprire un traditore",
        long_term: "liberare il porto dai ricatti",
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
        location_id: locationId,
        nearby_faction_ids: [],
        nearby_npc_ids: [],
        plot_hooks: [],
        differentiation_note: "Diversa dagli NPC militari esistenti.",
      },
    },
    secrets: [
      {
        layer: "surface",
        content: "Ha un debito.",
      },
    ],
  };
}
