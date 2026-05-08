import { describe, expect, it } from "vitest";

import type { LLMProvider } from "@/lib/llm";
import {
  buildLootItemEmbeddingText,
  calculateDmgBaseGold,
  lootItemToEntityInsert,
  LootItemResolver,
  type LootGeneratorItem,
  type LootGeneratorOutput,
  type LootItemCandidate,
  type LootItemResolverStore,
} from "@/lib/loot";

const campaignId = "11111111-1111-4111-8111-111111111111";
const existingItemId = "22222222-2222-4222-8222-222222222222";

describe("LootItemResolver", () => {
  it("reuses an existing item when similarity passes the threshold", async () => {
    const provider = new FakeProvider(vector(0.1));
    const store = new FakeStore([
      candidate({ distance: 0.04, name: "Cristallo di Obsidium grezzo" }),
    ]);
    const resolver = new LootItemResolver(store, () => provider);

    const resolved = await resolver.resolve(outputFixture(), {
      reuseThreshold: 0.9,
    });

    expect(resolved.metadata).toMatchObject({
      reusedCount: 1,
      createCount: 0,
      reuseThreshold: 0.9,
      maxCandidates: 5,
    });
    expect(resolved.items[0]).toMatchObject({
      action: "reuse",
      match: expect.objectContaining({
        id: existingItemId,
        score: 0.96,
      }),
      entityInsert: null,
    });
    expect(store.calls[0]).toMatchObject({
      campaignId,
      limit: 5,
      embedding: vector(0.1),
    });
    expect(provider.embeddedTexts[0]).toContain("Cristallo di Obsidium grezzo");
  });

  it("prepares a new item entity insert when no candidate is close enough", async () => {
    const resolver = new LootItemResolver(
      new FakeStore([candidate({ distance: 0.25 })]),
      () => new FakeProvider(vector(0.2)),
    );

    const resolved = await resolver.resolve(outputFixture(), {
      reuseThreshold: 0.9,
      maxCandidates: 3,
    });

    const item = resolved.items[0];
    expect(item?.action).toBe("create");
    expect(item?.match?.score).toBe(0.75);
    expect(item?.entityInsert).toMatchObject({
      campaignId,
      type: "item",
      name: "Cristallo di Obsidium grezzo",
      description: "Un cristallo nero attraversato da venature color petrolio.",
      publicDescription: "Un minerale raro e instabile.",
      tags: ["item", "loot", "generated", "obsidium", "material", "uncommon"],
      visibility: "dm_only",
      embedding: vector(0.2),
      properties: expect.objectContaining({
        kind: "material",
        rarity: "uncommon",
        value_gp: 125,
      }),
    });
    expect(resolved.metadata).toMatchObject({
      reusedCount: 0,
      createCount: 1,
      maxCandidates: 3,
    });
  });

  it("builds embedding text with effects and lore references", () => {
    const text = buildLootItemEmbeddingText(itemFixture());

    expect(text).toContain("Tipo: item");
    expect(text).toContain("Nome: Cristallo di Obsidium grezzo");
    expect(text).toContain("Effetti:");
    expect(text).toContain("componente per rituali di frattura");
    expect(text).toContain("Riferimenti lore:");
    expect(text).toContain("Tharros");
    expect(text).toContain("entity-name-only");
  });

  it("validates embedding dimensions when preparing item inserts", () => {
    expect(() =>
      lootItemToEntityInsert(outputFixture(), itemFixture(), {
        embedding: [1, 2, 3],
      }),
    ).toThrow("Embedding dimension mismatch");
  });
});

class FakeStore implements LootItemResolverStore {
  readonly calls: Array<{
    campaignId: string;
    embedding: number[];
    limit: number;
  }> = [];

  constructor(private readonly candidates: LootItemCandidate[]) {}

  async findSimilarItems(input: {
    campaignId: string;
    embedding: number[];
    limit: number;
  }): Promise<LootItemCandidate[]> {
    this.calls.push(input);
    return this.candidates.slice(0, input.limit);
  }
}

class FakeProvider implements LLMProvider {
  readonly embeddedTexts: string[] = [];

  constructor(private readonly embedding: number[]) {}

  complete(): Promise<string> {
    throw new Error("complete non usato in questo test");
  }

  completeStructured<T>(): Promise<T> {
    throw new Error("completeStructured non usato in questo test");
  }

  async *stream(): AsyncIterable<string> {
    throw new Error("stream non usato in questo test");
  }

  async embed(text: string): Promise<number[]> {
    this.embeddedTexts.push(text);
    return this.embedding;
  }

  embedBatch(): Promise<number[][]> {
    throw new Error("embedBatch non usato in questo test");
  }
}

function outputFixture(): LootGeneratorOutput {
  return {
    baseGold: calculateDmgBaseGold({ partyLevel: 7, mode: "hoard" }),
    narrativeSummary: "Bottino di una consegna interrotta.",
    gmNotes: null,
    hooks: ["Il sigillo della cassa punta a Tharros."],
    items: [itemFixture()],
    totalEstimatedValueGp: 3982,
    metadata: {
      campaignId,
      source: "agente di Tharros",
      anchorEntityId: null,
      partyLevel: 7,
      narrativeDensity: "ricco",
      contextEntitiesUsed: 0,
    },
  };
}

function itemFixture(): LootGeneratorItem {
  return {
    name: "Cristallo di Obsidium grezzo",
    kind: "material",
    rarity: "uncommon",
    quantity: 1,
    value_gp: 125,
    attunement: false,
    description: "Un cristallo nero attraversato da venature color petrolio.",
    public_description: "Un minerale raro e instabile.",
    effects: ["Funziona come componente per rituali di frattura."],
    origin: "Tharros",
    tags: ["obsidium"],
    lore_references: [
      {
        entity_id: "33333333-3333-4333-8333-333333333333",
        entity_name: "Tharros",
        reason: "La sorgente del bottino e' un suo agente.",
        source_section: "anchor",
      },
      {
        entity_name: "entity-name-only",
        reason: "Riferimento senza record wiki ancora disponibile.",
      },
    ],
    extra: {},
  };
}

function candidate(
  overrides: Partial<LootItemCandidate> = {},
): LootItemCandidate {
  const distance = overrides.distance ?? 0.1;
  return {
    id: existingItemId,
    name: "Cristallo affine",
    description: "Un oggetto simile gia' presente nel wiki.",
    publicDescription: "Un cristallo nero.",
    properties: {},
    tags: ["item", "loot"],
    visibility: "dm_only",
    distance,
    score: Math.max(0, Math.min(1, 1 - distance)),
    ...overrides,
  };
}

function vector(value: number): number[] {
  return Array.from({ length: 1024 }, () => value);
}
