import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  entities,
  entityIdentities,
  entityLinks,
  entitySecrets,
} from "@/db/schema";
import type { EntityTypeName } from "@/lib/validation";

type Visibility = "dm_only" | "discovered" | "public";
type SecretLayer = "surface" | "intermediate" | "deep";
type EntityContextSource = "anchor" | "relation" | "similarity";

export interface ContextRetrieverInput {
  anchorEntityId: string;
  maxRelated?: number;
  maxSimilar?: number;
  secretLayers?: SecretLayer[];
}

export interface ContextEntityRecord {
  id: string;
  campaignId: string;
  type: EntityTypeName;
  name: string;
  description: string | null;
  publicDescription: string | null;
  properties: unknown;
  tags: string[];
  parentId: string | null;
  visibility: Visibility;
  embedding?: number[] | null;
}

export interface ContextRelationRecord {
  id: string;
  campaignId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  publicRelationType: string | null;
  strength: number | null;
  description: string | null;
  visibility: Visibility;
}

export interface ContextIdentityRecord {
  id: string;
  entityId: string;
  name: string;
  isTrueIdentity: boolean;
  appearance: string | null;
  voice: string | null;
  mannerisms: unknown;
  activeFromSession: string | null;
  activeUntilSession: string | null;
  visibility: Visibility;
  notes: string | null;
}

export interface ContextSecretRecord {
  id: string;
  entityId: string | null;
  layer: SecretLayer;
  content: string;
  exploitHint: string | null;
  discoveredAtSession: string | null;
  discoveryNotes: string | null;
}

export interface SimilarContextEntityRecord {
  entity: ContextEntityRecord;
  distance: number;
}

export interface ContextRetrieverStore {
  getEntityById(id: string): Promise<ContextEntityRecord | null>;
  getRelationsForEntity(
    entityId: string,
    campaignId: string,
    limit: number,
  ): Promise<ContextRelationRecord[]>;
  getEntitiesByIds(ids: string[]): Promise<ContextEntityRecord[]>;
  findSimilarEntities(
    anchor: ContextEntityRecord,
    limit: number,
  ): Promise<SimilarContextEntityRecord[]>;
  getIdentities(entityIds: string[]): Promise<ContextIdentityRecord[]>;
  getSecrets(
    campaignId: string,
    entityIds: string[],
    layers?: SecretLayer[],
  ): Promise<ContextSecretRecord[]>;
}

export interface ContextRelation extends ContextRelationRecord {
  direction: "outgoing" | "incoming";
}

export interface ContextSimilarity {
  distance: number;
  score: number;
}

export interface ContextEntity extends Omit<ContextEntityRecord, "embedding"> {
  sources: EntityContextSource[];
  relations: ContextRelation[];
  similarity: ContextSimilarity | null;
  identities: ContextIdentityRecord[];
  secrets: ContextSecretRecord[];
}

export interface RetrievedGeneratorContext {
  anchor: ContextEntity;
  related: ContextEntity[];
  similar: ContextEntity[];
  entities: ContextEntity[];
  relations: ContextRelation[];
  metadata: {
    maxRelated: number;
    maxSimilar: number;
    similaritySkipped: boolean;
  };
}

export class ContextRetrieverError extends Error {
  override readonly name = "ContextRetrieverError";

