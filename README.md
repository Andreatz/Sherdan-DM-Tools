# Sherdan DM Tools

Toolkit locale per Dungeon Master dedicato alla campagna D&D 5e homebrew **Sherdan**.

Sherdan DM Tools trasforma l'archivio markdown della campagna in uno spazio di lavoro strutturato: wiki, grafo entità, segreti stratificati, identità multiple, hook dei PG, sessioni, thread narrativi, tabelle casuali e generatori assistiti da LLM.

Il progetto nasce Sherdan-first, ma l'architettura è pensata per poter diventare in futuro una base riusabile per campagne D&D/TTRPG narrative molto dense.

---

## Stato attuale

Il progetto non è più fermo alla Fase 1. La base, la Campaign Wiki, l'import Sherdan, la sicurezza dei contenuti raw, il motore di Random Tables e i primi generatori sono già presenti. Alcune aree sono però ancora beta o solo predisposte a livello schema.

Vocabolario stato (sidebar, `/status`, README usano gli stessi cinque valori):

- **Pronto** – feature usabile end-to-end, UI inclusa.
- **Beta** – usabile ma con rifiniture o limitazioni note.
- **Schema** – DB/API predisposti, UI dedicata ancora da costruire.
- **Pianificato** – non iniziato.
- **Bloccato** – volontariamente fermo finché una precondizione non è soddisfatta.

| Area | Stato | Nota |
|---|---|---|
| Foundation progetto | Pronto | Next.js, TypeScript, DB, logging, env check, CI |
| Campaign Wiki | Pronto | CRUD entità, identità, segreti, link, tag e PC hooks |
| Grafo entità | Pronto | Visualizzazione relazioni tra entità |
| Import Sherdan | Pronto | Parser + bootstrap idempotente dei markdown privati |
| Content safety gate | Pronto | Blocca markdown Sherdan raw in `public/` |
| Random Tables Engine | Pronto | CRUD, import, roll, subtabelle, template e history locale |
| NPC Generator | Pronto | Preview, re-roll parziale, salvataggio entity, embedding fail-forward + `pnpm db:embed:backfill`, link "Storico generazioni LLM" nella entity detail |
| Loot Generator | Pronto | Generatore + salvataggio + link a encounter/sessione, lista bundle filtrabile per campagna/sessione/encounter |
| Encounter Builder | Pronto | Browser mostri, CR calculator, LLM assist, marker "usato in sessione", lista filtrabile per sessione/location/plot |
| Player Dashboard | Pronto | Per-player codici hashati, scoping per campagna, rate limit, audit log, leakage tests, override (entity/truth_clue/entity_secret) con UI DM, smoke E2E Playwright |
| Truth Clue Tracker | Pronto | CRUD briciole, filtri per status/thread/sessione, plant/update status, dashboard verità rivelata per thread |
| Plot Thread Tracker | Pronto | Kanban hot/warm/cold/resolved/abandoned, split-screen GM vs percepito, timeline eventi, entita per ruolo, briciole correlate, stale alerts |
| Sessioni | Pronto | Lista, recap rendered, toggle DM notes, prep notes, plot thread avanzati per sessione, briciole piantate per sessione |
| Session Prep Assistant | Pronto | Agent LLM con 6 tool read-only (entities, plot threads, sessioni, identità attive, truth progress, PC hooks), output strutturato + accept granulare: ogni briciola/NPC/encounter/hook accettato diventa un record reale (`truth_clue`, entity NPC stub `dm_only`, encounter draft, `pc_hook`) e finisce nelle `prep_notes`. Streaming e tool `generate_*` agentici rinviati a slice 3. |
| Rules Lookup | Pronto | Fase 9 completa: ingestion 2 manuali homebrew + hybrid search RRF (vector + pg_trgm) + UI Q&A `/rules` con citazioni cliccabili + history locale + tool `rules_search` esposto al Session Prep agent + shortcut globale `Cmd+/`. |
| Procedural Dungeon Generator | Pronto | Fase 8 completa: layout BSP deterministico + contenuto LLM per stanza con `StyleCalibrator` opzionale + persistenza come grafo entity (root location `kind='dungeon'` con `map_data`, child rooms `kind='room'` con `parentId`, encounter draft con `locationId` su ogni room con `encounterHook`). Navigabile dal grafo entità campagna. |

