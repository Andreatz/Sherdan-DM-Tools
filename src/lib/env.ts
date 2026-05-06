import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL mancante"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    // Provider primario per chat. Embedding va sempre via Ollama.
    LLM_PROVIDER: z.enum(["gemini", "ollama"]).default("gemini"),

    // Gemini (richiesto se LLM_PROVIDER=gemini, controllo via superRefine).
    GOOGLE_AI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().min(1).default("gemini-3-flash-preview"),

    // Ollama (sempre richiesto: e' embed provider universale e fallback chat).
    OLLAMA_BASE_URL: z.string().min(1).default("http://localhost:11434"),
    OLLAMA_MODEL: z.string().min(1).default("qwen2.5:7b-instruct-q4_K_M"),
    OLLAMA_EMBED_MODEL: z.string().min(1).default("mxbai-embed-large"),
  })
  .superRefine((value, ctx) => {
    if (value.LLM_PROVIDER === "gemini" && !value.GOOGLE_AI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_AI_API_KEY"],
        message: "richiesta quando LLM_PROVIDER=gemini",
      });
    }
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