  constructor(
    readonly code: "anchor_not_found" | "invalid_input",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

const inputSchema = z
  .object({
    anchorEntityId: z.uuid(),
    maxRelated: z.number().int().min(0).max(50).default(12),
    maxSimilar: z.number().int().min(0).max(50).default(8),
    secretLayers: z
      .array(z.enum(["surface", "intermediate", "deep"]))
      .optional(),
  })
  .strict();

export class ContextRetriever {
  constructor(
    private readonly store: ContextRetrieverStore = new DrizzleContextRetrieverStore(),
  ) {}

  async retrieve(
    input: ContextRetrieverInput,
  ): Promise<RetrievedGeneratorContext> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ContextRetrieverError(
        "invalid_input",
        "Input ContextRetriever non valido",
        parsed.error,
      );
    }

    const options = parsed.data;
    const anchorRecord = await this.store.getEntityById(options.anchorEntityId);
    if (!anchorRecord) {
      throw new ContextRetrieverError(
        "anchor_not_found",
        `Entity anchor non trovata: ${options.anchorEntityId}`,
      );
    }

    const relations = await this.store.getRelationsForEntity(
      anchorRecord.id,
      anchorRecord.campaignId,
      Math.max(options.maxRelated * 2, options.maxRelated),
    );
    const relatedIds = unique(
      relations
        .map((relation) => otherEntityId(relation, anchorRecord.id))
        .filter((id): id is string => Boolean(id))
        .slice(0, options.maxRelated),
    );
    const relatedRecords = await this.store.getEntitiesByIds(relatedIds);

    const similarRecords =
      options.maxSimilar > 0 && anchorRecord.embedding
        ? await this.store.findSimilarEntities(anchorRecord, options.maxSimilar)
        : [];
    const similaritySkipped = options.maxSimilar > 0 && !anchorRecord.embedding;

    const allRecords = uniqueRecords([
      anchorRecord,
      ...orderRecordsByIds(relatedRecords, relatedIds),
      ...similarRecords.map((record) => record.entity),
    ]);
    const entityIds = allRecords.map((entity) => entity.id);
    const [identities, secrets] = await Promise.all([
      this.store.getIdentities(entityIds),
      this.store.getSecrets(
        anchorRecord.campaignId,
        entityIds,
        options.secretLayers,
      ),
    ]);

    const relationsByEntityId = groupRelationsByOtherEntity(
      relations,
      anchorRecord.id,
    );
    const identitiesByEntityId = groupBy(
      identities,
      (identity) => identity.entityId,
    );
    const secretsByEntityId = groupBy(
      secrets.filter((secret) => secret.entityId !== null),
      (secret) => secret.entityId as string,
    );
    const similarityByEntityId = new Map(
      similarRecords.map((record) => [record.entity.id, record.distance]),
    );
    const relatedIdSet = new Set(relatedIds);
    const similarIdSet = new Set(
      similarRecords.map((record) => record.entity.id),
    );

    const entitiesWithContext = allRecords.map((record) =>
      toContextEntity(record, {
        sources: sourcesFor(
          record.id,
          anchorRecord.id,
          relatedIdSet,
          similarIdSet,
        ),
        relations: relationsByEntityId.get(record.id) ?? [],
        similarityDistance: similarityByEntityId.get(record.id),
        identities: identitiesByEntityId.get(record.id) ?? [],
        secrets: secretsByEntityId.get(record.id) ?? [],
      }),
    );

    const entityById = new Map(
      entitiesWithContext.map((entity) => [entity.id, entity]),
    );
    const anchor = entityById.get(anchorRecord.id);
    if (!anchor) {
      throw new ContextRetrieverError(
        "anchor_not_found",
        `Entity anchor non materializzata: ${anchorRecord.id}`,
      );
    }

    return {
      anchor,
      related: relatedIds
        .map((id) => entityById.get(id))
        .filter((entity): entity is ContextEntity => Boolean(entity)),
      similar: similarRecords
        .map((record) => entityById.get(record.entity.id))
        .filter((entity): entity is ContextEntity => Boolean(entity)),
      entities: entitiesWithContext,
      relations: relations.map((relation) =>
        withDirection(relation, anchorRecord.id),
      ),
      metadata: {
        maxRelated: options.maxRelated,
        maxSimilar: options.maxSimilar,
        similaritySkipped,
      },
    };
  }
}

