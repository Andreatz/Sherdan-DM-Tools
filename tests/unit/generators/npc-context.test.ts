import { describe, expect, it } from "vitest";

import {
  NpcGeneratorContextError,
  NpcGeneratorContextRetriever,
  type ContextEntity,
  type ContextRetrieverInput,
  type NpcGeneratorContextStore,
  type NpcGeneratorInput,
  type NpcGeneratorContextRetrieverLike,
  type RetrievedGeneratorContext,
  type StyleCalibratorEntity,
} from "@/lib/generators";

const campaignId = "11111111-1111-4111-8111-111111111111";
const locationId = "22222222-2222-4222-8222-222222222222";
const factionId = "33333333-3333-4333-8333-333333333333";
const npcId = "44444444-4444-4444-8444-444444444444";
const similarNpcId = "55555555-5555-4555-8555-555555555555";
const styleReferenceId = "66666666-6666-4666-8666-666666666666";

const input: NpcGeneratorInput = {
  campaignId,
  locationId,
  npcType: "capitano",
  partyLevel: 7,
  tone: "cupo",
  narrativeDepth: "principale",
};

describe("NpcGeneratorContextRetriever", () => {
  it("builds NPC-specific context from location context and campaign style", async () => {
    const contextRetriever = new FakeContextRetriever(contextFixture());
    const store = new FakeNpcContextStore(styleEntities());

    const context = await new NpcGeneratorContextRetriever(
      contextRetriever,
      store,
    ).retrieve(input, {
      maxNearbyEntities: 10,
      maxSimilarEntities: 4,
      maxStyleEntities: 3,
    });

    expect(contextRetriever.calls).toEqual([
      {
        anchorEntityId: locationId,
        maxRelated: 10,
        maxSimilar: 4,
        secretLayers: ["surface", "intermediate", "deep"],
      },
    ]);
    expect(store.calls).toEqual([{ campaignId, limit: 3 }]);
    expect(context.location).toMatchObject({
      id: locationId,
      name: "Porto di Ferro",
      type: "location",
    });
    expect(context.nearbyFactions.map((entity) => entity.id)).toEqual([
      factionId,
    ]);
    expect(context.nearbyNpcs.map((entity) => entity.id)).toEqual([
      npcId,
      similarNpcId,
    ]);
    expect(context.nearbyEntities.map((entity) => entity.id)).toEqual([
      factionId,
      npcId,
      similarNpcId,
    ]);
    expect(context.style.profile.entitiesAnalyzed).toBe(3);
    expect(context.style.profile.toneSignals.map((signal) => signal.key)).toContain(
      "industrial_arcane",
    );
    expect(context.metadata).toMatchObject({
      maxNearbyEntities: 10,
      maxSimilarEntities: 4,
      maxStyleEntities: 3,
      styleEntitiesAnalyzed: 3,
      similaritySkipped: false,
    });
  });

  it("loads an optional NPC style reference from the same campaign", async () => {
    const contextRetriever = new FakeContextRetriever(contextFixture());
    const store = new FakeNpcContextStore(styleEntities());

    const context = await new NpcGeneratorContextRetriever(
      contextRetriever,
      store,
    ).retrieve({
      ...input,
      styleEntityId: styleReferenceId,
    });

    expect(store.referenceCalls).toEqual([
      { campaignId, entityId: styleReferenceId },
    ]);
    expect(context.input.styleEntityId).toBe(styleReferenceId);
    expect(context.styleReference).toMatchObject({
      id: styleReferenceId,
      name: "Lunacupa",
      type: "npc",
    });
  });

  it("rejects a missing style reference", async () => {
    const contextRetriever = new FakeContextRetriever(contextFixture());
    const store = new FakeNpcContextStore(styleEntities());

    await expect(
      new NpcGeneratorContextRetriever(contextRetriever, store).retrieve({
        ...input,
        styleEntityId: "99999999-9999-4999-8999-999999999999",
      }),
    ).rejects.toMatchObject({
      name: "NpcGeneratorContextError",
      code: "style_reference_not_found",
    } satisfies Partial<NpcGeneratorContextError>);
  });

  it("validates input before retrieving context", async () => {
    const contextRetriever = new FakeContextRetriever(contextFixture());
    const store = new FakeNpcContextStore([]);

    await expect(
      new NpcGeneratorContextRetriever(contextRetriever, store).retrieve({
        ...input,
        locationId: "not-a-uuid",
      }),
    ).rejects.toMatchObject({
      name: "NpcGeneratorContextError",
      code: "invalid_input",
    } satisfies Partial<NpcGeneratorContextError>);
    expect(contextRetriever.calls).toEqual([]);
    expect(store.calls).toEqual([]);
  });

  it("rejects a non-location anchor", async () => {
    const contextRetriever = new FakeContextRetriever({
      ...contextFixture(),
      anchor: entity({ id: locationId, type: "npc", name: "Finta location" }),
    });

    await expect(
      new NpcGeneratorContextRetriever(
        contextRetriever,
        new FakeNpcContextStore([]),
      ).retrieve(input),
    ).rejects.toMatchObject({
      name: "NpcGeneratorContextError",
      code: "location_not_found",
    } satisfies Partial<NpcGeneratorContextError>);
  });

  it("rejects a location from another campaign", async () => {
    const contextRetriever = new FakeContextRetriever({
      ...contextFixture(),
      anchor: entity({
        id: locationId,
        name: "Porto sbagliato",
        type: "location",
        campaignId: "99999999-9999-4999-8999-999999999999",
      }),
    });

    await expect(
      new NpcGeneratorContextRetriever(
        contextRetriever,
        new FakeNpcContextStore([]),
      ).retrieve(input),
    ).rejects.toMatchObject({
      name: "NpcGeneratorContextError",
      code: "invalid_input",
    } satisfies Partial<NpcGeneratorContextError>);
  });
});

