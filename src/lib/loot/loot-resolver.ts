import { and, asc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { entities } from "@/db/schema";
import {
  assertEmbeddingDimensions,
  buildEntityEmbeddingText,
} from "@/lib/import/entity-embedding-text";
import { getLLMProvider, type LLMProvider } from "@/lib/llm";

import {
  lootItemToItemProperties,
  type LootGeneratorItem,
  type LootGeneratorOutput,
} from "./loot-output";

export type LootItemResolutionAction = "reuse" | "create";

export interface LootItemResolverOptions {
  llm?: LLMProvider;
  maxCandidates?: number;
  reuseThreshold?: number;
}

export interface LootItemCandidate {
  id: string;
  name: string;
  description: string | null;
  publicDescription: string | null;
  properties: unknown;
  tags: string[];
  visibility: "dm_only" | "discovered" | "public";
  distance: number;
  score: number;
}

export interface LootItemResolverStore {
  findSimilarItems(input: {
    campaignId: string;
    embedding: number[];
    limit: number;
  }): Promise<LootItemCandidate[]>;
}

export interface ResolvedLootItem {
  item: LootGeneratorItem;
  action: LootItemResolutionAction;
  match: LootItemCandidate | null;
  candidates: LootItemCandidate[];
  embedding: number[];
  entityInsert: LootItemEntityInsert | null;
}

export interface ResolvedLootBundle {
  output: LootGeneratorOutput;
  items: ResolvedLootItem[];
  metadata: {
    reuseThreshold: number;
    maxCandidates: number;
    reusedCount: number;
    createCount: number;
  };
}

export type LootItemEntityInsert = typeof entities.$inferInsert;

const DEFAULT_MAX_CANDIDATES = 5;
const DEFAULT_REUSE_THRESHOLD = 0.88;

export class LootItemResolverError extends Error {
  override readonly name = "LootItemResolverError";

  constructor(
    readonly code: "invalid_embedding" | "resolve_failed",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class LootItemResolver {
  constructor(
    private readonly store: LootItemResolverStore = new DrizzleLootItemResolverStore(),
    private readonly providerFactory: () => LLMProvider = getLLMProvider,
  ) {}

  async resolve(
    output: LootGeneratorOutput,
    options: LootItemResolverOptions = {},
  ): Promise<ResolvedLootBundle> {
    const maxCandidates = options.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
    const reuseThreshold = options.reuseThreshold ?? DEFAULT_REUSE_THRESHOLD;
    const llm = options.llm ?? this.providerFactory();

    const items = await Promise.all(
      output.items.map(async (item) => {
        const embedding = await embedLootItem(llm, item);
        const candidates = await this.store.findSimilarItems({
          campaignId: output.metadata.campaignId,
          embedding,
          limit: maxCandidates,
        });
        const match = candidates[0] ?? null;
        const action =
          match && match.score >= reuseThreshold ? "reuse" : "create";

        return {
          item,
          action,
          match,
          candidates,
          embedding,
          entityInsert:
            action === "create"
              ? lootItemToEntityInsert(output, item, { embedding })
              : null,
        } satisfies ResolvedLootItem;
      }),
    );

    return {
      output,
      items,
      metadata: {
        reuseThreshold,
        maxCandidates,
        reusedCount: items.filter((item) => item.action === "reuse").length,
        createCount: items.filter((item) => item.action === "create").length,
      },
    };
  }
}

export class DrizzleLootItemResolverStore implements LootItemResolverStore {
  async findSimilarItems(input: {
    campaignId: string;
    embedding: number[];
    limit: number;
  }): Promise<LootItemCandidate[]> {
    if (input.limit <= 0) return [];
    const vector = toPgVectorLiteral(input.embedding);
    const distanceExpr = sql<number>`${entities.embedding} <=> ${vector}::vector`;
    const rows = await db
      .select({
        id: entities.id,
        name: entities.name,
        description: entities.description,
        publicDescription: entities.publicDescription,
        properties: entities.properties,
        tags: entities.tags,
        visibility: entities.visibility,
        distance: distanceExpr,
      })
      .from(entities)
      .where(
        and(
          eq(entities.campaignId, input.campaignId),
          eq(entities.type, "item"),
          isNotNull(entities.embedding),
        ),
      )
      .orderBy(distanceExpr, asc(entities.name))
      .limit(input.limit);

    return rows.map((row) => ({
      ...row,
      score: scoreFromDistance(row.distance),
    }));
  }
}

export function lootItemToEntityInsert(
  output: LootGeneratorOutput,
  item: LootGeneratorItem,
  options: { embedding?: number[] } = {},
): LootItemEntityInsert {
  const insert: LootItemEntityInsert = {
    campaignId: output.metadata.campaignId,
    type: "item",
    name: item.name,
    description: item.description,
    publicDescription: item.public_description ?? null,
    properties: lootItemToItemProperties(item),
    tags: normalizeLootItemTags(item),
    parentId: null,
    visibility: "dm_only",
  };

  if (options.embedding) {
    assertEmbeddingDimensions(options.embedding);
    insert.embedding = options.embedding;
  }

  return insert;
}

export function buildLootItemEmbeddingText(item: LootGeneratorItem): string {
  return buildEntityEmbeddingText({
    type: "item",
    name: item.name,
    description: item.description,
    publicDescription: item.public_description ?? null,
    properties: lootItemToItemProperties(item),
    tags: normalizeLootItemTags(item),
    visibility: "dm_only",
    extraSections: [
      {
        title: "Effetti",
        content: item.effects.join("\n"),
      },
      {
        title: "Riferimenti lore",
        content: item.lore_references
          .map((reference) => {
            const id = reference.entity_id ? ` (${reference.entity_id})` : "";
            return `- ${reference.entity_name}${id}: ${reference.reason}`;
          })
          .join("\n"),
      },
    ],
  });
}

function normalizeLootItemTags(item: LootGeneratorItem): string[] {
  const tags = ["item", "loot", "generated", ...item.tags, item.kind, item.rarity]
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0);
  return [...new Set(tags)];
}

async function embedLootItem(
  llm: LLMProvider,
  item: LootGeneratorItem,
): Promise<number[]> {
  try {
    const embedding = await llm.embed(buildLootItemEmbeddingText(item));
    assertEmbeddingDimensions(embedding);
    return embedding;
  } catch (err) {
    throw new LootItemResolverError(
      "invalid_embedding",
      "Embedding item loot non disponibile o con dimensione non valida",
      err,
    );
  }
}

function scoreFromDistance(distance: number): number {
  return Math.max(0, Math.min(1, 1 - distance));
}

function toPgVectorLiteral(vector: number[]): string {
  try {
    assertEmbeddingDimensions(vector);
  } catch (err) {
    throw new LootItemResolverError(
      "invalid_embedding",
      "Embedding item non valido per similarity search",
      err,
    );
  }
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new LootItemResolverError(
      "invalid_embedding",
      "Embedding item contiene valori non finiti",
    );
  }
  return `[${vector.join(",")}]`;
}
