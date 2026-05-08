import { describe, expect, it } from "vitest";

import {
  buildNpcGeneratorPrompt,
  type ContextEntity,
  type NpcGeneratorContext,
  type RetrievedGeneratorContext,
  type StyleCalibrationResult,
} from "@/lib/generators";

const campaignId = "11111111-1111-4111-8111-111111111111";
const locationId = "22222222-2222-4222-8222-222222222222";
const factionId = "33333333-3333-4333-8333-333333333333";
const npcId = "44444444-4444-4444-8444-444444444444";

describe("buildNpcGeneratorPrompt", () => {
  it("builds a Sherdan-style NPC prompt with context and required output fields", () => {
    const prompt = buildNpcGeneratorPrompt(contextFixture());

    expect(prompt.options).toEqual({
      temperature: 0.65,
      maxTokens: 2600,
      thinking: false,
    });
    expect(prompt.input).toEqual([
      {
        role: "system",
        content: expect.stringContaining("campagna Sherdan"),
      },
      {
        role: "user",
        content: expect.stringContaining("# NPC Generator Request"),
      },
    ]);

    const user = userContent(prompt);
    expect(user).toContain("tipo richiesto: capitano");
    expect(user).toContain("narrative depth: principale");
    expect(user).toContain("Porto di Ferro");
    expect(user).toContain("Loggia delle Maree");
    expect(user).toContain("Capitana Vela");
    expect(user).toContain("## Campaign Style Calibration");
    expect(user).toContain("scrittura multi-sensoriale");
    expect(user).toContain("\"sensory_details\"");
    expect(user).toContain("\"voice\"");
    expect(user).toContain("\"tics\"");
    expect(user).toContain("\"weaknesses\"");
    expect(user).toContain("\"goals\"");
    expect(user).toContain("\"secrets\"");
    expect(user).toContain("surface | intermediate | deep");
    expect(user).toContain("differentiation_note");
  });

  it("adds depth-specific instructions for principal NPCs", () => {
    const prompt = buildNpcGeneratorPrompt(contextFixture());
    const user = userContent(prompt);

    expect(user).toContain("Includi segreti su tre layer");
    expect(user).toContain("surface, intermediate e deep");
  });

  it("injects a specific style reference without asking to copy details", () => {
    const prompt = buildNpcGeneratorPrompt(
      contextFixture({ styleEntityId: "55555555-5555-4555-8555-555555555555" }),
    );
    const user = userContent(prompt);

    expect(user).toContain("## Style Reference NPC");
    expect(user).toContain("Lunacupa");
    expect(user).toContain("Layered secrets:");
    expect(user).toContain("pattern ricorrenti da emulare");
    expect(user).toContain("non copiare nome, biografia, fazione o segreti");
    expect(user).toContain("style_reference_entity_id");
  });

  it("keeps cameo prompts lighter and allows option overrides", () => {
    const prompt = buildNpcGeneratorPrompt(
      contextFixture({ narrativeDepth: "comparsa" }),
      { options: { maxTokens: 900, model: "test-model" } },
    );

    expect(prompt.options).toEqual({
      temperature: 0.55,
      maxTokens: 900,
      thinking: false,
      model: "test-model",
    });
    expect(userContent(prompt)).toContain("Evita segreti profondi");
  });
});

function userContent(prompt: ReturnType<typeof buildNpcGeneratorPrompt>): string {
  if (typeof prompt.input === "string") return prompt.input;
  return prompt.input[1]?.content ?? "";
}

function contextFixture(
  overrides: Partial<NpcGeneratorContext["input"]> = {},
): NpcGeneratorContext {
  const location = entity({
    id: locationId,
    name: "Porto di Ferro",
    type: "location",
    description: "Porto industriale, umido di sale e vapore.",
    sources: ["anchor"],
  });
  const faction = entity({
    id: factionId,
    name: "Loggia delle Maree",
    type: "faction",
    description: "Compra informazioni tra i moli.",
    sources: ["relation"],
  });
  const npc = entity({
    id: npcId,
    name: "Capitana Vela",
    type: "npc",
    description: "Una capitana gia' nota al party.",
    sources: ["relation"],
  });
  const retrieved: RetrievedGeneratorContext = {
    anchor: location,
    related: [faction, npc],
    similar: [],
    entities: [location, faction, npc],
    relations: [],
    metadata: {
      maxRelated: 12,
      maxSimilar: 4,
      similaritySkipped: false,
    },
  };

  return {
    input: {
      campaignId,
      locationId,
      npcType: "capitano",
      partyLevel: 7,
      tone: "cupo",
      narrativeDepth: "principale",
      ...overrides,
    },
    location,
    styleReference: overrides.styleEntityId
      ? {
          id: overrides.styleEntityId,
          type: "npc",
          name: "Lunacupa",
          description:
            "Ferita carismatica con codice morale rigido e segreto familiare.",
          publicDescription: "Una capitana che non perdona i debiti.",
          properties: {
            voice: {
              tone: "fredda",
              speech_patterns: ["frasi brevi"],
            },
          },
          tags: ["domus-nova"],
          secrets: [
            {
              id: "66666666-6666-4666-8666-666666666666",
              entityId: overrides.styleEntityId,
              layer: "deep",
              content: "Protegge un parente creduto morto.",
              exploitHint: "Chi conosce il nome del parente puo' spezzarla.",
              discoveredAtSession: null,
              discoveryNotes: null,
            },
          ],
        }
      : null,
    nearbyFactions: [faction],
    nearbyNpcs: [npc],
    nearbyEntities: [faction, npc],
    retrieved,
    style: styleFixture(),
    metadata: {
      maxNearbyEntities: 12,
      maxSimilarEntities: 4,
      maxStyleEntities: 20,
      styleEntitiesAnalyzed: 3,
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

function styleFixture(): StyleCalibrationResult {
  return {
    profile: {
      entitiesAnalyzed: 3,
      entityTypes: { npc: 2, location: 1 },
      description: {
        describedEntities: 3,
        averageWords: 80,
        medianWords: 70,
        averageChars: 420,
      },
      features: {
        sensoryDetailsRatio: 0.6,
        voiceRatio: 0.4,
        ticsRatio: 0.3,
        goalsRatio: 0.3,
        weaknessesRatio: 0.3,
        publicDescriptionRatio: 0.2,
      },
      secretsByLayer: { surface: 1, intermediate: 1, deep: 1 },
      toneSignals: [
        { key: "sensory", label: "scrittura multi-sensoriale", hits: 8 },
      ],
      guidance: ["Use concrete sensory detail."],
    },
    examples: [],
    promptBlock:
      "## Style Calibration\n- Tone signals: scrittura multi-sensoriale\n### Guidance\n- Use concrete sensory detail.",
  };
}
