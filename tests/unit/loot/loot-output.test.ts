import { describe, expect, it } from "vitest";

import {
  calculateDmgBaseGold,
  composeLootGeneratorOutput,
  lootGeneratorLLMOutputSchema,
  lootItemToItemProperties,
  type LootGeneratorContext,
  type LootGeneratorInput,
  type LootGeneratorLLMOutput,
} from "@/lib/loot";
import type { StyleCalibrationResult } from "@/lib/generators";

const campaignId = "11111111-1111-4111-8111-111111111111";

describe("lootGeneratorLLMOutputSchema", () => {
  it("accepts generated items with lore references and useful defaults", () => {
    const output = lootGeneratorLLMOutputSchema.parse({
      narrative_summary: "Il bottino puzza di contrabbando arcano.",
      items: [
        {
          name: "Scheggia di pietra-Scissione",
          kind: "material",
          description: "Una scheggia fredda che vibra vicino ai sigilli.",
          lore_references: [
            {
              entity_id: "22222222-2222-4222-8222-222222222222",
              entity_name: "Eclissi",
              reason: "La scheggia era cucita nel fodero di un cultista.",
            },
          ],
        },
      ],
    });

    expect(output.items[0]).toMatchObject({
      rarity: "common",
      quantity: 1,
      attunement: false,
      effects: [],
      tags: [],
    });
    expect(output.items[0]?.lore_references[0]?.entity_name).toBe("Eclissi");
  });

  it("composes deterministic gold with LLM items without losing metadata", () => {
    const input = inputFixture();
    const baseGold = calculateDmgBaseGold({
      partyLevel: input.partyLevel,
      mode: "hoard",
    });
    const output = composeLootGeneratorOutput(
      input,
      contextFixture(input),
      baseGold,
      sampleLLMOutput(),
    );

    expect(output.baseGold.totalGp).toBe(baseGold.totalGp);
    expect(output.totalEstimatedValueGp).toBe(baseGold.totalGp + 125);
    expect(output.metadata).toMatchObject({
      campaignId,
      source: "agente di Tharros",
      partyLevel: 7,
      narrativeDensity: "ricco",
      contextEntitiesUsed: 0,
    });
  });

  it("maps generated items to the shared item properties schema", () => {
    const properties = lootItemToItemProperties(sampleLLMOutput().items[0]!);

    expect(properties).toMatchObject({
      kind: "material",
      rarity: "uncommon",
      value_gp: 125,
      effects: ["Funziona come componente per rituali di frattura."],
      origin: "Tharros",
      extra: {
        quantity: 1,
        generated_by: "loot-generator",
        lore_references: [
          expect.objectContaining({ entity_name: "Tharros" }),
        ],
      },
    });
  });
});

function inputFixture(): LootGeneratorInput {
  return {
    campaignId,
    source: "agente di Tharros",
    partyLevel: 7,
    narrativeDensity: "ricco",
  };
}

function sampleLLMOutput(): LootGeneratorLLMOutput {
  return {
    narrative_summary: "Il bottino contiene segni di una consegna interrotta.",
    gm_notes: "La scheggia puo' puntare a un laboratorio nascosto.",
    hooks: ["Il marchio e' stato inciso dopo la morte del portatore."],
    items: [
      {
        name: "Cristallo di Obsidium grezzo",
        kind: "material",
        rarity: "uncommon",
        quantity: 1,
        value_gp: 125,
        attunement: false,
        description:
          "Un frammento nero attraversato da venature color petrolio.",
        public_description: "Un minerale raro e instabile.",
        effects: ["Funziona come componente per rituali di frattura."],
        origin: "Tharros",
        tags: ["loot", "obsidium"],
        lore_references: [
          {
            entity_name: "Tharros",
            reason: "La sorgente del bottino e' un suo agente.",
          },
        ],
        extra: {},
      },
    ],
  };
}

function contextFixture(input: LootGeneratorInput): LootGeneratorContext {
  return {
    input,
    anchor: null,
    sourceEntity: null,
    relatedEntities: [],
    retrieved: null,
    style: styleFixture(),
    metadata: {
      maxRelatedEntities: 12,
      maxSimilarEntities: 8,
      maxStyleEntities: 80,
      styleEntitiesAnalyzed: 0,
      similaritySkipped: true,
    },
  };
}

function styleFixture(): StyleCalibrationResult {
  return {
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
    promptBlock: "## Style Calibration\n- Minimal.",
  };
}
