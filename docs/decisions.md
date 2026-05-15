# Decisions log

Append-only. Una decisione = una sezione datata. Includi contesto, opzioni considerate, scelta e motivazione.

---

## 2026-05-15 - Fase 12: ChatGPT Web Bridge come percorso primario con `LLM_PROVIDER=none`

**Contesto.** Dopo la chiusura delle feature principali, il progetto aveva due esigenze in tensione: mantenere i tool generativi gia' costruiti, ma usare ChatGPT Web come motore creativo principale senza introdurre API key OpenAI, costi automatici o una nuova dipendenza runtime. La Fase 12 formalizza il Bridge manuale come percorso primario.

**Decisioni.**

- **`LLM_PROVIDER=none` e' una modalita' supportata, non un errore di configurazione.** Il ping LLM esce con successo e le route generative storiche rispondono con una CTA verso `/chatgpt-bridge`. Questo evita stati mezzi-rotti: se il progetto e' in modalita' Bridge, nessun bottone prova a chiamare un provider disabilitato.
- **Export/import manuale invece di integrazione API OpenAI.** Il DM copia un pacchetto Markdown/JSON in ChatGPT Web e riporta l'output nell'app. Tradeoff: un passaggio manuale in piu'; vantaggio: niente API key nel repo, niente costi imprevisti, pieno controllo umano su cosa entra nel DB.
- **Prompt canonico da `content/sherdan/Agente AI Worldbuilding.md`.** Il Bridge usa il prompt reale della campagna come fonte primaria, con fallback sul nome typo storico e poi su un riassunto interno. Il prompt resta in `content/sherdan`, quindi segue le stesse regole di sicurezza dei sorgenti GM-only.
- **UPDATE PACK sempre review-first.** ChatGPT puo' proporre modifiche, ma l'app non applica nulla senza selezione esplicita. Il parser produce candidate changes, il fuzzy matcher risolve nomi/alias/sessioni con warning, e la UI mostra payload/diff prima dell'applicazione.
- **Review con segnali operativi espliciti.** La UI distingue match esatti, fuzzy, ambigui e non trovati con badge dedicati. Le modifiche ad alto rischio (update canonici, identita', segreti e link) richiedono una conferma extra prima dell'apply.
- **Relevance budget nel builder, non nelle query.** Le query restano semplici e conservative; il builder decide quanto includere in base a densita', focus, location, sessione, status e priority. Cosi' si puo' migliorare il ranking senza cambiare API o schema DB.
- **Storico Bridge server-side.** Export e import restano persistiti su DB; `/chatgpt-bridge/history` espone una timeline compatta con warning, Update Pack e modifiche applicate, senza caricare markdown enormi nella lista.
- **Preset come scorciatoie, non modalita' separate.** I preset Bridge precompilano task type, densita', audience, sezioni e vincoli per casi ricorrenti, preservando campagna/sessione/location selezionate.
- **Copy-for-ChatGPT locale sulle superfici canoniche.** Entity, sessioni, plot thread e truth clue possono copiare un blocco Markdown mirato senza passare dall'export completo. Questi snippet sono pensati per prompt brevi e interventi puntuali, mentre `/chatgpt-bridge` resta il percorso per pacchetti ampi con relevance budget e storico.
- **Database di test locale automatizzato.** `pnpm test:db:setup`, `pnpm test:integration:local` e `pnpm test:e2e:local` derivano `sherdan_dm_test` dal `DATABASE_URL`, applicano guardie sul nome e abilitano `vector`/`pg_trgm`. Playwright usa `.next-e2e` per convivere con il dev server principale.

**Conseguenza.** Per Sherdan, il flusso consigliato diventa: preparare il contesto in `/chatgpt-bridge`, lavorare in ChatGPT Web, importare output e UPDATE PACK, applicare solo cio' che il DM approva, poi controllare lo storico in `/chatgpt-bridge/history`. I generatori storici restano disponibili se in futuro si riattiva un provider LLM, ma non sono piu' un prerequisito operativo.

**Test.** Unit Bridge/export/import/update-pack, env `none`, setup DB locale, integrazione DB/API locale e smoke E2E browser locale passano. La sidebar, la status page e il README usano lo stesso stato feature.

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

**Scelta storica.** **Opzione A**. Il deploy era single-user dietro Tailscale (CLAUDE.md §3, ROADMAP Fase 10), quindi in quel momento l'esposizione statica dei `.md` era considerata accettabile.

**Superata dal 2026-05-15.** La decisione corrente e' l'opposto operativo: i sorgenti raw di Sherdan devono stare in `content/sherdan/` e non in `public/`. Il content safety gate (`pnpm content:check:safe`) blocca i markdown Sherdan raw esposti come asset statici, perche' il progetto ora include superfici player-facing e workflow Bridge con audience `player`.

**Conseguenze operative.**
- Il codice applicativo legge i sorgenti canonici da `content/sherdan/`.
- I `.md` non vanno mai modificati a runtime.
- `public/` non deve contenere sorgenti narrativi raw con segreti GM.

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

---

## 2026-05-08 — Vista grafo wiki: D3

**Contesto.** Task Fase 1 "Vista grafo: D3 force-directed o vis-network, nodi colorati per type, opzione mostra solo links pubblici". Entrambe le librerie richiedono una nuova dipendenza; l'utente ha autorizzato esplicitamente l'installazione.

**Scelta.** **D3 7.9** (`d3`, `@types/d3`).

**Motivazione.**
- Il grafo del wiki crescerà con filtri narrativi specifici di Sherdan (verità GM vs link pubblici, type, centralità di una entity selezionata), quindi è meglio avere controllo diretto sul layout e sul rendering.
- Usiamo D3 per la simulazione force-directed (`d3-force`) e lasciamo il rendering a React/SVG. Questo evita un componente esterno molto opinato e mantiene link interni, toggle e styling nel sistema UI esistente.
- `vis-network` sarebbe più rapido per una vista pronta, ma meno flessibile quando serviranno filtri e affordance specifiche della campagna.

**Scope intenzionale.** La prima versione mostra tutte le entity della campagna, link direzionali da `entity_links`, nodi colorati per `entity.type`, highlight dell'entity selezionata e toggle "solo links pubblici" basato su `entity_links.visibility = 'public'`. Zoom/pan, clustering e filtri avanzati restano futuri polish se serviranno.

---

## 2026-05-09 — Import SRD monsters da Open5e V2

**Contesto.** Primo task Fase 5: importare mostri SRD come `entities type='monster'` con statblock JSONB completo.

**Decisioni.**

- **Fonte dati: Open5e API V2.** La documentazione Open5e indica V2 come versione corrente e V1 come deprecata. L'importer usa `/v2/creatures/` e filtra la source con `document__key__in`.
- **Default document: `srd-2014`.** Il progetto usa math e tabelle DMG 2014 per i task encounter/loot già implementati; quindi la prima importazione resta coerente con il sistema 5e 2014. Lo script permette comunque `--document srd-2024` o altri documenti Open5e.
- **Import per campagna.** `entities.campaign_id` è obbligatorio, quindi i mostri SRD vengono importati nella campagna scelta con `--campaign-id`. In futuro, se serviranno compendi globali riusabili tra campagne, sarà una migration/schema decision separata.
- **Idempotenza via tag.** Non aggiungiamo una nuova colonna o unique constraint ora. Ogni mostro riceve tag `open5e:<key>` e lo script salta record già presenti nella stessa campagna.

---

## 2026-05-13 — Fase 8 Procedural Dungeon Generator: BSP + 3-slice + stabilizzazione `map_data`

**Contesto.** Apertura Fase 8. La ROADMAP elencava tre algoritmi candidati (graph-based, BSP, cellular automata) e lasciava aperta la forma di `entities.properties.map_data` (in `locationPropertiesSchema` era `z.unknown().optional()` con commento "stabilizza in Fase 8"). Servono due decisioni di base prima di procedere.

**Decisioni.**

- **Algoritmo: BSP (Binary Space Partitioning).** Sherdan ha un'estetica industrial-arcane (Obsidium, Tharros, Synapse) prevalentemente "costruita dall'uomo" (fortezze, palazzi, complessi). BSP produce stanze rettangolari su grid connesse da corridoi manhattan: il match cartografico piu' diretto. Graph-based sarebbe stato piu' flessibile ma meno "mappa giocabile". Cellular automata bene per caverne organiche, fuori dal mood prevalente. La scelta non chiude la porta: l'enum `algorithm` in `dungeonMapDataSchema` lascia espandibile a `"cellular"`/`"graph"` in futuro.
- **3 slice verticali end-to-end.** Slice 1 (oggi): layout BSP + schema Zod + UI mappa + side panel, senza LLM e senza persistenza. Slice 2: contenuto LLM per stanza (descrizione, encounter, trap, treasure, lore) con `StyleCalibrator` iniettato + re-roll. Slice 3: persistenza come grafo entity (root `type='location'` con `map_data`, room come children con `parentId`, encounter pre-gen). Razionale: ognuno chiude un pezzo osservabile e testabile da solo, evita un singolo PR/commit gigante difficile da revieware. Coerente con CLAUDE.md §4.2 (vertical slice).
- **`map_data` stabilizzato come `dungeonMapDataSchema` (slice 1).** Forma: `{ version: 1, algorithm: 'bsp', params, rooms: Room[], edges: Edge[], grid: { width, height } }`. `Room`: `{ id, x, y, w, h, kind, centerX, centerY, label? }` con `kind` enum `entry|standard|boss|treasure|trick`. `Edge`: `{ id, fromRoomId, toRoomId, path: Point[] }`. Tutte le coordinate sono in celle griglia (resoluzione-indipendente, render via viewBox SVG). Lo schema vive in `src/lib/dungeons/schema.ts` e viene applicato all'output dell'algoritmo + alla validazione input dell'endpoint. **Non** modifichiamo ancora `locationPropertiesSchema.map_data: z.unknown()`: lo slice 3 fara' lo stringi-mento (probabilmente `z.union([dungeonMapDataSchema, z.unknown()])` o un discriminator su `kind`).
- **PRNG deterministico mulberry32, no `Math.random` nell'algoritmo.** Stesso seed -> stesso layout. Necessario per i test (snapshot-like via JSON.stringify) e per consentire "rigenera questo dungeon con seed X" da UI. Seed 0 e' bumpato silenziosamente a 1 (mulberry32 degenera con stato 0).
- **Connessione: spanning tree (edges = rooms - 1).** Ogni nodo BSP interno crea un edge tra i rappresentanti dei suoi due sub-tree. Garantisce a-priori `connected components = 1` e niente cicli, due proprieta' richieste dalla ROADMAP ("connessione completa, no rooms isolate"). Tradeoff: niente loop -> ogni stanza ha esattamente un percorso dall'entry, il che semplifica la BFS per identificare boss/treasure ma rende il dungeon "lineare-ramificato". Se in futuro vogliamo loop opzionali (per backtracking interessante) si puo' aggiungere un parametro `extraConnections` che aggiunge edge tra vicini topologici.
- **Identificazione ruoli room (entry/boss/treasure/trick) deterministica e basata sulla topologia.** Entry = top-left (indipendente dal seed). Boss = piu' lontano dal entry per BFS. Treasure = dead-end (degree 1) piu' lontano escludendo entry/boss. Trick = junction di grado >= 3 escludendo entry/boss/treasure. Lo slice 2 LLM puo' affinare ma non spostare i ruoli — la topologia decide, il contenuto narra.

**Versioni al momento della decisione.** Next 16.2.4, Zod 4.4.3, drizzle-orm 0.45.2. Nessuna nuova dipendenza installata.

---

## 2026-05-13 — Fase 8 slice 2: dungeon content LLM, batch single-shot, re-roll subset

**Contesto.** Slice 2 della Fase 8: aggiungere contenuto narrativo (descrizione, encounter, trap, treasure, lore, GM notes) per ogni stanza del layout BSP. Sherdan ha StyleCalibrator pronto dalla Fase 3 (riusato dal NPC generator). Servono due decisioni: granularita' della chiamata LLM e re-roll model.

**Decisioni.**

- **Batch single-shot per dungeon, non per-room.** Una sola chiamata LLM riceve theme + lista completa di stanze + style profile, e restituisce contenuto per tutte le room insieme. Vantaggi: (a) coerenza tematica naturale — il modello vede l'intero dungeon e tara prosa/tono di conseguenza, (b) un solo log entry in `generation_log` per generazione completa, (c) latenza unica (1 round-trip Gemini ~3-6s per 15 room) invece di N. Svantaggi: maxTokens piu' alto (4000 vs 1200), output piu' fragile a parse failure (1 stanza che fa fallire lo schema rompe tutto). Mitigazione: re-roll subset (vedi sotto). 15 room × ~300 char ciascuna = ~4.5K char output, dentro il budget.
- **Re-roll subset via stesso endpoint, non endpoint dedicato.** `POST /api/dungeons/content` accetta `targetRoomIds` opzionale + `existingContent` opzionale. Senza targetRoomIds: genera tutte. Con: genera solo quelle, ricevendo il content delle altre come "fixed context" nel prompt per mantenere coerenza. Razionale: il pattern e' isomorfo a NPC re-roll parziale (un field invece di tutto l'NPC); ridurre la superficie API e' un vantaggio. Trade-off: il modello potrebbe rispondere anche per room non-targeted; il composer (`composeDungeonContent`) le ignora silenziosamente — no surprise rewrites — ed errore loud se omette una room targeted.
- **Prompt diretto, niente `PromptBuilder` ancorato a una entity.** Il `PromptBuilder` del Generator Framework richiede un `RetrievedGeneratorContext` ancorato a una entity (location/anchor) e renderizza related/similar. Per il dungeon non c'e' un'entity ancora (lo slice 3 la creera'). Il prompt e' costruito a mano in `buildDungeonContentPrompt`, ma usa lo stesso `callStructuredOutputLogged` per persistere ogni chiamata in `generation_log` (campagna, input umano, prompt, output, status, latenza). Coerente con encounter-assist che ha lo stesso pattern.
- **`StyleCalibrator` riusato senza modifiche.** Quando `campaignId` e' presente, il generator fa `DrizzleNpcGeneratorContextStore.getCampaignStyleEntities(campaignId, 60)` (60 = sweet spot tra cope di prompt budget e rappresentativita' del corpus della campagna) e passa il risultato a `StyleCalibrator`. Il `promptBlock` (statistiche, guidance, few-shot examples) viene appeso al prompt. Senza `campaignId`, il prompt cade su solo theme (output piu' generico ma comunque coerente con il theme dell'input).
- **Niente streaming per ora.** Gemini supporta streaming, ma per output strutturato il parsing si fa a fine response. Streaming per UX andrebbe wirato a livello LLM provider e qui complicherebbe il composer (parse incrementale del JSON array). Rimandato a futuro polish se la latenza diventa fastidiosa.
- **Schema `DungeonRoomContent` separato da `DungeonMapData`.** Il layout (topologia) e' immutabile; il content (narrativo) e' rerollabile. Mantenerli separati semplifica re-roll, persistenza differenziata (slice 3 salvera' content come `properties` sulla room entity), e diff in UI. Map_data resta puro topology.

**Test.** 13 test unitari su content (schema validation, resolveTargetedRoomIds, compose merge/ignore/fail-loud, prompt include theme/target marker/style/existing). I 11 test BSP rimangono validi. Suite totale 327/327.

---

## 2026-05-13 — Fase 8 slice 3: persistenza dungeon come grafo entity

**Contesto.** Slice 3: salvare il dungeon procedurale come grafo di `entities` regolari, cosi' diventa navigabile dal Wiki, dal grafo entita' della campagna, dalla ricerca, e l'encounter draft compare automaticamente nell'Encounter Builder filtrando per location. Decisioni chiave.

**Decisioni.**

- **Root come `location` regolare con `properties.kind='dungeon'`, room come `location` con `properties.kind='room'`.** Nessun nuovo `entity.type`: il modello esistente e' abbastanza flessibile. `locationKindSchema` esteso con `'room'` in modo additivo (no DB migration, e' solo l'enum Zod che valida `properties.kind`). Vantaggi: room appare nel grafo, nella ricerca, nei wikilink, gestita dagli stessi pannelli detail/manager di ogni altra location. Svantaggio: un dungeon di 15 stanze "infila" 16 entity nella campagna; pulizia richiede `DELETE` sul root (cascade `parentId` e' `ON DELETE SET NULL`, quindi le room restano orfane — accettabile, l'utente puo' cancellarle separatamente o tramite tag `procedural-dungeon-room`).
- **`properties.map_data` resta `z.unknown()` nello schema location, ma validato come `dungeonMapDataSchema` dalla route save.** Stringere `map_data` a `union(dungeonMapDataSchema, ...)` lato `locationPropertiesSchema` accoppierebbe la validazione location al modulo dungeons (cycle di import + responsabilita' confusa). Meglio: la route che scrive il dungeon valida loud che la sua scrittura sia coerente; la lettura generica (Wiki) tratta `map_data` come opaque payload. Slice 4 (futuro) potrebbe formalizzare un discriminator `{ kind: 'dungeon', map_data: dungeonMapDataSchema } | { kind: ..., map_data: z.unknown() }`, ma e' costo prematuro oggi.
- **`description` (GM) vs `publicDescription` (player-facing).** La descrizione LLM ha sezione "player-facing" esplicita: quella finisce in `publicDescription` cosi' il futuro Player Dashboard puo' esporla via projection player-safe. `description` GM include ANCHE encounter hook, trap, treasure, lore, GM notes — tutto materiale DM-only. Esatto rispetto del pattern Sherdan #3 (propaganda vs verita') applicato al dungeon: il player legge la descrizione, il DM ha la versione completa.
- **Encounter draft "magri" invece di full encounter con participants.** Per ogni room con `encounterHook`, si crea un `encounters` con `title`, `description`, `locationId`, `tacticalNotes`, ma niente `difficulty`/`partyLevel`/`xpTotal`/participants. Razionale: l'LLM dungeon content non e' Encounter Builder — non ha visione dei mostri della campagna, ne' della party. Il DM completa nell'Encounter Builder, dove il draft compare automaticamente filtrando per `location_id` (filtri gia' esistenti). Tradeoff: l'output del dungeon NON e' immediatamente runnable in combat; serve un secondo passo. Accettato — meglio un draft onesto che un encounter falso-pronto.
- **Composer puro + transaction route, niente "save service" object.** Il pattern e' coerente con `npcOutputToEntityInsert` / NPC save route: la logica di trasformazione e' una funzione pura testabile (`composeDungeonSavePayload`); la route fa I/O e risolve i `localRef` placeholder (`parentLocalRef:"ROOT"`, `roomLocalRef:<roomId>`) dopo ogni `.returning({id})`. Tradeoff: la route ha piu' codice imperativo della media, ma e' lineare e annidato in `db.transaction` (rollback automatico su errore).
- **Visibility iniziale `dm_only` di default, propagata a root e room.** Il dungeon nasce GM-only; quando il party arriva sul posto il DM cambia a `discovered`. L'input schema accetta override esplicito; la UI per ora passa il default.
- **`parentLocationId` opzionale per agganciare il dungeon "sotto" una location esistente.** Es: dungeon = sotterraneo del Palazzo di Tharros → `parentLocationId = <id Palazzo>`. Validato lato API: la parent deve esistere, essere `type='location'`, e appartenere alla stessa campagna (no cross-campaign cascade). UI dello slice 3 non espone ancora il selector — lasciato come future polish.

**Test.** 12 test unitari composer (schema input gate, root kind=dungeon + map_data, parentLocationId, room kind=room + parentLocalRef, publicDescription vs description split, encounter solo con encounterHook, root+room properties passano `locationPropertiesSchema`, slug theme ASCII, visibility propagata). Suite totale 339/339. La sidebar globale: "Dungeon" passa da `Beta` a `Pronto`, Fase 8 marcata completata 2026-05-13.

---

## 2026-05-13 — Fase 9 slice 1: Rules Lookup ingestion + hybrid search (no SRD per V1)

**Contesto.** Apertura Fase 9. La ROADMAP elencava SRD loader + Sherdan homebrew + hybrid search + Q&A UI + agent tool come task della fase. Senza scoping, sarebbero 7-10 giorni. Tre decisioni di scoping prese all'inizio.

**Decisioni.**

- **SRD esterno fuori scope per V1 (skip).** Il corpus della campagna Sherdan vive su due manuali homebrew (`Manuale del Giocatore.md`, `La Forgia di Sherdan - Sistema di Crafting.md`). Caricare l'intero SRD 5.1 (~migliaia di chunk) introduce: (a) tempo embedding non banale (anche col batch Ollama), (b) rumore sulle query Sherdan-style (es. "obsidium raffinato" pesca SRD irrelevanti), (c) overhead UI (filtro source diventa obbligatorio invece di opzionale). Per ora il filtro `sources?: string[]` esiste gia' nello schema search ma di default cerca su tutti — quando SRD entrera' (backlog), la search non richiede modifiche. La DoD lato SRD ("se un mago invisibile lancia palla di fuoco rimane invisibile?") rimane in backlog.
- **3 slice verticali** invece di una mega-fase. Slice 1 (oggi): ingestion completa + hybrid search RRF; niente UI, niente Q&A LLM. Slice 2: UI `/rules` + LLM answer + citazioni. Slice 3: integrazione come tool `rules_search` per session-prep agent + shortcut globale. Ognuno chiude end-to-end ed e' testabile in isolation. Coerente con CLAUDE.md §4.2.
- **RRF semplice, no re-ranker LLM.** Reciprocal Rank Fusion fonde rank vector cosine + trigram similarity senza chiamate LLM extra. Latenza prevedibile (~1 embed query + DB). LLM re-rank rimane opzione futura se la qualita' non basta; oggi sarebbe complessita' premature. k=60 standard (paper Cormack 2009).
- **Trigram (`pg_trgm`) come "BM25-ish" invece di FTS `tsvector`.** Il DB ha gia' indice GIN trgm su `rule_documents.content` (Fase 0). `tsvector` richiederebbe migration additiva + scelta linguaggio. Trgm e' language-agnostic, ottimo per query italiane su corpus italiano, e l'indice e' gia' pronto. Combinato col fallback `ILIKE %query%` su `title`/`section` cattura match esatti su titoli di sezione (es. "Regole Rapide") che la trgm pura mancherebbe per query molto corte.
- **Vector ranker best-effort, trigram sempre attivo.** Se Ollama e' down/embedding query fallisce, la search degrada a solo trigram con log warn. Stesso pattern fail-forward dell'embedding entity (decisions 2026-05-12). Mai bloccare la search per un Ollama offline.
- **Embedding text = `title + section + content`.** Includere title/section nel doc embedding migliora recall su query che cercano per sezione nominata (es. "regole rapide crafting"). Tradeoff: il vector dello stesso chunk varia se il section path viene rinominato — ri-embed con `pnpm db:embed:rules --force` dopo refactor delle sezioni. Idempotente di default su `embedding IS NULL`.
- **Helper Homebrewery estratti in `_homebrewery.ts` per condividere tra parser Manuale del Giocatore e La Forgia.** Refactor minimale (~150 righe) per evitare duplicazione. `collectSectionDrafts` parametrizzato su `isChapterHeading`/`isDocumentChromeHeading`: chrome e capitoli sono document-specific (es. "PARTE II" e' chapter solo nella Forgia), il resto e' identico. Tests pre-esistenti del Manuale del Giocatore continuano a passare invariati (output-level, non internal-helpers).

**Test.** 9 test parser Forgia (chunk produced, chrome skipped, recipe items captured, rules categorization, chapter assignment, chunkIndex sequential) + 8 test RRF (cross-ranker fusion, single-ranker pass-through, perRanker fields, limit, k default 60, k override, tie-break su id, empty input). Suite totale 356/356.

---

## 2026-05-13 — Fase 9 slice 2 + 3: Q&A LLM con citazioni + tool agent prep + shortcut globale

**Contesto.** Chiusura della Fase 9. Slice 2 (UI Q&A con citazioni + history) e slice 3 (integrazione come tool del session-prep agent + shortcut globale) implementati nella stessa sessione perche' costruiscono uno sopra l'altro su `searchRules` esistente.

**Decisioni.**

- **Q&A: structured output JSON con `answer + citations[] + noAnswer` invece di stream markdown libero.** Prompt vincola il modello a JSON object con campi tipizzati: `answer` (markdown), `citations: [{index, chunkId, snippet}]`, `noAnswer` boolean. Vantaggi: (a) il composer puo' validare ogni citazione contro il contesto reale e filtrare quelle inventate (chunkId fuori range), (b) UI puo' rendere `[N]` cliccabili in modo affidabile, (c) il caso "non lo so" e' un boolean esplicito invece di una stringa da parsare. Tradeoff: rinunciamo a streaming token-by-token; per query Q&A ~2-5s su Gemini la latenza non e' un problema (UX accettabile con "Cerco...").
- **Composer drop citations con chunkId invalido invece di lanciare.** Coerente col pattern del dungeon content (slice 2 Fase 8): il modello a volte allucina citazioni con id inventati o duplicati. Il composer filtra silenziosamente (no surprise rewrites in `answer`, ma `citations` finale e' pulito) e deduplica per `index`. Se il modello salta una citazione, l'answer mantiene `[N]` orfano che la UI non rende cliccabile — non e' un crash, e' solo una citazione mancante. Cosi' un singolo errore di formato non manda in errore tutta la query.
- **`contextLimit` default 6, max 15.** Top-6 chunk RRF al modello e' un buon compromesso: copre query multi-sezione (es. "regole + esempio") senza esplodere il prompt o causare diluizione del contesto. Configurabile via input se serve. Embedding query: 1 call Ollama (best-effort, fallback a solo trigram come per search).
- **History locale `localStorage`, non server-side.** Sherdan e' single-user: niente login, niente cross-device. Salvare history su DB introdurrebbe modelli senza guadagno reale per V1. `localStorage` con cap 20 entry, persiste tra reload, isolato per device. Bottone "Pulisci" e reset silenzioso su JSON corrotto. Quando in futuro arrivasse multi-utente, migrazione a DB e' diretta (nuova tabella + endpoint).
- **Citazioni cliccabili come scroll-to invece di tooltip/popover.** Le `[N]` inline nell'answer scrollano alla entry citation tramite `data-citation-id`. Piu' semplice e accessibile di un popover (zero JS di posizionamento, screen-reader friendly). L'entry citation mostra sempre title/section + snippet, e l'utente espande "Mostra chunk" per il contenuto completo.
- **Tool `rules_search` ignora `campaignId` (regole globali).** L'interfaccia `SessionPrepTool` richiede `execute(campaignId, args)` per coerenza con i tool campaign-scoped. Il tool rules accetta l'argomento ma non lo usa: i `rule_documents` sono globali. Documentato con `void _campaignId;` esplicito. Tradeoff: se mai serviranno regole campaign-specific (homebrew per singola campagna), serve un campo `campaign_id` sulla tabella `rule_documents`. Rinviato a quando emergera' il caso.
- **Shortcut globale: `Cmd+/` (mac) / `Ctrl+/` (win/linux) invece di `Cmd+Shift+R` come da ROADMAP originale.** `Cmd+Shift+R` e' bound dal browser a "hard reload" e non e' intercettabile da JS senza estensione browser. `Cmd+/` e' idiomatico per "help/search" (VS Code, GitHub, ecc.), libero, intercettabile. Fallback `Cmd+Shift+K` (Ctrl+K e' EntityQuickSwitch). Documentato nel componente `RulesShortcut`. ROADMAP nota questo cambio nel task `[x]`.
- **Shortcut naviga a `/rules` invece di aprire modal palette.** Pattern entity-quick-switch (modal) richiede un secondo input separato e duplica la logica della pagina. Per Q&A la pagina ha gia' input + storia + risultati visibili insieme: navigare e' piu' diretto. EntityQuickSwitch resta modal perche' il caso d'uso ("salta a entity X") e' una transizione, non un workflow.

**Test.** Slice 2: 9 test QA (prompt include question/chunks/output-contract/no-context-placeholder, options temp+thinking, composer enriches valid citations, drops unknown chunkIds, dedupes index, propagates noAnswer, returns full context, sorts citations ascending). Slice 3: il tool `rules_search` e' coperto indirettamente dai test RRF + integration con searchRules; nessun test specifico per il tool standalone (e' un wrapper thin). Shortcut: nessun test (DOM event listener, manuale). Suite totale 365/365. Sidebar: "Rules Lookup" `Pianificato → Pronto`. Fase 9 marcata completata 2026-05-13.

---

## 2026-05-13 - Fase 10 real-time: WebSocket nativo senza dipendenze

**Contesto.** Primo task della Fase 10: aprire una surface real-time per il Player Dashboard. La ROADMAP lasciava aperta la scelta tra Socket.io e WebSocket nativi.

**Decisione.** Usare un custom server Node (`server.ts`) che avvia Next e intercetta solo l'upgrade HTTP su `/api/realtime`. Il protocollo WebSocket minimo e' implementato in `src/lib/realtime/protocol.ts` usando API Node standard: handshake RFC6455, frame text, ping/pong, close. Nessuna nuova dipendenza.

**Motivazione.**
- Socket.io sarebbe comodo, ma aggiunge protocollo, client e dipendenza prima di sapere se servono stanze, fallback long-polling o acknowledgement complessi.
- Il Player Dashboard e' single-user/small-party: un hub in memoria basta per il primo slice locale/Tailscale.
- Il custom server mantiene Next come applicazione principale e lascia `next build` invariato. `pnpm dev` e `pnpm start` passano da `tsx server.ts --dev|--prod`.

**Tradeoff.** Il server real-time e' in-process: non scala su piu' istanze e perde connessioni su restart. Accettabile per localhost + Tailscale. Quando arriveranno channel per campagna e token signed, il layer `RealtimeHub` verra' esteso senza cambiare handshake/protocollo.

**Test.** Unit test sui helper protocollo (accept key RFC6455, encode text frame, decode masked frame, partial frame buffering). Smoke manuale: dev server su `:3200`, connessione `ws://localhost:3200/api/realtime`, messaggio `connected`, round-trip `{type:"ping"}` -> `pong`.

**Estensione channel per campagna.** Il canale e' scelto all'upgrade tramite `campaign_id` UUID nella query string. `RealtimeHub` mantiene due indici in memoria: `connectionId -> connection` e `campaignId -> Set<connectionId>`. Questo basta per `broadcastCampaign(campaignId, event, payload)` dai futuri route handler DM-side. La validazione qui e' solo strutturale (UUID): l'autorizzazione resta al task successivo dei token URL signed, cosi' non mescoliamo routing e security nello stesso slice.

**Test channel.** Unit test su tracking per campagna, cleanup canale vuoto e broadcast isolato per campagna. Smoke manuale production su `:3201`: `ws://localhost:3201/api/realtime?campaign_id=<uuid>` ritorna `connected` con lo stesso `campaignId`.

**Estensione auth token signed.** L'upgrade WebSocket non usa il cookie player direttamente: i browser lo manderebbero, ma un URL firmato e' piu' adatto alla condivisione Player Dashboard e alla futura anteprima DM. Nuovo endpoint `GET /api/player/realtime-token?campaign_id=...` emette token brevi (10 minuti) solo dopo `requirePlayerAccess()` + `assertCampaignScope()`. Il token contiene `{ campaignId, playerId, expiresAt }`, e' firmato HMAC-SHA256 con `SHERDAN_PLAYER_ACCESS_CODE`, e viene passato come `?token=...` a `/api/realtime`. Se un client include anche `campaign_id`, deve combaciare col payload firmato.

**Tradeoff auth.** I token non sono revocabili singolarmente: scadono rapidamente e una rotazione di `SHERDAN_PLAYER_ACCESS_CODE` invalida tutto. Per uso single-DM/Tailscale e' sufficiente; se il dashboard diventasse pubblico, aggiungere `jti` + deny-list DB sarebbe il prossimo passo.

**Test auth.** Unit test su creazione/verifica token, tamper, scadenza e mismatch campagna. Smoke manuale production su `:3203`: token generato con secret locale, connessione `ws://localhost:3203/api/realtime?token=<token>` accettata e risposta `connected` con `campaignId` e `playerId`.
