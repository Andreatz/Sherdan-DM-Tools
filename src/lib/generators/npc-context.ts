import { asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { entities, entitySecrets } from "@/db/schema";
import type { EntityTypeName } from "@/lib/validation";

import {
  ContextRetriever,
  type ContextEntity,
  type ContextRetrieverInput,
  type ContextSecretRecord,
  type RetrievedGeneratorContext,
} from "./context-retriever";
import {
  StyleCalibrator,
  type StyleCalibrationResult,
  type StyleCalibratorEntity,
} from "./style-calibrator";
import {
  npcGeneratorInputSchema,
  type NpcGeneratorInput,
} from "./npc-input";

export interface NpcGeneratorContextOptions {
  maxNearbyEntities?: number;
  maxSimilarEntities?: number;
  maxStyleEntities?: number;
}

export interface NpcGeneratorContext {
  input: NpcGeneratorInput;
  location: ContextEntity;
  styleReference: StyleCalibratorEntity | null;
  nearbyFactions: ContextEntity[];
  nearbyNpcs: ContextEntity[];
  nearbyEntities: ContextEntity[];
  retrieved: RetrievedGeneratorContext;
  style: StyleCalibrationResult;
  metadata: {
    maxNearbyEntities: number;
    maxSimilarEntities: number;
    maxStyleEntities: number;
    styleEntitiesAnalyzed: number;
    similaritySkipped: boolean;
  };
}

export interface NpcGeneratorContextRetrieverLike {
  retrieve(input: ContextRetrieverInput): Promise<RetrievedGeneratorContext>;
}

export interface NpcGeneratorContextStore {
  getCampaignStyleEntities(
    campaignId: string,
    limit: number,
  ): Promise<StyleCalibratorEntity[]>;
  getStyleReferenceEntity(
    campaignId: string,
    entityId: string,
  ): Promise<StyleCalibratorEntity | null>;
}

export class NpcGeneratorContextError extends Error {
  override readonly name = "NpcGeneratorContextError";

  constructor(
    readonly code:
      | "invalid_input"
      | "location_not_found"
      | "style_reference_not_found",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

const DEFAULT_MAX_NEARBY_ENTITIES = 16;
const DEFAULT_MAX_SIMILAR_ENTITIES = 8;
const DEFAULT_MAX_STYLE_ENTITIES = 80;

export class NpcGeneratorContextRetriever {
  constructor(
    private readonly contextRetriever: NpcGeneratorContextRetrieverLike = new ContextRetriever(),
    private readonly store: NpcGeneratorContextStore = new DrizzleNpcGeneratorContextStore(),
    private readonly styleCalibrator: StyleCalibrator = new StyleCalibrator(),
  ) {}

  async retrieve(
    rawInput: NpcGeneratorInput,
    options: NpcGeneratorContextOptions = {},
  ): Promise<NpcGeneratorContext> {
    const parsed = npcGeneratorInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new NpcGeneratorContextError(
        "invalid_input",
        "Input NPC generator non valido",
        parsed.error,
      );
    }

    const input = parsed.data;
    const maxNearbyEntities =
      options.maxNearbyEntities ?? DEFAULT_MAX_NEARBY_ENTITIES;
    const maxSimilarEntities =
      options.maxSimilarEntities ?? DEFAULT_MAX_SIMILAR_ENTITIES;
    const maxStyleEntities =
      options.maxStyleEntities ?? DEFAULT_MAX_STYLE_ENTITIES;

    const retrieved = await this.contextRetriever.retrieve({
      anchorEntityId: input.locationId,
      maxRelated: maxNearbyEntities,
      maxSimilar: maxSimilarEntities,
      secretLayers: ["surface", "intermediate", "deep"],
    });

    if (retrieved.anchor.type !== "location") {
      throw new NpcGeneratorContextError(
        "location_not_found",
        `Entity anchor non e' una location: ${retrieved.anchor.name}`,
      );
    }
    if (retrieved.anchor.campaignId !== input.campaignId) {
      throw new NpcGeneratorContextError(
        "invalid_input",
        `Location '${retrieved.anchor.name}' non appartiene alla campagna richiesta`,
      );
    }

    const nearbyEntities = retrieved.entities.filter(
      (entity) => entity.id !== retrieved.anchor.id,
    );
    const nearbyFactions = nearbyEntities.filter(isFactionLike);
    const nearbyNpcs = nearbyEntities.filter((entity) => entity.type === "npc");
    const styleEntities = await this.store.getCampaignStyleEntities(
      input.campaignId,
      maxStyleEntities,
    );
    const styleReference = input.styleEntityId
      ? await this.store.getStyleReferenceEntity(
          input.campaignId,
          input.styleEntityId,
        )
      : null;
    if (input.styleEntityId && !styleReference) {
      throw new NpcGeneratorContextError(
        "style_reference_not_found",
        "NPC di riferimento per lo stile non trovato nella campagna richiesta",
      );
    }
    const style = this.styleCalibrator.calibrate(styleEntities);

    return {
      input,
      location: retrieved.anchor,
      styleReference,
      nearbyFactions,
      nearbyNpcs,
      nearbyEntities,
      retrieved,
      style,
      metadata: {
        maxNearbyEntities,
        maxSimilarEntities,
        maxStyleEntities,
        styleEntitiesAnalyzed: style.profile.entitiesAnalyzed,
        similaritySkipped: retrieved.metadata.similaritySkipped,
      },
    };
  }
}

export class DrizzleNpcGeneratorContextStore
  implements NpcGeneratorContextStore
{
  async getCampaignStyleEntities(
    campaignId: string,
    limit: number,
  ): Promise<StyleCalibratorEntity[]> {
    if (limit <= 0) return [];

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

  async getStyleReferenceEntity(
    campaignId: string,
    entityId: string,
  ): Promise<StyleCalibratorEntity | null> {
    const [row] = await db
      .select({
        id: entities.id,
        campaignId: entities.campaignId,
        type: entities.type,
        name: entities.name,
        description: entities.description,
        publicDescription: entities.publicDescription,
        properties: entities.properties,
        tags: entities.tags,
      })
      .from(entities)
      .where(eq(entities.id, entityId))
      .limit(1);

    if (!row || row.type !== "npc") return null;
    if (row.campaignId !== campaignId) return null;

    const secrets = await getSecretsForEntities([row.id]);
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      description: row.description,
      publicDescription: row.publicDescription,
      properties: row.properties,
      tags: row.tags,
      secrets,
    };
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

function isFactionLike(entity: { type: EntityTypeName }): boolean {
  return entity.type === "faction" || entity.type === "organization";
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
