import "dotenv/config";

import { z } from "zod";

import { env } from "@/lib/env";
import {
  GeminiProvider,
  LLMError,
  OllamaProvider,
  getLLMProvider,
} from "@/lib/llm";

// Sanity check end-to-end. Testa ognuno dei provider configurati in maniera
// indipendente, poi il router risultante. Esce 1 se qualcosa di critico
// fallisce; warning per cose non bloccanti (es. Ollama non avviato quando
// LLM_PROVIDER=gemini: usabile finche' c'e' rete, ma non hai fallback).

const PingSchema = z.object({
  pong: z.boolean(),
  language: z.string(),
});

async function main() {
  console.log(`LLM_PROVIDER=${env.LLM_PROVIDER}`);
  console.log();

  let geminiOk = false;
  let ollamaChatOk = false;
  let ollamaEmbedOk = false;

  if (env.GOOGLE_AI_API_KEY) {
    geminiOk = await pingGemini(env.GOOGLE_AI_API_KEY, env.GEMINI_MODEL);
  } else {
    console.log("[skip] Gemini: GOOGLE_AI_API_KEY non impostata.\n");
  }

  ({ chat: ollamaChatOk, embed: ollamaEmbedOk } = await pingOllama());

  // Verifica del router risultante
  console.log("Router (getLLMProvider):");
  try {
    const llm = getLLMProvider();
    const out = await llm.complete("Rispondi solo: OK", {
      temperature: 0,
      maxTokens: 5,
    });
    console.log(`  [OK]   complete via router: "${out.trim().slice(0, 60)}"`);
  } catch (err) {
    reportLlmError("  ", "router.complete", err);
  }
  console.log();

  // Esiti
  const failures: string[] = [];
  if (env.LLM_PROVIDER === "gemini") {
    if (!geminiOk)
      failures.push("Gemini primario non funziona — verifica API key e rete");
    if (!ollamaChatOk)
      console.warn(
        "[warn] Ollama chat fallback non disponibile: senza rete il router fallira'.",
      );
  } else if (!ollamaChatOk) {
    failures.push("Ollama (provider unico) non disponibile per chat");
  }
  if (!ollamaEmbedOk) {
    failures.push(
      "Ollama embed non disponibile (sempre richiesto, indipendente da LLM_PROVIDER)",
    );
  }

  if (failures.length > 0) {
    console.error("FAILURES:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("All required LLM checks passed.");
}

async function pingGemini(apiKey: string, model: string): Promise<boolean> {
  console.log(`Gemini (${model}):`);
  const gemini = new GeminiProvider({ apiKey, model });
  let ok = true;

  try {
    const out = await gemini.complete("Rispondi solo: pong", {
      temperature: 0,
      maxTokens: 10,
    });
    console.log(`  [OK]   complete  ("${out.trim().slice(0, 60)}")`);
  } catch (err) {
    reportLlmError("  ", "complete", err);
    ok = false;
  }

  try {
    const obj = await gemini.completeStructured(
      "Rispondi con un JSON {pong: true, language: 'it'}",
      PingSchema,
    );
    console.log(
      `  [OK]   completeStructured  (pong=${obj.pong}, lang=${obj.language})`,
    );
  } catch (err) {
    reportLlmError("  ", "completeStructured", err);
    ok = false;
  }

  console.log();
  return ok;
}

async function pingOllama(): Promise<{ chat: boolean; embed: boolean }> {
  console.log(`Ollama (${env.OLLAMA_BASE_URL}):`);
  console.log(`  chat:  ${env.OLLAMA_MODEL}`);
  console.log(`  embed: ${env.OLLAMA_EMBED_MODEL}`);

  // Step 1: tags / reachability
  let installed: string[] = [];
  try {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`);
    if (!res.ok) {
      console.error(`  [FAIL] /api/tags HTTP ${res.status}`);
      console.log();
      return { chat: false, embed: false };
    }
    const body = (await res.json()) as { models?: { name: string }[] };
    installed = body.models?.map((m) => m.name) ?? [];
    console.log(`  [OK]   /api/tags  (${installed.length} modelli)`);
  } catch (err) {
    console.error(
      `  [WARN] Ollama non raggiungibile: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    console.error("         Avvia il servizio Ollama per fallback chat + embed.");
    console.log();
    return { chat: false, embed: false };
  }

  const provider = new OllamaProvider({
    baseUrl: env.OLLAMA_BASE_URL,
    chatModel: env.OLLAMA_MODEL,
    embedModel: env.OLLAMA_EMBED_MODEL,
  });

  let chatOk = false;
  let embedOk = false;

  if (
    !installed.some(
      (m) => m === env.OLLAMA_MODEL || m.startsWith(`${env.OLLAMA_MODEL}:`),
    )
  ) {
    console.warn(
      `  [warn] modello chat ${env.OLLAMA_MODEL} non installato. \`ollama pull ${env.OLLAMA_MODEL}\``,
    );
  } else {
    try {
      const out = await provider.complete("Rispondi solo: pong", {
        temperature: 0,
        maxTokens: 10,
      });
      console.log(`  [OK]   complete  ("${out.trim().slice(0, 60)}")`);
      chatOk = true;
    } catch (err) {
      reportLlmError("  ", "complete", err);
    }
  }

  if (
    !installed.some(
      (m) =>
        m === env.OLLAMA_EMBED_MODEL ||
        m.startsWith(`${env.OLLAMA_EMBED_MODEL}:`),
    )
  ) {
    console.warn(
      `  [warn] modello embed ${env.OLLAMA_EMBED_MODEL} non installato. \`ollama pull ${env.OLLAMA_EMBED_MODEL}\``,
    );
  } else {
    try {
      const vec = await provider.embed("Sherdan: campagna D&D in italiano.");
      const dim = vec.length;
      if (dim !== 1024) {
        console.error(
          `  [FAIL] embed dim=${dim}, schema DB e' vector(1024).`,
        );
      } else {
        console.log(`  [OK]   embed  (dim=${dim})`);
        embedOk = true;
      }
    } catch (err) {
      reportLlmError("  ", "embed", err);
    }
  }

  console.log();
  return { chat: chatOk, embed: embedOk };
}

function reportLlmError(prefix: string, op: string, err: unknown) {
  if (err instanceof LLMError) {
    console.error(`${prefix}[FAIL] ${op}: ${err.message}`);
    if (err.cause) console.error(`${prefix}       cause:`, err.cause);
  } else {
    console.error(`${prefix}[FAIL] ${op}:`, err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
