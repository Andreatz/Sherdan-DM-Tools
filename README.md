# Sherdan DM Tools

Local-first Dungeon Master toolkit for the Sherdan D&D 5e campaign.

Sherdan DM Tools turns the campaign markdown archive into a structured, searchable and AI-assisted DM workspace. The app is single-user for now, optimized for local development, and calibrated on the real Sherdan dataset: layered secrets, propaganda vs GM truth, multiple identities, PC hooks, factions, sessions and plot threads.

The architecture is Sherdan-first, but the long-term goal is to make the same foundation reusable for other narrative-heavy D&D campaigns.

---

## Current Status

The project has completed the foundation, Campaign Wiki vertical slice, Sherdan content bootstrap validation and Random Tables Engine. The next planned phase is the Generator Framework + NPC Generator.

| Area | Status |
|---|---|
| Project foundation | Done |
| Next.js app shell | Done |
| Postgres + pgvector setup | Done |
| Drizzle schema v2 | Done |
| Campaign Wiki | Done for Phase 1 |
| Entity CRUD APIs | Done |
| Identity / secrets / links / PC hooks UI | Done |
| Sherdan markdown parsers | Done |
| Idempotent Sherdan import pipeline | Done |
| Sherdan import validation | Done |
| Random Tables Engine | Done |
| NPC Generator | Planned |
| Player Dashboard | Planned |

Validated Sherdan import snapshot:

| Metric | Count |
|---|---:|
| Imported entities | 151 |
| Identities | 81 |
| Secrets | 56 |
| PC hook assignments | 70 |
| Entity links | 45 |
| Sessions | 6 |
| Plot threads | 10 |
| Rule documents | 47 |
| Imported entity embeddings | 151 / 151 |

Reports:

- [Sherdan import report](./docs/sherdan-import-report.md)
- [Sherdan Phase 1.5 validation](./docs/sherdan-phase-1-5-validation.md)
- [Roadmap](./ROADMAP.md)
- [Architecture decisions](./docs/decisions.md)

---

## Important Privacy Notice

Sherdan campaign source files are currently stored in `public/`.

This is acceptable only under the current assumptions:

- single-user app;
- local development;
- private network or Tailscale access;
- no public deployment;
- no player-facing access to raw app routes or static files.

Before enabling a public or semi-public Player Dashboard, move the campaign source files outside `public/`, for example:

```txt
data/sherdan/
content/sherdan/
```

Runtime access should then happen only through server-side code and player-safe API routes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| App | Next.js 16 App Router |
| Language | TypeScript strict mode |
| UI | React 19 |
| Database | PostgreSQL 16 |
| Vector search | pgvector |
| Fuzzy search | pg_trgm |
| ORM | Drizzle |
| Validation | Zod |
| Testing | Vitest |
| Logging | Pino |
| Primary chat LLM | Gemini API |
| Local fallback / embeddings | Ollama |
| Package manager | pnpm |

---

## Requirements

| Tool | Version |
|---|---|
| Node.js | 24+ |
| pnpm | 10+ |
| Docker Desktop | recent |
| Ollama | required for embeddings |

Recommended local machine:

- 16 GB RAM or more;
- Docker available;
- Ollama installed with `mxbai-embed-large` for embeddings;
- optional Gemini API key for primary chat/structured generation.

---

## Quick Start

```bash
git clone <repo-url> sherdan-dm-tools
cd sherdan-dm-tools

pnpm install
cp .env.example .env
pnpm env:check

docker compose up -d
pnpm db:migrate
pnpm db:ping

pnpm dev
```

The app runs at:

```txt
http://localhost:3000
```

---

## Sherdan Import Pipeline

The bootstrap imports the real Sherdan markdown files from `public/` into the structured database.

```bash
pnpm db:bootstrap:sherdan
pnpm db:embed:sherdan
pnpm db:report:sherdan
pnpm db:validate:sherdan
```

What it imports:

- `NPC.md` -> NPC entities, identities, layered secrets, PC hooks and links;
- `Fazioni.md` -> factions, lieutenants, faction secrets, PC hooks and links;
- `Lore.md` -> locations, organizations and deities, split into public description vs GM truth;
- `Campagna.md` -> plot threads and sessions with GM prep notes separated;
- `Background Personaggi.md` -> PC entities and aliases/identities;
- `Manuale del Giocatore.md` -> rule documents.

The import is idempotent: rerunning it updates existing records instead of duplicating them.

---

## Random Tables Engine

Phase 2 adds a reusable random table engine with:

- weighted and uniform rolls;
- nested sub-table resolution;
- template interpolation such as `Taverniere {name}, {attitude}`;
- CRUD API and `/random-tables` workbench;
- CSV, Markdown bullet list and JSON import;
- sticky roll history with quick save to Wiki entity;
- seed tables for public-domain fantasy prompts and Sherdan-style sensory details, NPC tics, accents, surface secrets and hooks.

Seed or refresh the table library with:

```bash
pnpm db:seed:tables
```

The seed is idempotent: rerunning it updates the 26 seeded tables instead of duplicating them.

---

## LLM And Embeddings Setup

Embeddings always use Ollama so the vector space stays stable.

```bash
ollama pull mxbai-embed-large
ollama pull qwen2.5:7b-instruct-q4_K_M
pnpm llm:ping
```

Chat and structured generation can use Gemini as primary provider with Ollama fallback.

Main environment variables:

