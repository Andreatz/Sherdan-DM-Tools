# Sherdan DM Tools — Roadmap completa (v2)

## Premessa

Roadmap end-to-end per costruire una piattaforma unificata che integra 10 tool per il DM. Single-user (personal use), Postgres + pgvector come backbone, web app moderna con LLM e real-time per il Player Dashboard. **Calibrata sulla campagna Sherdan**: lo schema, i generators e i tool sono progettati per supportare i pattern narrativi specifici della tua scrittura (segreti stratificati, propaganda vs verità, identità multiple, briciole di verità).

**Stima totale**: ~5-6 mesi part-time (10-15h/settimana). Le prime 3 fasi (Setup + Wiki + Bootstrap Sherdan + Tables) ti danno qualcosa di usabile al tavolo entro 4-5 settimane.

**Changelog v2 rispetto a v1**:
- Aggiunta Fase 1.5 "Bootstrap Sherdan" (parser dei .md esistenti)
- Schema esteso con: identità multiple, segreti stratificati, briciole di verità, hook PG↔NPC, propaganda vs verità
- Calibrazione tool successivi su pattern Sherdan (multi-sensorialità NPC, doppio arco plot thread, agent prep con tool aggiuntivi)

---

## Principi guida

1. **Foundation first**: schema dati e wiki prima dei tool. I generators senza wiki sono giocattoli; con wiki diventano un sistema integrato.
2. **Vertical slice**: ogni fase chiude un pezzo end-to-end (DB → API → UI → integrazione). Non costruiamo "tutto il backend" prima di toccare il frontend.
3. **Riuso aggressivo**: il Generator Framework della Fase 3 viene riusato da NPC Gen, Loot Gen, Encounter Builder, Dungeon Gen, Session Prep Assistant. Pagare il costo una volta sola.
4. **JSONB per i campi instabili**: schema rigido solo dove serve davvero. Promuovi a colonne quando i campi si stabilizzano.
5. **Migrations sempre additive**: niente `DROP COLUMN`, sempre `ADD COLUMN NULLABLE` → backfill → cleanup successivo.
6. **Personal use ≠ sciatto**: niente auth multi-tenant, ma test, log strutturati, e backup sì.
7. **Sherdan come dataset di seed e calibrazione**: ogni feature viene testata sul materiale reale prima di considerarsi "fatta". Niente dati finti dove c'è materiale autentico.

---

## Stack di riferimento

- **DB**: Postgres 16 + `pgvector` + `pg_trgm`
- **Backend + Frontend**: Next.js 15 (App Router) — full-stack TypeScript in un repo (alternativa: FastAPI + frontend separato se preferisci Python)
- **ORM**: Drizzle (TS) o SQLAlchemy 2.0 (Python)
- **Validation**: Zod (TS) o Pydantic v2 (Python)
- **LLM**: Anthropic SDK + abstrazione provider-agnostic
- **Real-time**: WebSocket nativi o Socket.io (per Fase 10)
- **Deploy**: Docker Compose locale + Tailscale per esporre il Player Dashboard ai giocatori

---

## Schema esteso (v2)

Le tabelle core restano quelle della v1 (`campaigns`, `entities`, `entity_links`, `sessions`, `session_entities`, `plot_threads`, `plot_thread_entities`, `plot_thread_events`, `encounters`, `encounter_participants`, `loot_bundles`, `random_tables`, `rule_documents`).

**Aggiunte v2** — basate sui pattern emersi dalla campagna Sherdan:

```sql
-- ── Identità multiple di una stessa Entity ─────────────────────
-- Es: Malakor → "Vera forma", "Dante il Fortunato", e altri volti storici
--     Noel → "Yancarlos", "Lust", "Xuanji Shih"
-- Permette di distinguere ciò che il party sa (l'identità attiva)
-- da ciò che è realmente vero (l'entità sotto la maschera).
CREATE TABLE entity_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_true_identity BOOLEAN DEFAULT FALSE,
  appearance TEXT,                       -- markdown
  voice TEXT,
  mannerisms JSONB DEFAULT '[]'::jsonb,  -- array di tic/abitudini
  active_from_session UUID REFERENCES sessions(id),
  active_until_session UUID REFERENCES sessions(id),
  visibility visibility DEFAULT 'dm_only',
  notes TEXT
);

CREATE INDEX ON entity_identities(entity_id);

-- ── Segreti stratificati ───────────────────────────────────────
-- Tre livelli di profondità indipendenti dalla visibilità del party.
-- Un segreto deep può essere visibile al party in S20; uno surface
-- può restare DM-only per tutta la campagna.
CREATE TYPE secret_layer AS ENUM ('surface', 'intermediate', 'deep');

CREATE TABLE entity_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  plot_thread_id UUID REFERENCES plot_threads(id) ON DELETE CASCADE,
  layer secret_layer NOT NULL,
  content TEXT NOT NULL,                 -- il segreto, in markdown
  exploit_hint TEXT,                     -- come/da chi può essere sfruttato
  discovered_at_session UUID REFERENCES sessions(id),
  discovery_notes TEXT,                  -- come l'hanno scoperto
  CHECK (entity_id IS NOT NULL OR plot_thread_id IS NOT NULL)
);

CREATE INDEX ON entity_secrets(entity_id);
CREATE INDEX ON entity_secrets(plot_thread_id);
CREATE INDEX ON entity_secrets(layer);

-- ── Versione pubblica vs verità (propaganda vs reality) ────────
-- Pattern centrale di Sherdan: le sette divinità, la Scissione,
-- l'Eclissi, le monete nere — quasi tutto ha due narrazioni.
-- `description` resta la verità GM. `public_description` è ciò
-- che il mondo crede (propaganda dei sei, voce comune, ecc.).
ALTER TABLE entities       ADD COLUMN public_description TEXT;
ALTER TABLE plot_threads   ADD COLUMN public_description TEXT;
ALTER TABLE entity_links   ADD COLUMN public_relation_type TEXT;

-- ── Briciole di verità ─────────────────────────────────────────
-- Tracking esplicito di "cosa il party ha visto e come l'ha
-- interpretato". Granulare sotto i Plot Thread.
CREATE TYPE clue_status AS ENUM (
  'planted',           -- DM ha messo la briciola in scena
  'noticed',           -- party l'ha notata ma non capita
  'misinterpreted',    -- party l'ha interpretata male
  'understood',        -- party ha messo i pezzi insieme
  'lost'               -- chiaramente non l'hanno colta
);

CREATE TABLE truth_clues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  description TEXT NOT NULL,             -- la briciola, come è apparsa
  truth_revealed TEXT NOT NULL,          -- a quale verità punta
  related_plot_thread_id UUID REFERENCES plot_threads(id),
  related_entities UUID[] DEFAULT '{}',  -- entità coinvolte
  planted_in_session UUID REFERENCES sessions(id),
  status clue_status DEFAULT 'planted',
  status_notes TEXT,
  status_updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON truth_clues(campaign_id, status);
CREATE INDEX ON truth_clues(related_plot_thread_id);

-- ── Hook narrativi PG ↔ NPC ────────────────────────────────────
-- Diverso dagli entity_link ("knows", "ally"): è un'annotazione DM
-- su un *potenziale narrativo*, non un fatto in-fiction.
CREATE TABLE pc_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  pc_entity_id UUID NOT NULL REFERENCES entities(id),
  target_entity_id UUID NOT NULL REFERENCES entities(id),
  hook_description TEXT NOT NULL,
  potential_arc TEXT,                    -- "se accade X, l'arco diventa Y"
  used_in_session UUID REFERENCES sessions(id),
  status TEXT DEFAULT 'available'        -- available, in_progress, resolved
);

CREATE INDEX ON pc_hooks(pc_entity_id);
CREATE INDEX ON pc_hooks(target_entity_id);
```

**Modifiche alle properties JSONB degli NPC** — campi tipizzati esplicitamente nei Zod/Pydantic schemas:

```typescript
// Schema NPC properties (Zod)
const NPCPropertiesSchema = z.object({
  // Anagrafica
  race: z.string(),
  class: z.string().optional(),
  level: z.number().optional(),
  age: z.string().optional(),            // "43 anni", "circa 380", "indeterminata"
  alignment: z.string().optional(),
  occupation: z.string().optional(),

  // Apparizione (multi-sensoriale, pattern Sherdan)
  appearance_summary: z.string(),        // 2-3 frasi
  sensory_details: z.object({
    sight: z.string().optional(),        // dettaglio visivo non ovvio
    smell: z.string().optional(),
    sound: z.string().optional(),        // voce inclusa, o suono ambiente
    touch: z.string().optional()
  }),

  // Voce e modi
  voice: z.object({
    tone: z.string().optional(),
    accent: z.string().optional(),
    speech_patterns: z.array(z.string()).default([])
  }),
  tics: z.array(z.string()).default([]), // tic e abitudini
  mannerisms: z.array(z.string()).default([]),

  // Profilo
  motivations: z.array(z.string()).default([]),
  goals: z.object({
    short_term: z.string().optional(),
    medium_term: z.string().optional(),
    long_term: z.string().optional()
  }),

  // Tattico (per il DM)
  weaknesses: z.array(z.object({
    description: z.string(),
    who_could_exploit: z.string()
  })).default([]),

  stat_block_id: z.string().uuid().optional()  // ref a entity type=monster
});
```

L'idea: i campi che si ripresentano in ogni NPC della campagna Sherdan diventano typed; il resto resta libero in `properties.extra` come JSONB libero.

---

## Fase 0 — Setup & infrastruttura ✅

**Durata**: 3-5 giorni · **Tool sbloccati**: nessuno (foundation) · **Chiusa il 2026-05-07**

### Goal
Tutta l'infrastruttura per essere produttivi: progetto inizializzato, DB locale, prima migration, LLM client funzionante, layout di base.

### Task
- [x] Scaffolding progetto: `pnpm create next-app` (o equivalente Python) + TypeScript + Tailwind + ESLint
  - _Note implementative: Next.js 16.2.4 (non 15) installato da `create-next-app@latest`. Tailwind v4, ESLint v9 flat config, App Router, `src/`, alias `@/*`. tsconfig esteso con `noUncheckedIndexedAccess: true`. Aggiunto script `typecheck`. Vedi `docs/decisions.md` 2026-05-06 per dettagli su procedura di scaffold e gestione collisioni `public/` / `README.md`._
- [x] `docker-compose.yml` con Postgres 16 + extension `vector` e `pg_trgm`
  - _Note implementative: image `pgvector/pgvector:pg16` (vector 0.8.2). Init script in `docker/postgres/init/01-extensions.sql` (creato anche `pg_trgm`). Volume named `sherdan_pg_data`. Healthcheck con `pg_isready`. Port host 5432 (configurabile via `POSTGRES_PORT`). `.env.example` aggiunto come riferimento; `.gitignore` con eccezione `!.env.example`. Container `sherdan-postgres` avviato e verificato._
