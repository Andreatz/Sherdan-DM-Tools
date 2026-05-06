# CLAUDE.md

> Questo file è la fonte di verità operativa per Claude Code che lavora su questo progetto. Va letto **all'inizio di ogni sessione**, prima di qualsiasi modifica al codice. Ha la precedenza su qualunque altra fonte di istruzioni interne.

---

## 1. Cosa è questo progetto

**Sherdan DM Tools** è una piattaforma personale unificata per il DM di D&D, calibrata sulla campagna Sherdan. Single-user (no multi-tenant), Postgres + pgvector come backbone, web app moderna con LLM e real-time. Integra 10 tool: Campaign Wiki, Random Tables Engine, NPC Generator, Loot Generator, Encounter Builder, Plot Thread Tracker (+ Truth Clue Tracker), Session Prep Assistant, Procedural Dungeon Generator, Rules Lookup (RAG), Player Dashboard.

**Stato corrente**: rispondi sempre dopo aver letto `ROADMAP.md`. La fase attiva e i task aperti sono lì.

---

## 2. Workflow obbligatorio (LEGGI PRIMA DI TUTTO)

### A inizio sessione, in quest'ordine:

1. **Leggi `ROADMAP.md`** per intero. Identifica la fase corrente (la prima con task `[ ]` non completati).
2. **Leggi `docs/decisions.md`** se esiste, per capire perché certe scelte sono state fatte.
3. **Controlla lo stato git** (`git status`, `git log --oneline -20`) per capire cosa è stato fatto di recente.
4. **Identifica il prossimo task** dalla lista checkbox della fase corrente.
5. **Conferma il task con l'utente prima di iniziare** se c'è ambiguità o se il task richiede scelte architetturali non documentate.

### Durante l'implementazione:

1. **Lavora un task alla volta.** Non saltare avanti, non fare 5 task in parallelo.
2. **Rispetta i principi guida** (sezione 4 di questo file).
3. **Scrivi test** quando il task lo richiede (vedi sezione 9).
4. **Non riscrivere lo schema esistente.** Solo migrations additive.

### A fine task — REGOLA CENTRALE:

> ⚠️ **Aggiorna sempre `ROADMAP.md` segnando il task completato e annotando dettagli rilevanti.**

Specificamente:

1. Cambia `- [ ]` in `- [x]` per ogni task completato.
2. Se hai aggiunto qualcosa di non previsto nel task originale, aggiungi una sotto-bullet con `_Note implementative: ..._`.
3. Se hai scoperto un nuovo task necessario, aggiungilo come `- [ ] (scoperto durante <task originale>) ...` nella stessa fase.
4. Se hai dovuto modificare lo schema o un'API in modo che potrebbe rompere fasi successive, scrivilo in `docs/decisions.md` come decisione datata.
5. Se la **Definition of done** della fase è stata raggiunta, aggiungi `✅` accanto al titolo della fase e annota la data.
6. Committa il codice + l'aggiornamento di `ROADMAP.md` insieme, **nello stesso commit** (vedi sezione 10 per il formato).

Non chiudere mai un task senza aver aggiornato `ROADMAP.md`. Non importa quanto piccola sia la modifica.

### Quando aprire un nuovo task:

Se durante l'implementazione capisci che serve fare qualcosa che non era previsto nella roadmap:

- **Se è dentro lo scope della fase corrente** → aggiungilo a `ROADMAP.md` come nuovo task `[ ]` con la nota "(scoperto durante X)" e procedi.
- **Se è fuori scope ma necessario adesso** → fermati, descrivi il problema all'utente, chiedi se vuole spostare priorità.
- **Se è fuori scope e rinviabile** → aggiungilo in una sezione `## Backlog` di `ROADMAP.md` (creala se non esiste) e procedi col task originale.

---

## 3. Stack tecnologico (riferimento)