Snapshot import Sherdan validato:

| Metrica | Conteggio |
|---|---:|
| Entità importate | 151 |
| Identità | 81 |
| Segreti | 56 |
| Hook PG | 70 |
| Link entità | 45 |
| Sessioni | 6 |
| Plot thread | 10 |
| Documenti regole | 47 |
| Embedding entità | 151 / 151 |

Documenti utili:

- [Roadmap](./ROADMAP.md)
- [Decisioni architetturali](./docs/decisions.md)
- [Sherdan import report](./docs/sherdan-import-report.md)
- [Sherdan Phase 1.5 validation](./docs/sherdan-phase-1-5-validation.md)

---

## Avviso critico: privacy e spoiler GM

I markdown sorgenti di Sherdan contengono segreti GM-only, twist di campagna, identità reali, verità cosmologiche e informazioni non player-safe.

La posizione corretta dei sorgenti raw è:

```txt
content/sherdan/
```

I file reali in quella cartella devono restare ignorati da git. `public/*.md` è solo un fallback temporaneo per sviluppo locale e non deve essere usato prima di esporre il progetto a giocatori o a una rete pubblica/semi-pubblica.

File attesi:

- `NPC.md`
- `Fazioni.md`
- `Lore.md`
- `Campagna.md`
- `Background Personaggi.md`
- `Manuale del Giocatore.md`

Flusso consigliato:

```bash
pnpm content:migrate:sherdan
pnpm content:check
pnpm content:migrate:sherdan:delete-public
pnpm content:check:safe
```

Modalità stretta:

```bash
pnpm content:check:strict
SHERDAN_CONTENT_STRICT=1 pnpm db:bootstrap:sherdan
```

Prima di usare davvero il Player Dashboard con giocatori, ogni rotta player-facing deve passare da proiezioni player-safe e da un access gate. Non esporre mai direttamente entità raw, `description` GM, `properties`, segreti, clues, note GM, prep notes o markdown statici.

---

## Stack tecnico

| Livello | Tecnologia |
|---|---|
| App | Next.js 16 App Router |
| UI | React 19, Tailwind CSS 4 |
| Linguaggio | TypeScript strict mode |
| Database | PostgreSQL 16 |
| Vector search | pgvector |
| Fuzzy search | pg_trgm |
| ORM | Drizzle |
| Validazione | Zod |
| Test | Vitest |
| Logging | Pino |
| Grafi | D3 |
| Editor | Lexical |
| LLM cloud | Gemini API |
| LLM locale / embedding | Ollama |
| Package manager | pnpm |

---

## Requisiti

| Tool | Versione consigliata |
|---|---|
| Node.js | 24+ |
| pnpm | 10+ |
| Docker Desktop | recente |
| Ollama | richiesto per embedding |

Macchina consigliata:

- 16 GB RAM o più;
- Docker attivo;
- Ollama con `mxbai-embed-large` per embedding;
- opzionale: API key Gemini per chat/generazione strutturata.

---

## Setup rapido

```bash
git clone https://github.com/Andreatz/Sherdan-DM-Tools.git sherdan-dm-tools
cd sherdan-dm-tools

pnpm install
cp .env.example .env
pnpm env:check

docker compose up -d
pnpm db:migrate
pnpm db:ping

pnpm dev
```

App locale:

```txt
http://localhost:3000
```

Pannello stato progetto:

```txt
http://localhost:3000/status
```

---

## Variabili ambiente principali