```txt
DATABASE_URL=
LLM_PROVIDER=gemini
GOOGLE_AI_API_KEY=
GEMINI_MODEL=gemini-3-flash-preview
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b-instruct-q4_K_M
OLLAMA_EMBED_MODEL=mxbai-embed-large
```

Run:

```bash
pnpm env:check
```

to verify `.env`, `.env.example` and `src/lib/env.ts` stay aligned.

---

## Common Commands

### Development

```bash
pnpm dev
pnpm db:studio
pnpm llm:ping
```

### Quality Gate

```bash
pnpm env:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:ping
pnpm db:seed
pnpm db:seed:tables
```

### Sherdan Dataset

```bash
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

Warning:

```bash
docker compose down -v
```

deletes the local Postgres volume and all local campaign data.

---

## Project Structure

```txt
sherdan-dm-tools/
|-- README.md
|-- ROADMAP.md
|-- CLAUDE.md
|-- docker-compose.yml
|-- docs/
|   |-- decisions.md
|   |-- sherdan-import-report.md
|   `-- sherdan-phase-1-5-validation.md
|-- public/
|   `-- *.md
|-- scripts/
|   |-- bootstrap-sherdan.ts
|   |-- embed-sherdan-entities.ts
|   |-- report-sherdan-import.ts
|   `-- validate-sherdan-phase-1-5.ts
|-- src/
|   |-- app/
|   |-- components/
|   |-- db/
|   |-- lib/
|   |   |-- import/
|   |   |-- llm/
|   |   |-- parsers/
|   |   `-- validation/
|   `-- ...
`-- tests/
    `-- unit/
```

---

## Architecture Overview

The app is built around a structured campaign database.

Core ideas:

- every important campaign object becomes an entity;
- entities can represent NPCs, PCs, factions, locations, deities, items, monsters and organizations;
- entities have separate public descriptions and DM-only descriptions;
- secrets are modeled as layered information: `surface`, `intermediate`, `deep`;
- identities are first-class records, so Malakor/Dante and Noel/Yancarlos/Lust can be modeled cleanly;
- relationships and backlinks are first-class data;
- PC hooks are separate from in-fiction relationships because they describe narrative potential;
- AI tools should use the campaign database as context, not generic prompts.

The import flow is:

```txt
Sherdan markdown files
        |
        v
Parsers
        |
        v
Bootstrap plan
        |
        v
Idempotent import pipeline
        |
        v
Postgres entities, secrets, hooks, links, sessions and rules
        |
        v
Campaign Wiki / Search / Graph / Future generators
```

---

## Roadmap Summary

| Phase | Feature | Status |
|---|---|---|
| 0 | Setup and infrastructure | Done |
| 1 | Campaign Wiki | Done |
| 1.5 | Sherdan content import | Done |
| 2 | Random Tables Engine | Done |
| 3 | Generator Framework + NPC Generator | Next |
| 4 | Loot Generator | Planned |
| 5 | Encounter Builder | Planned |
| 6 | Plot Thread + Truth Clue Tracker | Planned |
| 7 | Session Prep Assistant | Planned |
| 8 | Procedural Dungeon Generator | Planned |
| 9 | Rules Lookup | Planned |
| 10 | Player Dashboard | Planned |

---

## Current Development Priority

The next priority is Phase 3: the Generator Framework + NPC Generator.

Phase 3 should deliver:

- reusable `Generator<Input, Output>` contracts;
- context retrieval from Wiki entities, links, identities and secrets;
- prompt building and structured LLM output;
- generation logging and retry/fallback behavior;
- first concrete implementation: NPC Generator calibrated on Sherdan style.

---

## Known Limitations

- Most sidebar tools beyond the Campaign Wiki and Random Tables are still placeholders.
- `public/*.md` contains raw campaign material and is not player-safe.
- Visibility filtering is not sufficient for a public Player Dashboard yet.
- Full Postgres integration tests are not automated in CI yet.
- Random Tables seed data is local DB state; run `pnpm db:seed:tables` after recreating the database.

---

## Testing

Run unit tests:

```bash
pnpm test
```

Run the full local quality gate:

```bash
pnpm env:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Before major schema or parser work, also verify:

```bash
pnpm db:migrate
pnpm db:ping
```

For Sherdan import work, verify:

```bash
pnpm db:bootstrap:sherdan
pnpm db:report:sherdan
pnpm db:validate:sherdan
```

---

## Troubleshooting

### `pnpm db:ping` fails with `ECONNREFUSED`

Postgres is probably not running.

```bash
docker compose up -d
pnpm db:ping
```

### `pnpm env:check` reports drift

The environment schema and `.env.example` are out of sync.

Update both before continuing.

### `pnpm llm:ping` fails for Ollama

Make sure Ollama is running and the configured models are pulled.

```bash
ollama serve
ollama pull mxbai-embed-large
ollama pull qwen2.5:7b-instruct-q4_K_M
pnpm llm:ping
```

### Next.js build fails because of database access

A page may be treated as static while querying the database.

Mark it as dynamic:

```ts
export const dynamic = "force-dynamic";
```

---

## Recommended GitHub Repository Metadata

Suggested description:

```txt
Local-first DM toolkit for the Sherdan D&D 5e campaign: campaign wiki, entity graph, secrets, session prep and AI-assisted generators.
```

Suggested topics:

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

## License

Private/personal campaign project unless a license is added.

Do not redistribute campaign content without permission.