- **DB**: Postgres 16 + estensioni `vector` (pgvector) e `pg_trgm`
- **Backend + Frontend**: Next.js 15 (App Router), TypeScript strict mode
- **ORM**: Drizzle (preferito per i tipi nativi e le migrations leggibili)
- **Validation**: Zod ovunque (input API, output LLM, parsing markdown)
- **LLM**: Anthropic SDK, dietro un'astrazione provider-agnostic in `lib/llm/`
- **Real-time** (Fase 10+): WebSocket nativi via Next.js, fallback Socket.io se serve
- **Test**: Vitest per unit, Playwright per E2E (solo dove serve davvero)
- **Lint/format**: ESLint + Prettier, configurazione standard
- **Container**: Docker Compose locale per Postgres
- **Deploy**: localhost + Tailscale per condividere con i giocatori

Se devi aggiungere una dipendenza non in questo elenco, **chiedi prima**. Non installare librerie a sentimento.

---

## 4. Principi guida non negoziabili

1. **Foundation first**: schema dati e wiki prima dei tool. Ogni tool successivo legge/scrive dal Wiki.
2. **Vertical slice**: ogni task chiude un pezzo end-to-end (DB → API → UI → integrazione). Niente "prima tutto il backend".
3. **Riuso aggressivo**: il `Generator Framework` (Fase 3) viene riusato da NPC Gen, Loot Gen, Encounter Builder, Dungeon Gen, Session Prep Assistant. Non duplicare.
4. **JSONB per i campi instabili**: schema rigido solo dove serve davvero. Promuovi a colonne quando i campi si stabilizzano (mai durante il lavoro corrente — annotalo come futuro task).
5. **Migrations sempre additive**: niente `DROP COLUMN`, niente `ALTER COLUMN ... NOT NULL` su colonne esistenti. Sempre `ADD COLUMN NULLABLE` → backfill in migration successiva → eventuale `NOT NULL` molto dopo.
6. **Personal use ≠ sciatto**: niente auth multi-tenant, ma test critici, log strutturati, backup, e gestione errori sì.
7. **Sherdan come dataset di seed e calibrazione**: ogni feature viene testata sul materiale reale (`public/*.md`) prima di considerarsi fatta.

---

## 5. Pattern Sherdan (CRITICI per lo schema e i tool)

Sherdan ha sei pattern narrativi che lo schema **deve** rispettare. Se stai lavorando a qualcosa che li tocca, conosci questi pattern a memoria:

1. **Identità multiple su una stessa entità.** Malakor↔Dante, Noel↔Yancarlos↔Lust↔Xuanji Shih. Modellate via tabella `entity_identities` separata. Una entità ha N identità, di cui una è `is_true_identity`.
2. **Segreti stratificati su tre layer.** `surface` / `intermediate` / `deep`. Indipendenti dalla visibilità del party. Tabella `entity_secrets` con enum `secret_layer`.
3. **Propaganda vs verità sullo stesso oggetto.** `entities.description` è verità GM; `entities.public_description` è ciò che il mondo crede. Idem `plot_threads`. Idem `entity_links` con `public_relation_type`.
4. **Briciole di verità tracciate.** Tabella `truth_clues` con enum `clue_status` (planted/noticed/misinterpreted/understood/lost). Granulari sotto i Plot Thread.
5. **Multi-sensorialità NPC come prima-citizen.** `properties.sensory_details: { sight, smell, sound, touch }`, `voice: { tone, accent, speech_patterns }`, `tics: string[]`. Non sepolti in `description`.
6. **Hook narrativi PG↔NPC come dato esplicito.** Tabella `pc_hooks` separata. Diversi dagli `entity_links` perché sono annotazioni DM su potenziali narrativi, non fatti in-fiction.

Se un task richiede di modellare contenuto narrativo, **assicurati che questi pattern siano sfruttati correttamente**. Non sotto-modellare. Non collassare segreti stratificati in un unico campo. Non mettere `public_description` dentro un JSONB.

---

## 6. Organizzazione del codice