```txt
DATABASE_URL=postgresql://sherdan:sherdan_dev@localhost:5432/sherdan_dm
LLM_PROVIDER=gemini
GOOGLE_AI_API_KEY=
GEMINI_MODEL=gemini-3-flash-preview
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b-instruct-q4_K_M
OLLAMA_EMBED_MODEL=mxbai-embed-large
```

Per usare il Player Dashboard locale:

```txt
SHERDAN_PLAYER_ACCESS_CODE=un-codice-lungo-non-indovinabile
```

Nota: l'accesso player attuale è sufficiente per uso locale/privato, ma non è ancora un sistema multiutente completo. Mancano ruoli per campagna, rate limit, auditing, rotazione token/sessioni avanzata e hardening da deploy pubblico.

Verifica allineamento env:

```bash
pnpm env:check
```

Setup Ollama:

```bash
ollama pull mxbai-embed-large
ollama pull qwen2.5:7b-instruct-q4_K_M
pnpm llm:ping
```

---

## Route principali

| Route | Stato | Scopo |
|---|---|---|
| `/` | Pronto | Home progetto |
| `/status` | Pronto | Stato feature + sicurezza contenuti |
| `/campaigns` | Pronto | Campaign Wiki e grafo entità |
| `/random-tables` | Pronto | Workbench tabelle casuali |
| `/npc-generator` | Beta | Generatore NPC contestuale |
| `/loot-generator` | Beta | Generatore loot |
| `/encounter-builder` | Beta | Prima slice encounter/monster browser |
| `/sessions` | Pronto | Lista sessioni + recap, toggle DM notes, plot/briciole per sessione |
| `/plot-threads` | Pronto | Kanban hot/warm/cold/resolved/abandoned, split-screen, timeline, stale alerts |
| `/truth-clues` | Pronto | Briciole filtrabili, plant/update status, dashboard verità rivelata |
| `/generation-log` | Pronto | Audit di ogni chiamata LLM dei generators |
| `/session-prep` | Beta | Agent LLM che legge stato campagna e propone prep di sessione (hooks, NPC seeds, encounter seeds, briciole, previously on) |
| `/player` | Beta | Dashboard player con access code e API player-safe (rate limit + audit log attivi) |
| `/dungeon-generator` | Pronto | Layout BSP + contenuto LLM per stanza con StyleCalibrator opzionale + re-roll per stanza + salvataggio nel Wiki come root location + room children + encounter draft. |
| `/rules` | Pronto | Q&A LLM sul corpus regole homebrew di Sherdan con citazioni cliccabili + history locale. Shortcut globale `Cmd+/`. |

---

## Pipeline Sherdan

Il bootstrap importa i markdown Sherdan da `content/sherdan/` nel database strutturato. Se la cartella privata è incompleta e la modalità strict è disattivata, può usare temporaneamente `public/` come fallback locale.

```bash
pnpm content:migrate:sherdan
pnpm db:bootstrap:sherdan
pnpm db:embed:sherdan
pnpm db:report:sherdan
pnpm db:validate:sherdan
```

Cosa viene importato:

- `NPC.md` -> NPC, identità, segreti stratificati, hook PG e link;
- `Fazioni.md` -> fazioni, luogotenenti, segreti, hook e link;
- `Lore.md` -> luoghi, organizzazioni, divinità, descrizione pubblica e verità GM;
- `Campagna.md` -> sessioni, plot thread e prep notes separate;
- `Background Personaggi.md` -> PG, alias e identità;
- `Manuale del Giocatore.md` -> documenti regole.

L'import è idempotente: rilanciarlo aggiorna i record esistenti invece di duplicarli.

---

## Funzionalità implementate

### Campaign Wiki

