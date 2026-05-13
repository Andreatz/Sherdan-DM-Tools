import "dotenv/config";

import { and, asc, eq, isNull, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { assertEmbeddingDimensions } from "@/lib/import/entity-embedding-text";
import { OllamaProvider } from "@/lib/llm";

// `pnpm db:embed:rules [--source=<source>] [--limit=N] [--dry-run]
// [--batch-size=N] [--force]`
//
// Genera embeddings per `rule_documents.embedding`. Di default tocca
// solo le righe con `embedding IS NULL` (idempotente: rilanciare non
// rifa' embeddings gia' presenti). `--force` rifa' tutto: usalo dopo
// aver cambiato modello embedding o re-indicizzato il corpus.
//
// `--source=<source>` filtra per `rule_documents.source` (es.
// `sherdan-custom`); senza, processa tutti i source presenti.

const DEFAULT_BATCH_SIZE = 8;

interface Args {
  source: string | null;
  dryRun: boolean;
  force: boolean;
  limit: number | null;
  batchSize: number;
}

interface EmbedStats {
  scope: { source: string | null; force: boolean };
  documentsScanned: number;
  documentsEmbedded: number;
  dryRun: boolean;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sqlClient = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sqlClient, { schema });

  try {
    const stats = await embedRuleDocuments(db, args);
    process.stdout.write("[ok] Embedding rule_documents completato\n");
    process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
  } finally {
    await sqlClient.end();
  }
}

async function embedRuleDocuments(
  db: ReturnType<typeof drizzle<typeof schema>>,
  args: Args,
): Promise<EmbedStats> {
  const stats: EmbedStats = {
    scope: { source: args.source, force: args.force },
    documentsScanned: 0,
    documentsEmbedded: 0,
    dryRun: args.dryRun,
  };

  const conditions: SQL[] = [];
  if (!args.force) {
    conditions.push(isNull(schema.ruleDocuments.embedding));
  }
  if (args.source) {
    conditions.push(eq(schema.ruleDocuments.source, args.source));
  }

  const rows = await db
    .select({
      id: schema.ruleDocuments.id,
      source: schema.ruleDocuments.source,
      title: schema.ruleDocuments.title,
      section: schema.ruleDocuments.section,
      content: schema.ruleDocuments.content,
    })
    .from(schema.ruleDocuments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(schema.ruleDocuments.createdAt))
    .limit(args.limit ?? 10_000);

  stats.documentsScanned = rows.length;
  if (rows.length === 0 || args.dryRun) return stats;

  await assertOllamaEmbedModelAvailable();
  const provider = new OllamaProvider({
    baseUrl: env.OLLAMA_BASE_URL,
    chatModel: env.OLLAMA_MODEL,
    embedModel: env.OLLAMA_EMBED_MODEL,
  });

  for (const batch of chunk(rows, args.batchSize)) {
    const texts = batch.map(buildRuleEmbeddingText);
    const vectors = await provider.embedBatch(texts);
    if (vectors.length !== batch.length) {
      throw new Error(
        `Ollama ha restituito ${vectors.length} embedding per ${batch.length} input`,
      );
    }
    for (let index = 0; index < batch.length; index += 1) {
      const row = batch[index];
      const vector = vectors[index];
      if (!row || !vector) continue;
      assertEmbeddingDimensions(vector);
      await db
        .update(schema.ruleDocuments)
        .set({ embedding: vector })
        .where(eq(schema.ruleDocuments.id, row.id));
      stats.documentsEmbedded += 1;
    }
  }

  return stats;
}

// Testo che va a embedding: title + section + content. Lo stesso testo
// che il modello vedra' a query-time non e' del tutto identico (lui
// embeda la domanda dell'utente), ma includere title/section nel doc
// embedding migliora il recall su query che cercano per sezione
// (es. "regole rapide crafting").
function buildRuleEmbeddingText(row: {
  title: string | null;
  section: string | null;
  content: string;
}): string {
  const lines: string[] = [];
  if (row.title) lines.push(row.title);
  if (row.section) lines.push(row.section);
  lines.push("");
  lines.push(row.content);
  return lines.join("\n");
}

async function assertOllamaEmbedModelAvailable() {
  let res: Response;
  try {
    res = await fetch(`${env.OLLAMA_BASE_URL.replace(/\/+$/, "")}/api/tags`);
  } catch (cause) {
    throw new Error(
      `Ollama non raggiungibile a ${env.OLLAMA_BASE_URL}. Avvia Ollama prima dell'embedding.`,
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
    source: null,
    dryRun: false,
    force: false,
    limit: null,
    batchSize: DEFAULT_BATCH_SIZE,
  };
  for (const arg of argv) {
    if (arg === "--") continue;
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--force") {
      args.force = true;
      continue;
    }
    if (arg.startsWith("--source=")) {
      args.source = arg.slice("--source=".length);
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
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} richiede un intero positivo, ricevuto: ${value}`);
  }
  return parsed;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

void main();