```
sherdan-dm-tools/
├── ROADMAP.md                     # ⭐ Stato master del progetto
├── CLAUDE.md                      # Questo file
├── README.md                      # Setup e come avviare
├── docs/
│   ├── decisions.md               # Decisions log datato
│   ├── schema.md                  # ER diagram + DDL canonica
│   └── ...
├── public/                        # Sorgenti markdown campagna Sherdan (READ-ONLY dal codice — sono dati utente)
│   ├── Campagna.md
│   ├── Lore.md
│   └── ...
├── docker-compose.yml
├── package.json
├── drizzle.config.ts
├── src/
│   ├── app/                       # Next.js App Router (pages + API routes)
│   │   ├── (wiki)/                # Wiki UI
│   │   ├── (tools)/               # Tool UIs (NPC gen, plot tracker, ecc.)
│   │   ├── api/
│   │   └── layout.tsx
│   ├── components/                # Componenti React riusabili
│   ├── db/
│   │   ├── schema/                # Drizzle schema, una file per dominio
│   │   ├── migrations/            # Migrations generate da Drizzle
│   │   └── client.ts
│   ├── lib/
│   │   ├── llm/                   # Astrazione provider, prompt templates
│   │   ├── generators/            # Generator Framework (Fase 3+)
│   │   ├── parsers/               # Parser markdown Sherdan (Fase 1.5)
│   │   ├── validation/            # Zod schemas (anche per properties JSONB)
│   │   └── ...
│   └── types/                     # Tipi condivisi
├── scripts/
│   ├── bootstrap-sherdan.ts       # Fase 1.5: import dei .md
│   └── ...
└── tests/
    ├── unit/
    └── integration/
```

Regole:

- File schema database: uno per dominio (`entities.ts`, `sessions.ts`, `plot.ts`, ecc.) in `src/db/schema/`, un `index.ts` che ri-esporta tutto.
- Zod schemas per validare `properties` JSONB: in `src/lib/validation/`, una funzione di validazione per ogni `entity.type`.
- API routes: una route file per risorsa, GET/POST/PATCH/DELETE come handler nominati.
- Componenti React: shared in `src/components/`, specifici a una pagina dentro la cartella della pagina.
- Test: stesso albero di `src/`, ma sotto `tests/unit/` o `tests/integration/`.

---

## 7. Convenzioni di codice

- **TypeScript strict**: `strict: true`, `noUncheckedIndexedAccess: true`. Niente `any` se non assolutamente inevitabile (e in quel caso commenta il perché).
- **Naming**: tabelle DB e colonne in `snake_case`, identificatori TypeScript in `camelCase`, tipi e classi in `PascalCase`. Drizzle si occupa del mapping.
- **Niente magic numbers** o magic strings. Costanti in `src/lib/constants.ts` o vicino al loro uso, comunque nominate.
- **Errori**: errori applicativi tipizzati (estendi una classe base `AppError`). Mai `throw new Error("string")` senza tipo. API routes usano un error handler centralizzato.
- **Nessun side effect a top-level dei moduli.** Inizializzazioni dentro funzioni esplicite.
- **Nessuna modifica diretta a `process.env`** in runtime. Config tipizzata in `src/lib/config.ts` letta una sola volta.
- **Commenti**: solo dove "il codice non lo dice". Niente commenti che ripetono il nome della funzione. Niente commenti `// TODO` orfani — apri un task in `ROADMAP.md` invece.
- **Markdown nei contenuti utente**: tratta tutto ciò che è user-content come Markdown. Sanitizza solo se il contenuto va in HTML lato client; altrimenti lascialo Markdown puro.

---

## 8. Schema database — regole d'oro

1. **Una migration per ogni cambiamento.** Mai modificare una migration già committata. Sempre aggiungerne una nuova.
2. **Nomi delle migration**: `YYYYMMDDHHMM_descrizione.sql` (Drizzle lo fa automaticamente, non rinominare).
3. **Ogni nuova tabella**: indici sui foreign key, indice GIN per array e JSONB usati in WHERE, indice ivfflat per `vector` columns.
4. **Embedding columns**: `vector(1536)` se usi modelli Anthropic-default; altri valori solo se documentato in `decisions.md`.
5. **Cascade di delete**: `ON DELETE CASCADE` quando un'entità figlia non ha senso senza il padre (`entity_links` quando `entities` viene cancellata). `ON DELETE SET NULL` se il riferimento è informativo. Mai cascade silenziose tra domini diversi senza pensarci due volte.
6. **Enum**: usa Postgres `CREATE TYPE` per enum stabili (`entity_type`, `secret_layer`, `clue_status`). Per valori che evolvono, usa `TEXT` + check Zod lato applicazione.