- Entità tipizzate: NPC, PG, fazioni, luoghi, divinità, oggetti, mostri, organizzazioni.
- Separazione tra descrizione pubblica e descrizione GM.
- Identità multiple per la stessa entità.
- Segreti stratificati: `surface`, `intermediate`, `deep`.
- Link tra entità con relazione reale e relazione pubblica.
- Hook PG separati dai link in-fiction.
- Grafo relazionale.
- Editor markdown.

### Random Tables Engine

- Tabelle pesate o uniformi.
- Sub-tabelle annidate.
- Template interpolation, per esempio `Taverniere {name}, {attitude}`.
- Import JSON, CSV e markdown bullet list.
- Roll history locale.
- Salvataggio rapido del risultato come entità Wiki.
- Seed idempotente di tabelle fantasy/Sherdan-style.

Seed tabelle:

```bash
pnpm db:seed:tables
```

### Generator Framework e NPC Generator

- Recupero contesto da campagna, location e NPC di riferimento.
- Prompt builder coerente con il tono Sherdan.
- Output strutturato validato con Zod.
- Preview prima del salvataggio.
- Re-roll parziale di nome, voce e segreti.
- Salvataggio come entity + secrets.
- Embedding fail-forward: l'NPC viene salvato anche se Ollama non è disponibile.

### Player Dashboard beta locale

- Accesso tramite codice server-side.
- Cookie HTTP-only firmato.
- API dedicate `/api/player/*`.
- Proiezione player-safe per campagne, recap ed entità conosciute.
- Nessuna esposizione diretta di `description`, `properties`, `tags`, embedding, segreti, identità o note GM.

---

## Comandi comuni

### Sviluppo

```bash
pnpm dev
pnpm db:studio
pnpm llm:ping
```

### Quality gate completo

```bash
pnpm check
```

Equivalente espanso:

```bash
pnpm env:check
pnpm content:check:safe
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Test E2E browser (Playwright)

```bash
# Una volta sola: installa Chromium (~110 MB, in cache utente)
pnpm exec playwright install chromium

# Esegui lo smoke E2E (avvia un dev server temporaneo sulla porta 3100)
DATABASE_URL="postgres://sherdan:sherdan_dev@localhost:5432/sherdan_dm_test" \
SHERDAN_PLAYER_ACCESS_CODE="e2e-fallback-secret" pnpm test:e2e

# UI Playwright per debug
pnpm test:e2e:ui
```

I test E2E coprono il flusso player end-to-end: login per-player → visibility scoping (solo entity public/discovered visibili) → override revealed (player vede `dm_only`) → override hidden (player non vede più entity public).

### Test integrazione DB/API

```bash
# 1. una tantum: crea un DB Postgres dedicato ai test
docker exec sherdan-postgres psql -U sherdan -d sherdan_dm \
  -c "CREATE DATABASE sherdan_dm_test OWNER sherdan"
docker exec sherdan-postgres psql -U sherdan -d sherdan_dm_test \
  -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# 2. esegui i test (il setup applica le migration + svuota le tabelle prima di ogni test)
DATABASE_URL="postgres://sherdan:sherdan_dev@localhost:5432/sherdan_dm_test" pnpm test:integration
```

Il setup di sicurezza richiede che il DB usato dai test abbia `test` nel nome (o sia `ci`): è una guardia per evitare di TRUNCATE-are il DB di sviluppo per errore.

### Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:ping
pnpm db:seed
pnpm db:seed:tables
```

### Embedding backfill

```bash
# Ricalcola l'embedding per ogni entity con `embedding IS NULL`
# (es. NPC salvati dal generator quando Ollama era offline).
# Idempotente, può girare in qualsiasi momento.
pnpm db:embed:backfill                      # tutte le campagne
pnpm db:embed:backfill --campaign-id=<uuid> # solo una campagna
pnpm db:embed:backfill --dry-run            # solo report, no scrittura

# Embedding dei rule_documents (Manuale del Giocatore, La Forgia di Sherdan).
# Idempotente: tocca solo le righe con embedding IS NULL.
pnpm db:embed:rules                         # tutti i source
pnpm db:embed:rules --source=sherdan-custom # solo il corpus Sherdan
pnpm db:embed:rules --force                 # rifa' tutto (dopo cambio modello)
```

