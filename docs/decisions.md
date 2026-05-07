# Decisions log

Append-only. Una decisione = una sezione datata. Includi contesto, opzioni considerate, scelta e motivazione.

---

## 2026-05-06 — Stack di scaffolding (Fase 0)

**Contesto.** Avvio della Fase 0 ("Setup & infrastruttura"). Lo scaffold Next.js è il primo step.

**Scelte.**

- **Package manager: pnpm** (installato globalmente via `npm i -g pnpm`). Coerente con tutti gli script citati in CLAUDE.md (`pnpm test`, `pnpm db:migrate`, ecc.).
- **Next.js 16.2.4** (non 15 come scritto in ROADMAP.md). `create-next-app@latest` ha installato la 16. Nessun cambio breaking che impatti lo scope del progetto: App Router stabile in entrambe, Turbopack maturato. Si mantiene 16; ROADMAP.md non viene aggiornato perché il numero di versione lì era indicativo, non vincolante.
- **Flag `create-next-app`**: `--ts --tailwind --eslint --app --src-dir --import-alias '@/*' --use-pnpm --turbopack --yes`.
- **Tailwind v4** (default dello scaffold). PostCSS plugin `@tailwindcss/postcss`.
- **ESLint v9 flat config** (`eslint.config.mjs`).
- **TypeScript strict + `noUncheckedIndexedAccess: true`** in `tsconfig.json`, come da CLAUDE.md §7.
- **Script aggiunto**: `typecheck` = `tsc --noEmit`. Mancava nel template di `create-next-app`, è obbligatorio per il quality gate (CLAUDE.md §11).

**Procedura di scaffold.** `create-next-app` rifiuta nomi con maiuscole (npm naming) e collide su `public/` e `README.md` esistenti. Workaround: scaffold in subdir `sherdan-dm-tools/` con flag `--use-pnpm`, poi spostamento dei file in root, scarto di `CLAUDE.md`/`AGENTS.md`/`README.md` generati dal template, ripristino di `public/` (sorgenti Sherdan) e `README.md` originali. Reinstallazione `pnpm install` necessaria dopo il move per ricostruire i symlink di `node_modules/.bin`.

**Note implementative.**
- Il template Next.js 16 aggiunge `pnpm-workspace.yaml` per dichiarare `ignoredBuiltDependencies` (sharp, unrs-resolver). Mantenuto.
- Generato `next-env.d.ts` (in `.gitignore` per default).

---

## 2026-05-06 — Cartella `public/`: opzione A (sorgenti Sherdan dentro `public/`)

**Contesto.** Next.js usa convenzionalmente `public/` come root degli asset statici serviti a `/`. CLAUDE.md (§6) prescrive invece che `public/` ospiti i sorgenti markdown della campagna Sherdan, read-only dal codice. Conflitto di convenzione.

**Opzioni considerate.**

- **A.** Tenere i `.md` di Sherdan in `public/`. Conseguenza: Next.js li servirà come asset statici (es. `GET /Campagna.md` ritorna il file). Il parser di Fase 1.5 li legge via `fs` come previsto.
- **B.** Spostarli in `data/sherdan/` o `content/sherdan/` e aggiornare CLAUDE.md.
- **C.** Sotto-cartella `public/sherdan/` per evitare collisioni future con asset Next.js.

**Scelta.** **Opzione A**. Il deploy è single-user dietro Tailscale (CLAUDE.md §3, ROADMAP Fase 10), quindi l'esposizione statica dei `.md` è innocua. Si rispetta CLAUDE.md alla lettera senza rinunciare alla flessibilità futura: se in seguito serviranno asset Next.js (immagini, font, ecc.) verranno messi in sotto-cartelle dedicate sotto `public/`, mentre i `.md` Sherdan restano in root come "dato utente".

**Conseguenze operative.**
- Il codice applicativo legge i `.md` con `fs.readFile(path.join(process.cwd(), 'public', '<file>.md'))`.
- I `.md` non vanno mai modificati a runtime (CLAUDE.md §12.2).
- Se in futuro l'esposizione statica diventasse un problema (ad es. condivisione del Player Dashboard pubblicamente), si rivaluta lo spostamento.

---

## 2026-05-06 — Postgres locale via docker-compose

**Contesto.** Secondo task della Fase 0: serve un Postgres 16 locale con `pgvector` (per gli embedding 1536-dim) e `pg_trgm` (per FTS fuzzy).

**Scelte.**

