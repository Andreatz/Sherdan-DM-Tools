import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL mancante"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // LLM provider: Ollama locale. Default punta al servizio standard.
  OLLAMA_BASE_URL: z.string().min(1).default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().min(1).default("qwen2.5:7b-instruct-q4_K_M"),
  OLLAMA_EMBED_MODEL: z.string().min(1).default("mxbai-embed-large"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Variabili d'ambiente invalide:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
