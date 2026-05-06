import { env } from "@/lib/env";

import { GeminiProvider } from "./gemini";
import { OllamaProvider } from "./ollama";
import { RoutedProvider } from "./router";
import type { LLMProvider } from "./types";

export * from "./types";
export { GeminiProvider } from "./gemini";
export { OllamaProvider } from "./ollama";
export { RoutedProvider } from "./router";

let cached: LLMProvider | undefined;

/**
 * Provider LLM configurato in base a env. Logica:
 * - embedding: SEMPRE Ollama (mxbai-embed-large 1024-dim) per stabilita' del
 *   vector space. La decisione e' isolata dalla scelta del chat provider.
 * - chat: dipende da `LLM_PROVIDER`.
 *   - `gemini` (default): Gemini come primario, Ollama come fallback su
 *     errori transient (rete/5xx/429).
 *   - `ollama`: Ollama unico provider.
 *
 * Singleton: viene istanziato al primo uso e riusato.
 */
export function getLLMProvider(): LLMProvider {
  if (cached) return cached;

  const ollama = new OllamaProvider({
    baseUrl: env.OLLAMA_BASE_URL,
    chatModel: env.OLLAMA_MODEL,
    embedModel: env.OLLAMA_EMBED_MODEL,
  });

  if (env.LLM_PROVIDER === "ollama") {
    cached = ollama;
    return cached;
  }

  // LLM_PROVIDER === "gemini": env.ts garantisce che GOOGLE_AI_API_KEY sia
  // presente (superRefine).
  if (!env.GOOGLE_AI_API_KEY) {
    throw new Error(
      "Configurazione invalida: LLM_PROVIDER=gemini ma GOOGLE_AI_API_KEY assente",
    );
  }

  const gemini = new GeminiProvider({
    apiKey: env.GOOGLE_AI_API_KEY,
    model: env.GEMINI_MODEL,
  });

  cached = new RoutedProvider({
    chatPrimary: gemini,
    chatFallback: ollama,
    embed: ollama,
  });
  return cached;
}

/** Reset del singleton — utile in test. */
export function resetLLMProviderCache(): void {
  cached = undefined;
}
