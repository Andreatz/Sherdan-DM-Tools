import { z } from "zod";

import {
  type CompleteOptions,
  type LLMInput,
  type LLMMessage,
  type LLMProvider,
  LLMError,
  LLMStructuredOutputError,
} from "./types";

interface GeminiProviderConfig {
  apiKey: string;
  model: string;
  /** Override del base URL (utile per test o proxy). */
  baseUrl?: string;
}

// Provider Gemini via REST API (https://ai.google.dev). Niente SDK esterno
// per restare coerenti con OllamaProvider e ridurre la superficie di
// dipendenze. Implementa solo i metodi chat: l'embedding e' deliberatamente
// non supportato e va via Ollama (vedi router.ts) per stabilita' del vector
// space.
export class GeminiProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: GeminiProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = (
      config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta"
    ).replace(/\/+$/, "");
  }

  async complete(input: LLMInput, options: CompleteOptions = {}) {
    const { contents, systemInstruction } = toGeminiMessages(
      input,
      options.system,
    );
    const body = {
      contents,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: geminiGenerationConfig(options),
    };

    const res = await this.fetchJson(
      `models/${options.model ?? this.model}:generateContent`,
      body,
      options.signal,
    );
    return extractText(res, "complete");
  }

  async completeStructured<T>(
    input: LLMInput,
    schema: z.ZodType<T>,
    options: CompleteOptions = {},
  ) {
    const { contents, systemInstruction } = toGeminiMessages(
      input,
      options.system,
    );
    const jsonSchema = sanitizeJsonSchema(z.toJSONSchema(schema));

    const body = {
      contents,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: {
        ...geminiGenerationConfig({ temperature: 0, ...options }),
        responseMimeType: "application/json",
        responseSchema: jsonSchema,
      },
    };

    const res = await this.fetchJson(
      `models/${options.model ?? this.model}:generateContent`,
      body,
      options.signal,
    );

    const raw = extractText(res, "completeStructured");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      throw new LLMStructuredOutputError(
        "Gemini ha restituito output non-JSON nonostante responseSchema",
        raw,
        cause,
      );
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new LLMStructuredOutputError(
        "Output Gemini non aderisce allo schema Zod richiesto",
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
    const { contents, systemInstruction } = toGeminiMessages(
      input,
      options.system,
    );
    const body = {
      contents,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: geminiGenerationConfig(options),
    };

    const url = `${this.baseUrl}/models/${
      options.model ?? this.model
    }:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: options.signal,
      });
    } catch (cause) {
      throw new LLMError(
        "Gemini unreachable (network). Connessione internet attiva?",
        cause,
      );
    }

    if (!res.ok) {
      throw new LLMError(
        `Gemini stream HTTP ${res.status}: ${await res.text()}`,
        undefined,
        res.status,
      );
    }
    if (!res.body) {
      throw new LLMError("Gemini stream: response body assente");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE: blocchi separati da `\n\n`, righe payload prefissate da `data: `.
        let sepIdx = buffer.indexOf("\n\n");
        while (sepIdx >= 0) {
          const block = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          const text = parseSseBlock(block);
          if (text) yield text;
          sepIdx = buffer.indexOf("\n\n");
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  embed(): Promise<number[]> {
    return Promise.reject(
      new LLMError(
        "GeminiProvider.embed non implementato: gli embedding del progetto " +
          "girano sempre via Ollama (mxbai-embed-large 1024-dim) per stabilita' " +
          "del vector space. Usa il router (getLLMProvider) o OllamaProvider " +
          "direttamente per gli embed.",
      ),
    );
  }

  embedBatch(): Promise<number[][]> {
    return Promise.reject(
      new LLMError(
        "GeminiProvider.embedBatch non implementato: usare il router " +
          "(getLLMProvider) o OllamaProvider per gli embed.",
      ),
    );
  }

  private async fetchJson(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const url = `${this.baseUrl}/${path}?key=${encodeURIComponent(this.apiKey)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (cause) {
      throw new LLMError(
        `Gemini unreachable a ${path}. Connessione internet attiva?`,
        cause,
      );
    }
    if (!res.ok) {
      throw new LLMError(
        `Gemini HTTP ${res.status} su ${path}: ${await res.text()}`,
        undefined,
        res.status,
      );
    }
    return res.json();
  }
}

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

interface GeminiSystemInstruction {
  parts: { text: string }[];
}

interface GeminiMessages {
  contents: GeminiContent[];
  systemInstruction?: GeminiSystemInstruction;
}

function toGeminiMessages(input: LLMInput, system?: string): GeminiMessages {
  const msgs: LLMMessage[] =
    typeof input === "string"
      ? [{ role: "user", content: input }]
      : [...input];

  const systemParts: string[] = [];
  if (system) systemParts.push(system);

  const contents: GeminiContent[] = [];
  for (const m of msgs) {
    if (m.role === "system") {
      systemParts.push(m.content);
      continue;
    }
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }

  return {
    contents,
    ...(systemParts.length > 0
      ? { systemInstruction: { parts: [{ text: systemParts.join("\n\n") }] } }
      : {}),
  };
}

function geminiGenerationConfig(options: CompleteOptions) {
  const out: Record<string, unknown> = {
    // Gemini 2.5 ha "thinking" abilitato di default che consuma
    // `maxOutputTokens` prima del testo finale. Per il progetto ci serve
    // output predicibile e quota efficiente: disabilitato.
    // Modelli che non supportano `thinkingBudget` ignorano il campo.
    thinkingConfig: { thinkingBudget: 0 },
  };
  if (options.temperature !== undefined) out.temperature = options.temperature;
  if (options.maxTokens !== undefined) out.maxOutputTokens = options.maxTokens;
  if (options.stop !== undefined) out.stopSequences = options.stop;
  return out;
}

const generateResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional() })).optional(),
          })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  promptFeedback: z
    .object({
      blockReason: z.string().optional(),
    })
    .optional(),
});