- [x] Configurazione ORM (Drizzle/Prisma): connessione, migrations folder
  - _Note implementative: Drizzle ORM 0.45.2 + driver `postgres` (postgres.js) 3.4.9. `drizzle-kit` 0.31.10 dev. `drizzle.config.ts` a root con dialect `postgresql`, schema `./src/db/schema/index.ts` (placeholder), out `./src/db/migrations`. Client in `src/db/client.ts`. Migrator script in `src/db/migrate.ts`. Sanity script `scripts/db-ping.ts`. Aggiunti `tsx`, `dotenv`, `zod` come dipendenze. Env tipizzata via Zod in `src/lib/env.ts` (parsing single-read, throw con messaggio descrittivo se manca `DATABASE_URL`). Scripts `db:generate`, `db:migrate`, `db:push`, `db:studio`, `db:ping` in `package.json`. Verificato: `db:ping` connette al container, lista versione Postgres 16.13 e estensioni._
- [x] Prima migration: schema completo v2 (campaigns + entities + entity_links + entity_identities + entity_secrets + sessions + session_entities + plot_threads + plot_thread_entities + plot_thread_events + truth_clues + pc_hooks + encounters + encounter_participants + loot_bundles + random_tables + rule_documents)
  - _Note implementative: schema diviso per dominio in `src/db/schema/` (enums, campaigns, entities, sessions, plot, encounters, loot, tables, rules) + barrel `index.ts`. 17 tabelle, 7 enum (`visibility`, `entity_type`, `secret_layer`, `clue_status`, `plot_thread_status`, `plot_role`, `encounter_difficulty`), 39 indici (B-tree FK, GIN su tags/properties/related_entities, trigram GIN su `rule_documents.content`), 1 check constraint (`entity_secrets_target_chk`), 1 unique compound (`uq_sessions_campaign_number`, `uq_session_entities_pair`, `uq_plot_thread_entities_role`). `embedding vector(1536)` su `entities` e `rule_documents`. Migration `0000_motionless_bruce_banner.sql` generata da drizzle-kit + prepend manuale di `CREATE EXTENSION IF NOT EXISTS vector|pg_trgm` per auto-sufficienza. Indici ivfflat/hnsw per embedding rinviati a Fase 1.5 (servono dati per training ivfflat). Verificato: 17 tabelle in `\dt`, check constraint funzionante via psql, smoke test Drizzle ha inserito/letto entity con embedding 1536 + properties JSONB + tags TEXT[]._
- [x] Validazione schema: Zod schemas per ogni `properties` JSONB type-specific (NPC, Location, Faction, Item, Monster, PC, Deity, Organization)
  - _Note implementative: 8 file in `src/lib/validation/` (uno per `entity_type`) + `_shared.ts` (sensoryDetails, voice, goals, weakness, extra) + `index.ts` (barrel + `propertiesSchemaByType` con `satisfies Record<EntityTypeName, ZodTypeAny>` che fa rompere il typecheck se aggiungi un valore all'enum senza schema). NPC schema fedele alla specifica ROADMAP §0 (race/class/level/age/alignment/occupation, appearance_summary, sensory_details multi-sensoriale, voice {tone, accent, speech_patterns}, tics/mannerisms, motivations, goals stratificati, weaknesses con who_could_exploit, stat_block_id). Tutti gli schemi `.strict()` (rifiutano chiavi sconosciute) con campo `extra` opzionale per estensioni libere. `EntityTypeName` derivato da `entityType.enumValues` di Drizzle (single source of truth). Funzioni esposte: `validateEntityProperties` (throw) e `safeValidateEntityProperties` (Result). Sanity script `scripts/validation-smoke.ts` con happy/bad case per ogni tipo, tutti verdi (sara' migrato a vitest quando il test setup arriva)._