export class DrizzleContextRetrieverStore implements ContextRetrieverStore {
  async getEntityById(id: string): Promise<ContextEntityRecord | null> {
    const rows = await db
      .select({
        id: entities.id,
        campaignId: entities.campaignId,
        type: entities.type,
        name: entities.name,
        description: entities.description,
        publicDescription: entities.publicDescription,
        properties: entities.properties,
        tags: entities.tags,
        parentId: entities.parentId,
        visibility: entities.visibility,
        embedding: entities.embedding,
      })
      .from(entities)
      .where(eq(entities.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async getRelationsForEntity(
    entityId: string,
    campaignId: string,
    limit: number,
  ): Promise<ContextRelationRecord[]> {
    if (limit <= 0) return [];
    return db
      .select({
        id: entityLinks.id,
        campaignId: entityLinks.campaignId,
        sourceEntityId: entityLinks.sourceEntityId,
        targetEntityId: entityLinks.targetEntityId,
        relationType: entityLinks.relationType,
        publicRelationType: entityLinks.publicRelationType,
        strength: entityLinks.strength,
        description: entityLinks.description,
        visibility: entityLinks.visibility,
      })
      .from(entityLinks)
      .where(andCampaignRelation(campaignId, entityId))
      .orderBy(
        sql`coalesce(${entityLinks.strength}, 0) desc`,
        asc(entityLinks.createdAt),
      )
      .limit(limit);
  }

  async getEntitiesByIds(ids: string[]): Promise<ContextEntityRecord[]> {
    if (ids.length === 0) return [];
    return db
      .select({
        id: entities.id,
        campaignId: entities.campaignId,
        type: entities.type,
        name: entities.name,
        description: entities.description,
        publicDescription: entities.publicDescription,
        properties: entities.properties,
        tags: entities.tags,
        parentId: entities.parentId,
        visibility: entities.visibility,
        embedding: entities.embedding,
      })
      .from(entities)
      .where(inArray(entities.id, ids));
  }

  async findSimilarEntities(
    anchor: ContextEntityRecord,
    limit: number,
  ): Promise<SimilarContextEntityRecord[]> {
    if (!anchor.embedding || limit <= 0) return [];
    const anchorVector = toPgVectorLiteral(anchor.embedding);
    const distanceExpr = sql<number>`${entities.embedding} <=> ${anchorVector}::vector`;
    const rows = await db
      .select({
        id: entities.id,
        campaignId: entities.campaignId,
        type: entities.type,
        name: entities.name,
        description: entities.description,
        publicDescription: entities.publicDescription,
        properties: entities.properties,
        tags: entities.tags,
        parentId: entities.parentId,
        visibility: entities.visibility,
        embedding: entities.embedding,
        distance: distanceExpr,
      })
      .from(entities)
      .where(
        and(
          eq(entities.campaignId, anchor.campaignId),
          sql`${entities.id} <> ${anchor.id}`,
          isNotNull(entities.embedding),
        ),
      )
      .orderBy(distanceExpr)
      .limit(limit);

    return rows.map(({ distance, ...entity }) => ({
      entity,
      distance,
    }));
  }

  async getIdentities(entityIds: string[]): Promise<ContextIdentityRecord[]> {
    if (entityIds.length === 0) return [];
    return db
      .select({
        id: entityIdentities.id,
        entityId: entityIdentities.entityId,
        name: entityIdentities.name,
        isTrueIdentity: entityIdentities.isTrueIdentity,
        appearance: entityIdentities.appearance,
        voice: entityIdentities.voice,
        mannerisms: entityIdentities.mannerisms,
        activeFromSession: entityIdentities.activeFromSession,
        activeUntilSession: entityIdentities.activeUntilSession,
        visibility: entityIdentities.visibility,
        notes: entityIdentities.notes,
      })
      .from(entityIdentities)
      .where(inArray(entityIdentities.entityId, entityIds))
      .orderBy(asc(entityIdentities.createdAt));
  }

  async getSecrets(
    campaignId: string,
    entityIds: string[],
    layers?: SecretLayer[],
  ): Promise<ContextSecretRecord[]> {
    if (entityIds.length === 0) return [];
    const conditions = [
      eq(entitySecrets.campaignId, campaignId),
      inArray(entitySecrets.entityId, entityIds),
    ];
    if (layers && layers.length > 0) {
      conditions.push(inArray(entitySecrets.layer, layers));
    }
    return db
      .select({
        id: entitySecrets.id,
        entityId: entitySecrets.entityId,
        layer: entitySecrets.layer,
        content: entitySecrets.content,
        exploitHint: entitySecrets.exploitHint,
        discoveredAtSession: entitySecrets.discoveredAtSession,
        discoveryNotes: entitySecrets.discoveryNotes,
      })
      .from(entitySecrets)
      .where(and(...conditions))
      .orderBy(asc(entitySecrets.createdAt));
  }
}

function andCampaignRelation(campaignId: string, entityId: string) {
  return and(
    eq(entityLinks.campaignId, campaignId),
    or(
      eq(entityLinks.sourceEntityId, entityId),
      eq(entityLinks.targetEntityId, entityId),
    ),
  );
}

function toContextEntity(
  record: ContextEntityRecord,
  extra: {
    sources: EntityContextSource[];
    relations: ContextRelation[];
    similarityDistance: number | undefined;
    identities: ContextIdentityRecord[];
    secrets: ContextSecretRecord[];
  },
): ContextEntity {
  return {
    ...withoutEmbedding(record),
    sources: extra.sources,
    relations: extra.relations,
    similarity:
      extra.similarityDistance === undefined
        ? null
        : {
            distance: extra.similarityDistance,
            score: 1 - extra.similarityDistance,
          },
    identities: extra.identities,
    secrets: extra.secrets,
  };
}

function withoutEmbedding(
  record: ContextEntityRecord,
): Omit<ContextEntityRecord, "embedding"> {
  return {
    id: record.id,
    campaignId: record.campaignId,
    type: record.type,
    name: record.name,
    description: record.description,
    publicDescription: record.publicDescription,
    properties: record.properties,
    tags: record.tags,
    parentId: record.parentId,
    visibility: record.visibility,
  };
}

function sourcesFor(
  entityId: string,
  anchorId: string,
  relatedIds: Set<string>,
  similarIds: Set<string>,
): EntityContextSource[] {
  const sources: EntityContextSource[] = [];
  if (entityId === anchorId) sources.push("anchor");
  if (relatedIds.has(entityId)) sources.push("relation");
  if (similarIds.has(entityId)) sources.push("similarity");
  return sources;
}

function groupRelationsByOtherEntity(
  relations: ContextRelationRecord[],
  anchorId: string,
): Map<string, ContextRelation[]> {
  const grouped = new Map<string, ContextRelation[]>();
  for (const relation of relations) {
    const otherId = otherEntityId(relation, anchorId);
    if (!otherId) continue;
    const list = grouped.get(otherId) ?? [];
    list.push(withDirection(relation, anchorId));
    grouped.set(otherId, list);
  }
  return grouped;
}

function withDirection(
  relation: ContextRelationRecord,
  anchorId: string,
): ContextRelation {
  return {
    ...relation,
    direction: relation.sourceEntityId === anchorId ? "outgoing" : "incoming",
  };
}

function otherEntityId(
  relation: ContextRelationRecord,
  anchorId: string,
): string | null {
  if (relation.sourceEntityId === anchorId) return relation.targetEntityId;
  if (relation.targetEntityId === anchorId) return relation.sourceEntityId;
  return null;
}

function orderRecordsByIds<T extends { id: string }>(
  records: T[],
  ids: string[],
): T[] {
  const recordById = new Map(records.map((record) => [record.id, record]));
  return ids
    .map((id) => recordById.get(id))
    .filter((record): record is T => Boolean(record));
}

function uniqueRecords<T extends { id: string }>(records: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const record of records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    result.push(record);
  }
  return result;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function groupBy<T>(
  items: T[],
  keyFor: (item: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }
  return grouped;
}

function toPgVectorLiteral(vector: number[]): string {
  if (vector.length === 0 || vector.some((value) => !Number.isFinite(value))) {
    throw new ContextRetrieverError(
      "invalid_input",
      "Embedding anchor non valido per similarity search",
    );
  }
  return `[${vector.join(",")}]`;
}
