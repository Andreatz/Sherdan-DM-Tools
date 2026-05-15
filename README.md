# Sherdan DM Tools

**Sherdan DM Tools** è un toolkit locale per Dungeon Master dedicato alla campagna D&D 5e homebrew **Sherdan**.

L'app trasforma l'archivio della campagna in un workspace strutturato per:

- Campaign Wiki;
- entità, identità, segreti e relazioni;
- plot thread;
- truth clues;
- hook dei PG;
- sessioni e prep notes;
- player dashboard;
- tabelle casuali;
- lookup regole;
- bridge manuale verso ChatGPT web.

La direzione attuale del progetto è:

```txt
Core app local-first
+
ChatGPT Web Bridge manuale
+
LLM server-side opzionali
```

Il progetto deve essere utile anche senza API LLM, senza billing e senza provider cloud.

---

## Modalità consigliata: ChatGPT Web Bridge

La modalità consigliata è usare Sherdan DM Tools come **memoria canonica strutturata** e ChatGPT web come **assistente creativo/manuale**.

Flusso:

```txt
Sherdan DM Tools
→ esporta pacchetto markdown/JSON
→ incolla o carica in ChatGPT web
→ usa il prompt Architetto di Mondi
→ incolla output in Sherdan DM Tools
→ review & apply selettivo nel database
```

Questa modalità funziona con:

```env
LLM_PROVIDER=none
```

Vantaggi:

- nessun costo API;
- nessun limite Gemini/OpenAI;
- nessuna dipendenza da Ollama;
- uso diretto dell'abbonamento ChatGPT web/Plus;
- controllo manuale prima di aggiornare il canon;
- migliore protezione dei segreti GM.

La route principale è:

```txt
/chatgpt-bridge
```

---

## Stato del progetto

Vocabolario stato:

| Stato | Significato |
|---|---|
| **Pronto** | Feature usabile end-to-end. |
| **Beta** | Usabile, ma con limiti o polish ancora necessari. |
| **Schema** | DB/API predisposti, UI ancora incompleta. |
| **Pianificato** | Non ancora iniziato. |
| **Opzionale** | Feature disponibile solo con provider/servizi extra. |

### Stato feature

| Area | Stato | Nota |
|---|---:|---|
| Foundation progetto | Pronto | Next.js, TypeScript, Postgres, Drizzle, Zod, logging, env check. |
| Campaign Wiki | Pronto | CRUD entità, identità, segreti, link, tag e PC hooks. |
| Grafo entità | Pronto | Visualizzazione relazioni con pan/zoom. |
| Import Sherdan | Pronto | Parser e bootstrap idempotente da `content/sherdan/`. |
| Content safety gate | Pronto | Blocca markdown Sherdan raw in `public/`. |
| Random Tables Engine | Pronto | CRUD, import, roll, subtabelle, template e history. |
| Sessioni | Pronto | Lista, recap, DM notes, prep notes, plot e briciole per sessione. |
| Plot Thread Tracker | Pronto | Kanban, split GM/pubblico, timeline, stale alerts. |
| Truth Clue Tracker | Pronto | Briciole filtrabili, status, verità rivelata, sessioni. |
| Player Dashboard | Pronto | Accesso per-player, cookie firmato, API player-safe, realtime. |
| Session Run Mode | Pronto | Vista da tavolo con scena live, iniziativa, thread hot/warm, briciole e copy-for-ChatGPT. |
| Rules Lookup | Pronto | Search ibrida RRF, citazioni, corpus homebrew/SRD, Q&A opzionale. |
| Procedural Dungeon Generator | Pronto / Opzionale | Layout BSP deterministico; contenuto LLM opzionale. |
| ChatGPT Web Bridge | Pronto | Export/import manuale, Update Pack, review & apply. |
| Contradiction Detector | Pronto | Audit deterministico di nomi, alias, relazioni, visibilita e stato trama. |
| NPC Generator | Opzionale | Richiede LLM server-side se usato come generatore automatico. |
| Loot Generator | Opzionale | Richiede LLM server-side per generazione automatica. |
| Encounter Builder | Pronto / Opzionale | Browser/CR calculator pronto; assist LLM opzionale. |
| Session Prep Assistant LLM | Opzionale | Sostituito nel workflow consigliato dal ChatGPT Web Bridge. |
| Combat Tracker runtime | Pronto | Iniziativa, round, HP/note e push live al Player Dashboard. |
| Matrice conoscenza PNG | Pronto | Matrice player x target basata su visibilita base e override individuali. |
| Spoiler Gate / Reveal Tracker | Pronto | Dashboard reveal per briciole, segreti stratificati e override per-player. |

