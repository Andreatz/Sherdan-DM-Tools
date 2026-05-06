# Sherdan DM Tools

Piattaforma personale per il DM della campagna **Sherdan** (D&D 5e). Web app
unificata con 10 tool integrati: Campaign Wiki, Random Tables, NPC Generator,
Loot Generator, Encounter Builder, Plot Thread + Truth Clue Tracker, Session
Prep Assistant, Procedural Dungeon Generator, Rules Lookup, Player Dashboard.

Single-user (single-tenant), Postgres + pgvector come backbone, Next.js full-stack,
LLM via Gemini (free tier) + Ollama come fallback offline.

> Per la roadmap completa e lo stato di avanzamento: [`ROADMAP.md`](./ROADMAP.md).
> Per le decisioni architetturali datate: [`docs/decisions.md`](./docs/decisions.md).
> Per il workflow Claude Code (questo file ha la precedenza per l'agente): [`CLAUDE.md`](./CLAUDE.md).

---

## Pre-requisiti

| Tool | Versione | Note |
|------|----------|------|
| Node.js | 24+ | `node --version` |
| pnpm | 10+ | `npm i -g pnpm` se manca |
| Docker Desktop | recente | per Postgres locale |
| Ollama | recente | opzionale: solo per fallback offline + embedding |

Hardware testato: i7-12700H, 16 GB RAM, RTX 3050 4 GB VRAM (Windows 11).

---

## Setup (prima volta)

```powershell
# 1. Clone
git clone <repo-url> sherdan-dm-tools
cd sherdan-dm-tools

# 2. Dipendenze
pnpm install

# 3. Variabili d'ambiente
Copy-Item .env.example .env
# Edita .env e riempi:
#   - GOOGLE_AI_API_KEY (gratis su https://ai.google.dev — vedi sotto)
#   - le credenziali Postgres se vuoi cambiare i default
pnpm env:check  # verifica sync .env <-> .env.example <-> schema Zod

# 4. Postgres locale (con pgvector + pg_trgm)
docker compose up -d
pnpm db:migrate          # applica le migration Drizzle
pnpm db:ping             # sanity check: deve elencare PostgreSQL 16 + estensioni

# 5. Ollama (opzionale, per fallback offline + embedding)
# Scarica e installa da https://ollama.com
ollama pull mxbai-embed-large            # ~670 MB, embedding 1024-dim
ollama pull qwen2.5:7b-instruct-q4_K_M   # ~4.7 GB, fallback chat (opzionale)
pnpm llm:ping            # verifica end-to-end Gemini + Ollama

# 6. Dev server
pnpm dev                 # http://localhost:3000
```

### Ottenere una Gemini API key (free tier)

1. Vai su https://ai.google.dev
2. "Get API key" → crea un nuovo progetto Google Cloud (**senza** abilitare il
   billing, cosi' sei hard-capped al free tier e non rischi addebiti).
3. Copia la key in `.env` come `GOOGLE_AI_API_KEY=...`.
4. Modello di default: `gemini-3-flash-preview` (free tier, qualita' decente
   in italiano). Vedi [`docs/decisions.md`](./docs/decisions.md) per
   l'inventario dei modelli free disponibili.

> ⚠️ **Privacy free tier**: Google puo' usare i tuoi input/output per migliorare
> i loro modelli. Se vuoi privacy assoluta, setta `LLM_PROVIDER=ollama` in `.env`
> e usa solo Ollama locale.

---

## Comandi quotidiani

### Sviluppo
```powershell
pnpm dev                 # avvia il dev server (http://localhost:3000)
pnpm db:studio           # GUI Drizzle per ispezionare il DB
pnpm llm:ping            # verifica salute LLM (Gemini + Ollama)
```

### Quality gate (eseguito anche da CI)
```powershell
pnpm env:check           # sync .env / schema Zod
pnpm lint                # ESLint
pnpm typecheck           # tsc --noEmit
pnpm test                # vitest run
pnpm build               # next build
```

### Database
```powershell
pnpm db:generate         # genera nuova migration dopo modifica schema
pnpm db:migrate          # applica migration al DB locale
pnpm db:push             # alternative: push diretto (solo dev/prototipi)
docker compose down      # ferma Postgres
docker compose down -v   # distrugge il volume (CANCELLA TUTTI I DATI)
```

---

## Struttura

```
sherdan-dm-tools/
├── ROADMAP.md             # ⭐ master plan delle 11 fasi
├── CLAUDE.md              # workflow per Claude Code (precedenza assoluta)
├── README.md              # questo file
├── docker-compose.yml     # Postgres 16 + pgvector + pg_trgm
├── docs/
│   └── decisions.md       # decision log datato (append-only)
├── public/                # sorgenti markdown campagna Sherdan (READ-ONLY)
├── src/
│   ├── app/               # Next.js App Router (pages + future API routes)
│   ├── components/        # componenti React riusabili
│   ├── db/
│   │   ├── client.ts      # Drizzle + postgres.js
│   │   ├── schema/        # schema split per dominio
│   │   └── migrations/    # migration generate da drizzle-kit
│   ├── lib/
│   │   ├── env.ts         # config tipizzata (Zod)
│   │   ├── logger.ts      # pino strutturato + redaction
│   │   ├── llm/           # provider abstraction (Gemini + Ollama + Router)
│   │   └── validation/    # Zod schemas per properties JSONB
│   └── ...
├── scripts/               # script CLI (db-ping, llm-ping, env-check, ...)
└── tests/
    └── unit/              # test vitest
```

---

## Stack

- **Frontend + Backend**: Next.js 16 (App Router), TypeScript strict mode
- **DB**: Postgres 16 + `pgvector` (1024-dim) + `pg_trgm`
- **ORM**: Drizzle + driver `postgres.js`
- **Validation**: Zod 4
- **LLM**: Gemini API primario + Ollama fallback (provider abstraction in `src/lib/llm/`)
- **Logging**: pino + pino-pretty
- **Test**: Vitest 4
- **Lint/format**: ESLint 9 + Prettier
- **CI**: GitHub Actions (lint + typecheck + test + build)
- **Deploy**: localhost + Tailscale (Fase 10)

---

## Stato del progetto

In **Fase 0** (Setup & infrastruttura). I tool nella sidebar dell'app sono
quasi tutti placeholder etichettati con la fase che li sblocca. Il primo tool
reale (Campaign Wiki) arriva in Fase 1.

Per la lista task aperti e la prossima azione, vedi [`ROADMAP.md`](./ROADMAP.md).

---

## Troubleshooting

**`pnpm db:ping` fallisce con "ECONNREFUSED"**
→ Container Postgres non in esecuzione. `docker compose up -d` e attendi 5s.

**`pnpm llm:ping` fallisce con "Gemini HTTP 429 ... limit: 0"**
→ Hai impostato un modello Pro nel `.env` (`gemini-3.1-pro-preview`,
`gemini-2.5-pro`, ecc.). I Pro non hanno free tier: passa a un Flash
(`gemini-3-flash-preview` consigliato).

**`pnpm llm:ping` fallisce con "Ollama unreachable"**
→ Il servizio Ollama non gira. Avvia l'app desktop o `ollama serve`. Se non
hai Ollama installato e usi solo Gemini, ignora il fail su Ollama embed (la
chat funziona comunque, ma gli embedding richiedono Ollama).

**Build di `next` fallisce con errori sulla connessione DB**
→ Una pagina e' marcata come static ma fa query al DB. Aggiungi
`export const dynamic = "force-dynamic"` alla pagina.

**`pnpm env:check` segnala drift**
→ Hai aggiunto una var in `.env.example` ma non in `src/lib/env.ts`
(o viceversa). Il messaggio dice quale. Allinea i due e ri-lancia.
