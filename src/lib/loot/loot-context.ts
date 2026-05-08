import { asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { entities, entitySecrets } from "@/db/schema";
import {
  ContextRetriever,
  type ContextEntity,
  type ContextRetrieverInput,
  type ContextSecretRecord,
  type RetrievedGeneratorContext,
  StyleCalibrator,
  type StyleCalibrationResult,
  type StyleCalibratorEntity,
} from "@/lib/generators";

import {
  lootGeneratorInputSchema,
  type LootGeneratorInput,
} from "./loot-input";

export interface LootGeneratorContextOptions {
  maxRelatedEntities?: number;
  maxSimilarEntities?: number;
  maxStyleEntities?: number;
}

export interface LootGeneratorContext {
  input: LootGeneratorInput;
  anchor: ContextEntity | null;
  sourceEntity: ContextEntity | null;
  relatedEntities: ContextEntity[];
  retrieved: RetrievedGeneratorContext | null;
  style: StyleCalibrationResult;
  metadata: {
    maxRelatedEntities: number;
    maxSimilarEntities: number;
    maxStyleEntities: number;
    styleEntitiesAnalyzed: number;
    similaritySkipped: boolean;
  };
}

export interface LootGeneratorContextRetrieverLike {
  retrieve(input: ContextRetrieverInput): Promise<RetrievedGeneratorContext>;
}

export interface LootGeneratorContextStore {
  getCampaignStyleEntities(
    campaignId: string,
    limit: number,
  ): Promise<StyleCalibratorEntity[]>;
}

export class LootGeneratorContextError extends Error {
  override readonly name = "LootGeneratorContextError";

  constructor(
    readonly code: "invalid_input" | "anchor_campaign_mismatch",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

const DEFAULT_MAX_RELATED_ENTITIES = 12;
const DEFAULT_MAX_SIMILAR_ENTITIES = 8;
const DEFAULT_MAX_STYLE_ENTITIES = 80;

export class LootGeneratorContextRetriever {
  constructor(
    private readonly contextRetriever: LootGeneratorContextRetrieverLike = new ContextRetriever(),
    private readonly store: LootGeneratorContextStore = new DrizzleLootGeneratorContextStore(),
    private readonly styleCalibrator: StyleCalibrator = new StyleCalibrator(),
  ) {}

  async retrieve(
    rawInput: LootGeneratorInput,
    options: LootGeneratorContextOptions = {},
  ): Promise<LootGeneratorContext> {
    const parsed = lootGeneratorInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new LootGeneratorContextError(
        "invalid_input",
        "Input Loot Generator non valido",
        parsed.error,
      );
    }

    const input = parsed.data;
    const maxRelatedEntities =
      options.maxRelatedEntities ?? DEFAULT_MAX_RELATED_ENTITIES;
    const maxSimilarEntities =
      options.maxSimilarEntities ?? DEFAULT_MAX_SIMILAR_ENTITIES;
    const maxStyleEntities =
      options.maxStyleEntities ?? DEFAULT_MAX_STYLE_ENTITIES;

    const [retrieved, styleEntities] = await Promise.all([
      input.anchorEntityId
        ? this.contextRetriever.retrieve({
            anchorEntityId: input.anchorEntityId,
            maxRelated: maxRelatedEntities,
            maxSimilar: maxSimilarEntities,
            secretLayers: ["surface", "intermediate", "deep"],
          })
        : Promise.resolve<RetrievedGeneratorContext | null>(null),
      this.store.getCampaignStyleEntities(input.campaignId, maxStyleEntities),
    ]);

    if (retrieved && retrieved.anchor.campaignId !== input.campaignId) {
      throw new LootGeneratorContextError(
        "anchor_campaign_mismatch",
        `Anchor '${retrieved.anchor.name}' non appartiene alla campagna richiesta`,
      );
    }

    const style = this.styleCalibrator.calibrate(styleEntities);

    return {
      input,
      anchor: retrieved?.anchor ?? null,
      sourceEntity: retrieved?.anchor ?? null,
      relatedEntities:
        retrieved?.entities.filter((entity) => entity.id !== retrieved.anchor.id) ??
        [],
      retrieved,
      style,
      metadata: {
        maxRelatedEntities,
        maxSimilarEntities,
        maxStyleEntities,
        styleEntitiesAnalyzed: style.profile.entitiesAnalyzed,
        similaritySkipped: retrieved?.metadata.similaritySkipped ?? false,
      },
    };
  }
}

export class DrizzleLootGeneratorContextStore
  implements LootGeneratorContextStore
{
  async getCampaignStyleEntities(
    campaignId: string,
    limit: number,
  ): Promise<StyleCalibratorEntity[]> {
    if (limit <= 0) return [];

    const rows = await db
      .select({
        id: entities.id,
        type: entities.type,
        name: entities.name,
        description: entities.description,
        publicDescription: entities.publicDescription,
        properties: entities.properties,
        tags: entities.tags,
      })
      .from(entities)
      .where(eq(entities.campaignId, campaignId))
      .orderBy(desc(entities.updatedAt), asc(entities.name))
      .limit(limit);

    const ids = rows.map((row) => row.id);
    const secrets = ids.length > 0 ? await getSecretsForEntities(ids) : [];
    const secretsByEntityId = groupBy(
      secrets.filter((secret) => secret.entityId !== null),
      (secret) => secret.entityId as string,
    );

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      description: row.description,
      publicDescription: row.publicDescription,
      properties: row.properties,
      tags: row.tags,
      secrets: secretsByEntityId.get(row.id) ?? [],
    }));
  }
}

async function getSecretsForEntities(
  entityIds: string[],
): Promise<ContextSecretRecord[]> {
  if (entityIds.length === 0) return [];
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
    .where(inArray(entitySecrets.entityId, entityIds))
    .orderBy(asc(entitySecrets.createdAt));
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
