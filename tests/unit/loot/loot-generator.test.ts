import { z } from "zod";
import { describe, expect, it } from "vitest";

import type {
  CompleteOptions,
  LLMInput,
  LLMProvider,
} from "@/lib/llm";
import { runGenerator } from "@/lib/generators";
import type { StyleCalibrationResult } from "@/lib/generators";
import {
  calculateDmgBaseGold,
  LootGenerator,
  type LootGeneratorContext,
  type LootGeneratorInput,
  type LootGeneratorLLMOutput,
} from "@/lib/loot";

const campaignId = "11111111-1111-4111-8111-111111111111";

describe("LootGenerator", () => {
  it("combines deterministic DMG gold with structured LLM items", async () => {
    const retriever = new FakeLootContextRetriever();
    const provider = new FakeProvider(sampleLLMOutput());
    const input = {
      campaignId,
      source: "agente di Tharros",
      partyLevel: 7,
      narrativeDensity: "ricco",
    };

    const result = await runGenerator(new LootGenerator(retriever), input, {
      llm: provider,
      persist: false,
    });

    const expectedGold = calculateDmgBaseGold({
      partyLevel: 7,
      mode: "hoard",
    });
    expect(result.output.baseGold).toEqual(expectedGold);
    expect(result.output.items[0]?.name).toBe("Cristallo di Obsidium grezzo");
    expect(result.output.items[0]?.lore_references[0]?.entity_name).toBe(
      "Tharros",
    );
    expect(result.output.totalEstimatedValueGp).toBe(
      expectedGold.totalGp + 125,
    );
    expect(result.persisted).toBeNull();
    expect(retriever.calls).toEqual([
      expect.objectContaining({ source: "agente di Tharros" }),
    ]);
    expect(provider.calls[0]?.options).toMatchObject({
      temperature: 0.6,
      maxTokens: 2200,
      thinking: false,
    });
  });
});

class FakeLootContextRetriever {
  readonly calls: unknown[] = [];

  async retrieve(input: unknown): Promise<LootGeneratorContext> {
    this.calls.push(input);
    return contextFixture(input as LootGeneratorInput);
  }
}

class FakeProvider implements LLMProvider {
  readonly calls: Array<{ input: LLMInput; options: CompleteOptions | undefined }> = [];

  constructor(private readonly structuredOutput: LootGeneratorLLMOutput) {}

  complete(): Promise<string> {
    throw new Error("complete non usato in questo test");
  }

  async completeStructured<T>(
    input: LLMInput,
    _schema: z.ZodType<T>,
    options?: CompleteOptions,
  ): Promise<T> {
    this.calls.push({ input, options });
    return this.structuredOutput as T;
  }

  async *stream(): AsyncIterable<string> {
    throw new Error("stream non usato in questo test");
  }

  embed(): Promise<number[]> {
    throw new Error("embed non usato in questo test");
  }

  embedBatch(): Promise<number[][]> {
    throw new Error("embedBatch non usato in questo test");
  }
}

function sampleLLMOutput(): LootGeneratorLLMOutput {
  return {
    narrative_summary: "Una consegna arcana spezzata a meta'.",
    hooks: ["La cera sul sigillo proviene da un laboratorio di Tharros."],
    items: [
      {
        name: "Cristallo di Obsidium grezzo",
        kind: "material",
        rarity: "uncommon",
        quantity: 1,
        value_gp: 125,
        attunement: false,
        description: "Un cristallo nero che vibra come una corda tesa.",
        effects: ["Puo' alimentare un rituale di frattura minore."],
        origin: "Tharros",
        tags: ["loot", "obsidium"],
        lore_references: [
          {
            entity_name: "Tharros",
            reason: "Il bottino proviene da un suo agente.",
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