---

## Route principali

| Route | Stato | Scopo |
|---|---:|---|
| `/` | Pronto | Home progetto. |
| `/status` | Pronto | Stato feature e sicurezza contenuti. |
| `/campaigns` | Pronto | Campaign Wiki, entità, dettagli, grafo. |
| `/sessions` | Pronto | Sessioni, recap, note e prep. |
| `/plot-threads` | Pronto | Tracker thread narrativi. |
| `/truth-clues` | Pronto | Tracker briciole/verità. |
| `/random-tables` | Pronto | Tabelle casuali e roll. |
| `/player` | Pronto | Dashboard player-safe. |
| `/session-run` | Pronto | Vista operativa da tavolo: scena, iniziativa, thread e briciole. |
| `/combat-tracker` | Pronto | Iniziativa runtime condivisa col Player Dashboard. |
| `/knowledge-matrix` | Pronto | Matrice conoscenza player x PNG/target. |
| `/reveal-tracker` | Pronto | Spoiler gate per briciole e segreti stratificati. |
| `/rules` | Pronto | Lookup regole e Q&A opzionale. |
| `/dungeon-generator` | Pronto / Opzionale | Layout dungeon e contenuto assistito. |
| `/chatgpt-bridge` | Pronto | Export/import manuale per ChatGPT web. |
| `/chatgpt-bridge/history` | Pronto | Storico export/import Bridge, warning e apply. |
| `/contradictions` | Pronto | Detector deterministico di incoerenze nel canon. |
| `/generation-log` | Pronto | Log chiamate LLM quando abilitate. |
| `/npc-generator` | Opzionale | Generatore automatico via LLM. |
| `/loot-generator` | Opzionale | Generatore automatico via LLM. |
| `/encounter-builder` | Pronto / Opzionale | Builder incontri + assist LLM opzionale. |
| `/session-prep` | Opzionale | Agent LLM server-side; non necessario con Bridge. |

---

## Snapshot dataset Sherdan

Snapshot validato del dataset Sherdan importato:

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
| Test | Vitest, Playwright |
| Logging | Pino |
| Grafi | D3 |
| Editor | Lexical |
| LLM opzionali | Gemini API, OpenAI API, Ollama |
| Package manager | pnpm |

---

## Requisiti

| Tool | Versione consigliata |
|---|---|
| Node.js | 24+ |
| pnpm | 10+ |
| Docker Desktop | recente |
| PostgreSQL | via Docker Compose |
| Ollama | opzionale, richiesto solo per embedding/LLM locale |

Macchina consigliata:

- 16 GB RAM o più;
- Docker attivo;
- Ollama opzionale con `mxbai-embed-large` se vuoi embedding locali;
- nessuna API key richiesta se usi `LLM_PROVIDER=none`.

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

Pannello stato:

```txt
http://localhost:3000/status
```

---

## Configurazione ambiente

Configurazione consigliata per workflow senza API:

```env
DATABASE_URL=postgresql://sherdan:sherdan_dev@localhost:5432/sherdan_dm

LLM_PROVIDER=none

GOOGLE_AI_API_KEY=
GEMINI_MODEL=gemini-3-flash-preview

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b-instruct-q4_K_M
OLLAMA_EMBED_MODEL=mxbai-embed-large

SHERDAN_PLAYER_ACCESS_CODE=
```