- **Image**: `pgvector/pgvector:pg16`. Image ufficiale del progetto pgvector basata su Postgres 16, evita di dover compilare l'estensione manualmente. Versione installata: `vector 0.8.2`, `pg_trgm 1.6`.
- **Init**: file `docker/postgres/init/01-extensions.sql` montato in `/docker-entrypoint-initdb.d/`. Postgres lo esegue una sola volta al primo avvio del volume, quindi `CREATE EXTENSION IF NOT EXISTS` per essere idempotenti se in futuro si aggiungono altri script.
- **Persistenza**: volume Docker named `sherdan_pg_data` su `/var/lib/postgresql/data`. `PGDATA=/var/lib/postgresql/data/pgdata` (sotto-cartella) come da raccomandazione dell'image — evita problemi quando il volume root contiene file di sistema (lost+found ecc.).
- **Networking**: porta host `5432` (sovrascrivibile con `POSTGRES_PORT`). Single-user su localhost, niente esposizione esterna.
- **Credenziali**: defaults in `docker-compose.yml` via `${VAR:-default}` (`sherdan` / `sherdan_dev` / `sherdan_dm`). `.env.example` come riferimento per il dev. La config tipizzata applicativa arriva in un task successivo (`Config management`).
- **Healthcheck**: `pg_isready` ogni 5s, 10 retries. Permette a chi lancera' migrations o test di aspettare che il DB sia pronto invece di sleep arbitrari.

**Decisione contestuale**: `.gitignore` esteso con `!.env.example` per consentire il commit del template senza esporre `.env` reale (CLAUDE.md §12.8).

---

## 2026-05-06 — ORM: Drizzle + postgres.js

**Contesto.** CLAUDE.md §3 indica Drizzle come scelta preferita ("preferito per i tipi nativi e le migrations leggibili"). Va concretizzato con un driver e un set di convenzioni.

**Scelte.**

