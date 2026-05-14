import { z } from "zod";

import {
  type CompleteOptions,
  type LLMInput,
  type LLMMessage,
  type LLMProvider,
  LLMError,
  LLMStructuredOutputError,
} from "./types";

interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export class OpenAIProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: OpenAIProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(
      /\/+$/,
      "",
    );
  }

  async complete(input: LLMInput, options: CompleteOptions = {}) {
    const body = {
      model: options.model ?? this.model,
      input: toOpenAIInput(input, options.system),
      ...(options.maxTokens !== undefined
        ? { max_output_tokens: options.maxTokens }
        : {}),
    };

    const res = await this.fetchJson("/responses", body, options.signal);
    return extractResponseText(res);
  }

  async completeStructured<T>(
    input: LLMInput,
    schema: z.ZodType<T>,
    options: CompleteOptions = {},
  ) {
    const wrappedSchema = z.object({
      result: schema,
    });

    const jsonSchema = sanitizeJsonSchema(z.toJSONSchema(wrappedSchema));

    const body = {
      model: options.model ?? this.model,
      input: toOpenAIInput(input, options.system),
      ...(options.maxTokens !== undefined
        ? { max_output_tokens: options.maxTokens }
        : {}),
      text: {
        format: {
          type: "json_schema",
          name: "structured_output",
          strict: false,
          schema: jsonSchema,
        },
      },
    };

    const res = await this.fetchJson("/responses", body, options.signal);
    const raw = extractResponseText(res);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      throw new LLMStructuredOutputError(
        "OpenAI ha restituito output non-JSON",
        raw,
        cause,
      );
    }

    const wrappedResult = wrappedSchema.safeParse(parsed);
    if (!wrappedResult.success) {
      throw new LLMStructuredOutputError(
        "Output OpenAI non aderisce allo schema Zod richiesto",
        raw,
        wrappedResult.error,
      );
    }

    return wrappedResult.data.result;
  }

  async *stream(): AsyncIterable<string> {
    throw new LLMError("OpenAIProvider.stream non ancora implementato.");
  }

  embed(): Promise<number[]> {
    return Promise.reject(
      new LLMError(
        "OpenAIProvider.embed non implementato: in questa repo gli embedding restano via Ollama per stabilita' del vector space.",
      ),
    );
  }

  embedBatch(): Promise<number[][]> {
    return Promise.reject(
      new LLMError(
        "OpenAIProvider.embedBatch non implementato: usa Ollama per gli embedding.",
      ),
    );
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (cause) {
      throw new LLMError(
        `OpenAI unreachable a ${this.baseUrl}${path}`,
        cause,
      );
    }

    if (!res.ok) {
      throw new LLMError(
        `OpenAI HTTP ${res.status} su ${path}: ${await res.text()}`,
        undefined,
        res.status,
      );
    }

    return res.json();
  }
}

function toOpenAIInput(input: LLMInput, system?: string) {
  const msgs: LLMMessage[] =
    typeof input === "string"
      ? [{ role: "user", content: input }]
      : [...input];

  if (system && !msgs.some((m) => m.role === "system")) {
    msgs.unshift({ role: "system", content: system });
  }

  return msgs.map((m) => ({
    role: m.role === "assistant" ? "assistant" : m.role,
    content: m.content,
  }));
}

function extractResponseText(raw: unknown): string {
  const obj = raw as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (typeof obj.output_text === "string" && obj.output_text.length > 0) {
    return obj.output_text;
  }

  const text =
    obj.output
      ?.flatMap((item) => item.content ?? [])
      .map((part) => part.text ?? "")
      .join("") ?? "";

  if (!text) {
    throw new LLMError("OpenAI: nessun testo nella risposta");
  }

  return text;
}

function sanitizeJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(sanitizeJsonSchema);
  if (schema === null || typeof schema !== "object") return schema;

  const input = schema as Record<string, unknown>;

  const dropKeys = new Set([
    "$schema",
    "$id",
    "$ref",
    "$defs",
    "patternProperties",
    "not",
  ]);

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (dropKeys.has(key)) continue;

    if (key === "const") {
      out.enum = [value];
      continue;
    }

    out[key] = sanitizeJsonSchema(value);
  }

  return out;
}