---

## 9. Test

Non puntare al 100% di coverage. Punta a coprire:

- **Roller library** (Fase 2): test approfondito su nesting, weights, depth limit, circular refs.
- **CR calculator** (Fase 5): test contro la tabella DMG ufficiale.
- **Validation schemas Zod** per `properties` JSONB: test che dati validi passino e dati malformati falliscano con errori utili.
- **Parser Sherdan** (Fase 1.5): test con frammenti reali estratti dai `.md`. Idempotenza dell'import.
- **Migrazioni**: ogni migration deve avere un test che verifica forma post-migration.
- **API critiche**: CRUD entities, plot threads, e tutto ciò che il Player Dashboard espone.

Non testare:

- Componenti UI puri (presentazionali).
- Codice generato da Drizzle.
- Wrapper triviali su SDK.

Test framework: Vitest. Esegui con `pnpm test` (deve essere lo script in `package.json`). Test devono passare in CI.

---

## 10. Git workflow

### Branch

- `main`: sempre deployabile. Solo merge da branch di lavoro.
- Branch di lavoro: `phase-N/feature-name` (es. `phase-1/wiki-crud`, `phase-1.5/sherdan-bootstrap`).
- Niente push diretto a `main` durante lavoro continuativo. Per task atomici di pulizia (refactor minore, doc-only) si può.

### Commit

- **Un commit per task chiuso.** Il commit include codice + aggiornamento di `ROADMAP.md`.
- **Conventional commits**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `db` (per migrations).
- **Messaggio in italiano se preferisci** (questo è un progetto personale), ma sii descrittivo.
- **Esempio**:

```
feat(wiki): aggiunge entity_identities con CRUD API e UI base

- Tabella entity_identities con campi name, is_true_identity, appearance, voice
- API routes /api/entities/:id/identities (GET, POST, PATCH, DELETE)
- Componente IdentityManager nella detail view dell'entità
- Toggle "true identity" mutuamente esclusivo

Aggiorna ROADMAP.md: completa task "Identity manager" in Fase 1.

Refs: pattern Sherdan #1 (identità multiple)
```

### Push

**Non pushare mai automaticamente.** Push solo dopo conferma esplicita dell'utente, oppure se l'utente ha lasciato un'istruzione preventiva tipo "puoi pushare quando il task è chiuso e i test passano". In assenza di istruzione, ferma e chiedi.

---

## 11. Quality gate prima di considerare un task fatto

Prima di marcare un task come `[x]` in `ROADMAP.md`:

1. ✅ Il codice fa quello che il task descrive.
2. ✅ I test rilevanti passano (`pnpm test`).
3. ✅ TypeScript compila senza errori (`pnpm typecheck` o `tsc --noEmit`).
4. ✅ Lint passa (`pnpm lint`).
5. ✅ Se hai modificato lo schema, la migration è stata generata (`pnpm db:generate`) e applicata localmente (`pnpm db:migrate`).
6. ✅ Se la feature è osservabile, l'hai testata manualmente almeno una volta (esegui `pnpm dev`, vai sulla pagina, verifica).
7. ✅ Hai aggiornato `ROADMAP.md`.
8. ✅ Hai aggiornato `docs/decisions.md` se la decisione era non ovvia.

Se uno di questi step fallisce, **non chiudere il task**. Scrivi un commit `wip:` con quello che hai, lascia il task `[ ]`, e descrivi il blocco all'utente.

---

## 12. Cosa NON fare