- **Driver**: `postgres` (postgres.js) invece di `pg` (node-postgres). Drizzle lo raccomanda come default — performance migliore, API moderna basata su tagged templates, supporto nativo a `BigInt`/`Date`/`JSON`. L'unica feature di `pg` che ci mancherebbe è il connection pool con eventi LISTEN/NOTIFY: postgres.js li supporta entrambi.
- **Schema layout**: una directory `src/db/schema/` con `index.ts` che ri-esporta tutto (CLAUDE.md §6). Drizzle accetta sia un singolo file sia una directory; il barrel `index.ts` consente sia ai file di dominio (`entities.ts`, `sessions.ts`, ...) sia alla `drizzle.config.ts` di puntare a un solo path.
- **Migrazioni**: cartella `src/db/migrations/` (sotto `src/` per coerenza con il resto del codice DB). Generate da `drizzle-kit generate`, applicate da `tsx src/db/migrate.ts` che usa `drizzle-orm/postgres-js/migrator`.
- **`drizzle.config.ts` a root**: convenzione Drizzle, fuori da `src/`. Usa import relativo (`./src/lib/env`) invece dell'alias `@/*` perché il loader di drizzle-kit non risolve sempre i path TS.
- **Env tipizzato**: `src/lib/env.ts` con Zod, single-read di `process.env`, throw con messaggio descrittivo se invalid. Pattern di CLAUDE.md §7 ("Config tipizzata letta una sola volta"). Il task "Config management" successivo estendera' questo modulo con dotenv-safe e altri campi (chiavi LLM, log level, ecc.) — qui il minimo necessario per il bootstrap del DB.
- **Caricamento `.env` nelle CLI**: `import "dotenv/config"` in cima a `drizzle.config.ts`, `src/db/migrate.ts`, `scripts/db-ping.ts`. Next.js carica `.env` da solo a runtime, ma le CLI Node no. `tsx` come runner per gli script TS (Node 24 + tsx, nessun build step).
- **Connessione client**: istanziata a top-level in `src/db/client.ts`. Tecnicamente e' una "side effect" rispetto a CLAUDE.md §7, ma postgres.js e' lazy (non apre socket finche' non c'e' una query) e questo e' il pattern canonico di Drizzle. Eccezione consapevole.
- **Scripts**: `db:generate`, `db:migrate`, `db:push` (solo dev/prototipazione), `db:studio`, `db:ping`. Coerenti con quelli citati nel quality gate (CLAUDE.md §11).

**Versioni installate al momento della decisione.**
- drizzle-orm 0.45.2, drizzle-kit 0.31.10, postgres 3.4.9, zod 4.4.3, dotenv 17.4.2, tsx 4.21.0.

---

## 2026-05-06 — Prima migration: scelte di modellazione

**Contesto.** Schema completo v2 (17 tabelle), prima migration. Decisioni non ovvie che vale la pena fissare.

**Decisioni.**

- **Split per dominio.** Un file per dominio in `src/db/schema/` (enums, campaigns, entities, sessions, plot, encounters, loot, tables, rules) + barrel `index.ts`. Drizzle-kit accetta sia un singolo file sia un barrel — il barrel mantiene CLAUDE.md §6 e permette di evolvere ogni dominio indipendentemente. Imports circolari tra `entities.ts` e `sessions.ts`/`plot.ts` sono gestiti dalla forma `() => table.column` di Drizzle (lazy ref), funzionano in ESM.
- **Enum stabili come `pgEnum`, vocabolari aperti come `text`.** Enum: `visibility`, `entity_type`, `secret_layer`, `clue_status`, `plot_thread_status`, `plot_role`, `encounter_difficulty`. Aperti (TEXT): `entity_links.relation_type`, `session_entities.role`, `plot_thread_events.event_type`, `pc_hooks.status`, `encounter_participants.role`, `rule_documents.source`. Validazione lato app via Zod, in linea con CLAUDE.md §8.6.
- **Visibilita' separata dai segreti.** Le entita' hanno `visibility` (dm_only/discovered/public, scelta DM su cosa esporre), e _separatamente_ possono avere `entity_secrets` con `layer` (surface/intermediate/deep) il cui ciclo di "discoperta" e' tracciato da `discovered_at_session`. I due assi non si collassano: un'entita' `discovered` puo' avere segreti deep ancora segreti, e viceversa — pattern Sherdan #2.
- **`entity_secrets` con check constraint XOR-or.** `CHECK (entity_id IS NOT NULL OR plot_thread_id IS NOT NULL)`: un segreto deve appartenere a una entity, a un plot thread, o a entrambi (es. il segreto della Scissione e' sia di una deita' sia di una macro-trama). Verificato che il vincolo fa fallire insert vuoti.
- **Self-reference `entities.parent_id`** per gerarchie (location -> sub-location, faction -> luogotenente). `ON DELETE SET NULL` per non perdere figli orfani senza preavviso.
- **`truth_clues.related_entities` come `uuid[]` + GIN.** Volutamente non normalizzato in join table: la briciola e' una unita' atomica e tipicamente coinvolge 2-3 entita'. GIN per `... && ARRAY[id]::uuid[]` query (entity X appare in quante briciole).
- **`embedding vector(1536)`** su `entities` e `rule_documents`. Dimensione default per modelli Anthropic-class. La colonna e' nullable (popolata async). Indici ivfflat/hnsw rinviati: ivfflat richiede dati per il training, hnsw e' costoso da costruire — entrambi vanno aggiunti in Fase 1.5 dopo il bootstrap quando ci saranno ~50 righe di Sherdan.
- **`updated_at` via `$onUpdate(() => new Date())`.** Implementato lato Drizzle invece che con trigger Postgres. Funziona perche' tutti gli writer passano dall'app; se in futuro arrivano writer SQL diretti, si aggiunge un trigger BEFORE UPDATE in migration successiva.
- **`CREATE EXTENSION IF NOT EXISTS vector|pg_trgm`** prepended manualmente alla migration generata. Drizzle-kit non li auto-genera, ma il container Docker li installa via init script. Il prepend rende la migration auto-sufficiente per chiunque cloni il repo e usi un Postgres diverso.
- **`encounters.location_id`** referenzia `entities.id` con `onDelete: 'set null'` — non vincoliamo `type='location'` a livello DB (richiederebbe trigger). Validazione lato API.
- **`random_tables.campaign_id` nullable.** Tabelle SRD/public-domain non sono legate a una campagna specifica.
- **Check costanti.** Migration applicata: 17 tabelle, 7 enum custom, 39 indici `idx_*`, 6 constraint su `entity_secrets`. Smoke test su entity con embedding 1536-dim + properties JSONB + tags TEXT[] + cascade delete OK.

---

## 2026-05-06 — Zod schemas per `properties` JSONB

**Contesto.** Ogni entity ha una colonna `properties JSONB` la cui forma dipende dal `type`. Postgres non puo' validarla; lo facciamo lato app via Zod prima di insert/update.

**Decisioni di forma.**

- **Un file per `entity_type`** in `src/lib/validation/` (8 file) + `_shared.ts` per primitivi riusati (`sensoryDetailsSchema`, `voiceSchema`, `goalsSchema`, `weaknessSchema`, `extraField`, `stringArray`). Coerente con CLAUDE.md §6.
- **`.strict()` ovunque, `extra: z.record(...).optional()` come escape hatch.** Strict rifiuta chiavi sconosciute al top level, evitando data loss silenzioso quando il chiamante invia campi non previsti. Per estensioni legittime c'e' `extra`. La regola "JSONB per i campi instabili" (CLAUDE.md §4.4) si applica al livello dell'organizzazione del DB, non a quello della forma di un singolo record: nel record vogliamo struttura riconoscibile.
- **Discriminator type-safe.** `propertiesSchemaByType` usa `satisfies Record<EntityTypeName, z.ZodTypeAny>` dove `EntityTypeName = (typeof entityType.enumValues)[number]`. Aggiungere un valore all'enum Drizzle e dimenticare lo schema corrispondente diventa un errore di typecheck. Single source of truth e' la pgEnum di Drizzle.
- **NPC schema fedele alla specifica ROADMAP.** Modificarlo significa modificare ROADMAP §0 prima — quel template e' calibrato sul materiale Sherdan e ha valore di contratto col Wiki UI / NPC generator.
- **Campi narrativamente carichi sono `string` (markdown)**. Niente vincoli di lunghezza minima oltre `min(1)` dove necessario (es. `weakness.description`, `feature.name`). Lasciamo respiro al testo.
- **CR come stringa regex `^(0|1\/8|1\/4|1\/2|[1-9][0-9]?|3[0-3])$`.** Permette "1/4" e "0" senza forzare un numero decimale. 33 e' il CR massimo nel D&D 5e.
- **`location.map_data` e `item.mechanics` come `z.unknown()`.** Forme che si stabilizzeranno nelle Fasi 5/8; oggi vincolarle sarebbe debito tecnico. CLAUDE.md §4.4: "Promuovi a colonne (qui, a sotto-schema) quando i campi si stabilizzano".
- **Goals "segreti" non vivono in `properties`.** `factionPropertiesSchema.goals` contiene gli obiettivi dichiarati. Quelli reali ma nascosti vanno in `entity_secrets` (pattern Sherdan #2 + #3).
- **Identita' multiple non vivono in `properties`.** Sono modellate via `entity_identities` (DDL dedicato). Non duplichiamo qui.

**Test.** Smoke script `scripts/validation-smoke.ts` con un payload "ok" e uno "broken" per ognuno degli 8 tipi. Diagnosticita' dei messaggi verificata (es. "abilities.cha: Invalid input: expected number, received undefined"). Sara' migrato a vitest quando arriva il test setup nella stessa Fase 0.

---

## 2026-05-06 — LLM stack: OSS-only via Ollama

**Contesto.** Decisione utente: solo strumenti FOSS, niente API a pagamento. Cambia il provider previsto in CLAUDE.md/ROADMAP (Anthropic) ma non l'astrazione (provider-agnostic).

**Scelte.**

- **Runtime: Ollama.** Standard de-facto per LLM locali, HTTP API stabile su `:11434`, supporta structured output (`format: <jsonschema>` da v0.5+), tool calling, embeddings, streaming. Servizio gestito; niente SDK Node esterno (fetch built-in).
- **Modello chat: `qwen2.5:7b-instruct-q4_K_M`** (~4.7 GB). Hardware utente: i7-12700H, 16 GB RAM, RTX 3050 (4 GB VRAM), ~34 GB disco liberi. Qwen 2.5 7B Q4 e' il sweet spot: gira CPU + offload parziale GPU, italiano decente, latenza accettabile (5-30s/risposta). Alternative configurabili via `OLLAMA_MODEL`.
- **Modello embedding: `mxbai-embed-large`** (~670 MB, 1024-dim). Multilingue forte, italiano molto buono. Alternative: `nomic-embed-text` (768-dim, piu' leggero), `bge-m3` (1024-dim).
- **Dimensione embedding: 1024** invece di 1536 (CLAUDE.md §8.4 ammette divergenze documentate). I modelli OSS 1024-dim sono i piu' competitivi disponibili. Schema modificato: `entities.embedding` e `rule_documents.embedding` ridotti a `vector(1024)`.
- **Migration: opzione α (amend del 0000).** Migration 0000 ri-generata, file rinominato `0000_next_robbie_robertson.sql`. Volume Docker droppato (`docker compose down -v`) e ri-applicato da zero. CLAUDE.md §4.5 chiede migrations additive ma siamo pre-data e l'utente ha autorizzato esplicitamente. CLAUDE.md §12.7 (no migration distruttive senza autorizzazione) rispettato: la scelta α e' stata proposta e accettata. La regola additiva torna in vigore dalla 0001 in poi.
- **Astrazione provider-agnostic.** `LLMProvider` interface in `src/lib/llm/types.ts`: `complete`, `completeStructured`, `stream`, `embed`, `embedBatch`. Implementazione `OllamaProvider` in `ollama.ts`. Singleton via `getLLMProvider()`. Aggiungere un secondo provider domani (cloud o altro locale) significa solo implementare l'interfaccia e cambiare la factory.
- **Structured output.** Ollama accetta JSON Schema in `format`. Convertiamo Zod schema con `z.toJSONSchema()` (Zod 4 nativo, no extra dep). La response viene parsata e ri-validata col Zod schema originale: due reti di sicurezza (vincolo lato modello + parse lato client). Default `temperature: 0` per structured (creativita' va contro aderenza).
- **Streaming.** Async iterable di stringhe (token chunks). NDJSON parser line-by-line.
- **Errori tipizzati.** `LLMError` (con `cause` e `status`) per tutto. `LLMStructuredOutputError` (con `rawOutput`) quando la risposta non parsa o non aderisce allo schema — il raw output e' utile per debug.

**Tradeoff esplicito.** I generators (Fase 3+) avranno qualita' sensibilmente inferiore a un modello cloud frontier su task complessi (NPC con 3 segreti stratificati coerenti, prep assistant agentic). Il framework non si rompe, ma la prosa sara' piu' grezza. Mitigazione: `StyleCalibrator` (Fase 3) puo' iniettare few-shot examples dal materiale Sherdan per migliorare l'aderenza stilistica anche con modelli piccoli.

**Setup richiesto all'utente** (una volta, non in scope di questo task):
1. Scaricare Ollama da ollama.com (installer Windows).
2. `ollama pull qwen2.5:7b-instruct-q4_K_M` (~4.7 GB).
3. `ollama pull mxbai-embed-large` (~670 MB).
4. `pnpm llm:ping` per verificare end-to-end.

**Versioni al momento della decisione.** Ollama: non ancora installato sulla macchina (verifica live posticipata). Zod: 4.4.3 (toJSONSchema nativo).

---

## 2026-05-06 — Gemini come chat primario, Ollama come fallback + embed unico

**Contesto.** Stessa giornata, decisione successiva: l'utente vuole sfruttare la qualita' di Gemini (free tier, AI Studio) mantenendo Ollama come fallback offline. Aggiornamento dell'architettura LLM senza buttare via il provider Ollama.

**Decisioni.**

- **Architettura "split per metodo":**
  - **Chat** (`complete`, `completeStructured`, `stream`): Gemini primario, Ollama fallback automatico su errori transient (network, 5xx, 429). Errori 4xx (input invalido, content blocked) propagano senza fallback — un fallback su input rotti maschera bug.
  - **Embed** (`embed`, `embedBatch`): **sempre Ollama** (mxbai-embed-large, 1024-dim). Mai switchato. Switchare embed provider cambia il vector space e invalida ogni similarity search sui dati gia' embeddati. La stabilita' qui ha valore di invariante.
- **`RoutedProvider` (src/lib/llm/router.ts).** Wrapper che compone i due provider. Per gli stream, fallback solo se non e' stato emesso alcun chunk (best-effort: a meta' stream lasciare propagare l'errore evita output duplicati/corrotti).
- **`GeminiProvider` via REST** (no `@google/genai` SDK). Coerente con `OllamaProvider`. Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` per chat, `:streamGenerateContent?alt=sse` per stream. `embed`/`embedBatch` rejecting con `LLMError` esplicito perche' devono passare dal router.
- **JSON Schema sanitization.** Gemini accetta un subset OpenAPI 3.0, rigetta `$schema`/`$id`/`$ref`/`$defs`/`additionalProperties`/`patternProperties`/`not` che Zod 4 inietta. Il sanitizer in `gemini.ts` li strippa ricorsivamente prima di inviare. Anche `format` accetta solo i valori standard OpenAPI.
- **`thinkingBudget: 0` di default.** Gemini 2.5 ha "thinking" abilitato di default che consuma `maxOutputTokens` prima dell'output (una `complete` con `maxTokens=10` finiva a 0 token di output). Disabilitato per default: output predicibile + quota efficiente. Modelli che non supportano `thinkingBudget` ignorano il campo (nessun rischio di compatibilita').
- **Modello scelto: `gemini-2.5-flash`.** Tier free, ottima qualita' in italiano, latenza ~1-3s. Configurabile via `GEMINI_MODEL`.
- **Validation env via `superRefine`.** Se `LLM_PROVIDER=gemini` ma `GOOGLE_AI_API_KEY` manca, il bootstrap fallisce con messaggio diagnostico. Niente errori silenziosi.
- **API key in `.env` (gitignored), `.env.example` con placeholder vuoto.** L'utente ha condiviso la key in chat: la conversazione e' un canale di transito, la key va rigenerata se il transcript persiste. Documentato nelle note di handover ma non in `decisions.md` (la key concreta non sta nel repo).
- **Privacy:** sul free tier Gemini, gli input/output possono essere usati da Google per training. Tradeoff esplicito accettato dall'utente. Mitigazione futura: tier paid Gemini (no training) o ritorno a Ollama-only via `LLM_PROVIDER=ollama`.

**Verifica live (questa sessione).** Gemini `complete` + `completeStructured` + `RoutedProvider.complete` tutti OK. Ollama daemon raggiungibile ma modelli non ancora scaricati: pull di `qwen2.5:7b-instruct-q4_K_M` (4.7 GB, fallback chat) e `mxbai-embed-large` (670 MB, embed) restano azione di setup utente.

**Versioni al momento della decisione.** Gemini API v1beta. Modello `gemini-2.5-flash`. Zod 4.4.3 (`z.toJSONSchema`).

---

## 2026-05-07 — Modello Gemini definitivo: `gemini-3-flash-preview`

**Contesto.** Decisione di ottimizzare la qualita' del modello chat. L'utente ha richiesto `gemini-3.1-pro-preview`, poi `gemini-3.1-flash-preview`. Verifica live ha rivelato due constraint:

1. **Tutti i Pro Gemini (2.5-pro, 3-pro-preview, 3.1-pro-preview, alias `gemini-pro-latest`) hanno quota free tier = 0.** L'API ritorna 429 con `"limit: 0"` esplicito su `generate_content_free_tier_input_token_count` e `_requests`. Pro = solo con billing abilitato. Coerente con la scelta utente "no paid".
2. **`gemini-3.1-flash-preview` non esiste** come endpoint chat. La famiglia 3.1 Flash espone solo varianti specializzate: `lite-preview`, `image-preview`, `tts-preview`, `live-preview`. Niente "Flash piena" 3.1 sull'API pubblica oggi.

**Modelli FREE TIER usabili oggi per chat (verificati live):**
- `gemini-3-flash-preview` ✅ — Flash piu' recente disponibile su free tier, miglior qualita' tra i free
- `gemini-3.1-flash-lite-preview` ✅ — versione lite, piu' veloce ma qualita' inferiore al 3-flash
- `gemini-2.5-flash` ✅ — stable, ben testato
- `gemini-2.0-flash`, `gemini-2.0-flash-lite` ✅ — vecchi, evitati

**Scelta finale: `gemini-3-flash-preview`.** Aggiornato sia in `.env` (locale) sia come default in `src/lib/env.ts` e `.env.example`.

**Caveat preview.** Il modello e' "preview", potenzialmente cambia o viene ritirato senza preavviso. Per uso personale e' un rischio accettabile (basta cambiare `GEMINI_MODEL`); per un prodotto in produzione sarebbe meglio un modello stable. Quando `gemini-3-flash` (senza `-preview`) sara' GA, vale la pena swappare.

**Verifica live (questa sessione).** `complete` ("pong") + `completeStructured` (JSON `{pong:true, lang:"it"}` validato Zod) + `RoutedProvider.complete` tutti OK. Tempi di risposta nell'ordine di 1-3s.

**Update 2026-05-07 — thinking riabilitato.** Inizialmente `thinkingBudget: 0` era hardcoded perche' su Gemini 2.5 i token di thinking consumavano `maxOutputTokens` causando output vuoti con maxTokens piccoli. Decisione rivista: il thinking migliora la qualita' su task complessi (NPC stratificati, plot thread coerenti), e per la campagna Sherdan la qualita' della prosa conta piu' della velocita'. Ora `thinking` e' una opzione di `CompleteOptions` (`undefined` = default modello, ON per Gemini 3+; `false` = disabilita; `true` = budget dinamico; `number` = budget esatto). Default ON. Nei chiamanti che vogliono path veloce/predicibile (sanity check, db ping-like) si passa `thinking: false`. Nota operativa: con thinking ON serve `maxTokens` generoso (1024+) perche' i thinking tokens sono inclusi in `maxOutputTokens`.

---

## 2026-05-07 — Config management e dotenv-safe equivalente

**Contesto.** Il task ROADMAP "Config management" richiede `.env`, `dotenv-safe` e config object tipizzato. I primi due erano gia' a posto (`env.ts` Zod-based, `.env`/`.env.example` separati). Mancava la parte "dotenv-safe": una rete di sicurezza contro la drift tra documentazione (`.env.example`), validazione (Zod schema) e ambiente locale (`.env`).

**Decisioni.**

- **No dipendenza esterna** (`dotenv-safe`): scriviamo l'equivalente in `scripts/env-check.ts` (~100 righe). Riduce superficie di dipendenze, aderisce al filtro CLAUDE.md §3 ("se serve una libreria fuori stack, chiedi prima"). La versione hand-rolled fa tutto cio' che serve a noi: parse di `.env` files (con strip dei commenti e delle quote), confronto con un set di chiavi noto, output diagnostico.
- **Tre invarianti verificati** dal sync-check:
  1. Ogni chiave in `.env.example` e' presente nello schema Zod (`envSchemaKeys`). Catch per "ho documentato una var ma non la valido".
  2. Ogni chiave nello schema Zod e' presente in `.env.example`. Catch per "ho aggiunto una var allo schema ma non l'ho documentata".
  3. Ogni chiave nel `.env` locale e' o nello schema o documentata. Warning, non errore: chiavi sperimentali sono ok ma vanno notate.
- **Errori vs warnings.** Drift schema/example = errore (exit 1, blocca CI). `.env` locale fuori sync = warning. Razionale: in CI non c'e' `.env`, e drift vs example sono problemi di documentazione che vanno fixati ASAP; warning su `.env` locale e' info utile per il dev senza bloccare.
- **POSTGRES_\* nello schema come `optional`.** Sono consumate da `docker-compose.yml` (template `${POSTGRES_DB:-default}`), non dall'app. L'app legge `DATABASE_URL` composta. Includerle nello schema le rende "conosciute" ed evita falsi positivi nel sync-check; il commento esplicativo nello schema previene che qualcuno le usi nell'app code.
- **NODE_ENV documentato in `.env.example` ma vuoto.** Next.js / Node lo impostano automaticamente, non lo scriviamo nel `.env`. Il commento spiega perche' c'e' la riga.
- **Server-only convention.** `src/lib/env.ts` non ha `import "server-only"` perche' viene usato anche dagli script CLI (Node, fuori da Next.js). Convenzione documentata in cima al file: non importarlo da React client. Quando aggiungeremo componenti client e API routes, valuteremo se splittare in `env.ts` (universale) e `env.server.ts` (server-only re-export).
- **Single-read mantenuto.** `parsed = schema.safeParse(process.env)` a livello di modulo. Throw immediato su invalid. Pattern fail-fast: meglio crash al boot che bug subdoli a runtime.

**Risultati.** 12 chiavi documentate, 12 validate, in sync. `pnpm env:check` aggiunto come gate riusabile (CI / pre-commit futuri).

---

## 2026-05-07 — Logging strutturato con pino

**Contesto.** Task ROADMAP "Logging strutturato: pino (TS)". Cross-cutting concern (CLAUDE.md): log strutturati con request_id, metriche LLM, fail-fast su regressioni.

**Decisioni.**

- **pino 10 + pino-pretty 13.** Standard de-facto in TS, asincrono, performante. Nessun runtime Edge in scope: usiamo Node ovunque, no compromessi.
- **Pretty in dev/test, JSON in production.** Lettura umana mentre lavoro al tavolo, ingestione automatica quando il Player Dashboard sara' deployato. Ramificazione via `transport: { target: "pino-pretty" }` solo se `NODE_ENV !== "production"`.
- **Default level per ambiente.**
  - `development`: `debug` — molto verboso, voglio vedere tutto durante lo sviluppo
  - `production`: `info`
  - `test`: `warn` — silenzioso ma non muto, cosi' vedo regressioni sui test
  - Override via `LOG_LEVEL` env (es. `LOG_LEVEL=trace pnpm dev` per debug profondo)
- **Scope come metadata.** `getLogger("llm.router")` produce un child logger con `scope: "llm.router"` nel JSON (e prefisso visibile in pino-pretty). Pattern dotted (`llm.router`, `db.client`, `parsers.npc`) per gerarchia leggibile.
- **Redaction always-on.** Lista esplicita di path sensibili in `redact.paths`: `apiKey`, `password`, `GOOGLE_AI_API_KEY`, `DATABASE_URL`, `headers.authorization`. `[Redacted]` come placeholder. Sia top-level (`apiKey`) sia nested (`*.apiKey`) per sicurezza. In produzione log finiscono in file/stdout, una API key per errore puo' diventare un incidente — ridondanza accettata.
- **Niente pid/hostname per default.** Single-user su localhost, sono rumore. `base: {}` li elimina; `ignore: "pid,hostname"` in pino-pretty per coerenza.
- **Fields riservati di pino.** `level`, `time`, `msg` sono nomi che pino usa internamente. Documentato nello smoke script: usare `npcLevel`/`occurredAt`/`message` se serve un field con quel concetto.
- **Wiring iniziale: solo `RoutedProvider`.** Il `console.warn` di default per il fallback chat e' diventato `log.warn({ op, err, status }, "primary failed, using fallback")`. Gli altri moduli (db client, providers LLM concreti) NON sono wirati ora — gli aggiungeremo logging mirato quando arrivano feature osservabili (e.g., logging di tokens/latency in Fase 3 con `generation_log`). CLAUDE.md §"Don't add features beyond task scope".
- **Console.* negli script CLI.** `db-ping`, `llm-ping`, `env-check`, `logger-smoke` continuano a usare `console.log`/`error`. Sono CLI tools, l'output testuale e' il canale giusto. Pino e' per il codice applicativo.

---

## 2026-05-07 — Test setup con Vitest

**Contesto.** CLAUDE.md §9 elenca cosa testare (roller, CR calc, validation Zod, parser Sherdan, migrations) e cosa no (UI puri, codice generato, wrapper triviali). Servono tooling e convenzioni.

**Decisioni.**

- **Vitest 4.** API jest-compatibile, ESM-native, transformer veloce (Vite). Niente Jest: vitest e' lo standard nei nuovi progetti TS/Vite-based, e Next.js 16 funziona bene con vitest senza setup speciale. `@vitest/ui` opzionale per esplorazione visuale (`pnpm test:ui`).
- **Path alias allineato al tsconfig.** `vitest.config.ts` mappa `@` a `src/` con `resolve.alias`. Niente `vite-tsconfig-paths` plugin: una alias e' sufficiente, evitiamo dep extra.
- **Layout `tests/` separato da `src/`.** CLAUDE.md §6: "stesso albero di `src/`, ma sotto `tests/unit/` o `tests/integration/`". Test co-located con codice (es. `src/foo.ts` + `src/foo.test.ts`) sarebbe piu' veloce per refactor, ma il layout separato matcha CLAUDE.md e tiene i `src/` puliti per quando arriveranno bundler / IDE che non escludono `*.test.ts`.
- **`tests/setup.ts` con `import "dotenv/config"`.** Necessario perche' `src/lib/env.ts` parsa `process.env` al load e fallisce se mancano var. Vitest imposta `NODE_ENV=test` automaticamente (no override manuale).
- **`process.env` esposto a vitest** via `env: process.env` in config. Senza questo, alcuni runtime test non vedono var caricate da dotenv.
- **Generic narrowing su `validateEntityProperties` / `safeValidateEntityProperties`.** Originariamente non-generic: `validateEntityProperties("npc", x).race` falliva al typecheck. Refactored a `<T extends EntityTypeName>` con tipi `PropertiesFor<T>` e `SafeValidateResult<T>`. Zod 4 non espone `SafeParseReturnType`: definito locale come union `{success:true,data} | {success:false,error:z.ZodError}`. Test ora possono accedere `result.data.race` con type safety.
- **22 test iniziali su `properties` JSONB.** Coverage: happy/bad path per ognuno degli 8 `entity_type`, edge cases NPC pattern Sherdan (multi-sensorialita', voice, weaknesses with who_could_exploit), verifica `.strict()` (chiavi non documentate rifiutate), verifica che `secrets` non vadano in properties (devono usare la tabella `entity_secrets`). Migrato da `scripts/validation-smoke.ts` (eliminato dopo migrazione).
- **Test rimandati.**
  - Roller library (Fase 2): non scritta ancora.
  - CR calculator (Fase 5): non scritta ancora.
  - Parser Sherdan (Fase 1.5): non scritta ancora.
  - Migrations: aggiungeremo un test della forma post-migration (lista tabelle, indici, vincoli) quando arrivera' la prima ALTER non triviale.
  - LLM provider: difficile testare senza mock dei modelli; i sanity script (`db-ping`, `llm-ping`) coprono il lato infrastrutturale.

---

## 2026-05-07 — Markdown editor wiki: Lexical

**Contesto.** Task Fase 1 "Markdown editor (TipTap o Lexical) con custom node `[[wikilink]]`". Entrambe le opzioni richiedono nuove dipendenze non presenti nello stack iniziale; l'utente ha autorizzato esplicitamente l'installazione.

**Scelta.** **Lexical 0.44** (`lexical`, `@lexical/react`, `@lexical/rich-text`, `@lexical/history`, `@lexical/utils`).

**Motivazione.**
- API modulare e adatta a un editor wiki embedded nella detail view, senza introdurre un framework editor troppo opinato.
- Custom node leggero: `WikiLinkNode` estende `TextNode`, mantiene il markdown salvato come testo `[[Nome Entita']]`, ma lo visualizza come token nell'editor.
- Salvataggio conservativo: i campi `entities.description` e `entities.public_description` restano markdown puro nel DB. Nessuna migrazione e nessun formato serializzato editor-specifico.

**Scope intenzionale.** Questo task introduce editing e tokenizzazione dei wikilink. Autocomplete su `[[`, render markdown navigabile e hover preview restano task separati in ROADMAP.md.