function extractText(raw: unknown, op: string): string {
  const parsed = generateResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new LLMError(`Gemini ${op}: risposta inattesa`);
  }
  if (parsed.data.promptFeedback?.blockReason) {
    throw new LLMError(
      `Gemini ${op} bloccato: ${parsed.data.promptFeedback.blockReason}`,
    );
  }
  const candidate = parsed.data.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((p) => p.text ?? "")
    .filter((t) => t.length > 0)
    .join("");
  if (!text) {
    throw new LLMError(
      `Gemini ${op}: nessun testo nella risposta (finishReason=${
        candidate?.finishReason ?? "?"
      })`,
    );
  }
  return text;
}

function parseSseBlock(block: string): string {
  const lines = block.split("\n");
  let payload = "";
  for (const line of lines) {
    if (line.startsWith("data:")) {
      payload += line.slice(5).trimStart();
    }
  }
  if (!payload || payload === "[DONE]") return "";

  try {
    const json = JSON.parse(payload);
    const parsed = generateResponseSchema.safeParse(json);
    if (!parsed.success) return "";
    return (
      parsed.data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("") ?? ""
    );
  } catch {
    return "";
  }
}

// Gemini accetta un subset di JSON Schema (basato su OpenAPI 3.0), che
// rigetta diversi keyword che Zod 4 inietta. Stripping difensivo.
//
// Rigettati esplicitamente da Gemini: `$schema`, `$id`, `$ref`, `$defs`,
// `additionalProperties`, `patternProperties`, `not`. `format` accetta solo
// alcuni valori standard.
function sanitizeJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(sanitizeJsonSchema);
  if (schema === null || typeof schema !== "object") return schema;

  const dropKeys = new Set([
    "$schema",
    "$id",
    "$ref",
    "$defs",
    "additionalProperties",
    "patternProperties",
    "not",
  ]);
  const supportedFormats = new Set([
    "date",
    "date-time",
    "duration",
    "email",
    "hostname",
    "ipv4",
    "ipv6",
    "time",
    "uri",
  ]);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (dropKeys.has(key)) continue;
    if (
      key === "format" &&
      typeof value === "string" &&
      !supportedFormats.has(value)
    )
      continue;
    out[key] = sanitizeJsonSchema(value);
  }
  return out;
}