Provider disponibili:

| Provider | Uso |
|---|---|
| `none` | Nessun LLM server-side. Usa ChatGPT Web Bridge. |
| `gemini` | Gemini API come provider primario. |
| `openai` | OpenAI API come provider primario. |
| `ollama` | Solo locale via Ollama. |

Verifica env:

```bash
pnpm env:check
```

Verifica LLM, solo se usi provider diversi da `none`:

```bash
pnpm llm:ping
```

Con `LLM_PROVIDER=none`, il ping deve uscire senza errore e indicare che il Bridge è attivo.

---

## Come usare ChatGPT Web Bridge

### 1. Vai alla pagina Bridge

```txt
http://localhost:3000/chatgpt-bridge
```

### 2. Genera un pacchetto

Scegli:

- campagna;
- tipo task;
- densità;
- audience;
- sessione;
- focus;
- vincoli;
- sezioni da includere.

Task supportati:

| Tipo | Comando prompt |
|---|---|
| Sessione MD | `/sessione --md [numero]` |
| Brief sessione | `/sessione [numero]` |
| Audit sessione | `/sessione --audit [file/testo]` |
| Patch sessione | `/sessione --patch [scena/problema]` |
| Dialogo | `/dialogo [PNG] [situazione]` |
| TXC | `/txc [scena]` |
| Recap giocatori | `/recap giocatori` |
| Recap GM | `/recap gm` |
| Lore | `/lore [argomento]` |
| NPC | `/npc [nome/ruolo]` |
| Fazione | `/fazione [nome]` |
| Città | `/citta [nome]` |
| Dungeon | `/dungeon [tema]` |

Densità disponibili:

| Modalità | Uso |
|---|---|
| `Light` | Idee rapide, scene secondarie, brainstorming. |
| `Standard` | Sessione normale, PNG importanti, archi medi. |
| `Full` | Finali d'arco, dungeon complessi, eventi politici. |
| `Table-Ready` | Materiale pronto da usare al tavolo. |
| `Design-Only` | Progettazione GM, non testo player-facing. |

### 3. Usa ChatGPT web

Copia o scarica il pacchetto `.md`, poi incollalo/caricalo in ChatGPT web.

### 4. Importa la risposta

Incolla l'output prodotto da ChatGPT nella sezione import.

L'app può:

- salvare il markdown;
- rilevare titolo/sessione;
- estrarre `UPDATE PACK`;
- generare modifiche candidate;
- applicare solo quelle selezionate.

### 5. Review & Apply

L'Update Pack può proporre:

- aggiornamento sessione;
- nuovo evento plot thread;
- nuova truth clue;
- aggiornamento NPC;
- nuovo PC hook;
- nuova identità;
- nuovo segreto;
- nuovo link entità.

Nulla viene applicato senza selezione manuale.

---

## Privacy e spoiler GM

I markdown sorgenti di Sherdan contengono:

- segreti GM;
- identità reali;
- twist di campagna;
- verità cosmologiche;
- informazioni non player-safe.

I sorgenti raw devono stare in:

```txt
content/sherdan/
```

Non in:

```txt
public/
```

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

Regole fondamentali:

1. non esporre mai `description` GM ai player;
2. usare `publicDescription` per contenuti player-facing;
3. non esportare `entity_secrets` in audience player;
4. non esportare `truthRevealed` in audience player;
5. non esportare `dmNotes` o `prepNotes` in audience player;
6. revisionare sempre l'Update Pack prima dell'apply.

---

## Pipeline Sherdan

Import dei markdown privati:

```bash
pnpm content:migrate:sherdan
pnpm db:bootstrap:sherdan
pnpm db:embed:sherdan
pnpm db:report:sherdan
pnpm db:validate:sherdan
```

File attesi in `content/sherdan/`:

- `NPC.md`
- `Fazioni.md`
- `Lore.md`
- `Campagna.md`
- `Background Personaggi.md`
- `Manuale del Giocatore.md`
- `Agente AI Worldbuilding.md`

