import { describe, expect, it } from "vitest";

import {
  ContextRetriever,
  ContextRetrieverError,
  type ContextEntityRecord,
  type ContextIdentityRecord,
  type ContextRelationRecord,
  type ContextRetrieverStore,
  type ContextSecretRecord,
  type SimilarContextEntityRecord,
} from "@/lib/generators";

const campaignId = "00000000-0000-4000-8000-000000000001";
const anchorId = "00000000-0000-4000-8000-000000000101";
const relatedId = "00000000-0000-4000-8000-000000000102";
const incomingId = "00000000-0000-4000-8000-000000000103";
const similarId = "00000000-0000-4000-8000-000000000104";

describe("ContextRetriever", () => {
  it("retrieves anchor, relationship context, similarity context, identities and secrets", async () => {
    const store = new MemoryContextStore();
    const context = await new ContextRetriever(store).retrieve({
      anchorEntityId: anchorId,
      maxRelated: 2,
      maxSimilar: 2,
      secretLayers: ["surface", "deep"],
    });

    expect(context.anchor).toMatchObject({
      id: anchorId,
      name: "Malakor",
      sources: ["anchor"],
      identities: [
        expect.objectContaining({ name: "Dante Il Fortunato" }),
      ],
    });
    expect(context.related.map((entity) => entity.id)).toEqual([
      relatedId,
      incomingId,
    ]);
    expect(context.related[0]).toMatchObject({
      id: relatedId,
      sources: ["relation", "similarity"],
      relations: [
        expect.objectContaining({
          direction: "outgoing",
          relationType: "manipulates",
        }),
      ],
      secrets: [
        expect.objectContaining({
          layer: "deep",
          content: "Sa chi indossa la maschera.",
        }),
      ],
      similarity: { distance: 0.12, score: 0.88 },
    });
    expect(context.related[1]?.relations[0]).toMatchObject({
      direction: "incoming",
      relationType: "hunts",
    });
    expect(context.similar.map((entity) => entity.id)).toEqual([
      relatedId,
      similarId,
    ]);
    expect(context.entities.map((entity) => entity.id)).toEqual([
      anchorId,
      relatedId,
      incomingId,
      similarId,
    ]);
    expect(context.relations).toHaveLength(2);
    expect(store.lastSecretLayers).toEqual(["surface", "deep"]);
  });

  it("skips semantic similarity when the anchor has no embedding", async () => {
    const store = new MemoryContextStore({
      entities: [entity({ id: anchorId, name: "No embed", embedding: null })],
      relations: [],
      similar: [],
    });

    const context = await new ContextRetriever(store).retrieve({
      anchorEntityId: anchorId,
      maxSimilar: 3,
    });

    expect(context.similar).toEqual([]);
    expect(context.metadata.similaritySkipped).toBe(true);
    expect(store.findSimilarCalls).toBe(0);
  });

  it("throws a typed error when the anchor is missing", async () => {
    await expect(
      new ContextRetriever(new MemoryContextStore()).retrieve({
        anchorEntityId: "00000000-0000-4000-8000-000000009999",
      }),
    ).rejects.toMatchObject({
      name: "ContextRetrieverError",
      code: "anchor_not_found",
    } satisfies Partial<ContextRetrieverError>);
  });

  it("validates input before hitting the store", async () => {
    const store = new MemoryContextStore();

    await expect(
      new ContextRetriever(store).retrieve({
        anchorEntityId: "not-a-uuid",
      }),
    ).rejects.toMatchObject({
      name: "ContextRetrieverError",
      code: "invalid_input",
    } satisfies Partial<ContextRetrieverError>);
    expect(store.getEntityCalls).toBe(0);
  });
});

class MemoryContextStore implements ContextRetrieverStore {
  readonly entities: ContextEntityRecord[];
  readonly relations: ContextRelationRecord[];
  readonly identities: ContextIdentityRecord[];
  readonly secrets: ContextSecretRecord[];
  readonly similar: SimilarContextEntityRecord[];
  getEntityCalls = 0;
  findSimilarCalls = 0;
  lastSecretLayers: string[] | undefined;

