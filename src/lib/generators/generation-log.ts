import type { z } from "zod";

import { db } from "@/db/client";
import { generationLogs } from "@/db/schema";
import { env } from "@/lib/env";
import { getLogger } from "@/lib/logger";

import {
  callStructuredOutput,
  type StructuredOutputCallOptions,
} from "./structured-output";
import type { GeneratorPrompt, GeneratorRunOptions } from "./types";

const log = getLogger("generation-log");

export interface GenerationLogContext {
  generatorName: string;
  campaignId?: string | null;
  /** Input "umano" (es. form DM) di alto livello — separato dal prompt LLM. */
  input: unknown;
  /** Metadata libero: latency, branching info, esiti. */
  metadata?: Record<string, unknown>;
}

export interface CallStructuredOutputLoggedOptions<T>
  extends Omit<StructuredOutputCallOptions, "llm" | "signal"> {
  /** Schema Zod che valida l'output strutturato. */
  schema: z.ZodType<T>;
  /** Prompt LLM gia' costruito. */
  prompt: GeneratorPrompt;
  /** Contesto di logging (campagna, generator name, input umano, metadata). */
  logContext: GenerationLogContext;
  /** Run options del Generator Framework (llm, signal, ...). */
  runOptions?: GeneratorRunOptions;
  /**
   * Override interno (test-only) per evitare la dipendenza dal DB nei test
   * unitari. Default: insert su `generation_log` via Drizzle.
   */
  sink?: GenerationLogSink;
}

export interface GenerationLogSink {
  insert(row: PersistLogRow): Promise<void>;
}

// Wrapper attorno a `callStructuredOutput` che persiste ogni chiamata LLM in
// `generation_log` per audit, cost monitoring e debug. La persistenza e'
// fire-and-forget rispetto al risultato: un errore di logging non rompe la
// route (loggato come warning). Se il provider non espone usage nativo,
// salviamo una stima token/costo marcata in metadata.
export async function callStructuredOutputLogged<T>(
  args: CallStructuredOutputLoggedOptions<T>,
): Promise<T> {
  const { schema, prompt, logContext, runOptions, sink, ...callOptions } =
    args;
  const startedAt = Date.now();
  const modelHint = prompt.options?.model ?? defaultModelForProvider();
  const activeSink: GenerationLogSink = sink ?? defaultSink;

  try {
    const output = await callStructuredOutput(
      prompt,
      schema,
      runOptions ?? {},
      callOptions,
    );
    const usage = estimateUsage({
      model: modelHint,
      prompt: prompt.input,
      output,
    });
    void safePersist(activeSink, {
      generatorName: logContext.generatorName,
      campaignId: logContext.campaignId ?? null,
      provider: env.LLM_PROVIDER,
      model: modelHint,
      input: jsonbSafe(logContext.input),
      prompt: jsonbSafe(prompt.input),
      output: jsonbSafe(output),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      costUsd: usage.costUsd,
      status: "succeeded",
      error: null,
      metadata: jsonbSafeObject({
        ...(logContext.metadata ?? {}),
        latencyMs: Date.now() - startedAt,
        promptOptions: prompt.options ?? null,
        usageEstimated: true,
        costAlert: usage.costUsdNumber >= COST_ALERT_USD,
      }),
    });
    return output;
  } catch (err) {
    const usage = estimateUsage({
      model: modelHint,
      prompt: prompt.input,
      output: "",
    });
    void safePersist(activeSink, {
      generatorName: logContext.generatorName,
      campaignId: logContext.campaignId ?? null,
      provider: env.LLM_PROVIDER,
      model: modelHint,
      input: jsonbSafe(logContext.input),
      prompt: jsonbSafe(prompt.input),
      output: null,
      inputTokens: usage.inputTokens,
      outputTokens: 0,
      totalTokens: usage.inputTokens,
      costUsd: usage.inputCostUsd,
      status: "failed",
      error: serializeError(err),
      metadata: jsonbSafeObject({
        ...(logContext.metadata ?? {}),
        latencyMs: Date.now() - startedAt,
        promptOptions: prompt.options ?? null,
        usageEstimated: true,
        costAlert: usage.inputCostUsdNumber >= COST_ALERT_USD,
      }),
    });
    throw err;
  }
}

