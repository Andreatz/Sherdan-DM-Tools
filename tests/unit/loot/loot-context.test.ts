import { describe, expect, it } from "vitest";

import {
  LootGeneratorContextError,
  LootGeneratorContextRetriever,
  type LootGeneratorContextStore,
  type LootGeneratorContextRetrieverLike,
  type LootGeneratorInput,
} from "@/lib/loot";
import {
  type ContextEntity,
  type ContextRetrieverInput,
  type RetrievedGeneratorContext,
  type StyleCalibratorEntity,
} from "@/lib/generators";

const campaignId = "11111111-1111-4111-8111-111111111111";
const anchorEntityId = "22222222-2222-4222-8222-222222222222";
const relatedEntityId = "33333333-3333-4333-8333-333333333333";

const input: LootGeneratorInput = {
  campaignId,
  source: "bandit",
  anchorEntityId,
  partyLevel: 7,
  narrativeDensity: "ricco",
};

describe("LootGeneratorContextRetriever", () => {
  it("builds loot context from an optional anchor entity", async () => {
    const contextRetriever = new FakeContextRetriever(contextFixture());
    const store = new FakeLootContextStore(styleEntities());

    const context = await new LootGeneratorContextRetriever(
      contextRetriever,
      store,
    ).retrieve(input, {
      maxRelatedEntities: 6,
      maxSimilarEntities: 3,
      maxStyleEntities: 2,
    });

    expect(contextRetriever.calls).toEqual([
      {
        anchorEntityId,
        maxRelated: 6,
        maxSimilar: 3,
        secretLayers: ["surface", "intermediate", "deep"],
      },
    ]);
    expect(store.calls).toEqual([{ campaignId, limit: 2 }]);
    expect(context.anchor).toMatchObject({
      id: anchorEntityId,
      name: "Banda del Molo",
      type: "faction",
    });
    expect(context.sourceEntity?.id).toBe(anchorEntityId);
    expect(context.relatedEntities.map((entity) => entity.id)).toEqual([
      relatedEntityId,
    ]);
    expect(context.style.profile.entitiesAnalyzed).toBe(2);
    expect(context.metadata).toMatchObject({
      maxRelatedEntities: 6,
      maxSimilarEntities: 3,
      maxStyleEntities: 2,
      styleEntitiesAnalyzed: 2,
      similaritySkipped: false,
    });
  });

  it("supports text-only source input without context retriever calls", async () => {
    const contextRetriever = new FakeContextRetriever(contextFixture());
    const store = new FakeLootContextStore(styleEntities());

    const context = await new LootGeneratorContextRetriever(
      contextRetriever,
      store,
    ).retrieve({
      ...input,
      anchorEntityId: undefined,
      source: "dragon",
    });

    expect(contextRetriever.calls).toEqual([]);
    expect(store.calls).toEqual([{ campaignId, limit: 80 }]);
    expect(context.anchor).toBeNull();
    expect(context.sourceEntity).toBeNull();
    expect(context.relatedEntities).toEqual([]);
    expect(context.input.source).toBe("dragon");
  });

  it("validates input before retrieving context", async () => {
    const contextRetriever = new FakeContextRetriever(contextFixture());
    const store = new FakeLootContextStore([]);

    await expect(
      new LootGeneratorContextRetriever(contextRetriever, store).retrieve({
        ...input,
        partyLevel: 99,
      }),
    ).rejects.toMatchObject({
      name: "LootGeneratorContextError",
      code: "invalid_input",
    } satisfies Partial<LootGeneratorContextError>);
    expect(contextRetriever.calls).toEqual([]);
    expect(store.calls).toEqual([]);
  });

  it("rejects anchor entities from another campaign", async () => {
    const contextRetriever = new FakeContextRetriever({
      ...contextFixture(),
      anchor: entity({
        id: anchorEntityId,
        name: "Banda sbagliata",
        campaignId: "99999999-9999-4999-8999-999999999999",
      }),
    });

    await expect(
      new LootGeneratorContextRetriever(
        contextRetriever,
        new FakeLootContextStore([]),
      ).retrieve(input),
    ).rejects.toMatchObject({
      name: "LootGeneratorContextError",
      code: "anchor_campaign_mismatch",
    } satisfies Partial<LootGeneratorContextError>);
  });
});

class FakeContextRetriever implements LootGeneratorContextRetrieverLike {
  readonly calls: ContextRetrieverInput[] = [];

  constructor(private readonly context: RetrievedGeneratorContext) {}

  async retrieve(input: ContextRetrieverInput): Promise<RetrievedGeneratorContext> {
    this.calls.push(input);
    return this.context;
  }
}

class FakeLootContextStore implements LootGeneratorContextStore {
  readonly calls: Array<{ campaignId: string; limit: number }> = [];

  constructor(private readonly entities: StyleCalibratorEntity[]) {}

  async getCampaignStyleEntities(
    campaignId: string,
    limit: number,
  ): Promise<StyleCalibratorEntity[]> {
    this.calls.push({ campaignId, limit });
    return this.entities.slice(0, limit);
  }
}

function contextFixture(): RetrievedGeneratorContext {
  const anchor = entity({
    id: anchorEntityId,
    name: "Banda del Molo",
    type: "faction",
    sources: ["anchor"],
  });
  const related = entity({
    id: relatedEntityId,
    name: "Arborea",
    type: "location",
    sources: ["relation"],
  });

  return {
    anchor,
    related: [related],
    similar: [],
    entities: [anchor, related],
    relations: [],
    metadata: {
      maxRelated: 6,
      maxSimilar: 3,
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
    sources: ["anchor"],
    relations: [],
    similarity: null,
    identities: [],
    secrets: [],
    ...overrides,
  };
}

function styleEntities(): StyleCalibratorEntity[] {
  return [
    {
      id: "44444444-4444-4444-8444-444444444444",
      type: "item",
      name: "Cristallo di Obsidium",
      description: "Un frammento freddo, nero, quasi vivo.",
      publicDescription: null,
      properties: {},
      tags: ["obsidium"],
      secrets: [],
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      type: "location",
      name: "Arborea",
      description: "Radici, sale e marcescenza.",
      publicDescription: null,
      properties: {
        atmosphere: {
          smell: "resina e sale",
          sound: "legno vivo che scricchiola",
        },
      },
      tags: ["lore"],
      secrets: [],
    },
  ];
}
