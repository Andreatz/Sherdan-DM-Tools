import type { z } from "zod";

import { getLogger } from "@/lib/logger";

import {
  type CompleteOptions,
  type LLMInput,
  type LLMProvider,
  LLMError,
} from "./types";

const log = getLogger("llm.router");

interface RoutedProviderConfig {
  /** Provider primario per chat (complete, completeStructured, stream). */
  chatPrimary: LLMProvider;
  /** Provider di fallback per chat su errori transient (rete, 5xx, 429). */
  chatFallback: LLMProvider;
  /** Provider unico per embed (mai switchato per stabilita' del vector space). */
  embed: LLMProvider;
  /** Config retry per errori transient prima di passare al fallback. */
  retry?: RetryConfig;
  /** Hook chiamato prima di ritentare una chiamata. Default: log a warn. */
  onRetry?: (event: RetryEvent) => void;
  /** Hook chiamato quando il fallback parte. Default: log a warn. */
  onFallback?: (op: string, err: unknown) => void;
}

interface RetryConfig {
  /** Numero di retry dopo il primo tentativo fallito. Default: 2. */
  maxRetries?: number;
  /** Primo delay tra retry, in ms. Default: 250. */
  initialDelayMs?: number;
  /** Tetto massimo del backoff, in ms. Default: 1000. */
  maxDelayMs?: number;
  /** Moltiplicatore esponenziale. Default: 2. */
  backoffMultiplier?: number;
  /** Iniettato nei test per evitare attese reali. */
  sleep?: (ms: number) => Promise<void>;
}

interface NormalizedRetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  sleep: (ms: number) => Promise<void>;
}

interface RetryEvent {
  op: string;
  provider: "primary" | "fallback";
  retryAttempt: number;
  nextDelayMs: number;
  err: unknown;
}

// Compone due provider in uno: i metodi chat ritentano `chatPrimary` su errori
// transient (network, 5xx, 429) e poi fanno fallback su `chatFallback`.
// I metodi embed vanno SEMPRE al provider `embed` dedicato: non si fa fallback
// perche' switchare provider di embed cambia il vector space e invalida la
// similarity search su tutti i dati gia' embeddati.
//
// Per gli stream retry/fallback si applicano solo se non e' stato ancora emesso
// alcun chunk (best-effort: se la primary fallisce a meta' stream, si lascia
// propagare l'errore invece di duplicare output).
export class RoutedProvider implements LLMProvider {
  private readonly chatPrimary: LLMProvider;
  private readonly chatFallback: LLMProvider;
  private readonly embedProvider: LLMProvider;
  private readonly retry: NormalizedRetryConfig;
  private readonly onRetry: (event: RetryEvent) => void;
  private readonly onFallback: (op: string, err: unknown) => void;

  constructor(config: RoutedProviderConfig) {
    this.chatPrimary = config.chatPrimary;
    this.chatFallback = config.chatFallback;
    this.embedProvider = config.embed;
    this.retry = normalizeRetryConfig(config.retry);
    this.onRetry =
      config.onRetry ??
      ((event) => {
        log.warn(
          {
            op: event.op,
            provider: event.provider,
            retryAttempt: event.retryAttempt,
            nextDelayMs: event.nextDelayMs,
            err:
              event.err instanceof Error
                ? event.err.message
                : String(event.err),
            status: event.err instanceof LLMError ? event.err.status : undefined,
          },
          "transient LLM error, retrying",
        );
      });
    this.onFallback =
      config.onFallback ??
      ((op, err) => {
        log.warn(
          {
            op,
            err: err instanceof Error ? err.message : String(err),
            status: err instanceof LLMError ? err.status : undefined,
          },
          "primary failed, using fallback",
        );
      });
  }

  async complete(input: LLMInput, options?: CompleteOptions): Promise<string> {
    try {
      return await this.withRetries("complete", "primary", options, () =>
        this.chatPrimary.complete(input, options),
      );
    } catch (err) {
      if (!canFallback(err, options)) throw err;
      this.onFallback("complete", err);
      return this.withRetries("complete", "fallback", options, () =>
        this.chatFallback.complete(input, options),
      );
    }
  }

