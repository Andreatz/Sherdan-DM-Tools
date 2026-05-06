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
