import "dotenv/config";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import { envSchemaKeys } from "@/lib/env";

// dotenv-safe equivalente, ~50 righe, no dependency.
//
// Verifica tre invarianti:
// 1. Ogni chiave in `.env.example` e' validata da `src/lib/env.ts` (e
//    viceversa). Catch-all per drift tra documentazione e codice.
// 2. Ogni chiave required (in `.env.example` con valore non vuoto, oppure
//    nello schema Zod senza default) e' presente in `process.env` dopo
//    `dotenv/config`. Catch per "ho clonato il repo e dimenticato `.env`".
// 3. `src/lib/env.ts` parsa senza errori — implicito: l'import su riga 6
//    fa partire la validazione Zod a livello di modulo. Se fallisce, il
//    processo crasha prima di arrivare qui.
//
// Esce con codice 1 se trova drift; 0 se tutto OK.

const PROJECT_ROOT = resolve(__dirname, "..");
const ENV_EXAMPLE = resolve(PROJECT_ROOT, ".env.example");
const ENV_FILE = resolve(PROJECT_ROOT, ".env");

interface ParsedEntry {
  key: string;
  value: string;
}

function parseDotenvFile(path: string): ParsedEntry[] {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, "utf8");
  const entries: ParsedEntry[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip surrounding single/double quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push({ key, value });
  }
  return entries;
}

function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  const exampleEntries = parseDotenvFile(ENV_EXAMPLE);
  if (exampleEntries.length === 0) {
    errors.push(`.env.example non trovato o vuoto a ${ENV_EXAMPLE}`);
  }
  const exampleKeys = new Set(exampleEntries.map((e) => e.key));
  const schemaKeys = new Set(envSchemaKeys);

  // 1. Drift schema vs .env.example
  const inExampleNotSchema = [...exampleKeys].filter(
    (k) => !schemaKeys.has(k),
  );
  const inSchemaNotExample = [...schemaKeys].filter(
    (k) => !exampleKeys.has(k),
  );

  for (const k of inExampleNotSchema) {
    errors.push(
      `[.env.example -> schema] ${k}: documentata ma non validata da src/lib/env.ts`,
    );
  }
  for (const k of inSchemaNotExample) {
    errors.push(
      `[schema -> .env.example] ${k}: validata ma non documentata in .env.example`,
    );
  }

  // 2. .env locale presente (warning, non fatale: in CI si usa env vars dirette)
  if (!existsSync(ENV_FILE)) {
    warnings.push(
      `.env non presente a ${ENV_FILE}. ` +
        `In dev: \`cp .env.example .env\` e riempi i valori richiesti.`,
    );
  } else {
    const envEntries = parseDotenvFile(ENV_FILE);
    const envKeys = new Set(envEntries.map((e) => e.key));
    // .env -> .env.example: chiavi locali non documentate (warn, magari sperimentazione)
    for (const k of envKeys) {
      if (!exampleKeys.has(k) && schemaKeys.has(k)) {
        warnings.push(
          `[.env -> .env.example] ${k}: presente in .env ma non in .env.example. ` +
            `Aggiungilo all'example per documentazione (placeholder vuoto va bene).`,
        );
      } else if (!exampleKeys.has(k) && !schemaKeys.has(k)) {
        warnings.push(
          `[.env senza schema] ${k}: in .env ma non riconosciuta dallo schema. ` +
            `Probabilmente residuo o da aggiungere a src/lib/env.ts.`,
        );
      }
    }
  }

  // Output
  if (warnings.length > 0) {
    console.warn("Warnings:");
    for (const w of warnings) console.warn(`  ${w}`);
    console.warn();
  }

  if (errors.length > 0) {
    console.error("Errors:");
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }

  console.log(
    `OK: ${exampleKeys.size} chiavi documentate, ${schemaKeys.size} validate, in sync.`,
  );
}

main();
