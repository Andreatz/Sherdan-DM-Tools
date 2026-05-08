import { describe, expect, it } from "vitest";

import {
  buildNpcSaveEmbeddingText,
  npcOutputToEntityInsert,
  npcOutputToSecretInserts,
  parseNpcGeneratorSaveRequest,
  type NpcGeneratorInput,
  type NpcGeneratorOutput,
} from "@/lib/generators";

const campaignId = "11111111-1111-4111-8111-111111111111";
const locationId = "22222222-2222-4222-8222-222222222222";

describe("NPC save utilities", () => {
  it("maps generator output to an NPC entity insert", () => {
    const entity = npcOutputToEntityInsert(sampleInput(), sampleOutput());

    expect(entity).toMatchObject({
      campaignId,
      type: "npc",
      name: "Capitana Rame",
      description: "Tiene Arborea stabile con accordi sporchi.",
      publicDescription: "Capitana portuale severa.",
      properties: sampleOutput().properties,
      parentId: locationId,
      visibility: "dm_only",
    });
    expect(entity.tags).toEqual(["npc", "generated", "porto", "capitano"]);
  });

  it("can attach a generated embedding to the entity insert", () => {
    const embedding = Array.from({ length: 1024 }, (_, index) => index / 1024);
    const entity = npcOutputToEntityInsert(sampleInput(), sampleOutput(), {
      embedding,
    });

    expect(entity.embedding).toBe(embedding);
  });

  it("maps generated secrets to entity_secret inserts", () => {
    const secrets = npcOutputToSecretInserts(
      sampleInput(),
      sampleOutput(),
      "55555555-5555-4555-8555-555555555555",
    );

    expect(secrets).toEqual([
      {
        campaignId,
        entityId: "55555555-5555-4555-8555-555555555555",
        plotThreadId: null,
        layer: "surface",
        content: "Ha un debito.",
        exploitHint: "Una ricevuta nascosta.",
        discoveredAtSession: null,
        discoveryNotes: null,
      },
      {
        campaignId,
        entityId: "55555555-5555-4555-8555-555555555555",
        plotThreadId: null,
        layer: "intermediate",
        content: "Sta coprendo un traditore.",
        exploitHint: null,
        discoveredAtSession: null,
        discoveryNotes: null,
      },
    ]);
  });

  it("validates saved output against the requested narrative depth", () => {
    expect(() =>
      parseNpcGeneratorSaveRequest({
        input: { ...sampleInput(), narrativeDepth: "comparsa" },
        output: sampleOutput({
          properties: {
            ...sampleOutput().properties,
            extra: {
              ...sampleOutput().properties.extra,
              narrative_depth: "comparsa",
            },
          },
          secrets: [
            {
              layer: "deep",
              content: "Conosce il nome perduto di Malakor.",
            },
          ],
        }),
      }),
    ).toThrow("Una comparsa non deve introdurre segreti deep");
  });

  it("builds embedding text with generated secrets", () => {
    const text = buildNpcSaveEmbeddingText(sampleInput(), sampleOutput());

    expect(text).toContain("Tipo: npc");
    expect(text).toContain("Nome: Capitana Rame");
    expect(text).toContain("Proprieta' strutturate:");
    expect(text).toContain("Segreti stratificati:");
    expect(text).toContain("- surface: Ha un debito.");
    expect(text).toContain("Sfruttabile: Una ricevuta nascosta.");
  });
});

function sampleInput(): NpcGeneratorInput {
  return {
    campaignId,
    locationId,
    npcType: "capitano",
    partyLevel: 7,
    tone: "cupo",
    narrativeDepth: "secondario",
  };
}

function sampleOutput(
  overrides: Partial<NpcGeneratorOutput> = {},
): NpcGeneratorOutput {
  return {
    name: "Capitana Rame",
    public_description: "Capitana portuale severa.",
    description: "Tiene Arborea stabile con accordi sporchi.",
    tags: ["NPC", "generated", "porto", "capitano", "porto"],
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
        exploit_hint: "Una ricevuta nascosta.",
      },
      {
        layer: "intermediate",
        content: "Sta coprendo un traditore.",
      },
    ],
    ...overrides,
  };
}