1. **Non saltare la Fase 0** (setup) o la Fase 1.5 (bootstrap Sherdan). Sono fondazionali.
2. **Non modificare i file in `public/`.** Sono dati utente. Sola lettura per il codice.
3. **Non re-disegnare lo schema dati.** È stato progettato per durare. Refactor di codice sì, redesign no. Se senti l'urgenza di redesign, fermati e chiedi all'utente.
4. **Non aggiungere feature fuori scope della fase corrente.** Backlog → fase futura. Mai inline.
5. **Non installare dipendenze a caso.** Conferma prima.
6. **Non eseguire `git push`** senza autorizzazione.
7. **Non eseguire migrations distruttive** (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`) senza autorizzazione esplicita per quella specifica operazione.
8. **Non scrivere segreti, API key, o credenziali** in nessun file committato. Usa `.env` (in `.gitignore`).
9. **Non commit di file generati** (`node_modules/`, `.next/`, `dist/`, dump del DB, ecc.).
10. **Non usare `any` in TypeScript** se puoi evitarlo. Se devi, commenta il perché sopra la riga.
11. **Non collassare i pattern Sherdan** in modelli più semplici per "andare più veloce". Sono il motivo per cui lo schema è così.
12. **Non assumere che l'utente voglia una feature solo perché "è ovvia".** Se non è in `ROADMAP.md`, chiedi.

---

## 13. Quando fermarsi e chiedere all'utente

Ferma il lavoro e chiedi se:

- Una decisione architetturale non è coperta da `ROADMAP.md` o `docs/decisions.md`.
- Stai per modificare uno dei pattern Sherdan (sezione 5).
- Devi installare una dipendenza non in stack (sezione 3).
- Stai per fare una migration distruttiva.
- Il task richiede una scelta di UX che cambia significativamente il comportamento di una feature.
- Hai trovato un bug o un'incoerenza nello schema o in `ROADMAP.md` che potrebbe richiedere modifiche a fasi precedenti.
- I test falliscono in modo che richiedono modifiche a codice che non avevi previsto di toccare.
- Stai per pushare a remote.

In tutti questi casi: scrivi un breve riassunto del problema, le opzioni che vedi (con pro/contro), e la tua raccomandazione. Aspetta risposta.

Per tutto il resto: **agisci con autonomia**. Non chiedere il permesso per ogni piccolo dettaglio implementativo (naming di una variabile, scelta tra due librerie ugualmente in stack, struttura interna di un componente). Decidi e procedi.

---

## 14. Auto-aggiornamento di questo file

Se durante il lavoro scopri:

- Una convenzione non documentata che hai dovuto stabilire.
- Una decisione architetturale che si applica trasversalmente.
- Un nuovo pattern Sherdan che emerge dal materiale.
- Un'istruzione che l'utente ha dato e che dovrebbe diventare regola permanente.

→ proponi un aggiornamento a `CLAUDE.md` nello stesso commit, e segnalalo nel commit message. L'utente confermerà la modifica.

Non auto-modificare regole esistenti senza approvazione esplicita. Solo aggiungere.

---

## 15. Riferimenti rapidi

| File | Cosa contiene |
|------|---------------|
| `ROADMAP.md` | Master plan con fasi, task, definition of done. **Aggiorna sempre.** |
| `docs/decisions.md` | Decision log datato. Append-only. |
| `docs/schema.md` | DDL canonica e ER diagram. Aggiorna quando cambia lo schema. |
| `public/*.md` | Materiale campagna Sherdan. **Sola lettura.** |
| `.env.example` | Variabili ambiente necessarie (senza valori reali). |
| `package.json` | Script disponibili: `dev`, `build`, `test`, `lint`, `typecheck`, `db:generate`, `db:migrate`, `db:studio`. |

---

## 16. TL;DR per ogni sessione

1. Leggi `ROADMAP.md`.
2. Identifica il prossimo task `[ ]` della fase corrente.
3. Lavora un task alla volta, rispettando i pattern Sherdan e i principi guida.
4. **A fine task**: aggiorna `ROADMAP.md` (segna `[x]`, aggiungi note implementative, eventuali nuovi task scoperti), passa il quality gate (sezione 11), committa codice + roadmap insieme.
5. Non pushare senza permesso.
6. Quando in dubbio, chiedi (sezione 13). Quando non in dubbio, agisci.