- [x] LLM client wrapper: interfaccia `complete(prompt, options)` + `complete_structured(prompt, schema)`, implementazione Anthropic
  - _Note implementative: stack OSS-only (decisione 2026-05-06): implementazione Ollama invece di Anthropic. Provider abstraction in `src/lib/llm/`: `types.ts` con `LLMProvider` interface (`complete`, `completeStructured`, `stream`, `embed`, `embedBatch`), `LLMError` + `LLMStructuredOutputError`. `ollama.ts` con impl HTTP via fetch (no SDK esterno), supporto structured output via `format: <jsonschema>` (Zod -> JSON Schema con `z.toJSONSchema`), streaming NDJSON, abort signal cooperativo. Singleton via `getLLMProvider()` in `index.ts`. Modelli default: `qwen2.5:7b-instruct-q4_K_M` (chat) e `mxbai-embed-large` (embedding 1024-dim). Env vars: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_EMBED_MODEL` con default sensati. Sanity script `scripts/llm-ping.ts` (script `pnpm llm:ping`): verifica `/api/tags`, presenza modelli configurati, complete, completeStructured con Zod, embed (controlla dim=1024). Verifica live posticipata: Ollama non ancora installato sulla macchina, `llm:ping` fallisce con messaggio diagnostico chiaro come atteso. Setup utente: scaricare Ollama da ollama.com, poi `ollama pull qwen2.5:7b-instruct-q4_K_M` e `ollama pull mxbai-embed-large`._
  - _(scoperto durante questo task) Schema embedding ridotto da `vector(1536)` a `vector(1024)` per allineamento con `mxbai-embed-large`. Migration 0000 ri-generata (file rinominato in `0000_next_robbie_robertson.sql`), volume Docker droppato e ri-applicata da zero (opzione α: pre-data, no rischio). Documentato in `docs/decisions.md`._
  - _(scoperto durante questo task) Aggiunto Gemini come provider primario per chat (chiesto dall'utente). Architettura: chat con `RoutedProvider` che usa Gemini primario + Ollama fallback automatico su errori transient (network/5xx/429); embedding **sempre via Ollama** (1024-dim mxbai-embed-large) per stabilita' del vector space. `src/lib/llm/gemini.ts` (REST, no SDK), `src/lib/llm/router.ts` (FallbackProvider). Env esteso: `LLM_PROVIDER` (default `gemini`), `GOOGLE_AI_API_KEY` (richiesta da superRefine), `GEMINI_MODEL` (default `gemini-2.5-flash`). Fixed: sanitize JSON Schema per Gemini (strippa `additionalProperties`/`$schema`/format non supportati), disabilita `thinkingConfig.thinkingBudget=0` di default per output predicibile. Verificato live: Gemini complete + completeStructured + router OK. Pull modelli Ollama (qwen2.5:7b, mxbai-embed-large) restano azione setup user._
- [x] Config management: `.env`, dotenv-safe, type-safe config object
  - _Note implementative: gia' presente `src/lib/env.ts` (Zod, single-read, fail-fast, type `Env` esportato). Estensioni: split `baseSchema`/`schema` (con superRefine in cima) per esporre `envSchemaKeys`. POSTGRES_* aggiunte allo schema come `optional()` con commento ("consumate da docker-compose, non dall'app") per evitare drift col `.env.example`. NODE_ENV documentata in `.env.example`. Nuovo script `scripts/env-check.ts` (`pnpm env:check`) — equivalente leggero di `dotenv-safe` (~100 righe, no dep): verifica tre invarianti — ogni chiave in `.env.example` e' nello schema, ogni chiave nello schema e' in `.env.example`, ogni chiave nel `.env` locale o e' documentata o produce warning. 12 chiavi documentate, 12 validate, in sync. Server-only convention: commento esplicativo in env.ts; `import "server-only"` aggiunto quando ci sara' codice client._
- [x] Logging strutturato: pino (TS) o structlog (Python)
  - _Note implementative: pino 10.3.1 + pino-pretty 13.1.3 (dev). `src/lib/logger.ts` esporta root `logger` e helper `getLogger(scope)` per child logger scoped. Pretty-print con colori e timestamp in dev/test, JSON in production. Livello configurabile via `LOG_LEVEL` env (fatal/error/warn/info/debug/trace/silent), default per ambiente: debug in dev, info in production, warn in test (silenzioso ma non muto). Redaction automatica di campi sensibili (apiKey, password, GOOGLE_AI_API_KEY, DATABASE_URL, headers.authorization) → `[Redacted]`. Wired nel `RoutedProvider`: il fallback chat ora logga a warn invece di console.warn (con `op`, `err`, `status`). Smoke `scripts/logger-smoke.ts` verifica livelli, scope, error con stack, redazione. Metriche LLM (tokens, latency, cost) saranno wirate quando arriva il `generation_log` in Fase 3._
- [x] Test setup: vitest/jest (TS) o pytest (Python)
  - _Note implementative: Vitest 4.1.5 + @vitest/ui. Config in `vitest.config.ts` (alias `@/*` -> `src/*`, glob `tests/**/*.test.ts`, env Node, `setupFiles: ["tests/setup.ts"]` per dotenv). Scripts: `pnpm test` (run), `pnpm test:watch`, `pnpm test:ui`. Convenzione path: `tests/unit/<area>/*.test.ts` (parallelo a `src/`), `tests/integration/` per quando arrivera'. Migrato `scripts/validation-smoke.ts` in `tests/unit/validation/properties.test.ts` con 22 test (happy/bad path per ognuno degli 8 entity_type + edge cases NPC pattern Sherdan + verifica `.strict()` + verifica che segreti vadano in entity_secrets non in properties). `validateEntityProperties`/`safeValidateEntityProperties`/`getPropertiesSchema` resi generici per narrowing del return type su `T extends EntityTypeName`. Definito `PropertiesFor<T>` e `SafeValidateResult<T>` (Zod 4 non espone piu' `SafeParseReturnType`). Logger-smoke.ts mantenuto come demo, validation-smoke.ts rimosso (ridondante)._
- [x] Layout principale: shell con sidebar + main content (placeholder)
  - _Note implementative: `src/components/app-shell.tsx` (AppShell con sidebar fissa + main scrollabile, max-w-6xl) usato in `src/app/layout.tsx` con metadata "Sherdan DM Tools" e lang="it". `src/components/sidebar.tsx` con sezioni "Generale", "Wiki", "Sessioni & Trama", "Generators", "Assistenti", "Tavolo": gli item futuri sono placeholder disabilitati con etichetta "Fase X" allineata a destra (utili promemoria visuali). Niente responsive collapse: target desktop al tavolo. Mobile-first arrivera' in Fase 10 (Player Dashboard)._
- [x] Routing base: home, campaigns list, campaign view (placeholder)
  - _Note implementative: `/` (home dashboard con CTA "vai alle campagne" e badge stato Fase 0), `/campaigns` (lista da DB via Drizzle, server component, con empty state e error state diagnostico se DB unreachable), `/campaigns/[id]` (detail con sezioni placeholder per Entita'/Sessioni/Plot/Briciole, `notFound()` se id non esiste). Vertical slice end-to-end (DB -> Drizzle -> server component -> UI) — appena si aggiungeranno campagne, le pagine si popolano senza modifiche. Verificato live: `/` 200, `/campaigns` 200 con empty state, `/campaigns/<bogus>` 404. Build genera 5 routes (Static / + /_not-found + /campaigns; Dynamic /campaigns/[id])._
- [x] CI minima: lint + test su push (GitHub Actions)
  - _Note implementative: `.github/workflows/ci.yml` con job singolo `validate` (Ubuntu, Node 24, pnpm 10, frozen-lockfile). Trigger: push su main + pull request su main. Concurrency group cancella build piu' vecchie sullo stesso ref. Step: env:check -> lint -> typecheck -> test -> build. Niente Postgres in CI: i test attuali sono unit (Zod schemas) e `/campaigns` e' marcata `force-dynamic` quindi `next build` non interroga il DB. Env minime fake per soddisfare la validazione Zod (`DATABASE_URL` placeholder, `LLM_PROVIDER=ollama` per evitare il check di `GOOGLE_AI_API_KEY`). Dry-run locale: tutto verde in ~10s. Quando arriveranno integration test col DB (Fase 1.5+), si aggiunge il service container `pgvector/pgvector:pg16` al job._
  - _(scoperto durante questo task) `/campaigns` cambiata da static a `force-dynamic`: i dati cambiano sempre, e questo evita che `next build` tenti di prerenderizzare la pagina interrogando il DB. Cambio coerente comunque, non un workaround._
- [x] README con setup instructions per il "te" futuro
  - _Note implementative: README completo in italiano. Sezioni: cos'e' il progetto, pre-requisiti (Node/pnpm/Docker/Ollama opzionale), setup prima volta (clone, install, .env, docker, db:migrate, ollama pull, dev), istruzioni per ottenere una Gemini API key gratuita (con avviso privacy free tier), comandi quotidiani (dev, quality gate, DB), struttura del progetto, stack, stato del progetto, e troubleshooting con i 5 fail piu' probabili (DB unreachable, Gemini Pro quota, Ollama mancante, build dynamic, env drift). Pointer espliciti a ROADMAP.md, CLAUDE.md, docs/decisions.md._
- [x] (scoperto durante README) Seed minimale: campagna "Sherdan" nel DB
  - _Note implementative: `scripts/db-seed.ts` (`pnpm db:seed`). Idempotente: se la campagna "Sherdan" esiste gia', non duplica. Inserisce con name + description + settings (`system: D&D 5e`, `language: it`, `tone`). Necessario per soddisfare la Definition of Done della Fase 0 ("hai una campagna seed nel DB"). Verifica live: `/campaigns` mostra la card, link a `/campaigns/<uuid>` apre il detail con tutte le sezioni placeholder. La popolazione vera (NPC, fazioni, plot) avviene in Fase 1.5._

### Definition of done
Esegui `pnpm dev`, vedi la home, hai una campagna seed nel DB (Sherdan vuota, con solo nome e settings), riesci a fare una chiamata LLM che ritorna JSON validato.

---

## Fase 1 — Wiki minimale (Campaign Wiki) ✅

**Durata**: 12-16 giorni · **Tool sbloccato**: ✅ Campaign Wiki · **Chiusa il 2026-05-08**

### Goal
CRUD completo su entità con linking bidirezionale, ricerca, markdown editor. Supporto fin da subito a identità multiple, segreti stratificati, propaganda vs verità. Da qui in poi tutti i tool successivi scriveranno qui.

### Task

**Backend**
- [x] API routes CRUD per `campaigns`
  - _Note implementative: `src/app/api/campaigns/route.ts` (GET list, POST create) e `src/app/api/campaigns/[id]/route.ts` (GET, PATCH, DELETE). Input validato via Zod (`createSchema.strict()`, `updateSchema.strict()`, `idParamSchema` con `z.uuid()`). PATCH rifiuta body vuoto con `BadRequestError`. DELETE ritorna 204 no-content. Error handler centralizzato in `src/lib/api/respond.ts` con helper `ok/created/noContent/fail`: `fail()` traduce ZodError -> 400 validation_failed, AppError -> status mappato, errori sconosciuti -> 500 generico (dettagli solo nei log). Errori tipizzati in `src/lib/api/errors.ts`: `AppError` base + `NotFoundError` (404), `ValidationFailedError` (400), `BadRequestError` (400), `ConflictError` (409). Logger pino registra 4xx come info, 5xx come error. Smoke live verificato via curl: tutti 5 endpoint OK + 3 error path (404 dopo delete, 400 su body vuoto, 400 su uuid malformato)._
  - _Test handler rimandati: vitest mock di Drizzle e' fragile, integration tests con DB richiedono setup CI con service container Postgres. Si fanno arrivare in un task dedicato dopo la prima manciata di route._
- [x] API routes CRUD per `entities` (con filtri: type, tag, parent_id, search) — `description` è verità GM, `public_description` opzionale
  - _Note implementative: `src/lib/validation/entity-input.ts` con `createEntityInputSchema` (campaignId+type+name required), `updateEntityInputSchema` (tutto optional + `.refine()` "type implies properties": cambiare type richiede properties aggiornate), `listEntitiesQuerySchema` (snake_case URL: campaign_id, type, parent_id, tag, search, limit, offset, include_embedding). Output sempre camelCase. `embedding vector(1024)` escluso dai SELECT di default (rumoroso); flag `?include_embedding=true` lo include. Search basico via ILIKE su name + description + publicDescription (FTS sofisticato arrivera' col task `/search` dedicato). Validazione `properties` JSONB type-specific delegata a `validateEntityProperties` del discriminator: in PATCH se cambia type richiede properties, se cambia solo properties valida contro type esistente nel DB (lookup). PATCH costruisce il SET solo coi campi presenti nel body (no overwrite implicito a null). DELETE 204 con cascade sulle FK figli (entity_links, entity_identities, entity_secrets, pc_hooks). Smoke live verificato: POST npc valido + Cappello location + POST con properties invalide -> 400, list base 2 risultati, filtro type=npc, filtro tag=mercenario, search=cappello (trova Cappello via name + Lunacupa via publicDescription), GET singolo, PATCH solo name, PATCH type senza properties -> 400 (refine), PATCH properties valide, DELETE 204, GET dopo delete 404._
- [x] API routes CRUD per `entity_links` (con `public_relation_type` opzionale)
  - _Note implementative: URL `/api/entity-links` (kebab-case URL convention, body camelCase). Schemi in `src/lib/validation/entity-link-input.ts`: create (campaignId+source+target+relationType required), update (campaignId/source/target NON modificabili: cambierebbe la semantica, cancella+ricrea), list query con filtri `campaign_id`, `source_entity_id`, `target_entity_id`, `involves_entity_id` (source OR target — shorthand utile per "tutto cio' che tocca questa entity"), `relation_type`, paginazione. `involves_entity_id` mutuamente esclusivo con i puntuali source/target -> 400 BadRequest se combinati. `relationType` e `publicRelationType` open vocab (text) per pattern Sherdan #3 (propaganda vs verita'). Smoke live verificato (11 step): CRUD base, filtri source/involves/relation_type, mutual exclusion, PATCH con `publicRelationType: null` (cancella propaganda), DELETE 204, cascade ON DELETE entity -> link sparisce automaticamente._
- [x] API routes CRUD per `entity_identities`
  - _Note implementative: URL `/api/entity-identities`. Schemi in `src/lib/validation/entity-identity-input.ts`. Filtri list: `entity_id`, `is_true_identity`. Update non modifica `entityId` (cambia semantica). Pattern Sherdan #1 (Malakor -> Dante + Vera Forma) verificato live: 2 identita' su una entity, una con `isTrueIdentity=true` con visibility dm_only, l'altra public. Unicita' di `is_true_identity=true` per entity NON e' enforced a livello DB: la UI in Fase 1 garantira' che non se ne creino piu' di una._
- [x] API routes CRUD per `entity_secrets` (filtro per layer)
  - _Note implementative: URL `/api/entity-secrets`. Schemi in `src/lib/validation/entity-secret-input.ts`. Filtri list: `campaign_id`, `entity_id`, `plot_thread_id`, `layer` (surface/intermediate/deep), `discovered` (vero se `discoveredAtSession` non-null, falso altrimenti). Refine Zod su create: almeno uno tra `entityId` e `plotThreadId` deve essere valorizzato (DB enforce: `CHECK (entity_id IS NOT NULL OR plot_thread_id IS NOT NULL)`). Smoke live: 2 secret su Malakor (deep + surface), filtro `layer=deep` -> 1, refine fa fallire create senza target con 400._
- [x] API routes CRUD per `pc_hooks`
  - _Note implementative: URL `/api/pc-hooks`. Schemi in `src/lib/validation/pc-hook-input.ts`. Filtri list: `campaign_id`, `pc_entity_id`, `target_entity_id`, `status`. `status` enum `available|in_progress|resolved`. Update non modifica campaignId/pcEntityId/targetEntityId. Pattern Sherdan #6 (hook narrativi PG <-> NPC come dato esplicito separato dagli entity_links) verificato live._
- [x] (scoperto durante questi 3 task) Bug fix: parser `boolish` per query string boolean
  - _Note implementative: `z.coerce.boolean()` ha un bug noto — la stringa "false" e' truthy (length > 0) quindi viene coercita a `true`. Aggiunto helper `boolish` in `src/lib/validation/_shared.ts` che usa `z.preprocess` per riconoscere letteralmente "true"/"false". Sostituito `z.coerce.boolean()` in 4 punti: `entity-input.ts` (include_embedding), `entity-identity-input.ts` (is_true_identity), `entity-secret-input.ts` (discovered), `entities/[id]/route.ts` (include_embedding). Re-test confermato: discovered=false ora trova gli undiscovered, is_true_identity=false trova le aliases._
- [x] Endpoint `GET /entities/:id/backlinks`
  - _Note implementative: `src/app/api/entities/[id]/backlinks/route.ts`. JOIN tra `entityLinks` (target=id) e `entities` (sull'entity sorgente) con select nested (`source: { id, type, name }`) per evitare al client una seconda chiamata. Ordinati alfabeticamente per `source.name`. 404 esplicito se l'entity non esiste (senza check, una entity inesistente ritornerebbe `[]` ambiguo). Forward-link recuperabili via `/api/entity-links?source_entity_id=ID`, niente endpoint dedicato. Smoke live: 3 step verdi (Setta -> 2 backlinks Lunacupa+Garrick, Lunacupa -> 0, entity inesistente -> 404)._
- [x] Endpoint `GET /search?q=...` (FTS su nome + description + public_description)
  - _Note implementative: `src/app/api/search/route.ts` con schema in `src/lib/validation/search-input.ts`. Implementazione minima ILIKE su `name` + `description` + `publicDescription` (no ranking, ordinamento alfabetico). Filtri: `q` (required, 1-200 chars), `campaign_id`, `type`, `limit`/`offset`. `embedding` escluso dall'output. Quando il volume crescera' (~500+ entities) o servira' ranking, si aggiungeranno indici trigram (`pg_trgm` gia' installato) e si passera' a `similarity()` con threshold + ORDER BY similarity. Smoke live: 6 step verdi (q libero, q+type, q+campaign_id, q mancante -> 400)._
- [x] Validation server-side delle `properties` JSONB per ogni `type`
  - _Note implementative: gia' coperta dai task CRUD entities (POST e PATCH). Il route handler `/api/entities` chiama `validateEntityProperties(type, properties)` (discriminator type-safe in `src/lib/validation/index.ts`) dopo il parse Zod del body. PATCH che cambia solo properties senza type fa lookup del type esistente per validare contro il type effettivo. Errori traducono in 400 ValidationFailedError con dettagli Zod._

**Frontend**
- [x] Sidebar: lista entità raggruppate per type, ricerca rapida
  - _Note implementative: aggiunto componente client `EntitySidebarSection` nella sidebar globale. Carica fino a 200 entità da `GET /api/entities`, le raggruppa per `type`, mostra conteggi e indicatore di `visibility`, e filtra istantaneamente per nome/type/tag. Finché la detail view non esiste, i link puntano alla campagna con query `focus=<entity_id>` per evitare 404 e restare agganciabili al task successivo._
- [x] Entity list view: filtri (type, tag, search), card o tabella
  - _Note implementative: lista entita' nella detail view campagna (`/campaigns/[id]`) come tabella server-rendered con filtri GET per `type`, `tag`, `search`; badge visibilita', tag cliccabili, stato vuoto e reset filtri. Verificata manualmente su `http://127.0.0.1:3000/campaigns/0614eb59-a2f3-45cf-ae1b-2d32586340d4`._
- [x] Entity detail view: tabs per "Verità GM", "Versione pubblica", "Properties" (form JSONB), "Identità", "Segreti", "Links", "Backlinks", "Hooks PG"
  - _Note implementative: detail view integrata in `/campaigns/[id]` con selezione via `focus=<entity_id>` e tab via `detail_tab`. Mostra Verita' GM, versione pubblica, JSONB properties read-only, identita', segreti stratificati, links in uscita, backlinks e hooks PG recuperati dal DB. I pannelli sono volutamente read-only: editor/manager dedicati restano nei task successivi. Verificata manualmente su tab `properties` con HTTP 200._
- [x] Markdown editor (TipTap o Lexical) con custom node `[[wikilink]]`
  - _Note implementative: scelto Lexical 0.44 (autorizzato dall'utente, documentato in `docs/decisions.md`). Aggiunto `WikiMarkdownEditor` client nei tab Verita' GM e Versione pubblica: salva via PATCH su `entities.description` / `entities.public_description`, preserva markdown puro nel DB e tokenizza `[[Nome Entita']]` tramite `WikiLinkNode` custom. Autocomplete/render/hover restano nei task successivi._
- [x] Autocomplete su `[[`: suggerisce entità esistenti, "Crea [name]" se non esiste
  - _Note implementative: `WikiMarkdownEditor` rileva wikilink aperti (`[[query`) e mostra un pannello suggerimenti sotto l'editor, caricato da `GET /api/entities?campaign_id=...&search=...`. Click su un'entita' sostituisce il testo parziale con `[[Nome]]`. Se non esiste un match esatto, il pannello permette creazione inline di uno stub con tipo selezionabile e properties minime valide, poi inserisce il wikilink. Il quick-create modal completo resta nel task dedicato._
- [x] Render markdown: wikilinks come link interni, hover preview
  - _Note implementative: aggiunta preview live nel `WikiMarkdownEditor`, senza dipendenze nuove. Renderer markdown minimale per paragrafi, heading `#`/`##`/`###`, liste `-`/`*`, enfasi, bold e inline code. I `[[wikilink]]` risolvono contro le entita' della campagna, diventano link interni a `/campaigns/[id]?focus=<entity_id>` e mostrano hover preview con nome, type e `public_description`; link non risolti sono evidenziati in rosso._
- [x] EntityLink editor: search + select target, relation_type (dropdown), strength slider, public_relation_type opzionale
  - _Note implementative: aggiunto `EntityLinkEditor` client-side nella tab Links dell'entity detail. Supporta ricerca target tra le entità della campagna, select target, dropdown relation_type, slider strength 0-10, visibility, public_relation_type opzionale, note, creazione via `POST /api/entity-links`, modifica/cancellazione dei link in uscita via `PATCH`/`DELETE /api/entity-links/:id`. La tab Backlinks resta read-only per ispezionare le relazioni entranti._
- [x] Identity manager: lista identità di una entity, toggle "true identity", date di attivazione
  - _Note implementative: aggiunto `EntityIdentityManager` client-side nella tab Identita'. Supporta creazione/modifica/cancellazione identità, campi appearance/voice/mannerisms/notes, visibility, sessione "attiva da" e "attiva fino a" tramite select sulle sessioni della campagna. Il toggle "vera identità" mantiene la mutua esclusività lato UI: quando un'identità viene marcata true, le altre identità true della stessa entity vengono demarcate via API._
- [x] Secrets panel: tre colonne (surface/intermediate/deep), ognuna espandibile, status "discovered" toggleable
  - _Note implementative: aggiunto `EntitySecretManager` client-side nella tab Segreti. Render a tre colonne espandibili per layer `surface`/`intermediate`/`deep`, con creazione/modifica/cancellazione segreti, campi `content`, `exploit_hint`, `discovery_notes`, e toggle "Scoperto dal party". Lo stato discovered usa `discovered_at_session`: toggle on valorizza una sessione selezionata (o l'ultima disponibile), toggle off salva `null`; se non esistono sessioni, il pannello permette comunque gestire i segreti ma richiede una sessione per marcarli scoperti._
- [x] PC Hooks panel: matrice PG × NPC con descrizione hook
  - _Note implementative: aggiunto `PcHookMatrix` client-side nella tab Hooks PG. Recupera tutti i `pc_hooks` della campagna e li mostra come matrice PG × NPC, con righe `type='pc'` e colonne `type='npc'`. Ogni cella può contenere più hook, crearne di nuovi e modificare/cancellare quelli esistenti via API; campi gestiti: `hook_description`, `potential_arc`, `status` (`available`/`in_progress`/`resolved`) e `used_in_session`. La riga/colonna dell'entità selezionata viene evidenziata._
- [x] Tag system: input chip-style con autocomplete su tag esistenti
  - _Note implementative: aggiunto `EntityTagEditor` nel detail header dell'entità. I tag sono chip removibili, l'input accetta Enter/virgola, suggerisce i tag già presenti nella campagna e consente creazione inline di tag nuovi; il salvataggio usa `PATCH /api/entities/:id` aggiornando solo `tags`._
- [x] Quick-create flow: da `[[NewEntity]]` → modal "che tipo è?" → crea stub
  - _Note implementative: completato il flusso nel `WikiMarkdownEditor`: quando un wikilink non risolve a un'entità esistente, il pannello autocomplete apre un modal "Che tipo è?", crea uno stub type-specific via `POST /api/entities`, inserisce il token `[[Nome]]` nel punto del trigger Lexical e chiama `router.refresh()` per aggiornare lista/preview della campagna._

**QoL**
- [x] Vista grafo: D3 force-directed o vis-network, nodi colorati per type, opzione "mostra solo links pubblici"
  - _Note implementative: aggiunto `EntityGraphView` con D3 force-directed (`d3-force`) e rendering React/SVG. La pagina campagna carica tutte le entity e tutti gli `entity_links` della campagna; il grafo mostra nodi colorati per `entity.type`, link direzionali con label, highlight dell'entità selezionata e toggle client-side "Mostra solo links pubblici" basato su `entity_links.visibility = 'public'`. Aggiunte dipendenze `d3` e `@types/d3`; scelta documentata in `docs/decisions.md`._
- [x] "Recently edited" nella sidebar
  - _Note implementative: aggiunta sezione "Modificate di recente" in `EntitySidebarSection`, con gli ultimi 5 record ordinati per `entities.updated_at` e link diretto alla detail view. Estesa `GET /api/entities` con query `sort=name_asc|updated_desc` (default `name_asc`) per non dipendere dal sort client-side quando il dataset crescerà._
- [x] Keyboard shortcut Cmd-K per quick switch entità
  - _Note implementative: aggiunto `EntityQuickSwitch` globale nell'`AppShell`. `Cmd+K`/`Ctrl+K` apre una palette modal, carica le entità via `GET /api/entities`, filtra localmente per nome/type/tag/`public_description`, supporta frecce su/giù + Invio + Escape e naviga a `/campaigns/[campaign_id]?focus=[entity_id]`._
- [x] Visibility toggle nell'editor (dm_only / discovered / public)
  - _Note implementative: il `WikiMarkdownEditor` ora include un controllo segmentato DM/Scoperta/Pubblica, salva `visibility` insieme al markdown via `PATCH /api/entities/:id` e chiama `router.refresh()` per aggiornare badge, lista e sidebar. I due editor dell'entita' sono keyati per `entity.id` + campo, cosi' cambio focus e cambio tab non riusano stato client obsoleto._

### Definition of done
Hai 30+ entità di test (anche fittizie va bene per ora), link tra loro, navighi il grafo cliccando wikilinks, ricerca FTS funzionante, vedi backlinks, gestisci almeno un'entità con identità multiple e una con segreti su tutti e tre i layer.

---

## Fase 1.5 — Bootstrap Sherdan ⭐ NUOVA

**Durata**: 3-5 giorni · **Tool sbloccato**: dataset di seed reale

### Goal
Importare l'intero materiale di Sherdan (i .md della repo `public/`) come entità popolate nel Wiki. Non solo per evitare data-entry manuale: serve a **stress-testare lo schema su materiale reale prima di costruire i 9 tool successivi**, e a fornire a tutti i generators successivi un dataset di calibrazione stilistica autentico.

### Strategia
I .md di Sherdan hanno una struttura regolare. Ogni tipo di documento ha un template predicibile:

- **NPC.md**: header `## N. Nome - Razza, Classe`, poi sezioni `Identità` / `Tic e Abitudini` / `Backstory` / `Obiettivi` (tabella) / `Segreti (stratificati)` (lista numerata 1/2/3 = surface/intermediate/deep) / `Punti Deboli` (tabella) / `Agganci PG` (tabella).
- **Fazioni.md**: header `## N. Nome Fazione`, poi `Struttura` / `Luogotenenti` / `Obiettivi` (tabella) / `Segreti` / `Rapporti con altre Fazioni` (tabella) / `Agganci PG` (tabella).
- **Lore.md**: sezioni numerate `# N. Titolo`, con blocchi `🔒 Verità su X` interleaved che vanno separati come `description` (verità) vs `public_description` (propaganda).
- **Campagna.md**: profezia + arc dei PG + macro-trama + recap sessioni con `🔒 Nota GM` interleaved.

### Task

**Parser**
- [x] Parser per `NPC.md` → `entities` (type=npc) con properties tipizzate, `entity_secrets` su tre layer, `pc_hooks` per ogni riga della tabella Agganci PG, `entity_links` per "Rapporti con i Cinque Capi" o sezioni equivalenti
  - _Note implementative: aggiunto parser puro `parseSherdanNpcMarkdown` in `src/lib/parsers/sherdan-npc.ts`, pensato come import-plan per il task Pipeline idempotente successivo. Su `public/NPC.md` riconosce 65 blocchi `##` importabili, produce properties NPC validate da Zod, 18 segreti stratificati, 27 agganci PG, 10 relazioni verso entità da risolvere al secondo passaggio e 66 identità/alias (inclusa la maschera pubblica Dante per Malakor). Test unitari su frammenti reali verificano Lunacupa e Malakor._
- [x] Parser per `Fazioni.md` → `entities` (type=faction) + sotto-entità per luogotenenti, `entity_secrets`, `entity_links` per rapporti
  - _Note implementative: aggiunto parser puro `parseSherdanFactionsMarkdown` in `src/lib/parsers/sherdan-factions.ts`, parallelo al parser NPC e pensato come import-plan per la pipeline idempotente. Su `public/Fazioni.md` riconosce 17 fazioni, produce properties `faction` validate da Zod, 27 sotto-entità NPC per luogotenenti/membri chiave, 38 segreti (inclusi blocchi `🔒` GM-only come deep), 35 relazioni verso altre fazioni/organizzazioni, 31 agganci PG e 8 warning da risolvere nel report di import. Test unitari su materiale reale verificano Valchirie, Synapse ed Eclissi._
- [x] Parser per `Lore.md` → `entities` (type=organization/location/deity a seconda della sezione) con split automatico `description` (testo `🔒` markato) vs `public_description` (testo non markato)
  - _Note implementative: aggiunto parser puro `parseSherdanLoreMarkdown` in `src/lib/parsers/sherdan-lore.ts`, coerente con gli import-plan NPC/Fazioni. Su `public/Lore.md` riconosce 37 sezioni top-level e le classifica in 1 `deity`, 15 `organization` e 21 `location`; separa automaticamente propaganda pubblica e verita' GM in `publicDescription`/`description`, trattando come privati sia i blocchi `🔒` sia le note GM `💡`. Produce properties validate da Zod per deity/location/organization, mantiene riferimenti sorgente e tag diagnostici, conta 65 blocchi GM-only, 2 sezioni interamente GM-only e 8 warning da gestire nel report di import. Test unitari su materiale reale verificano Pantheon, Sabotaggio di Mitra e Tharros._
- [x] Parser per `Campagna.md` → `plot_threads` (uno per arc personale + macro-arc), `sessions` con `recap` (testo) e `prep_notes` (blocchi `🔒` estratti)
  - _Note implementative: aggiunto parser puro `parseSherdanCampaignMarkdown` in `src/lib/parsers/sherdan-campaign.ts`, come import-plan per la pipeline idempotente. Su `public/Campagna.md` produce 10 `plot_threads`: 1 profezia, 1 verita' campagna sui Sigilli/Vascelli, 7 arc personali PG e 1 macro-arc con 4 capitoli. Estrae 6 `sessions` con date ISO, `recap` pubblico e `prepNotes` privati; i blocchi `🔒` interleaved vengono rimossi dal recap e contati come note GM (5 note nei plot thread, 13 nelle sessioni). Test unitari su materiale reale verificano Profezia, Azazel, Macro-Trama e split delle Sessioni 2/5._
- [x] Parser per `Background Personaggi.md` → `entities` (type=pc) con properties popolate
  - _Note implementative: aggiunto parser puro `parseSherdanPcMarkdown` in `src/lib/parsers/sherdan-pc.ts`, come import-plan per la pipeline idempotente. Su `public/Background Personaggi.md` produce 7 entita' `pc` con properties validate da Zod (`race`, `class`, `subclass`, `level`, `age`, `backstory`, `arc_personale`, tratti, legami, difetti, motivazioni, goals, voce/frasi tipiche e appearance dove disponibili). Estrae 15 identita'/alias totali, inclusi `Alyne` per Althea, `Uomo di ferro` per Axton e le identita' preferite di Noel/Yancarlos. Il livello non e' presente nel sorgente: viene inferito a 1 e segnalato come warning per ciascun PG. Test unitari su materiale reale verificano Althea, Axton, Noel, Azazel e Bellamy._
- [x] Parser per `Manuale del Giocatore.md` → contenuto a parte (probabilmente regole homebrew → `rule_documents` con source='custom')
  - _Note implementative: aggiunto parser puro `parseSherdanPlayerManualMarkdown` in `src/lib/parsers/sherdan-player-manual.ts`, come import-plan per `rule_documents` con `source='sherdan-custom'`. Ripulisce il formato Homebrewery/NaturalCrit (`{{...}}`, `\page`, `\column`, immagini, HTML inline, separatori grafici) e conserva solo sezioni testuali con metadata di provenienza. Su `public/Manuale del Giocatore.md` produce 47 chunk ordinati e indicizzabili: 3 history, 3 geography, 9 seas, 27 cities, 5 pantheon. Ogni chunk include `title`, `section`, `content`, `chunkIndex`, `metadata.path`, `chapter`, `heading_line`, categoria e word count. Test unitari verificano Obsidium, Tharros, Mitra, pulizia markup e conteggi per categoria._

**Pipeline**
- [x] Script di import idempotente: posso rieseguirlo e aggiorna invece di duplicare
  - _Note implementative: aggiunto `scripts/bootstrap-sherdan.ts` con script `pnpm db:bootstrap:sherdan`, piu' piano puro testabile `buildSherdanBootstrapPlan` in `src/lib/import/sherdan-bootstrap-plan.ts`. Primo passaggio idempotente: assicura la campagna "Sherdan", crea/aggiorna 153 entita' (PC, NPC, fazioni, luogotenenti, lore), 81 identita', 56 segreti, 6 sessioni, 10 plot thread, 47 rule documents e 70 assegnazioni `pc_hooks` concrete da 58 righe sorgente. Gli hook PG risolvono nomi brevi, identita'/alias e gruppi (`Tutti` -> tutti i 7 PG) tramite `resolvePcHookEntityKeys`. Le relazioni name-based restano volutamente `deferredLinks` (45) per il task successivo di cross-reference. Verifica live con Docker/Postgres: rerun idempotente senza duplicati (`entitiesCreated: 0`, `entitiesUpdated: 153`, `identitiesUpdated: 81`, `secretsSkipped: 56`, `sessionsUpdated: 6`, `plotThreadsUpdated: 10`, `ruleDocumentsUpdated: 47`, `pcHooksExisting: 70`, `pcHooksUnresolved: 0`)._
- [x] Risoluzione cross-reference: dopo il primo passaggio (creazione entità), un secondo passaggio risolve i `[[wikilink]]` e i riferimenti tipo "vedi NPC §60" creando `entity_links`
  - _Note implementative: il piano `buildSherdanBootstrapPlan` ora conserva sorgente e alias delle entita' e produce `entityLinks`/`unresolvedLinks` oltre ai `deferredLinks` grezzi. La risoluzione copre le 45 relazioni tabellari da NPC/Fazioni piu' i riferimenti testuali `§`/`#` risolvibili; import live con `pnpm db:bootstrap:sherdan`: prima esecuzione `entityLinksCreated: 45`, seconda esecuzione idempotente `entityLinksCreated: 0`, `entityLinksUpdated: 45`. Restano 3 unresolved intenzionali per il report di import: `Tutte`, `Occhi di Vetro (Tharros)` e `NPC.md §60`, perche' non corrispondono a una singola entita' importata._
- [x] Generazione embeddings per tutte le entità importate (per la Fase 3 in poi)
  - _Note implementative: aggiunto `pnpm db:embed:sherdan` (`scripts/embed-sherdan-entities.ts`) per generare embedding idempotenti sulle entita' Sherdan importate (`tag=sherdan-import`) usando sempre Ollama `mxbai-embed-large` e validando `vector(1024)`. Il testo embeddabile e' costruito da `buildEntityEmbeddingText` con sintesi corta di nome, tipo, tag, descrizioni e properties, troncata a 900 caratteri per restare nel context del modello. Verifica live: prima passata reale `entitiesEmbedded: 1` + `entitiesEmbedded: 150`, poi rerun idempotente `entitiesSkipped: 151`, `entitiesEmbedded: 0`; check DB: 151/151 entita' importate con embedding presente e dimensione 1024._
- [x] Report di import: cosa è stato creato, cosa è stato skippato, warning su strutture non riconosciute
  - _Note implementative: aggiunto `pnpm db:report:sherdan` (`scripts/report-sherdan-import.ts`) e builder puro `buildSherdanImportReport`/`renderSherdanImportReportMarkdown` in `src/lib/import/sherdan-import-report.ts`. Il report viene generato in `docs/sherdan-import-report.md` e confronta piano parser vs DB: 153 righe entity pianificate, 151 record unici/persistiti, 81 identita', 56 segreti, 58 righe PC hook / 70 assegnazioni `pc_hooks`, 45 `entity_links`, 6 sessioni, 10 plot thread, 47 rule documents e 151/151 embedding presenti. Evidenzia anche skipped/unresolved: 2 righe entity duplicate del piano (`npc:Razza:`, `npc:Aspetto:`), 3 entity link unresolved, 0 PC hook unresolved e 107 warning parser._

**Validazione**
- [x] Apri il Wiki dopo l'import e verifica che le ~50 entità di Sherdan siano navigabili
- [x] Verifica che i `🔒` siano nel posto giusto (verità GM, non public)
- [x] Verifica che le identità multiple di Malakor siano modellate correttamente
- [x] Verifica che i segreti stratificati siano distribuiti sui tre layer
- [x] Verifica che gli Agganci PG siano tutti popolati come `pc_hooks`
  - _Note validazione: aggiunto `pnpm db:validate:sherdan` (`scripts/validate-sherdan-phase-1-5.ts`) con report in `docs/sherdan-phase-1-5-validation.md`. Tutti i 6 check passano: 151 entita' importate, 6 sessioni, marker privati assenti da `publicDescription` e presenti solo nelle descrizioni GM, Malakor/Dante e Noel/Yancarlos/Lust modellati, segreti distribuiti su `surface=13`, `intermediate=13`, `deep=30`, e 70 `pc_hooks` persistiti. Smoke UI/API su Next dev temporaneo `:3050`: `/api/campaigns`, `/api/entities`, `/campaigns/[id]`, focus Malakor/tab identita' e tab Hooks PG tutti 200; pagina identities contiene `Dante Il Fortunato`._

### Definition of done
Apri il Wiki, vedi la campagna Sherdan completa: NPC con tic/dettagli sensoriali/voce/segreti stratificati, fazioni con luogotenenti, plot threads attivi, sessioni 1-6 con recap, identità doppie modellate (Malakor↔Dante, Noel↔Yancarlos↔Lust), PC hooks visibili sulla scheda di ogni PG. Lo script è ri-eseguibile senza duplicare nulla.

> 💡 **Bonus opportunity**: durante questa fase quasi sicuramente troverai 2-3 cose che lo schema attuale non gestisce bene. Aggiusta lo schema **adesso** che il debito tecnico è zero, non dopo.

---

## Fase 2 — Random Tables Engine ✅

**Durata**: 5-7 giorni · **Tool sbloccato**: ✅ Random Tables Engine · **Chiusa il 2026-05-08**

### Goal
Motore generale per random tables con supporto nesting, riusato da tutti i generators successivi.

### Task

**Logic core**
- [x] Roller library: parsing entries JSONB, weighted/uniform roll, nested sub-roll resolution
  - _Note implementative: aggiunta libreria pura `src/lib/random-tables/roller.ts` (barrel `src/lib/random-tables/index.ts`). `randomTableEntriesSchema` valida il JSONB `entries` con Zod, normalizza `weight` mancante a 1, supporta `subTableId`/`sub_table_id` e conserva `templateVars` per il task successivo. `rollRandomTable` usa RNG iniettato per test deterministici, produce `trace` completo (`threshold`, `totalWeight`, entry scelta, nested trace), risolve sub-table via callback async, rileva circular refs e applica depth limit. Test unitari coprono uniform, weighted, nested, shape invalide, RNG fuori range, circular refs e depth limit._
- [x] Template interpolation: `"Taverniere {name}, {attitude}"` → roll su sub-tables → substitute
  - _Note implementative: `rollRandomTable` ora intercetta `value` stringa con placeholder `{var}` e usa `templateVars`/`template_vars` per risolvere ogni variabile tramite sub-table. Le variabili ripetute vengono tirate una sola volta per risultato, il valore viene sostituito in tutte le occorrenze e la trace include `template` con risultato finale e sub-trace per ogni variabile. Errori espliciti per variabili non mappate, sub-table mancanti e cicli anche via template (`a -> b -> a`). Test unitari aggiunti su interpolazione, variabili ripetute, circular template refs e missing mappings._
- [x] Test coverage approfondita (logica nidificata = circular refs, depth limit, edge case sui weights)
  - _Note implementative: ampliata `tests/unit/random-tables/roller.test.ts` a 18 casi sul core: pesi frazionari, boundary esatto su soglie cumulative, pesi 0/negativi/NaN, entry con chiavi extra, sub-table senza resolver, sub-table mancante, resolver async, cicli diretti e cicli lunghi (`a -> b -> c -> a`), depth limit su sub-roll diretto e via template. La suite random tables resta deterministica tramite RNG iniettato._

**Backend**
- [x] CRUD `random_tables`
  - _Note implementative: aggiunte route `GET/POST /api/random-tables` e `GET/PATCH/DELETE /api/random-tables/[id]`, con filtri `campaign_id`, `tag`, `search`, `sort=name_asc|updated_desc`, `limit`, `offset`. La validazione vive in `src/lib/validation/random-table-input.ts` e riusa `randomTableEntriesSchema` del roller, quindi il JSONB `entries` viene normalizzato allo stesso formato usato dal core. PATCH aggiorna solo i campi presenti (fix verificato: `tags` non defaulta a `[]` se assente). Smoke HTTP live su Next dev temporaneo `:3051`: create 201, list filtrata, get 200, patch 200 con tag preservati, delete 204._
- [x] Endpoint `POST /tables/:id/roll` → ritorna risultato + traccia dei sub-roll
  - _Note implementative: aggiunto `POST /api/random-tables/[id]/roll` con body opzionale `{ maxDepth }` validato da `rollRandomTableInputSchema`. L'endpoint carica la tabella root dal DB, risolve sub-table/template vars via lookup async su `random_tables.id`, ritorna `RandomTableRollResult` completo (`value` + trace nested/template) e converte `RandomTableRollError` in 400 con `rollErrorCode`. Fix emerso da smoke: `randomTableEntriesSchema` ora accetta anche la forma normalizzata persistita (`label: null`, `subTableId: null`) oltre alla forma raw. Smoke HTTP live su Next dev temporaneo `:3052`: create sub-table + root template, `POST /roll` 200 con `Taverniere Mara, guardinga`, trace template e cleanup delete 204._
- [x] Schema validation degli `entries` JSONB
  - _Note implementative: rafforzato `randomTableEntriesSchema` come contratto unico per CRUD e roller. Valida forma raw e forma normalizzata persistita, rifiuta entry senza `value`/`subTableId`, pesi non positivi/non finiti, chiavi extra, alias conflittuali (`subTableId` vs `sub_table_id`, `templateVars` vs `template_vars`) e template string con placeholder non mappati in `templateVars`. Smoke HTTP live su Next dev temporaneo `:3053`: `POST /api/random-tables` con `value="Oste {name}"` senza mapping viene rifiutato con 400 `validation_failed`._

**Frontend**
- [x] Editor: form per entries singole, oppure JSON/YAML editor avanzato
  - _Note implementative: aggiunta pagina `src/app/random-tables/page.tsx` con workbench client `RandomTablesWorkbench`. Editor centrale con campi `name`, `description`, `tags` comma-separated e textarea JSON per `entries`, collegato a `POST/PATCH/DELETE /api/random-tables`. La sidebar ora linka `Random Tables` a `/random-tables`._
- [x] Roll button con history sticky
  - _Note implementative: il pannello destro della pagina Random Tables chiama `POST /api/random-tables/[id]/roll`, mostra il valore prodotto e mantiene history locale degli ultimi 12 risultati con sintesi della trace nested/template. Il pannello resta sticky su desktop._
- [x] Filtro per tag
  - _Note implementative: la colonna library include filtri client-side-backed-by-API per `search`, `tag` e ordinamento `name_asc|updated_desc`, usando query params gia' supportati dal CRUD._
- [x] Import: CSV, Markdown bullet list, JSON
  - _Note implementative: aggiunto parser puro `parseRandomTableImport` in `src/lib/random-tables/importer.ts`, esportato dal barrel random tables e coperto da test unitari. Supporta import JSON (array o oggetto `{ entries }`), Markdown con bullet/numbered list e pesi inline, CSV con header o colonne posizionali, valori quotati e `templateVars`. Il workbench `/random-tables` ora include un pannello Import con formato Auto/JSON/Markdown/CSV: l'import normalizza gli entries via lo stesso Zod schema del roller e aggiorna il draft JSON senza salvare automaticamente._
- [x] Library view: tutte le tabelle filtrate per tag
  - _Note implementative: colonna sinistra con lista filtrata delle tabelle, selezione immediata, badge testuali dei tag e stato empty/loading. La selezione aggiorna il draft senza effect derivati, per rispettare lint React hooks._
- [x] (scoperto durante completamento Fase 2) Salvataggio rapido del risultato roll come entity
  - _Note implementative: il pannello History ora puo' salvare un roll come entity nella campagna selezionata. Supporta tipi rapidi `item`, `npc` e `location`, costruendo properties minime valide per gli Zod schema type-specific e conservando valore + trace in `properties.extra.random_table_roll`. Smoke API live: roll da `Sherdan - NPC Spark`, creazione entity temporanea e cleanup DELETE riusciti._

**Seed data**
- [x] Importa tabelle public-domain: nomi (varie razze), atteggiamenti, taverne, eventi viaggio, complicazioni urbane
  - _Note implementative: aggiunte definizioni seed pure in `src/lib/random-tables/seed-data.ts` e script idempotente `pnpm db:seed:tables`. Seed globali public-domain: nomi umani/elfici/nanici/halfling, picker nested dei nomi, atteggiamenti NPC, nomi taverna via template, eventi viaggio, complicazioni urbane e meteo. Lo script usa due pass per risolvere `subTableId`/`templateVars` su UUID reali e aggiorna righe esistenti per nome+campagna senza creare duplicati._
- [x] **Tabelle in stile Sherdan**: tic NPC, dettagli sensoriali (vista/odore/suono), accenti regionali, segreti di strato superficiale tipici, hook narrativi base. Estratti dal dataset di Bootstrap.
  - _Note implementative: lo stesso seed include tabelle campaign-scoped su Sherdan per tic NPC, vista/odore/suono, accenti regionali, segreti surface, hook narrativi, presagi di Obsidium, pressioni di fazione, difetti tecnici tharrosiani, tensioni arboreane, complicazioni viaggio e due template pronti (`Sherdan - NPC Spark`, `Sherdan - Scene Spark`). Verificato live: `pnpm db:seed:tables` crea 26 tabelle al primo giro e al secondo resta idempotente (`0 create, 26 update`)._

### Definition of done
Hai 20+ tabelle, tiri con nesting, salvi i risultati al volo come entità (es. "questo NPC tirato lo voglio salvare nel wiki"). ✅

---

## Fase 3 — Generator Framework + NPC Generator

**Durata**: 12-16 giorni · **Tool sbloccato**: ✅ NPC Generator (+ infrastruttura per i generators successivi)

### Goal
Framework riutilizzabile per tutti i generators, prima implementazione concreta con NPC Generator **calibrato sullo stile Sherdan**.

### Task

**Generator Framework**
- [x] Interfaccia `Generator<Input, Output>`: `validateInput`, `buildContext`, `buildPrompt`, `call`, `validateOutput`, `persist`
  - _Note implementative: aggiunto framework base in `src/lib/generators/` con interfaccia generic `Generator<Input, Output, Context, Persisted>`, `GeneratorPrompt`, `GeneratorRunOptions`, `runGenerator` e `GeneratorPipelineError` stage-aware. Il runner esegue la pipeline nell'ordine `validateInput -> buildContext -> buildPrompt -> call -> validateOutput -> persist`, supporta preview con `persist: false`, passa provider LLM/opzioni a ogni stage e wrappa gli errori con nome generator + stage. Test unitari coprono ordine, skip persist e wrapping degli errori._
- [x] `ContextRetriever`: dato un entity_id ancorante, recupera entità correlate (per relazione + per similarità semantica via embedding) — *include identità multiple e segreti rilevanti come contesto*
  - _Note implementative: aggiunto `ContextRetriever` in `src/lib/generators/context-retriever.ts`, con store astratto testabile e store Drizzle di default. Dato un `anchorEntityId`, recupera l'anchor, relazioni incoming/outgoing ordinate per strength, entity correlate, similarità semantica via pgvector (`embedding <=> anchorEmbedding`), identità multiple e segreti filtrabili per layer. Il risultato deduplica entity presenti sia nei link sia nella similarity search e annota le fonti (`anchor`, `relation`, `similarity`), direzione dei link e score/distance. Test unitari coprono relazione uscente/entrante, deduplica relation+similarity, identità, segreti, skip similarity senza embedding e input invalidi. Smoke DB live su Sherdan: anchor `Althea`, 3 similar, 4 entity totali, 5 identità incluse._
- [x] `PromptBuilder`: template engine con substitution (entità → markdown blocks nel prompt)
  - _Note implementative: aggiunto `PromptBuilder` in `src/lib/generators/prompt-builder.ts`. Supporta template `system`/`user`, opzioni LLM, variabili custom e placeholder built-in `{{anchor}}`, `{{related}}`, `{{similar}}`, `{{entities}}`, `{{context}}`, `{{relations}}`, piu' `{{entity:Nome-o-id}}`. Le entity del `ContextRetriever` vengono renderizzate come markdown blocks con id/type/visibility/sources/tags, public description, GM description, properties JSON, identità multiple, segreti stratificati e relazioni con direzione/strength. Errori tipizzati `PromptBuilderError` per placeholder sconosciuti o entity mancanti; modalita' non strict disponibile per lasciare placeholder non risolti. Test unitari coprono render markdown, sostituzioni, entity lookup e errori._
- [x] `StyleCalibrator`: dato il set di entità di una campagna, estrae feature stilistiche (lunghezza media descrizioni, presenza di tic/sensorialità/segreti stratificati, tono) e le inietta nel prompt come few-shot examples
  - _Note implementative: aggiunto `StyleCalibrator` in `src/lib/generators/style-calibrator.ts`. Analizza entity di campagna senza dipendere dal DB: statistiche lunghezza descrizioni, mix type, presenza di sensory details/voice/tics/goals/weaknesses/public description, conteggio segreti per layer e segnali tonali euristici (grimdark, intrigo politico, arcano-industriale, multi-sensoriale). Produce `StyleCalibrationResult` con `profile`, few-shot examples scelti per ricchezza stilistica e `promptBlock` markdown iniettabile nel `PromptBuilder` via `styleCalibrationToPromptVariables`. Test unitari coprono feature extraction, example selection, prompt block e profilo vuoto. Smoke DB live su 40 entity Sherdan: average 714 parole, tone signals `sensory`, `industrial_arcane`, `grimdark`, examples `Capitana Lunacupa "La Vedova"` e `Comandante Ivar`._
- [x] LLM call con structured output: schema Zod/Pydantic → JSON Schema → tool call
  - _Note implementative: aggiunto `StructuredOutputCaller` in `src/lib/generators/structured-output.ts`. Incapsula `GeneratorPrompt + Zod schema`, converte lo schema con `z.toJSONSchema()` per metadata/tracciabilità, chiama `LLMProvider.completeStructured` (Gemini `responseSchema` / Ollama `format`) e ri-valida l'output via Zod prima di restituirlo. Helper `callStructuredOutput` integra `GeneratorRunOptions.llm/signal`, defaulta `temperature: 0` per path strutturati e mergea opzioni prompt/call. Test unitari con provider finto coprono input/options, JSON Schema metadata, uso da run options e errore tipizzato `StructuredOutputCallError` su output invalido._
- [x] `generation_log` table: input, prompt, output, model, tokens, cost, timestamp
  - _Note implementative: aggiunta tabella `generation_log` via Drizzle (`src/db/schema/generators.ts`) e migration `0001_minor_roxanne_simpson.sql`. Campi core: `input`, `prompt`, `output`, `model`, token usage (`input_tokens`, `output_tokens`, `total_tokens`), `cost_usd`, `created_at`; campi operativi minimi: `campaign_id` nullable con FK `ON DELETE SET NULL`, `generator_name`, `provider`, `status`, `error`, `metadata`. Indici su campagna, generator, status e timestamp per audit/cost monitoring. Applicata migration locale e smoke insert/delete verificato con JSONB + `numeric(12,6)`._
- [x] Retry logic + fallback chain (provider primario → secondario)
  - _Note implementative: esteso `RoutedProvider` con retry automatico su errori transient (`network`, `429`, `5xx`) prima di passare dal provider primario al fallback. Default: 2 retry con backoff 250ms → 500ms, cap 1000ms; configurabile/iniettabile nei test. Il fallback viene ritentato con la stessa policy. Nessun retry/fallback su errori non transient (es. `400`) o `AbortSignal` già abortito. Per lo streaming, retry/fallback avvengono solo prima del primo chunk per evitare output duplicato. Test unitari dedicati in `tests/unit/llm/router.test.ts` coprono complete, structured output e stream._
- [x] Streaming support (utile in Fase 7)
  - _Note implementative: aggiunto `TextStreamCaller` in `src/lib/generators/streaming.ts`, con helper `streamText` e `collectStreamedText`. Accetta `GeneratorPrompt`, mergea opzioni prompt/call e `AbortSignal` come gli altri caller, chiama `LLMProvider.stream()` ed emette eventi `{ type: "chunk" }` con testo accumulato + `{ type: "done" }` con risultato finale (`text`, `input`, `options`). Supporta callback `onChunk` per UI/telemetria. Test unitari coprono eventi progressivi, collect finale, integrazione con `GeneratorRunOptions` e propagazione errori senza evento `done`._

**NPC Generator (stile Sherdan)**
- [ ] Form input: tipo (taverniere, guardia, mercante, nobile, capitano, infiltrato, …), location_id, party_level, tone (serio/comico/cupo/grimdark), **livello narrativo** (comparsa/secondario/principale — determina quanto in profondità generare)
- [ ] Context retrieval: location + fazioni nel raggio + NPC esistenti vicini (per evitare doppioni) + tono e stile della campagna estratto dalle entità esistenti
- [ ] Prompt template specifico Sherdan-style: richiede output con tic, sensory_details (vista/odore/suono), voice, weaknesses (con who_could_exploit), goals stratificati (short/medium/long), e — per NPC principali — segreti su tre layer
- [ ] Output schema: NPC `properties` completo come da NPCPropertiesSchema sopra
- [ ] Preview UI con possibilità di re-roll campi singoli (nome, voce, segreto layer X, …)
- [ ] "Save as Entity" → crea entity type='npc' con properties popolate
- [ ] Genera embedding al save per future similarity searches
- [ ] **Modalità "in stile X"**: opzione di generare un NPC che imita lo stile di un NPC esistente (es. "in stile Lunacupa" = ferito carismatico con codice morale rigido + segreto familiare)

### Definition of done
Generi un NPC contestuale a Sherdan, lo confronti con quelli che hai scritto a mano (Lunacupa, Rotella, Ivar) e la qualità è paragonabile. Lo modifichi, lo salvi nel wiki, lo trovi cercandolo per similarità ("dammi NPC simili a Garrick").

---

## Fase 4 — Loot Generator

**Durata**: 5-7 giorni · **Tool sbloccato**: ✅ Loot Generator

### Goal
Riusare il generator framework per produrre loot bundles narrativamente coerenti.

### Task
- [ ] Tabelle DMG per gold base (per CR / livello)
- [ ] LootGenerator: input context (sorgente: bandit/dragon/merchant/setta/vincolatore/…), party_level, narrative_density (sobrio/ricco)
- [ ] Algoritmo: gold deterministic da tabelle + items via LLM con context narrative — **inclusione di lore-references quando pertinente** (es. un cristallo di Obsidium grezzo da un agente di Tharros, una scheggia di pietra-Scissione da un membro dell'Eclissi)
- [ ] Resolve items: cerca items esistenti per similarità, riusa o crea nuovi
- [ ] UI: form input → preview bundle → save
- [ ] Link opzionale a Encounter (drop di un encounter specifico)

### Definition of done
Generi loot per un encounter, gli items hanno descrizioni narrative coerenti con la lore di Sherdan (se attiva), items magici nuovi diventano entity nel wiki.

---

## Fase 5 — Encounter Builder

**Durata**: 10-14 giorni · **Tool sbloccato**: ✅ Encounter Builder

### Goal
Builder completo con browser mostri, math di bilanciamento, e LLM-assist per ideazione.

### Task

**Pre-requisiti**
- [ ] Importer SRD monsters (open5e API o JSON dump) → entities type='monster' con statblock JSONB completo
- [ ] Browser mostri con filtri: CR range, type (umanoide/non morto/draconico…), environment, size

**Encounter logic**
- [ ] CR calculator (DMG encounter difficulty: XP threshold per livello/dimensione party, multipliers per gruppo)
- [ ] Suggester: input party_level/size/difficulty → composizioni candidate
- [ ] Difficulty meter live mentre componi

**LLM-assist**
- [ ] "Encounter di livello 5 in palude, tema corruzione" → composizione mostri + tactical notes
- [ ] Rispetta vincoli (CR target) usando il CR calculator come tool dell'agent
- [ ] **Include hook narrativi**: l'encounter può "essere usato come" rivelazione di una briciola di verità, complicazione di un plot thread, o aggancio per un PC specifico

**UI**
- [ ] Builder: cerca/aggiungi mostri, modifica count, mostra difficulty corrente
- [ ] Tactical notes editor
- [ ] Save con location_id link e plot_thread_id opzionale
- [ ] "Used in session" toggle

### Definition of done
Componi un encounter, vedi difficulty live, generi tactical notes, lo associ a una location, lo marchi come "usato" in una sessione.

---

## Fase 6 — Sessions & Plot Threads (con doppio arco)

**Durata**: 12-16 giorni · **Tool sbloccato**: ✅ Plot Thread Tracker, Truth Clue Tracker

### Goal
Dimensione temporale: sessioni con recap, plot threads con doppio arco (percepito vs reale), briciole di verità tracciate.

### Task

**Sessions**
- [ ] CRUD sessions con auto-numerazione
- [ ] Recap markdown editor con auto-detect entità menzionate (parsing wikilinks → SessionEntity)
- [ ] **Recap split**: campo `recap` (cosa è successo in fiction) e `dm_notes` (interpretazioni `🔒`, retcon, intuizioni private). Editor a due colonne.
- [ ] Pre-session "prep notes" separati dal recap
- [ ] "Previously on..." generator: LLM riassume recap precedente in stile cinematografico per giocatori — **usa solo il `recap`, mai i `dm_notes`**

**Plot Threads (doppio arco)**
- [ ] CRUD plot_threads con `description` (verità GM) e `public_description` (versione percepita dal party)
- [ ] PlotThreadEntity: assegna ruoli (instigator, victim, target, mcguffin, witness)
- [ ] PlotThreadEvent: timeline con event_type
- [ ] **Visualizzazione "split-screen"**: per ogni thread, due colonne sincronizzate temporalmente — ciò che il party crede stia succedendo vs ciò che sta realmente succedendo. Vedi a colpo d'occhio la divergenza/convergenza.
- [ ] Stale alerts: thread "hot" senza eventi da N sessioni → suggerisce demote a "warm" o "cold"

**Truth Clue Tracker**
- [ ] CRUD `truth_clues`
- [ ] UI dedicata: lista delle briciole filtrabile per status (planted/noticed/misinterpreted/understood/lost), per plot thread, per sessione
- [ ] "Plant a clue" workflow: crea briciola, collega a thread, indica in che sessione la introdurrai
- [ ] "Update status" workflow: dopo la sessione, aggiorni come il party l'ha colta
- [ ] Dashboard "verità rivelata" per thread: percentuale di briciole `understood` su totali → indica quanto il party è vicino alla verità di quel thread

**UI**
- [ ] Sessions list view, detail view con recap rendered + dm_notes toggle
- [ ] Plot Threads board: Kanban per status (hot/warm/cold/resolved/abandoned)
- [ ] Plot Thread detail: timeline orizzontale, doppio arco visibile, entità coinvolte con ruolo, briciole associate
- [ ] Visualizzazione cross: "questa entità è in N plot threads"

### Definition of done
Hai registrato 3-5 sessioni con recap + dm_notes, 5-10 plot threads tracciati con doppio arco, vedi la timeline, hai piantato 10+ briciole con stato aggiornato, ricevi alert su thread che si raffreddano.

---

## Fase 7 — Session Prep Assistant (con tool Sherdan-aware)

**Durata**: 12-16 giorni · **Tool sbloccato**: ✅ Session Prep Assistant

### Goal
Agent LLM che compone tutto il sistema: legge stato (incluse identità attive, briciole rivelate, plot threads doppi), propone hook/NPC/encounter calibrati sul momento narrativo della campagna, ti fa risparmiare ore di prep.

### Task

**Architettura agentic**
- [ ] Tool definitions per l'agent:
  - `search_entities(query, type?)`
  - `get_active_plot_threads(status_filter)`
  - `get_recent_sessions(n)`
  - `get_entity_details(id)` — restituisce solo verità GM se chiamato dall'agent prep
  - `get_active_identities()` — chi indossa quale maschera in questo momento della campagna
  - `get_truth_progress(plot_thread_id?)` — quante briciole understood su totali
  - `get_pc_hooks(pc_id?, status?)` — hook narrativi disponibili per i PG
  - `generate_npc(context)` (chiama il generator NPC interno)
  - `generate_encounter(context)`
  - `generate_loot(context)`
  - `rules_search(query)` (placeholder fino a Fase 9)
- [ ] System prompt: ruolo, principi DM, formato output, **istruzioni esplicite su come gestire propaganda vs verità** (l'agent deve sapere che la sessione è una performance dove il party riceve la versione percepita, ma il prep deve coordinare cosa rivelare gradualmente)
- [ ] Tool execution loop con safety (max iterations, timeout, cost cap per session)
- [ ] Streaming response per UX

**Workflow**
- [ ] Input DM: location corrente, "vibe" desiderato della sessione, focus opzionale (es. "voglio piantare due briciole sull'identità di Malakor")
- [ ] Agent legge contesto → propone:
  - 3 hook narrativi (preferendo PC hooks `available` non ancora usati)
  - 5 NPC pronti (alcuni esistenti riusati, alcuni nuovi)
  - 2 encounter bilanciati
  - "Previously on..." per giocatori (basato su `recap`, non `dm_notes`)
  - **Briciole suggerite**: dato lo stato attuale dei plot threads, propone N briciole da piantare, con descrizione e collegamento al thread
- [ ] DM rivede ogni proposta: accetta / rigetta / rigenera / modifica
- [ ] Pezzi accettati → persistiti come entities/encounters/sessions.prep_notes/truth_clues

**UI**
- [ ] Pagina prep dedicata con sezioni espandibili
- [ ] Streaming: vedi l'agent "pensare" e produrre risultati
- [ ] Trace view (debug): quali tool ha chiamato, con quali parametri

### Definition of done
Esegui prep di una sessione di Sherdan in 10-15 minuti invece di 2 ore. Le proposte sono coerenti con lo stato attuale (Malakor è ancora Dante, le briciole non rivelate non vengono accidentalmente esposte, gli hook scelti sono per i PG che non hanno avuto spotlight di recente). Accetti le proposte buone, scarti le scarse, lo stato della campagna si aggiorna automaticamente.

---

## Fase 8 — Procedural Dungeon Generator

**Durata**: 10-14 giorni · **Tool sbloccato**: ✅ Procedural Dungeon Generator

### Goal
Generatore algoritmico di dungeon con contenuto narrativo coerente.

### Task

**Layout**
- [ ] Algoritmo scelto (graph-based, BSP, o cellular automata): produce nodes + edges
- [ ] Parametri: dimensione, densità, complessità, theme
- [ ] Validazione: connessione completa, no rooms isolate

**Content per room**
- [ ] LLM-assist: dato theme + room type → descrizione, encounter possibile, trap, treasure, lore
- [ ] Coerenza tematica: tutte le room consistenti con il theme generale
- [ ] Identifica boss room, treasure room, trick room basandosi sul layout
- [ ] **Stile-coerenza con la campagna**: usa StyleCalibrator (Fase 3) per generare descrizioni room nello stile della campagna corrente

**Render**
- [ ] SVG/Canvas mappa con room IDs cliccabili
- [ ] Click su room → side panel con dettaglio

**Persistence**
- [ ] Save root come entity type='location', kind='dungeon', con map_data in properties
- [ ] Save ogni room come entity figlia con parent_id
- [ ] Encounter pre-generati salvati e linkati alle room

### Definition of done
Generi un dungeon di 15 room, vedi la mappa, ogni room ha contenuto coerente con lo stile Sherdan se generato in quella campagna, tutto è salvato come grafo di entities navigabile dal Wiki.

---

## Fase 9 — Rules Lookup (RAG)

**Durata**: 7-10 giorni · **Tool sbloccato**: ✅ Rules Lookup

### Goal
Q&A sulle regole con citazioni accurate. Bonus: integrazione come tool dell'agent prep, **incluso il manuale del giocatore homebrew di Sherdan**.

### Task

**Ingestion**
- [ ] Loader per SRD (markdown o JSON da open source repos)
- [ ] **Loader per manuali homebrew di Sherdan** (`Manuale del Giocatore.md`, `La Forgia di Sherdan.md`) — già parsati in Fase 1.5, qui li indicizzi come `rule_documents` con source='sherdan-custom'
- [ ] Chunking semantico: split per sezione, max ~500 token con overlap
- [ ] Embedding generation in batch
- [ ] Storage con metadata (source, section, page)

**Search**
- [ ] Hybrid search: BM25 (FTS Postgres) + vector cosine, RRF (reciprocal rank fusion) per merging
- [ ] Re-ranker opzionale (Cohere rerank o LLM-based) per query difficili
- [ ] Filtro per source (solo SRD / solo Sherdan custom / entrambi)

**Q&A**
- [ ] UI: input domanda, risposta in markdown con citazioni inline
- [ ] Citazioni cliccabili → espandono il chunk originale
- [ ] History delle query

**Integrazione**
- [ ] Esposto come tool `rules_search` all'agent prep (Fase 7)
- [ ] Bottone "ask the rules" globale (Cmd-Shift-R)

### Definition of done
Chiedi "se un mago invisibile lancia palla di fuoco rimane invisibile?", ricevi risposta corretta con citazione PHB. Chiedi "come funziona il crafting di Obsidium raffinato a Sherdan?", ricevi risposta dal Manuale del Giocatore custom.

---

## Fase 10 — Player Dashboard (con visibilità granulare)

**Durata**: 12-16 giorni · **Tool sbloccato**: ✅ Player Dashboard

### Goal
Vista real-time per i giocatori, controllata dal DM, **con controllo granulare di cosa esporre**: per ogni entità il DM sceglie se mostrare la `public_description` (propaganda), la `description` filtrata su segreti `discovered`, o niente.

### Task

**Real-time setup**
- [ ] WebSocket server (Socket.io o nativo Next.js con ws)
- [ ] Channel per campagna
- [ ] Auth lightweight: token URL signed per giocatore (no account)

**DM control panel**
- [ ] Toggle visibility di entity (dm_only ↔ discovered ↔ public)
- [ ] **Per ogni entity esposta, sub-toggle**: "mostra public_description" / "mostra description con segreti `discovered`" / "mostra solo nome e tipo"
- [ ] Pannello "scena corrente": testo descrittivo + immagine + entità in scena
- [ ] Push button per inviare update ai giocatori
- [ ] Mappa con fog of war: rivela aree (rect / freehand)
- [ ] Push handout (immagine, testo lungo, audio?)
- [ ] **"Anteprima vista giocatore"**: il DM può vedere esattamente cosa stanno vedendo i giocatori in questo momento

**Player view**
- [ ] Read-only, mobile-first
- [ ] Sezioni: scena corrente, NPC conosciuti, luoghi visitati, mappa, handouts
- [ ] Notifiche di nuove rivelazioni ("Hai scoperto: Garrick il Sussurratore")
- [ ] Initiative tracker in evidenza durante combattimento (se mai aggiungerai initiative)

**Deploy**
- [ ] Tailscale per esporre la web app ai giocatori da remoto
- [ ] O Cloudflare Tunnel se preferisci HTTPS pubblico

### Definition of done
Apri la sessione, i giocatori si connettono dal cellulare, vedono la scena, scopri un NPC, lo vedono apparire nella loro lista in tempo reale — ma vedono solo `public_description` finché non sbloccano segreti `discovered`. Anteprima DM concorde con quello che vedono i giocatori.

---

## Fase 11 — Polish & integrazione (ongoing)

- [ ] Global search (entities + sessions + plot threads + rules + truth_clues) con Cmd-K
- [ ] Command palette per quick actions
- [ ] Backup automatico campagna (JSON dump + media)
- [ ] Import/export (per migrazioni, per condividere)
- [ ] Re-export verso Markdown nello stesso formato dei file originali (così la repo `public/` resta in sync con il sistema, opzionalmente)
- [ ] Mobile responsive su tutto
- [ ] Theme dark/light
- [ ] Performance: paginazione liste, lazy loading, query optimization
- [ ] Cost monitoring LLM con alerting

---

## Cross-cutting concerns (spalmati su tutte le fasi)

- **Test**: minimum unit test su roller logic, CR calculator, validation schemas, parser Sherdan (Fase 1.5). Integration test su API CRUD.
- **Migrations**: sempre additive (`ADD COLUMN NULLABLE` → backfill → eventuale `NOT NULL` in migration successiva).
- **Observability**: log strutturati con request_id, metriche LLM (tokens, latency, cost) per detectare regressioni.
- **Security**: anche se single-user, il Player Dashboard espone una surface esterna. Token signed, rate limiting, CORS stretto.
- **Backup**: cron quotidiano `pg_dump` + sync su cloud storage personale.
- **Documentation**: ogni fase aggiorna README + un breve "decisions log" (perché hai scelto X invece di Y).

---

## Timeline visiva (stima v2)

| Settimana | Fase | Tool sbloccato |
|-----------|------|----------------|
| 1 | Fase 0 | infrastruttura |
| 2-4 | Fase 1 | Campaign Wiki |
| 4-5 | **Fase 1.5 ⭐** | **Bootstrap Sherdan (dataset reale)** |
| 5-6 | Fase 2 | Random Tables |
| 7-8 | Fase 3 | NPC Generator |
| 9 | Fase 4 | Loot Generator |
| 10-11 | Fase 5 | Encounter Builder |
| 12-13 | Fase 6 | Plot Thread Tracker + Truth Clue Tracker |
| 14-15 | Fase 7 | Session Prep Assistant |
| 16-17 | Fase 8 | Dungeon Generator |
| 18 | Fase 9 | Rules Lookup |
| 19-20 | Fase 10 | Player Dashboard |
| 21+ | Fase 11 | Polish ongoing |

A 10-15h/settimana sei "feature-complete" in ~5-6 mesi. Più realisticamente 6-7 mesi tenendo conto di vita, blocchi tecnici, e sessioni di gioco da masterare con quello che hai costruito finora.

---

## Suggerimenti di esecuzione

1. **Non saltare Fase 0**. La tentazione di "lo aggiusto dopo" su logging, validation, schema migrations crea debito che ti rallenta dalla Fase 3 in poi.
2. **Non saltare Fase 1.5**. Il bootstrap è il momento in cui scoprirai cosa lo schema non gestisce bene. Aggiusta lì, dove il debito tecnico è ancora zero.
3. **Usa la piattaforma mentre la costruisci**. A partire dalla Fase 1.5, masterizza Sherdan con quello che hai. Trovi i bug che contano e mantieni la motivazione alta.
4. **Resisti allo scope creep**. Se durante Fase 5 ti viene voglia di aggiungere initiative tracker, scrivilo nel backlog ma non implementarlo.
5. **Refactoring sì, redesign no**. Lo schema dati v2 è progettato per durare. I refactor di codice sono attesi e benvenuti. Re-disegnare lo schema a metà progetto significa che hai sbagliato qualcosa altrove.
6. **Genera SRD una volta sola**. L'import dei monsters (Fase 5) e delle rules (Fase 9) sono one-off. Non spendere giorni a fare loader perfetti — basta che funzionino.
7. **Audit ogni 4 settimane**. Una volta al mese ferma lo sviluppo per mezza giornata e rivedi: cosa funziona, cosa non uso, cosa sta diventando complicato. Aggiusta il piano se serve, senza sensi di colpa.
8. **Documenta i pattern di Sherdan come decisioni esplicite**. Ogni volta che un pattern della tua campagna influenza lo schema o un tool, scrivilo nel decisions log. Quando masterizzerai una seconda campagna con caratteristiche diverse (magari più semplice, senza segreti stratificati), saprai cosa è "feature di prodotto" e cosa è "specifico di Sherdan da rendere opzionale".