export interface PersistLogRow {
  generatorName: string;
  campaignId: string | null;
  provider: string;
  model: string;
  input: unknown;
  prompt: unknown;
  output: unknown;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: string;
  status: "succeeded" | "failed";
  error: unknown;
  metadata: Record<string, unknown>;
}

const defaultSink: GenerationLogSink = {
  async insert(row) {
    await db.insert(generationLogs).values({
      generatorName: row.generatorName,
      campaignId: row.campaignId,
      provider: row.provider,
      model: row.model,
      input: row.input,
      prompt: row.prompt,
      output: row.output,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
      costUsd: row.costUsd,
      status: row.status,
      error: row.error,
      metadata: row.metadata,
    });
  },
};

async function safePersist(
  sink: GenerationLogSink,
  row: PersistLogRow,
): Promise<void> {
  try {
    await sink.insert(row);
  } catch (err) {
    log.warn(
      {
        generator: row.generatorName,
        status: row.status,
        err: err instanceof Error ? err.message : String(err),
      },
      "Impossibile scrivere su generation_log (logging fire-and-forget)",
    );
  }
}

function defaultModelForProvider(): string {
  return env.LLM_PROVIDER === "ollama" ? env.OLLAMA_MODEL : env.GEMINI_MODEL;
}

function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack ?? null,
    };
  }
  return { value: String(err) };
}

// Drizzle/postgres serializza JSONB con JSON.stringify implicitamente.
// Filtriamo cicli/proprieta' non serializzabili a costo di una clonazione.
function jsonbSafe(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { unserializable: true };
  }
}

function jsonbSafeObject(value: Record<string, unknown>): Record<string, unknown> {
  const clone = jsonbSafe(value);
  if (clone && typeof clone === "object" && !Array.isArray(clone)) {
    return clone as Record<string, unknown>;
  }
  return {};
}

const COST_ALERT_USD = 0.05;

const MODEL_PRICING_USD_PER_1M: Record<
  string,
  { input: number; output: number }
> = {
  "gemini-3-flash-preview": { input: 0.5, output: 3 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-preview": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  ollama: { input: 0, output: 0 },
};

const ZERO_PRICE = { input: 0, output: 0 };

interface UsageEstimateInput {
  model: string;
  prompt: unknown;
  output: unknown;
}

function estimateUsage(input: UsageEstimateInput) {
  const inputTokens = estimateTokens(input.prompt);
  const outputTokens = estimateTokens(input.output);
  const totalTokens = inputTokens + outputTokens;
  const pricing = priceForModel(input.model);
  const inputCostUsdNumber = (inputTokens / 1_000_000) * pricing.input;
  const outputCostUsdNumber = (outputTokens / 1_000_000) * pricing.output;
  const costUsdNumber = inputCostUsdNumber + outputCostUsdNumber;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    inputCostUsd: formatUsd(inputCostUsdNumber),
    costUsd: formatUsd(costUsdNumber),
    inputCostUsdNumber,
    costUsdNumber,
  };
}

function estimateTokens(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return Math.max(1, Math.ceil(text.length / 4));
}

function priceForModel(model: string) {
  const normalized = model.toLowerCase();
  for (const [key, pricing] of Object.entries(MODEL_PRICING_USD_PER_1M)) {
    if (normalized.includes(key)) return pricing;
  }
  if (normalized.includes("ollama")) {
    return MODEL_PRICING_USD_PER_1M.ollama ?? ZERO_PRICE;
  }
  if (normalized.includes("gemini")) {
    return MODEL_PRICING_USD_PER_1M["gemini-2.5-flash"] ?? ZERO_PRICE;
  }
  return ZERO_PRICE;
}

function formatUsd(value: number) {
  return value.toFixed(6);
}
