# Sherdan DM Tools

Personal Dungeon Master toolkit for the Sherdan D&D 5e campaign.

Sherdan DM Tools is a local-first, single-user web app designed to turn the full Sherdan campaign material into a structured, searchable and AI-assisted DM workspace.

The long-term goal is to provide one integrated platform for:

- Campaign Wiki
- Entity graph
- NPC and faction management
- Secrets and truth tracking
- Session prep
- Random tables
- NPC generation
- Loot generation
- Encounter building
- Procedural dungeon generation
- Rules lookup
- Player-safe dashboard

> This project is built specifically for the Sherdan campaign, but the architecture is designed to become reusable for other narrative-heavy D&D campaigns.

---

## Current Status

The project is currently in early MVP development.

| Area | Status |
|---|---|
| Project foundation | Done |
| Next.js app shell | Done |
| Postgres + pgvector setup | Done |
| Drizzle schema | In progress |
| Campaign Wiki | In progress |
| Entity API | Partial |
| Sherdan markdown parsers | Partial |
| Idempotent import pipeline | Not complete |
| Random Tables | Planned |
| NPC Generator | Planned |
| Player Dashboard | Planned |

The repository is no longer only a setup scaffold: parser work for real Sherdan material has already started.

However, the app is not yet a complete DM-facing product.

For the full implementation plan, see [`ROADMAP.md`](./ROADMAP.md).

For architecture decisions, see [`docs/decisions.md`](./docs/decisions.md).

---

## Important Privacy Notice

Sherdan campaign source files are currently stored in `public/`.

This means they can be served as static files by Next.js during local development or deployment.

This is acceptable only under the current assumptions:

- single-user app;
- local development;
- private network or Tailscale access;
- no public deployment;
- no player-facing access to the raw app.

Before enabling a public or semi-public Player Dashboard, the campaign source files should be moved outside `public/`, for example:

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
| LLM primary | Gemini API |
| LLM local fallback | Ollama |
| Package manager | pnpm |
| CI | GitHub Actions |

---

## Requirements

| Tool | Version |
|---|---|
| Node.js | 24+ |
| pnpm | 10+ |
| Docker Desktop | recent |
| Ollama | optional |

Recommended local machine:

- 16 GB RAM or more;
- Docker available;
- Ollama installed only if you want offline fallback and local embeddings.

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

## Optional: Ollama Setup

Ollama is used for local fallback and embeddings.

```bash
ollama pull mxbai-embed-large
ollama pull qwen2.5:7b-instruct-q4_K_M
pnpm llm:ping
```

If you only want to use Gemini for chat features, Ollama is optional.

Embedding features require a local embedding model unless another provider is configured.

---

## Environment Variables

Create `.env` from `.env.example`.

```bash
cp .env.example .env
pnpm env:check
```

The `env:check` command verifies that:

- `.env.example` is aligned with the Zod schema;
- required variables are documented;
- local configuration is valid.

Main variables:

```txt
DATABASE_URL=
LLM_PROVIDER=
GOOGLE_AI_API_KEY=
OLLAMA_BASE_URL=
```

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
├── README.md
├── ROADMAP.md
├── CLAUDE.md
├── docker-compose.yml
├── docs/
│   └── decisions.md
├── public/
│   └── *.md
├── scripts/
├── src/
│   ├── app/
│   ├── components/
│   ├── db/
│   │   ├── client.ts
│   │   ├── migrate.ts
│   │   ├── migrations/
│   │   └── schema/
│   ├── lib/
│   │   ├── env.ts
│   │   ├── logger.ts
│   │   ├── llm/
│   │   ├── parsers/
│   │   └── validation/
│   └── ...
└── tests/
    └── unit/
```

---

## Architecture Overview

The app is built around a structured campaign database.

Core ideas:

- every important campaign object becomes an entity;
- entities can represent NPCs, factions, locations, deities, items, events, sessions and plot threads;
- entities can have public descriptions and DM-only descriptions;
- secrets are modeled as layered information;
- relationships between entities are first-class data;
- future AI tools should use the campaign database as context, not generic prompts.

The intended flow is:

```txt
Sherdan markdown files
        ↓
Parsers
        ↓
Import plans
        ↓
Idempotent import pipeline
        ↓
Postgres entities
        ↓
Campaign Wiki / Search / Graph / Generators
```

---

## Roadmap Summary

| Phase | Feature | Status |
|---|---|---|
| 0 | Setup and infrastructure | Mostly done |
| 1 | Campaign Wiki | In progress |
| 1.5 | Sherdan content import | In progress |
| 2 | Random Tables Engine | Planned |
| 3 | Generator Framework + NPC Generator | Planned |
| 4 | Loot Generator | Planned |
| 5 | Encounter Builder | Planned |
| 6 | Plot Thread + Truth Clue Tracker | Planned |
| 7 | Session Prep Assistant | Planned |
| 8 | Procedural Dungeon Generator | Planned |
| 9 | Rules Lookup | Planned |
| 10 | Player Dashboard | Planned |

---

## Current Development Priority

The next priority should be completing a full Campaign Wiki vertical slice:

1. list entities;
2. open entity detail page;
3. edit public and DM-only descriptions;
4. display secrets;
5. display relationships;
6. display PC hooks;
7. search entities;
8. import Sherdan markdown without duplicates.

New generators should wait until the Wiki and import pipeline are stable.

---

## Known Limitations

- Most sidebar tools are still placeholders.
- The Campaign Wiki is not yet feature-complete.
- The import pipeline is not fully idempotent yet.
- CI currently focuses on unit-level validation and does not yet run full Postgres integration tests.
- Sherdan source markdown files are currently inside `public/`.
- Player-facing features are not safe until visibility filtering is complete.

---

## Testing

Run:

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

Before merging major schema or parser changes, also verify:

```bash
pnpm db:migrate
pnpm db:ping
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

Make sure Ollama is running.

```bash
ollama serve
```

Then retry:

```bash
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
