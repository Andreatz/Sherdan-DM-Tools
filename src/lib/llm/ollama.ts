import { z } from "zod";

import {
  type CompleteOptions,
  type LLMInput,
  type LLMMessage,
  type LLMProvider,
  LLMError,
  LLMStructuredOutputError,
} from "./types";

interface OllamaProviderConfig {
  baseUrl: string;
  chatModel: string;
  embedModel: string;
}

export class OllamaProvider implements LLMProvider {
  private readonly baseUrl: string;
  private readonly chatModel: string;
  private readonly embedModel: string;

  constructor(config: OllamaProviderConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.chatModel = config.chatModel;
    this.embedModel = config.embedModel;
  }

  async complete(input: LLMInput, options: CompleteOptions = {}) {
    const messages = toMessages(input, options.system);
    const res = await this.fetchJson("/api/chat", {
      model: options.model ?? this.chatModel,
      messages,
      stream: false,
      options: ollamaSamplingOptions(options),
    }, options.signal);

    return assistantContent(res, "complete");
  }

  async completeStructured<T>(
    input: LLMInput,
    schema: z.ZodType<T>,
    options: CompleteOptions = {},
  ) {
    const messages = toMessages(input, options.system);
    const jsonSchema = z.toJSONSchema(schema);

    const res = await this.fetchJson("/api/chat", {
      model: options.model ?? this.chatModel,
      messages,
      stream: false,
      format: jsonSchema,
      // Default temperature 0 per output strutturati: la creativita' va contro
      // l'aderenza allo schema. Caller puo' sovrascrivere.
      options: ollamaSamplingOptions({ temperature: 0, ...options }),
    }, options.signal);

    const raw = assistantContent(res, "completeStructured");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      throw new LLMStructuredOutputError(
        "Ollama ha restituito output non-JSON nonostante format=schema",
        raw,
        cause,
      );
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new LLMStructuredOutputError(
        "Output Ollama non aderisce allo schema Zod richiesto",
        raw,
        result.error,
      );
    }
    return result.data;
  }

  async *stream(
    input: LLMInput,
    options: CompleteOptions = {},
  ): AsyncIterable<string> {
    const messages = toMessages(input, options.system);
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model ?? this.chatModel,
        messages,
        stream: true,
        options: ollamaSamplingOptions(options),
      }),
      signal: options.signal,
    });

    if (!res.ok) {
      throw new LLMError(
        `Ollama stream HTTP ${res.status}: ${await res.text()}`,
        undefined,
        res.status,
      );
    }
    if (!res.body) {
      throw new LLMError("Ollama stream: response body assente");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx = buffer.indexOf("\n");
        while (newlineIdx >= 0) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (line) {
            const chunk = parseStreamChunk(line);
            if (chunk.content) yield chunk.content;
            if (chunk.done) return;
          }
          newlineIdx = buffer.indexOf("\n");
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async embed(text: string) {
    const [vec] = await this.embedBatch([text]);
    if (!vec) {
      throw new LLMError("Ollama embed: risposta vuota");
    }
    return vec;
  }

  async embedBatch(texts: string[]) {
    if (texts.length === 0) return [];
    const res = await this.fetchJson("/api/embed", {
      model: this.embedModel,
      input: texts,
    });
    const parsed = embedResponseSchema.safeParse(res);
    if (!parsed.success) {
      throw new LLMError(
        `Ollama embed: risposta inattesa: ${parsed.error.message}`,
      );
    }
    return parsed.data.embeddings;
  }

  private async fetchJson(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (cause) {
      throw new LLMError(
        `Ollama unreachable a ${this.baseUrl}${path}. Servizio Ollama avviato?`,
        cause,
      );
    }
    if (!res.ok) {
      throw new LLMError(
        `Ollama HTTP ${res.status} su ${path}: ${await res.text()}`,
        undefined,
        res.status,
      );
    }
    return res.json();
  }
}

function toMessages(input: LLMInput, system?: string): LLMMessage[] {
  const msgs =
    typeof input === "string"
      ? [{ role: "user" as const, content: input }]
      : [...input];
  if (system && !msgs.some((m) => m.role === "system")) {
    msgs.unshift({ role: "system", content: system });
  }
  return msgs;
}

function ollamaSamplingOptions(options: CompleteOptions) {
  // Ollama accetta solo i campi non-undefined. Costruiamo l'oggetto in modo
  // che num_predict/temperature/stop appaiano solo se richiesti.
  const out: Record<string, unknown> = {};
  if (options.temperature !== undefined) out.temperature = options.temperature;
  if (options.maxTokens !== undefined) out.num_predict = options.maxTokens;
  if (options.stop !== undefined) out.stop = options.stop;
  return out;
}

const chatResponseSchema = z.object({
  message: z
    .object({
      role: z.string(),
      content: z.string(),
    })
    .optional(),
  done: z.boolean().optional(),
});

function assistantContent(raw: unknown, op: string): string {
  const parsed = chatResponseSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.message) {
    throw new LLMError(`Ollama ${op}: risposta inattesa`);
  }
  return parsed.data.message.content;
}

const streamChunkSchema = z.object({
  message: z.object({ content: z.string() }).optional(),
  done: z.boolean().optional(),
});

function parseStreamChunk(line: string): { content: string; done: boolean } {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    // Ollama emette solo NDJSON valido; un parse fallito e' un bug del
    // server o della rete. Saltiamo silenziosamente la riga rotta.
    return { content: "", done: false };
  }
  const parsed = streamChunkSchema.safeParse(json);
  if (!parsed.success) return { content: "", done: false };
  return {
    content: parsed.data.message?.content ?? "",
    done: parsed.data.done ?? false,
  };
}

const embedResponseSchema = z.object({
  embeddings: z.array(z.array(z.number())),
});