### Backup & export

```bash
# Dump SQL completo (via docker exec sul container sherdan-postgres):
pnpm db:backup
# → backups/sherdan-YYYYMMDD-HHMMSS.sql

# Ripristino (DISTRUTTIVO, richiede conferma esplicita):
CONFIRM=yes pnpm db:restore -- backups/sherdan-YYYYMMDD-HHMMSS.sql

# Export JSON autoportante di una singola campagna:
pnpm db:export:campaign -- --name "Sherdan"
# oppure
pnpm db:export:campaign -- --id <campaign-uuid>
# → backups/campaign-<slug>-<timestamp>.json
```

La cartella `backups/` è git-ignored (i dump contengono segreti GM-only).

### Dataset Sherdan

```bash
pnpm content:check
pnpm content:check:safe
pnpm content:check:strict
pnpm content:migrate:sherdan
pnpm content:migrate:sherdan:delete-public
pnpm db:bootstrap:sherdan
pnpm db:embed:sherdan
pnpm db:report:sherdan
pnpm db:validate:sherdan
```

### Docker

```bash
docker compose up -d
docker compose down
docker compose down -v
```

Attenzione:

```bash
docker compose down -v
```

cancella il volume Postgres locale e tutti i dati campagna locali.

---

## Struttura progetto

```txt
sherdan-dm-tools/
|-- README.md
|-- ROADMAP.md
|-- docker-compose.yml
|-- content/
|   `-- sherdan/
|       |-- README.md
|       `-- *.md        # ignorati da git, locali/privati
|-- docs/
|   |-- decisions.md
|   |-- sherdan-import-report.md
|   `-- sherdan-phase-1-5-validation.md
|-- scripts/
|   |-- bootstrap-sherdan.ts
|   |-- migrate-sherdan-content.ts
|   |-- seed-random-tables.ts
|   |-- embed-sherdan-entities.ts
|   |-- report-sherdan-import.ts
|   `-- validate-sherdan-phase-1-5.ts
|-- src/
|   |-- app/
|   |   |-- api/
|   |   |-- campaigns/
|   |   |-- random-tables/
|   |   |-- npc-generator/
|   |   |-- loot-generator/
|   |   |-- encounter-builder/
|   |   |-- player/
|   |   `-- status/
|   |-- components/
|   |-- db/
|   |   `-- schema/
|   |-- lib/
|   |   |-- api/
|   |   |-- generators/
|   |   |-- import/
|   |   |-- llm/
|   |   |-- random-tables/
|   |   |-- security/
|   |   `-- validation/
|   `-- ...
`-- tests/
    `-- unit/
```

---

## Architettura

Il cuore del progetto è il database campagna strutturato.

Principi:

- ogni oggetto importante diventa una entity;
- la verità GM e la versione pubblica sono campi separati;
- le identità sono record di primo livello;
- i segreti sono informazioni stratificate, non testo disperso;
- i link descrivono relazioni in-fiction;
- gli hook PG descrivono potenziale narrativo;
- i generatori devono usare il database come contesto, non prompt generici;
- ogni superficie player-facing deve passare da una proiezione player-safe.

Flusso dati:

```txt
Markdown Sherdan in content/sherdan/
        |
        v
Parser
        |
        v
Bootstrap idempotente
        |
        v
Postgres: entities, secrets, identities, links, sessions, plot, rules
        |
        v
Wiki / Search / Graph / Random Tables / Generators / Player Dashboard
```

---

## Priorità consigliate

