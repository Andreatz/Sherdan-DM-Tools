import { describe, expect, it } from "vitest";

import type {
  ContextEntity,
  RetrievedGeneratorContext,
  StyleCalibrationResult,
} from "@/lib/generators";
import {
  buildLootGeneratorPrompt,
  calculateDmgBaseGold,
  type LootGeneratorContext,
} from "@/lib/loot";

const campaignId = "11111111-1111-4111-8111-111111111111";
const anchorId = "22222222-2222-4222-8222-222222222222";
const factionId = "33333333-3333-4333-8333-333333333333";

describe("buildLootGeneratorPrompt", () => {
  it("builds a loot prompt with deterministic gold, context and lore-reference rules", () => {
    const baseGold = calculateDmgBaseGold({ partyLevel: 7, mode: "hoard" });
    const prompt = buildLootGeneratorPrompt(contextFixture(), { baseGold });

    expect(prompt.options).toEqual({
      temperature: 0.6,
      maxTokens: 2200,
      thinking: false,
    });
    expect(prompt.input).toEqual([
      {
        role: "system",
        content: expect.stringContaining("generatore di loot"),
      },
      {
        role: "user",
        content: expect.stringContaining("# Loot Generator Request"),
      },
    ]);

    const user = userContent(prompt);
    expect(user).toContain("- sorgente: agente di Tharros");
    expect(user).toContain(`- total gp: ${baseGold.totalGp}`);
    expect(user).toContain("Caposquadra Tharros");
    expect(user).toContain("Eclissi");
    expect(user).toContain("## Campaign Style Calibration");
    expect(user).toContain("lore_references");
    expect(user).toContain("cristallo di Obsidium grezzo");
    expect(user).toContain("scheggia di pietra-Scissione");
    expect(user).toContain("Non includere monete dentro `items`");
  });

  it("keeps sober loot smaller and allows option overrides", () => {
    const context = contextFixture({ narrativeDensity: "sobrio" });
    const prompt = buildLootGeneratorPrompt(context, {
      baseGold: calculateDmgBaseGold({ partyLevel: 3, mode: "hoard" }),
      options: { maxTokens: 900, model: "test-model" },
    });

    expect(prompt.options).toEqual({
      temperature: 0.45,
      maxTokens: 900,
      thinking: false,
      model: "test-model",
    });
    expect(userContent(prompt)).toContain("Genera 1-3 item");
  });
});

function userContent(prompt: ReturnType<typeof buildLootGeneratorPrompt>): string {
  if (typeof prompt.input === "string") return prompt.input;
  return prompt.input[1]?.content ?? "";
}

function contextFixture(
  overrides: Partial<LootGeneratorContext["input"]> = {},
): LootGeneratorContext {
  const anchor = entity({
    id: anchorId,
    name: "Caposquadra Tharros",
    type: "npc",
    description: "Trasporta frammenti di Obsidium verso un deposito segreto.",
    sources: ["anchor"],
    secrets: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        entityId: anchorId,
        layer: "intermediate",
        content: "La cassa contiene materiale per una frattura rituale.",
        exploitHint: "Il sigillo reagisce al sangue freddo.",
        discoveredAtSession: null,
        discoveryNotes: null,
      },
    ],
  });
  const faction = entity({
    id: factionId,
    name: "Eclissi",
    type: "faction",
    description: "Setta che commercia schegge di pietra-Scissione.",
    sources: ["relation"],
  });
  const retrieved: RetrievedGeneratorContext = {
    anchor,
    related: [faction],
    similar: [],
    entities: [anchor, faction],
    relations: [],
    metadata: {
      maxRelated: 12,
      maxSimilar: 8,
      similaritySkipped: false,
    },
  };

  return {
    input: {
      campaignId,
      source: "agente di Tharros",
      anchorEntityId: anchorId,
      partyLevel: 7,
      narrativeDensity: "ricco",
      ...overrides,
    },
    anchor,
    sourceEntity: anchor,
    relatedEntities: [faction],
    retrieved,
    style: styleFixture(),
    metadata: {
      maxRelatedEntities: 12,
      maxSimilarEntities: 8,
      maxStyleEntities: 80,
      styleEntitiesAnalyzed: 2,
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
      entitiesAnalyzed: 2,
      entityTypes: { npc: 1, faction: 1 },
      description: {
        describedEntities: 2,
        averageWords: 60,
        medianWords: 60,
        averageChars: 360,
      },
      features: {
        sensoryDetailsRatio: 0.5,
        voiceRatio: 0.2,
        ticsRatio: 0.1,
        goalsRatio: 0.1,
        weaknessesRatio: 0.1,
        publicDescriptionRatio: 0.4,
      },
      secretsByLayer: { surface: 0, intermediate: 1, deep: 0 },
      toneSignals: [
        { key: "industrial_arcane", label: "arcano-industriale", hits: 3 },
      ],
      guidance: ["Usa materiali e segni fisici specifici."],
    },
    examples: [],
    promptBlock:
      "## Style Calibration\n- Tone signals: arcano-industriale\n### Guidance\n- Usa materiali e segni fisici specifici.",
  };
}