Cosa viene importato:

- `NPC.md` → NPC, identità, segreti, hook e link;
- `Fazioni.md` → fazioni, luogotenenti, segreti, hook e link;
- `Lore.md` → luoghi, organizzazioni, divinità, verità GM e versioni pubbliche;
- `Campagna.md` → sessioni, plot thread e prep notes;
- `Background Personaggi.md` → PG, alias e identità;
- `Manuale del Giocatore.md` → rule documents;
- `Agente AI Worldbuilding.md` → prompt Architetto di Mondi per il Bridge.

---

## Funzionalità principali

### Campaign Wiki

- Entità tipizzate: NPC, PG, fazioni, luoghi, divinità, oggetti, mostri, organizzazioni.
- Separazione tra descrizione pubblica e descrizione GM.
- Identità multiple.
- Segreti stratificati: `surface`, `intermediate`, `deep`.
- Link tra entità con relazione reale e relazione pubblica.
- Hook PG separati dai link in-fiction.
- Grafo relazionale.
- Editor markdown.

### Plot Thread Tracker

- Kanban hot/warm/cold/resolved/abandoned.
- Descrizione GM e descrizione pubblica separate.
- Timeline eventi.
- Entità per ruolo.
- Briciole correlate.
- Stale alerts.

### Truth Clue Tracker

- Tracking di cosa è stato piantato, notato, frainteso o capito.
- Collegamento a plot thread e sessioni.
- Verità rivelata separata dalla briciola percepita.
- Supporto a override player-facing.

### Player Dashboard

- Accesso tramite codice per-player.
- Cookie HTTP-only firmato.
- API `/api/player/*`.
- WebSocket con token firmato.
- Scena corrente realtime.
- Handout, mappa, fog.
- Entità esposte con policy:
  - `name_only`;
  - `public_description`;
  - `discovered_description`.

### Session Run Mode

- Route `/session-run` per il DM al tavolo.
- Aggrega scena live dal Player Dashboard, sessione selezionata, iniziativa, entita attive, thread hot/warm e briciole non chiuse.
- Include copy-for-ChatGPT del contesto runtime per chiedere aiuto rapido senza passare dal Bridge completo.
- Non crea nuovi dati: rimanda agli editor esistenti per sessioni, plot thread, briciole e dashboard.

### Matrice conoscenza PNG

- Route `/knowledge-matrix`.
- Tabella player x target con default derivato da `visibility` e override da `player_visibility_overrides`.
- Filtro per tipo entity, con default sui PNG.
- Serve come audit rapido per capire chi vede cosa prima di esporre contenuti player-facing.
- Azioni inline per rivelare, nascondere o resettare un target per singolo player.

### Spoiler Gate / Reveal Tracker

- Route `/reveal-tracker`.
- Raccoglie `truth_clues` e `entity_secrets` in una dashboard unica.
- Mostra stato party-level, layer dei segreti e override individuali hidden/revealed.
- Azioni inline per party reveal/protezione e override individuali.

### Combat Tracker

- Route `/combat-tracker`.
- Usa `player_dashboard_states.initiative`, quindi lo stesso stato compare nel Player Dashboard.
- Gestisce round, stato attivo/pausa, combattenti, iniziativa, HP e note/condizioni.
- Salva e puo' fare push realtime ai player con lo stesso canale del Player Dashboard.

### Random Tables Engine

- Tabelle pesate o uniformi.
- Subtabelle.
- Template interpolation.
- Import JSON/CSV/markdown.
- Roll history locale.
- Salvataggio rapido nel Wiki.

### Rules Lookup

- Corpus homebrew e SRD.
- Search ibrida vector + trigram.
- Reciprocal Rank Fusion.
- Citazioni cliccabili.
- Q&A opzionale se LLM abilitato.
- Shortcut globale `Cmd+/`.

### ChatGPT Web Bridge

