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
  /** Hook chiamato quando il fallback parte. Default: log a warn. */
  onFallback?: (op: string, err: unknown) => void;
}

// Compone due provider in uno: i metodi chat tentano `chatPrimary` e fanno
// fallback su `chatFallback` se l'errore e' "transient" (network, 5xx, 429).
// I metodi embed vanno SEMPRE al provider `embed` dedicato — non si fa
// fallback perche' switchare provider di embed cambia il vector space e
// invalida la similarity search su tutti i dati gia' embeddati.
//
// Per gli stream il fallback si applica solo se non e' stato ancora emesso
// alcun chunk (best-effort: se la primary fallisce a meta' stream, si lascia
// propagare l'errore invece di duplicare output).
export class RoutedProvider implements LLMProvider {
  private readonly chatPrimary: LLMProvider;
  private readonly chatFallback: LLMProvider;
  private readonly embedProvider: LLMProvider;
  private readonly onFallback: (op: string, err: unknown) => void;

  constructor(config: RoutedProviderConfig) {
    this.chatPrimary = config.chatPrimary;
    this.chatFallback = config.chatFallback;
    this.embedProvider = config.embed;
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
      return await this.chatPrimary.complete(input, options);
    } catch (err) {
      if (!isFallbackable(err)) throw err;
      this.onFallback("complete", err);
      return this.chatFallback.complete(input, options);
    }
  }

  async completeStructured<T>(
    input: LLMInput,
    schema: z.ZodType<T>,
    options?: CompleteOptions,
  ): Promise<T> {
    try {
      return await this.chatPrimary.completeStructured(input, schema, options);
    } catch (err) {
      if (!isFallbackable(err)) throw err;
      this.onFallback("completeStructured", err);
      return this.chatFallback.completeStructured(input, schema, options);
    }
  }

  async *stream(
    input: LLMInput,
    options?: CompleteOptions,
  ): AsyncIterable<string> {
    let yielded = false;
    try {
      for await (const chunk of this.chatPrimary.stream(input, options)) {
        yielded = true;
        yield chunk;
      }
      return;
    } catch (err) {
      if (yielded || !isFallbackable(err)) throw err;
      this.onFallback("stream", err);
      yield* this.chatFallback.stream(input, options);
    }
  }

  embed(text: string): Promise<number[]> {
    return this.embedProvider.embed(text);
  }

  embedBatch(texts: string[]): Promise<number[][]> {
    return this.embedProvider.embedBatch(texts);
  }
}

// Fallback solo su errori "transient": network, 5xx, 429. Errori 4xx sono
// problemi di input (schema invalido, prompt troppo lungo, content blocked):
// li lasciamo propagare invece di mascherarli con risposte da un altro modello.
function isFallbackable(err: unknown): boolean {
  if (!(err instanceof LLMError)) return false;
  if (err.status === undefined) return true; // network / DNS / fetch failed
  if (err.status === 429) return true;
  if (err.status >= 500) return true;
  return false;
}
