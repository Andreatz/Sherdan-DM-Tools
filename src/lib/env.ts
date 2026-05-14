import { z } from "zod";

// Single source of truth per le variabili d'ambiente del progetto.
//
// Convenzione server-only: questo modulo legge `process.env` e contiene
// chiavi sensibili (DATABASE_URL, GOOGLE_AI_API_KEY). NON deve essere
// importato da componenti React client. Non usiamo `import "server-only"` qui
// perche' questo file e' importato anche da script Node eseguiti con tsx
// (`pnpm env:check`, migrations, seed, bootstrap) fuori dal runtime Next.
//
// Per esporre valori al client, passare attraverso server actions o API routes
// e valutare se vadano davvero sotto prefisso `NEXT_PUBLIC_*`.
//
// Per l'allineamento col file `.env.example` vedi `scripts/env-check.ts`
// (`pnpm env:check`).
const baseSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL mancante"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .optional(),

  // Provider primario per chat. Embedding va sempre via Ollama.
  LLM_PROVIDER: z.enum(["none", "gemini", "ollama", "openai"]).default("none"),

  // Gemini
  GOOGLE_AI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-3-flash-preview"),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.5"),

  // Ollama
  OLLAMA_BASE_URL: z.string().min(1).default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().min(1).default("qwen2.5:7b-instruct-q4_K_M"),
  OLLAMA_EMBED_MODEL: z.string().min(1).default("mxbai-embed-large"),

  // Player / realtime access
  SHERDAN_PLAYER_ACCESS_CODE: z.string().optional(),

  // Variabili consumate da docker-compose.yml
  POSTGRES_DB: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_PORT: z.string().optional(),
});

const schema = baseSchema.superRefine((value, ctx) => {
  if (value.LLM_PROVIDER === "gemini" && !value.GOOGLE_AI_API_KEY) {
    ctx.addIssue({
      code: "custom",
      path: ["GOOGLE_AI_API_KEY"],
      message: "richiesta quando LLM_PROVIDER=gemini",
    });
  }

  if (value.LLM_PROVIDER === "openai" && !value.OPENAI_API_KEY) {
    ctx.addIssue({
      code: "custom",
      path: ["OPENAI_API_KEY"],
      message: "richiesta quando LLM_PROVIDER=openai",
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

// Elenco dei nomi env conosciuti dallo schema, usato dal sync-check con
// `.env.example`. Esposto come array di stringhe per evitare di accoppiare
// gli script al tipo Zod (che non e' serializzabile).
export const envSchemaKeys: readonly string[] = Object.freeze(
  Object.keys(baseSchema.shape),
);
