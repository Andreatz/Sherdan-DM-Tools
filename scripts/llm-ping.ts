import "dotenv/config";

import { z } from "zod";

import { env } from "@/lib/env";
import { LLMError, getLLMProvider } from "@/lib/llm";

// Sanity check end-to-end del provider LLM:
// 1. Verifica che il servizio risponda (lista modelli installati)
// 2. complete: una frase breve
// 3. completeStructured: un piccolo oggetto JSON valido
// 4. embed: produce un vettore di dimensione attesa (1024 per mxbai-embed-large)
//
// Se Ollama non e' avviato o i modelli non sono pull-ati, il check fallisce
// con messaggio diagnostico ma non crasha l'intero progetto.

async function main() {
  console.log(`Ollama base: ${env.OLLAMA_BASE_URL}`);
  console.log(`chat model:  ${env.OLLAMA_MODEL}`);
  console.log(`embed model: ${env.OLLAMA_EMBED_MODEL}`);
  console.log();

  // 1. Lista modelli (chiamata diretta, l'astrazione non la espone perche'
  //    e' Ollama-specifica e non rientra nel contratto LLMProvider).
  let installed: string[] = [];
  try {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`);
    if (!res.ok) {
      console.error(`[FAIL] /api/tags HTTP ${res.status}`);
      process.exit(1);
    }
    const body = (await res.json()) as { models?: { name: string }[] };
    installed = body.models?.map((m) => m.name) ?? [];
    console.log(`[OK]   /api/tags  (${installed.length} modelli installati)`);
    for (const m of installed) console.log(`         - ${m}`);
  } catch (err) {
    console.error(
      `[FAIL] Ollama non raggiungibile a ${env.OLLAMA_BASE_URL}.`,
      `\n       Avvia il servizio Ollama (es. \`ollama serve\` o app desktop).`,
      `\n       Errore: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
  console.log();

  const expectedModels = [env.OLLAMA_MODEL, env.OLLAMA_EMBED_MODEL];
  const missing = expectedModels.filter(
    (m) => !installed.some((i) => i === m || i.startsWith(`${m}:`)),
  );
  if (missing.length > 0) {
    console.error(
      `[FAIL] Modelli mancanti: ${missing.join(", ")}`,
      `\n       Installali con:`,
      ...missing.map((m) => `\n         ollama pull ${m}`),
    );
    process.exit(1);
  }

  const llm = getLLMProvider();

  // 2. complete
  try {
    const out = await llm.complete("Rispondi solo con la parola: pong", {
      temperature: 0,
      maxTokens: 10,
    });
    console.log(`[OK]   complete  (${out.trim().slice(0, 40)})`);
  } catch (err) {
    reportLlmError("complete", err);
    process.exit(1);
  }

  // 3. completeStructured
  try {
    const PingSchema = z.object({
      pong: z.boolean(),
      timestamp_iso: z.string(),
    });
    const obj = await llm.completeStructured(
      [
        {
          role: "user",
          content:
            "Rispondi con un JSON {pong: true, timestamp_iso: <data ISO 8601 di oggi>}",
        },
      ],
      PingSchema,
    );
    console.log(
      `[OK]   completeStructured  (pong=${obj.pong}, ts=${obj.timestamp_iso})`,
    );
  } catch (err) {
    reportLlmError("completeStructured", err);
    process.exit(1);
  }

  // 4. embed (verifica dim coerente con lo schema Postgres vector(1024))
  try {
    const vec = await llm.embed("Sherdan: campagna D&D in italiano.");
    const dim = vec.length;
    if (dim !== 1024) {
      console.error(
        `[WARN] embed dim=${dim}, schema DB e' vector(1024). Disallineamento!`,
      );
    } else {
      console.log(`[OK]   embed  (dim=${dim})`);
    }
  } catch (err) {
    reportLlmError("embed", err);
    process.exit(1);
  }

  console.log("\nAll LLM smoke checks passed.");
}

function reportLlmError(op: string, err: unknown) {
  if (err instanceof LLMError) {
    console.error(`[FAIL] ${op}: ${err.message}`);
    if (err.cause) console.error("       cause:", err.cause);
  } else {
    console.error(`[FAIL] ${op}:`, err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