- Export markdown contestuale.
- Preset operativi per politica, crisi politica complessa, flashback, dungeon, heist, downtime, viaggio, recap giocatori e audit anti-railroad.
- Copy-for-ChatGPT da entity, sessioni, plot thread e truth clue.
- Prompt Architetto di Mondi incluso o sintetico.
- Relevance budgeting per densità.
- Audience GM/player.
- Import output ChatGPT.
- Canon Diff deterministico sugli import confrontati con recap, DM notes e prep notes della sessione.
- Canon Diff campo-per-campo per titolo, recap, DM notes e prep notes.
- Export/copia del Canon Diff in Markdown.
- Apply dell'Update Pack anche su `prepNotesCandidate`.
- Session Debrief Import verso `dmNotes`.
- Parsing `UPDATE PACK`.
- Review e apply selettivo.
- Badge match esatto/fuzzy/ambiguo.
- Conferma extra per modifiche ad alto rischio.
- Storico export/import.
- Dashboard compatta delle ultime modifiche applicate.

### Contradiction Detector

- Route `/contradictions`.
- Audit deterministico senza LLM su canon locale.
- Rileva nomi entity duplicati, collisioni alias/identita, identita vere multiple, link relazionali incoerenti, gap player-facing e briciole aperte su thread risolti.
- Mostra severita alta/media/bassa, target coinvolti, azione consigliata e checklist di risoluzione guidata.
- Deep link dall'audit alla singola entity, briciola o plot thread coinvolto.
- Quick fix sicuro per gap player-facing non ambigui: riporta il target a `dm_only`.
- Quick fix guidato per link duplicati esatti: conserva il primo link e rimuove i duplicati.
- Ignore-list persistente per contraddizioni intenzionali.
- Esporta/copia il report in Markdown per audit o note di sessione.
- Utile prima di export Bridge, recap player-facing o reveal importanti.

---

## Comandi comuni

### Sviluppo

```bash
pnpm dev
pnpm db:studio
```

### Quality gate

```bash
pnpm check
```

Equivalente:

```bash
pnpm env:check
pnpm content:check:safe
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Test

```bash
pnpm test
pnpm test:integration:local
pnpm test:e2e:local
```

Playwright:

```bash
pnpm exec playwright install chromium
pnpm test:e2e:local
```

### Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:ping
pnpm db:studio
pnpm test:db:setup
pnpm db:seed
pnpm db:seed:tables
```

### Backup ed export

```bash
pnpm db:backup
CONFIRM=yes pnpm db:restore -- backups/sherdan-YYYYMMDD-HHMMSS.sql

pnpm db:export:campaign -- --name "Sherdan"
pnpm db:import:campaign -- backups/campaign-sherdan-YYYYMMDD-HHMMSS.json
pnpm db:export:campaign:markdown -- --name "Sherdan"
```

Le cartelle `backups/` ed `exports/` sono git-ignored perché possono contenere segreti GM.

### Embedding opzionali

```bash
ollama serve
ollama pull mxbai-embed-large
pnpm db:embed:sherdan
pnpm db:embed:backfill
pnpm db:embed:rules
```

---

## Struttura progetto

```txt
sherdan-dm-tools/
|-- README.md
|-- ROADMAP.md
|-- NEWPROJECT.md
|-- docker-compose.yml
|-- content/
|   `-- sherdan/
|       |-- README.md
|       `-- *.md
|-- docs/
|   |-- decisions.md
|   |-- sherdan-import-report.md
|   `-- sherdan-phase-1-5-validation.md
|-- scripts/
|-- src/
|   |-- app/
|   |   |-- api/
|   |   |-- campaigns/
|   |   |-- chatgpt-bridge/
|   |   |-- sessions/
|   |   |-- plot-threads/
|   |   |-- truth-clues/
|   |   |-- random-tables/
|   |   |-- player/
|   |   |-- session-run/
|   |   |-- knowledge-matrix/
|   |   |-- reveal-tracker/
|   |   |-- rules/
|   |   |-- dungeon-generator/
|   |   `-- status/
|   |-- components/
|   |-- db/
|   |   `-- schema/
|   |-- lib/
|   |   |-- chatgpt-bridge/
|   |   |-- llm/
|   |   |-- random-tables/
|   |   |-- rules/
|   |   |-- security/
|   |   `-- validation/
|   `-- ...
`-- tests/
    |-- unit/
    |-- integration/
    `-- e2e/
