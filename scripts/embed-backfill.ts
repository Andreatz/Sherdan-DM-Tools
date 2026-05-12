import "dotenv/config";

import { and, asc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import {
  assertEmbeddingDimensions,
  buildEntityEmbeddingText,
} from "@/lib/import/entity-embedding-text";
import { OllamaProvider } from "@/lib/llm";

// `pnpm db:embed:backfill [--campaign-id=<uuid>] [--limit=N] [--dry-run]
// [--batch-size=N]`
//
// Ripopola la colonna `entities.embedding` per tutte le entity dove
// `embedding IS NULL`. Utile quando un NPC e' stato salvato dal Generator
// con Ollama offline (la save route e' fail-forward: l'embedding resta
// null, nel response `embeddingStatus: "unavailable"`).
//
// Backfill idempotente: scansiona solo le righe senza embedding, le
// filtra opzionalmente per campagna, e applica il provider Ollama
// configurato. Non duplica `embed-sherdan-entities.ts` (quello filtra per
// `tag=sherdan-import`); questo script copre tutto il resto.

const DEFAULT_BATCH_SIZE = 8;

interface Args {
  campaignId: string | null;
  dryRun: boolean;
  limit: number | null;
  batchSize: number;
}

interface BackfillStats {
  scope: "campaign" | "all-campaigns";
  campaignId: string | null;
  entitiesScanned: number;
  entitiesEmbedded: number;
  dryRun: boolean;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sqlClient = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sqlClient, { schema });

  try {
    const stats = await backfillMissingEmbeddings(db, args);
    process.stdout.write("[ok] Embedding backfill completato\n");
    process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
  } finally {
    await sqlClient.end();
  }
}

async function backfillMissingEmbeddings(
  db: ReturnType<typeof drizzle<typeof schema>>,
  args: Args,
): Promise<BackfillStats> {
  const stats: BackfillStats = {
    scope: args.campaignId ? "campaign" : "all-campaigns",
    campaignId: args.campaignId,
    entitiesScanned: 0,
    entitiesEmbedded: 0,
    dryRun: args.dryRun,
  };

  const conditions = [isNull(schema.entities.embedding)];
  if (args.campaignId) {
    conditions.push(eq(schema.entities.campaignId, args.campaignId));
  }

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
    })
    .from(schema.entities)
    .where(and(...conditions))
    .orderBy(asc(schema.entities.updatedAt))
    .limit(args.limit ?? 10_000);

  stats.entitiesScanned = rows.length;
  if (rows.length === 0 || args.dryRun) return stats;

  await assertOllamaEmbedModelAvailable();
  const provider = new OllamaProvider({
    baseUrl: env.OLLAMA_BASE_URL,
    chatModel: env.OLLAMA_MODEL,
    embedModel: env.OLLAMA_EMBED_MODEL,
  });

  for (const batch of chunk(rows, args.batchSize)) {
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
      `Ollama non raggiungibile a ${env.OLLAMA_BASE_URL}. Avvia Ollama prima del backfill.`,
      { cause },
    );
  }
  if (!res.ok) {
    throw new Error(`Ollama /api/tags HTTP ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { models?: Array<{ name?: string }> };
  const installed = body.models?.map((m) => m.name ?? "") ?? [];
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
    campaignId: null,
    dryRun: false,
    limit: null,
    batchSize: DEFAULT_BATCH_SIZE,
  };
  for (const arg of argv) {
    // pnpm passa `--` come separatore (es. `pnpm db:embed:backfill --
    // --dry-run`). Lo accettiamo come no-op cosi' lo stesso script
    // funziona sia via tsx diretto sia tramite pnpm.
    if (arg === "--") continue;
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg.startsWith("--campaign-id=")) {
      args.campaignId = arg.slice("--campaign-id=".length);
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
  process.stderr.write(
    `${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