  async completeStructured<T>(
    input: LLMInput,
    schema: z.ZodType<T>,
    options?: CompleteOptions,
  ): Promise<T> {
    try {
      return await this.withRetries(
        "completeStructured",
        "primary",
        options,
        () => this.chatPrimary.completeStructured(input, schema, options),
      );
    } catch (err) {
      if (!canFallback(err, options)) throw err;
      this.onFallback("completeStructured", err);
      return this.withRetries("completeStructured", "fallback", options, () =>
        this.chatFallback.completeStructured(input, schema, options),
      );
    }
  }

  async *stream(
    input: LLMInput,
    options?: CompleteOptions,
  ): AsyncIterable<string> {
    let yielded = false;
    try {
      for await (const chunk of this.streamWithRetries("primary", options, () =>
        this.chatPrimary.stream(input, options),
      )) {
        yielded = true;
        yield chunk;
      }
      return;
    } catch (err) {
      if (yielded || !canFallback(err, options)) throw err;
      this.onFallback("stream", err);
      yield* this.streamWithRetries("fallback", options, () =>
        this.chatFallback.stream(input, options),
      );
    }
  }

  embed(text: string): Promise<number[]> {
    return this.embedProvider.embed(text);
  }

  embedBatch(texts: string[]): Promise<number[][]> {
    return this.embedProvider.embedBatch(texts);
  }

  private async withRetries<T>(
    op: string,
    provider: "primary" | "fallback",
    options: CompleteOptions | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    for (let failedAttempts = 0; ; failedAttempts++) {
      try {
        return await fn();
      } catch (err) {
        if (
          !canFallback(err, options) ||
          failedAttempts >= this.retry.maxRetries
        ) {
          throw err;
        }

        const nextDelayMs = retryDelayMs(this.retry, failedAttempts);
        this.onRetry({
          op,
          provider,
          retryAttempt: failedAttempts + 1,
          nextDelayMs,
          err,
        });
        await this.retry.sleep(nextDelayMs);
      }
    }
  }

  private async *streamWithRetries(
    provider: "primary" | "fallback",
    options: CompleteOptions | undefined,
    streamFactory: () => AsyncIterable<string>,
  ): AsyncIterable<string> {
    for (let failedAttempts = 0; ; failedAttempts++) {
      let yieldedInAttempt = false;
      try {
        for await (const chunk of streamFactory()) {
          yieldedInAttempt = true;
          yield chunk;
        }
        return;
      } catch (err) {
        if (
          yieldedInAttempt ||
          !canFallback(err, options) ||
          failedAttempts >= this.retry.maxRetries
        ) {
          throw err;
        }

        const nextDelayMs = retryDelayMs(this.retry, failedAttempts);
        this.onRetry({
          op: "stream",
          provider,
          retryAttempt: failedAttempts + 1,
          nextDelayMs,
          err,
        });
        await this.retry.sleep(nextDelayMs);
      }
    }
  }
}

// Fallback solo su errori "transient": network, 5xx, 429. Errori 4xx sono
// problemi di input (schema invalido, prompt troppo lungo, content blocked):
// li lasciamo propagare invece di mascherarli con risposte da un altro modello.
function canFallback(err: unknown, options: CompleteOptions | undefined): boolean {
  if (options?.signal?.aborted) return false;
  if (!(err instanceof LLMError)) return false;
  if (err.status === undefined) return true; // network / DNS / fetch failed
  if (err.status === 429) return true;
  if (err.status >= 500) return true;
  return false;
}

function normalizeRetryConfig(
  config: RetryConfig | undefined,
): NormalizedRetryConfig {
  return {
    maxRetries: config?.maxRetries ?? 2,
    initialDelayMs: config?.initialDelayMs ?? 250,
    maxDelayMs: config?.maxDelayMs ?? 1000,
    backoffMultiplier: config?.backoffMultiplier ?? 2,
    sleep: config?.sleep ?? sleep,
  };
}

function retryDelayMs(
  config: NormalizedRetryConfig,
  failedAttempts: number,
): number {
  return Math.min(
    config.maxDelayMs,
    config.initialDelayMs *
      Math.pow(config.backoffMultiplier, failedAttempts),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
