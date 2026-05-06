import { env } from "@/lib/env";

import { OllamaProvider } from "./ollama";
import type { LLMProvider } from "./types";

export * from "./types";
export { OllamaProvider } from "./ollama";

let cached: LLMProvider | undefined;

/**
 * Singleton del provider LLM configurato. Oggi e' sempre Ollama; quando
 * verra' aggiunto un secondo provider questa factory leggera' env
 * (es. LLM_PROVIDER=ollama|anthropic|...) per scegliere.
 */
export function getLLMProvider(): LLMProvider {
  if (!cached) {
    cached = new OllamaProvider({
      baseUrl: env.OLLAMA_BASE_URL,
      chatModel: env.OLLAMA_MODEL,
      embedModel: env.OLLAMA_EMBED_MODEL,
    });
  }
  return cached;
}
