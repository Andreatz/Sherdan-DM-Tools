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