class FakeContextRetriever implements NpcGeneratorContextRetrieverLike {
  readonly calls: ContextRetrieverInput[] = [];

  constructor(private readonly context: RetrievedGeneratorContext) {}

  async retrieve(input: ContextRetrieverInput): Promise<RetrievedGeneratorContext> {
    this.calls.push(input);
    return this.context;
  }
}

class FakeNpcContextStore implements NpcGeneratorContextStore {
  readonly calls: Array<{ campaignId: string; limit: number }> = [];
  readonly referenceCalls: Array<{ campaignId: string; entityId: string }> = [];

  constructor(private readonly entities: StyleCalibratorEntity[]) {}

  async getCampaignStyleEntities(
    campaignId: string,
    limit: number,
  ): Promise<StyleCalibratorEntity[]> {
    this.calls.push({ campaignId, limit });
    return this.entities.slice(0, limit);
  }

  async getStyleReferenceEntity(
    campaignId: string,
    entityId: string,
  ): Promise<StyleCalibratorEntity | null> {
    this.referenceCalls.push({ campaignId, entityId });
    const entity = this.entities.find((item) => item.id === entityId);
    return entity?.type === "npc" ? entity : null;
  }
}

function contextFixture(): RetrievedGeneratorContext {
  const location = entity({
    id: locationId,
    name: "Porto di Ferro",
    type: "location",
  });
  const faction = entity({
    id: factionId,
    name: "Loggia delle Maree",
    type: "faction",
    sources: ["relation"],
  });
  const npc = entity({
    id: npcId,
    name: "Capitana Vela",
    type: "npc",
    sources: ["relation"],
  });
  const similarNpc = entity({
    id: similarNpcId,
    name: "Ivar",
    type: "npc",
    sources: ["similarity"],
    similarity: { distance: 0.15, score: 0.85 },
  });

  return {
    anchor: location,
    related: [faction, npc],
    similar: [similarNpc],
    entities: [location, faction, npc, similarNpc],
    relations: [],
    metadata: {
      maxRelated: 10,
      maxSimilar: 4,
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
      id: styleReferenceId,
      type: "npc",
      name: "Lunacupa",
      description:
        "Odora di sale, fumo e metallo freddo. Parla poco, ma ogni frase pesa come una sentenza.",
      publicDescription: null,
      properties: {
        sensory_details: {
          smell: "sale e fumo",
          sound: "voce bassa",
        },
      },
      tags: ["porto"],
      secrets: [],
    },
    {
      id: "77777777-7777-4777-8777-777777777777",
      type: "location",
      name: "Fucina di Tharros",
      description:
        "La fucina pulsa di luce azzurra, tra ingranaggi, obsidium e vapore.",
      publicDescription: null,
      properties: {},
      tags: ["obsidium", "tharros"],
      secrets: [],
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      type: "faction",
      name: "Synapse",
      description:
        "Una fazione che compra silenzi e vende tecnologia come fosse indulgenza.",
      publicDescription: null,
      properties: {},
      tags: ["fazione"],
      secrets: [],
    },
  ];
}
