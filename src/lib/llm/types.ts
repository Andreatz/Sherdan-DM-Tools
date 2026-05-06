import type { z } from "zod";

// Astrazione provider-agnostic. Oggi l'unica impl e' Ollama (CLAUDE.md sec 3
// + decisione 2026-05-06 OSS-only). Cloud providers (Anthropic, OpenAI, ecc.)
// possono essere aggiunti in futuro implementando questa interfaccia.

export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

// Input shorthand: una stringa diventa un singolo `{ role: "user", content }`.
export type LLMInput = string | LLMMessage[];

export interface CompleteOptions {
  /** Override del modello configurato in env. */
  model?: string;
  /** 0 = deterministico, 1 = creativo. Default lasciato al provider. */
  temperature?: number;
  /** Tetto sui token generati. */
  maxTokens?: number;
  /** Sequenze che, se incontrate, fermano la generazione. */
  stop?: string[];
  /** Shorthand: prepende un system message se non gia' presente. */
  system?: string;
  /** Abort cooperativo per richieste lunghe. */
  signal?: AbortSignal;
  /**
   * Modalita' di "thinking" / reasoning interno del modello.
   * - `undefined` (default): usa il default del provider (Gemini 3+: ON)
   * - `false`: disabilita il thinking (output predicibile, meno token)
   * - `true`: abilita con budget dinamico deciso dal modello
   * - `number`: budget esatto in token per il thinking
   *
   * Provider che non supportano thinking (es. Ollama oggi) ignorano l'opzione.
   * I token di thinking contano contro `maxTokens`/`maxOutputTokens`.
   */
  thinking?: boolean | number;
}

export interface LLMProvider {
  /** Completion plain-text. Ritorna il contenuto del messaggio finale. */
  complete(input: LLMInput, options?: CompleteOptions): Promise<string>;

  /**
   * Completion con output strutturato vincolato da uno Zod schema.
   * Il provider passa lo JSON schema corrispondente al modello (Ollama
   * supporta `format: <jsonschema>` da v0.5+) e parsa+valida la risposta.
   */
  completeStructured<T>(
    input: LLMInput,
    schema: z.ZodType<T>,
    options?: CompleteOptions,
  ): Promise<T>;

  /** Streaming token-by-token come async iterable. */
  stream(input: LLMInput, options?: CompleteOptions): AsyncIterable<string>;

  /** Embedding per una singola stringa. */
  embed(text: string): Promise<number[]>;

  /** Embedding batch per piu' stringhe in un'unica richiesta. */
  embedBatch(texts: string[]): Promise<number[][]>;
}

export class LLMError extends Error {
  override readonly name: string = "LLMError";
  constructor(
    message: string,
    readonly cause?: unknown,
    readonly status?: number,
  ) {
    super(message);
  }
}

export class LLMStructuredOutputError extends LLMError {
  override readonly name: string = "LLMStructuredOutputError";
  constructor(
    message: string,
    readonly rawOutput: string,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}