1. Aggiungere le rotte player-facing per `truth_clues` e `entity_secret` (gli override visibility sono già pronti, manca solo l'API che li espone in modalità player-safe).
2. Slice 3 del Session Prep Assistant: streaming dell'output dell'agent + tool `generate_npc/encounter/loot` agentici (oggi l'agent suggerisce seed che il DM accetta come stub/draft, ma non chiama i generator vivi).

---

## Limitazioni note

- Il progetto è ancora single-user e local-first: non è pronto come SaaS o app multiutente.
- Il Player Dashboard è pronto: la modalità per-player è attiva (codici individuali hashati, scoping per campagna, override visibilità per giocatore) ed è coperta da test di integrazione DB/API + smoke E2E Playwright.
- Accesso player: per-giocatore (tabella `players`, codici HMAC-hashed, UI DM in `/campaigns/[id]`) con fallback al codice globale `SHERDAN_PLAYER_ACCESS_CODE`.
- Rate limit attivo: login `/api/player/access/login` 5 tentativi / 15 min per IP, altre API player 120 req / minuto per IP.
- Override visibilità per giocatore: ogni entità, `truth_clue` o `entity_secret` può essere `hidden` o `revealed` per uno specifico player. UI DM disponibile nei pannelli "Visibilita' per giocatore" della entity detail, del Truth Clue Tracker e dell'Entity Secret Manager.
- `generation_log` ora cattura ogni chiamata LLM (NPC/Loot/Encounter assist) con input, prompt, output, status e latenza, ma `input_tokens`/`output_tokens`/`cost_usd` restano `null` finché `LLMProvider` non espone l'usage del provider.
- Encounter Builder copre il flusso DM (browser mostri, CR calculator, LLM assist, marker "usato in sessione"); un combat tracker run-time (iniziativa, HP live, condizioni) resta fuori scope per ora.
- Test di integrazione DB/API in posto (`pnpm test:integration`, 5 file, 19 test su campaigns/entities/player auth/leakage/truth-clues). Manca ancora la smoke E2E browser.
- I seed delle Random Tables sono stato locale DB: rilanciare `pnpm db:seed:tables` dopo reset del database.

---

## Troubleshooting

### `pnpm db:ping` fallisce con `ECONNREFUSED`

Postgres probabilmente non è avviato.

```bash
docker compose up -d
pnpm db:ping
```

### `pnpm env:check` segnala drift

`.env.example` e `src/lib/env.ts` non sono allineati.

Aggiorna entrambi prima di continuare.

### `pnpm content:check:safe` fallisce

Ci sono ancora markdown Sherdan raw in `public/`.

```bash
pnpm content:migrate:sherdan
pnpm content:migrate:sherdan:delete-public
pnpm content:check:safe
```

### `pnpm content:check:strict` fallisce

Mancano file in `content/sherdan/` o sono ancora presenti in `public/`.

```bash
pnpm content:migrate:sherdan
pnpm content:migrate:sherdan:delete-public
pnpm content:check:strict
```

### `pnpm llm:ping` fallisce per Ollama

Controlla che Ollama sia attivo e che i modelli siano stati scaricati.

```bash
ollama serve
ollama pull mxbai-embed-large
ollama pull qwen2.5:7b-instruct-q4_K_M
pnpm llm:ping
```

### Build Next.js fallisce per accesso database

Una pagina potrebbe essere trattata come statica mentre interroga il DB.

Marcarla come dinamica:

```ts
export const dynamic = "force-dynamic";
```

---

## Metadata consigliati repository

Descrizione:

```txt
Local-first DM toolkit for the Sherdan D&D 5e campaign: campaign wiki, entity graph, secrets, session prep and AI-assisted generators.
```

Topic suggeriti:

```txt
dnd
dnd5e
nextjs
typescript
postgres
pgvector
drizzle
ollama
gemini
campaign-management
ttrpg
dm-tools
```

---

## Licenza

Progetto personale/privato di campagna finché non viene aggiunta una licenza esplicita.

Non redistribuire materiale narrativo di Sherdan senza permesso.