  constructor(
    data: Partial<{
      entities: ContextEntityRecord[];
      relations: ContextRelationRecord[];
      identities: ContextIdentityRecord[];
      secrets: ContextSecretRecord[];
      similar: SimilarContextEntityRecord[];
    }> = {},
  ) {
    this.entities =
      data.entities ??
      [
        entity({ id: anchorId, name: "Malakor", embedding: [1, 0, 0] }),
        entity({ id: relatedId, name: "Dante", embedding: [0.9, 0.1, 0] }),
        entity({ id: incomingId, name: "Loggia", type: "organization" }),
        entity({ id: similarId, name: "Noel", embedding: [0.8, 0.2, 0] }),
      ];
    this.relations =
      data.relations ??
      [
        relation({
          id: "00000000-0000-4000-8000-000000000201",
          sourceEntityId: anchorId,
          targetEntityId: relatedId,
          relationType: "manipulates",
          strength: 5,
        }),
        relation({
          id: "00000000-0000-4000-8000-000000000202",
          sourceEntityId: incomingId,
          targetEntityId: anchorId,
          relationType: "hunts",
          strength: 3,
        }),
      ];
    this.identities =
      data.identities ??
      [
        {
          id: "00000000-0000-4000-8000-000000000301",
          entityId: anchorId,
          name: "Dante Il Fortunato",
          isTrueIdentity: false,
          appearance: "Sorriso da truffatore.",
          voice: "Calda e teatrale.",
          mannerisms: ["gioca con una moneta"],
          activeFromSession: null,
          activeUntilSession: null,
          visibility: "dm_only",
          notes: null,
        },
      ];
    this.secrets =
      data.secrets ??
      [
        {
          id: "00000000-0000-4000-8000-000000000401",
          entityId: relatedId,
          layer: "deep",
          content: "Sa chi indossa la maschera.",
          exploitHint: "Pressione sulla Loggia.",
          discoveredAtSession: null,
          discoveryNotes: null,
        },
      ];
    this.similar =
      data.similar ??
      [
        {
          entity: this.entities.find((item) => item.id === relatedId)!,
          distance: 0.12,
        },
        {
          entity: this.entities.find((item) => item.id === similarId)!,
          distance: 0.2,
        },
      ];
  }

  async getEntityById(id: string): Promise<ContextEntityRecord | null> {
    this.getEntityCalls += 1;
    return this.entities.find((item) => item.id === id) ?? null;
  }

  async getRelationsForEntity(
    entityId: string,
    _campaignId: string,
    limit: number,
  ): Promise<ContextRelationRecord[]> {
    return this.relations
      .filter(
        (item) =>
          item.sourceEntityId === entityId || item.targetEntityId === entityId,
      )
      .slice(0, limit);
  }

  async getEntitiesByIds(ids: string[]): Promise<ContextEntityRecord[]> {
    return this.entities.filter((item) => ids.includes(item.id));
  }

  async findSimilarEntities(
    _anchor: ContextEntityRecord,
    limit: number,
  ): Promise<SimilarContextEntityRecord[]> {
    this.findSimilarCalls += 1;
    return this.similar.slice(0, limit);
  }

  async getIdentities(entityIds: string[]): Promise<ContextIdentityRecord[]> {
    return this.identities.filter((item) => entityIds.includes(item.entityId));
  }

  async getSecrets(
    _campaignId: string,
    entityIds: string[],
    layers?: Array<"surface" | "intermediate" | "deep">,
  ): Promise<ContextSecretRecord[]> {
    this.lastSecretLayers = layers;
    return this.secrets.filter(
      (item) =>
        item.entityId !== null &&
        entityIds.includes(item.entityId) &&
        (!layers || layers.includes(item.layer)),
    );
  }
}

function entity(
  overrides: Partial<ContextEntityRecord> & Pick<ContextEntityRecord, "id" | "name">,
): ContextEntityRecord {
  return {
    campaignId,
    type: "npc",
    description: null,
    publicDescription: null,
    properties: {},
    tags: [],
    parentId: null,
    visibility: "dm_only",
    embedding: null,
    ...overrides,
  };
}

function relation(
  overrides: Partial<ContextRelationRecord> &
    Pick<
      ContextRelationRecord,
      "id" | "sourceEntityId" | "targetEntityId" | "relationType"
    >,
): ContextRelationRecord {
  return {
    campaignId,
    publicRelationType: null,
    strength: null,
    description: null,
    visibility: "dm_only",
    ...overrides,
  };
}
