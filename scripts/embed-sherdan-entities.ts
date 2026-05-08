import "dotenv/config";

import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import {
  assertEmbeddingDimensions,
  buildEntityEmbeddingText,
} from "@/lib/import/entity-embedding-text";
import { OllamaProvider } from "@/lib/llm";

const SHERDAN_NAME = "Sherdan";
const DEFAULT_BATCH_SIZE = 8;

interface Args {
  refresh: boolean;
  dryRun: boolean;
  limit: number | null;
  batchSize: number;
}

interface EmbedStats {
  campaignFound: boolean;
  entitiesScanned: number;
  entitiesSkipped: number;
  entitiesEmbedded: number;
  dryRun: boolean;
  refreshed: boolean;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sqlClient = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sqlClient, { schema });

  try {
    const stats = await embedSherdanEntities(db, args);
    console.log("[ok] Embedding Sherdan completati");
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await sqlClient.end();
  }
}

async function embedSherdanEntities(
  db: ReturnType<typeof drizzle<typeof schema>>,
  args: Args,
): Promise<EmbedStats> {
  const campaign = await db
    .select({ id: schema.campaigns.id })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.name, SHERDAN_NAME))
    .limit(1);

  const campaignId = campaign[0]?.id;
  const stats: EmbedStats = {
    campaignFound: Boolean(campaignId),
    entitiesScanned: 0,
    entitiesSkipped: 0,
    entitiesEmbedded: 0,
    dryRun: args.dryRun,
    refreshed: args.refresh,
  };

  if (!campaignId) return stats;

  const rows = await db
    .select({
      id: schema.entities.id,
      type: schema.entities.type,
      name: schema.entities.name,
      description: schema.entities.description,
      publicDescription: schema.entities.publicDescription,
      properties: schema.entities.properties,
      tags: schema.entities.tags,
      visibility: schema.entities.visibility,
      embedding: schema.entities.embedding,
    })
    .from(schema.entities)
    .where(
      and(
        eq(schema.entities.campaignId, campaignId),
        sql`'sherdan-import' = ANY(${schema.entities.tags})`,
      ),
    )
    .orderBy(asc(schema.entities.name));

  stats.entitiesScanned = rows.length;
  const pending = rows
    .filter((row) => {
      const shouldEmbed = args.refresh || row.embedding === null;
      if (!shouldEmbed) stats.entitiesSkipped += 1;
      return shouldEmbed;
    })
    .slice(0, args.limit ?? undefined);

  if (args.dryRun || pending.length === 0) return stats;

  await assertOllamaEmbedModelAvailable();
  const provider = new OllamaProvider({
    baseUrl: env.OLLAMA_BASE_URL,
    chatModel: env.OLLAMA_MODEL,
    embedModel: env.OLLAMA_EMBED_MODEL,
  });

  for (const batch of chunk(pending, args.batchSize)) {
    const texts = batch.map((entity) =>
      buildEntityEmbeddingText({
        type: entity.type,
        name: entity.name,
        description: entity.description,
        publicDescription: entity.publicDescription,
        properties: entity.properties,
        tags: entity.tags,
        visibility: entity.visibility,
      }),
    );
    const vectors = await provider.embedBatch(texts);
    if (vectors.length !== batch.length) {
      throw new Error(
        `Ollama ha restituito ${vectors.length} embedding per ${batch.length} input`,
      );
    }

    for (let index = 0; index < batch.length; index += 1) {
      const entity = batch[index];
      const vector = vectors[index];
      if (!entity || !vector) continue;
      assertEmbeddingDimensions(vector);
      await db
        .update(schema.entities)
        .set({ embedding: vector })
        .where(eq(schema.entities.id, entity.id));
      stats.entitiesEmbedded += 1;
    }
  }

  return stats;
}

async function assertOllamaEmbedModelAvailable() {
  let res: Response;
  try {
    res = await fetch(`${env.OLLAMA_BASE_URL.replace(/\/+$/, "")}/api/tags`);
  } catch (cause) {
    throw new Error(
      `Ollama non raggiungibile a ${env.OLLAMA_BASE_URL}. Avvia Ollama prima di generare embedding.`,
      { cause },
    );
  }
  if (!res.ok) {
    throw new Error(`Ollama /api/tags HTTP ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as { models?: Array<{ name?: string }> };
  const installed = body.models?.map((model) => model.name ?? "") ?? [];
  const hasEmbedModel = installed.some(
    (name) =>
      name === env.OLLAMA_EMBED_MODEL ||
      name.startsWith(`${env.OLLAMA_EMBED_MODEL}:`),
  );

  if (!hasEmbedModel) {
    throw new Error(
      `Modello embedding Ollama non installato: ${env.OLLAMA_EMBED_MODEL}. Esegui: ollama pull ${env.OLLAMA_EMBED_MODEL}`,
    );
  }
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    refresh: false,
    dryRun: false,
    limit: null,
    batchSize: DEFAULT_BATCH_SIZE,
  };

  for (const arg of argv) {
    if (arg === "--refresh") {
      args.refresh = true;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      args.limit = parsePositiveInt(arg.slice("--limit=".length), "--limit");
      continue;
    }
    if (arg.startsWith("--batch-size=")) {
      args.batchSize = parsePositiveInt(
        arg.slice("--batch-size=".length),
        "--batch-size",
      );
      continue;
    }
    throw new Error(`Argomento non riconosciuto: ${arg}`);
  }

  return args;
}

function parsePositiveInt(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} deve essere un intero positivo`);
  }
  return parsed;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
