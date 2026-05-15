# Release locale / readiness checklist

Questa checklist serve prima di una sessione importante, prima di esporre il Player Dashboard o dopo modifiche strutturali al progetto.

## 1. Ambiente

```bash
pnpm install
pnpm env:check
docker compose up -d
pnpm db:ping
```

Se `pnpm env:check` fallisce, allinea `.env`, `.env.example` e `src/lib/env.ts` prima di procedere.

## 2. Database

```bash
pnpm db:migrate
pnpm db:ping
```

Per una campagna nuova:

```bash
pnpm db:seed
pnpm db:seed:tables
```

Per importare il corpus Sherdan:

```bash
pnpm content:check:safe
pnpm db:bootstrap:sherdan
pnpm db:validate:sherdan
```

## 3. Backup

Prima di lavorare su contenuti canonici:

```bash
pnpm db:backup
```

Smoke sicuro su database test:

```bash
pnpm db:backup:smoke
```

Ripristino manuale, distruttivo:

```bash
CONFIRM=yes pnpm db:restore -- backups/sherdan-YYYYMMDD-HHMMSS.sql
```

Usa `db:restore` solo dopo aver controllato il file. I dump nuovi includono `--clean --if-exists`, quindi possono ricreare lo schema durante il restore.

## 4. Quality gate

Percorso rapido:

```bash
pnpm check
```

Percorso completo locale:

```bash
pnpm env:check
pnpm content:check:safe
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration:local
pnpm test:e2e:local
pnpm build
```

Usa sempre le varianti `:local` per integration/E2E sul tuo PC: derivano `sherdan_dm_test` da `DATABASE_URL` e rifiutano il DB reale.

## 5. Player-facing

Prima di condividere `/player`:

```bash
pnpm content:check:safe
```

Poi verifica `/status`:

- `Leak public/` deve essere `0`;
- `Database` deve essere `Connesso`;
- `Player Dashboard` non deve segnalare blocchi;
- `Realtime` deve mostrare `/api/realtime`.

## 6. LLM mode

Modalita consigliata:

```env
LLM_PROVIDER=none
```

Con questa modalita il ChatGPT Web Bridge resta il percorso primario e nessuna route critica richiede API key. Se abiliti `gemini`, `openai` o `ollama`, verifica:

```bash
pnpm llm:ping
```

## 7. Avvio

```bash
pnpm dev
```

App locale:

```txt
http://localhost:3000
```