```

---

## Architettura dati

Principi:

- ogni oggetto importante diventa una entity;
- la verità GM e la versione pubblica sono campi separati;
- le identità sono record di primo livello;
- i segreti sono informazioni stratificate;
- i link descrivono relazioni in-fiction;
- gli hook PG descrivono potenziale narrativo;
- le briciole tracciano il percorso verso una verità;
- ogni superficie player-facing passa da una proiezione sicura;
- ChatGPT può proporre, ma il database canonico viene aggiornato solo dopo review.

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
Postgres: entities, identities, secrets, links, sessions, plot, clues, rules
        |
        v
Wiki / Graph / Search / Dashboard / Bridge / Tables / Tools
```

---

## Roadmap consigliata

### Priorità alta

1. [x] Rifinitura UX delle viste da tavolo dopo uso reale in sessione.
2. [x] Contradiction Detector deterministico.
3. [x] Campo-per-campo per Canon Diff.

### Priorità futura

1. Quick fix piu ricchi per duplicati entity/alias, sempre con review manuale.
2. Report mensile di salute canon: detector + reveal + knowledge matrix.
3. E2E smoke dedicato per Contradiction Detector e Bridge diff export.


---

## Limitazioni note

- Progetto single-user e local-first.
- Non è un SaaS multiutente.
- LLM server-side opzionali possono fallire per quota, billing o memoria locale.
- Con `LLM_PROVIDER=none`, i generatori automatici LLM non devono essere usati come percorso principale.
- ChatGPT Web Bridge non automatizza ChatGPT web: prepara export/import manuali.
- L'Update Pack va sempre revisionato prima dell'apply.
- Matrice conoscenza PNG e Reveal Tracker usano override inline e filtri operativi, ma gli editor canonici continuano a gestire il dettaglio completo.

---

## Troubleshooting

### `pnpm db:ping` fallisce con `ECONNREFUSED`

Postgres non è avviato.

```bash
docker compose up -d
pnpm db:ping
```

### `pnpm env:check` segnala drift

`.env.example` e `src/lib/env.ts` non sono allineati.

Aggiorna entrambi.

### `pnpm content:check:safe` fallisce

Ci sono markdown Sherdan raw in `public/`.

```bash
pnpm content:migrate:sherdan
pnpm content:migrate:sherdan:delete-public
pnpm content:check:safe
```

### `pnpm llm:ping` fallisce

Se usi `LLM_PROVIDER=none`, non dovrebbe servire.

Se usi Ollama:

```bash
ollama serve
ollama pull mxbai-embed-large
ollama pull qwen2.5:7b-instruct-q4_K_M
pnpm llm:ping
```

Se usi Gemini/OpenAI, verifica API key, quota e billing.

### Build Next.js fallisce per accesso database

Una pagina potrebbe essere trattata come statica mentre interroga il DB.

Aggiungi:

```ts
export const dynamic = "force-dynamic";
```

---

## Metadata repository consigliati

Descrizione:

```txt
Local-first DM toolkit for the Sherdan D&D 5e campaign: campaign wiki, secrets, entity graph, player dashboard, random tables and ChatGPT Web Bridge.
```

Topic suggeriti:

```txt
dnd
dnd5e
ttrpg
dm-tools
campaign-management
nextjs
typescript
postgres
pgvector
drizzle
ollama
chatgpt
local-first
worldbuilding
```

---

## Licenza

Progetto personale/privato di campagna finché non viene aggiunta una licenza esplicita.

Non redistribuire materiale narrativo di Sherdan senza permesso.
