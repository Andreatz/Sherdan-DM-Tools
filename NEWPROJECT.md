# NEWPROJECT.md — ChatGPT Web Bridge per Sherdan-DM-Tools

## 0. Missione

Sviluppare in **Sherdan-DM-Tools** una nuova modalità di lavoro chiamata:

> **ChatGPT Web Bridge**

L'obiettivo è permettere al Master di usare **esclusivamente l'interfaccia web di ChatGPT** e il proprio prompt **Architetto di Mondi**, senza usare OpenAI API, Gemini API o altri provider LLM dentro l'app.

La nuova architettura deve trasformare Sherdan-DM-Tools in:

1. **memoria canonica strutturata** della campagna;
2. **generatore di pacchetti di contesto** pronti da incollare/caricare in ChatGPT web;
3. **importatore controllato** dell'output prodotto da ChatGPT;
4. **sistema di review** prima di aggiornare il database.

Non implementare chiamate automatiche a ChatGPT web.  
Non usare scraping, browser automation, reverse engineering, session cookie o API non ufficiali.

---

## 1. Regola fondamentale

Questa feature deve funzionare anche con:

```env
LLM_PROVIDER=none
```

Nessuna parte del Bridge deve richiedere:

- `OPENAI_API_KEY`
- `GOOGLE_AI_API_KEY`
- Ollama acceso
- billing API
- chiamate LLM server-side

Il flusso deve essere:

```txt
Sherdan-DM-Tools
→ esporta contesto markdown/JSON
→ utente copia o scarica file
→ utente usa ChatGPT web manualmente
→ utente incolla output in Sherdan-DM-Tools
→ Sherdan-DM-Tools salva/importa/revisiona
```

---

## 2. Contesto del progetto

Repo: `Sherdan-DM-Tools`

Stack attuale:

- Next.js 16 App Router
- TypeScript
- Zod
- Drizzle ORM
- Postgres
- Tailwind
- Pino logger
- Vitest / Playwright
- custom server con realtime WebSocket

Il progetto contiene già concetti di dominio importanti:

- `campaigns`
- `entities`
- `entity_links`
- `entity_identities`
- `entity_secrets`
- `sessions`
- `plot_threads`
- `plot_thread_events`
- `truth_clues`
- `pc_hooks`
- `players`
- `player_visibility_overrides`
- `player_dashboard_states`
- `random_tables`
- `rule_documents`

Il Bridge deve usare questi dati per costruire snapshot mirati e non enormi dump indiscriminati.

---

## 3. Obiettivo funzionale

Creare una nuova area UI:

```txt
/chatgpt-bridge
```

La pagina deve permettere al Master di:

1. scegliere una campagna;
2. scegliere un tipo di richiesta;
3. scegliere una modalità di densità;
4. selezionare sessione target, focus, location e vincoli;
5. generare un pacchetto pronto per ChatGPT web;
6. copiare negli appunti il pacchetto;
7. scaricare il pacchetto `.md`;
8. incollare l'output prodotto da ChatGPT;
9. salvarlo come documento/sessione;
10. estrarre un `UPDATE PACK` JSON, se presente;
11. revisionare e applicare manualmente gli aggiornamenti suggeriti.

---

## 4. Tipi di richiesta supportati

Implementare almeno questi tipi:

```ts
type ChatGptBridgeTaskType =
  | "session_md"
  | "session_brief"
  | "session_audit"
  | "session_patch"
  | "dialogue"
  | "txc"
  | "player_recap"
  | "gm_recap"
  | "lore"
  | "npc"
  | "faction"
  | "city"
  | "dungeon";
```

Mappatura verso i comandi dell'Architetto di Mondi:

| Tipo UI | Comando prompt |
|---|---|
| `session_md` | `/sessione --md [numero]` |
| `session_brief` | `/sessione [numero]` |
| `session_audit` | `/sessione --audit [file/testo]` |
| `session_patch` | `/sessione --patch [scena/problema]` |
| `dialogue` | `/dialogo [PNG] [situazione]` |
| `txc` | `/txc [scena]` |
| `player_recap` | `/recap giocatori` |
| `gm_recap` | `/recap gm` |
| `lore` | `/lore [argomento]` |
| `npc` | `/npc [nome/ruolo]` |
| `faction` | `/fazione [nome]` |
| `city` | `/città [nome]` |
| `dungeon` | `/dungeon [tema]` |

---

## 5. Modalità di densità

Implementare selettore:

```ts
type ChatGptBridgeDensity =
  | "Light"
  | "Standard"
  | "Full"
  | "Table-Ready"
  | "Design-Only";
```

Default: `Standard`.

Descrizione nella UI:

| Modalità | Uso |
|---|---|
| `Light` | idee rapide, scene secondarie, brainstorming |
| `Standard` | sessione normale, PNG importanti, archi medi |
| `Full` | finali d'arco, dungeon complessi, eventi politici centrali |
| `Table-Ready` | materiale pronto da usare al tavolo |
| `Design-Only` | progettazione per il Master, non testo player-facing |

---

## 6. Nuove rotte UI

### 6.1 `/chatgpt-bridge`

Pagina principale.

Componenti minimi:

- selettore campagna;
- selettore tipo richiesta;
- input numero sessione;
- input focus;
- input location;
- input durata prevista;
- input vincoli;
- selettore modalità;
- checkbox:
  - includi prompt Architetto di Mondi completo;
  - includi snapshot campagna;
  - includi ultime N sessioni;
  - includi plot thread;
  - includi truth clues;
  - includi segreti GM rilevanti;
  - includi PC hooks;
  - includi registro fazioni;
  - includi player-facing state;
  - richiedi `UPDATE PACK` JSON finale;
- pulsanti:
  - `Genera pacchetto`
  - `Copia negli appunti`
  - `Scarica .md`
  - `Apri area import`
  - `Pulisci`

Stato implementato al 2026-05-15:

- preset rapidi per sessione politica, dungeon, heist, recap giocatori e audit anti-railroad;
- relevance budget per densità/focus;
- leakage guard player-facing anche su contesti sporchi;
- review con badge match esatto/fuzzy/ambiguo/non trovato;
- conferma extra per modifiche ad alto rischio;
- Canon Diff sugli import verso sessione target;
- import debrief post-sessione verso `dmNotes`.

### 6.2 `/chatgpt-bridge/import`

Può essere una route separata o una sezione nella stessa pagina.

Campi:

- campagna;
- tipo output;
- numero sessione;
- textarea per incollare output ChatGPT;
- pulsanti:
  - `Analizza output`
  - `Salva come documento`
  - `Estrai Update Pack`
  - `Review & Apply`
  - `Annulla`

### 6.3 `/chatgpt-bridge/history`

Route implementata per lo storico Bridge.

Contenuto:

- timeline compatta export/import;
- filtro per campagna e tipo (`all`, `export`, `import`);
- conteggi export/import/apply;
- preview breve del markdown;
- badge per warning, Update Pack e modifiche applicate.
- dashboard compatta delle ultime modifiche applicate.

---

## 7. Nuove API locali

Queste API NON devono chiamare provider LLM.

### 7.1 `POST /api/chatgpt-bridge/export`

Input Zod:

```ts
const chatGptBridgeExportInputSchema = z.object({
  campaignId: z.string().uuid(),
  taskType: z.enum([
    "session_md",
    "session_brief",
    "session_audit",
    "session_patch",
    "dialogue",
    "txc",
    "player_recap",
    "gm_recap",
    "lore",
    "npc",
    "faction",
    "city",
    "dungeon",
  ]),
  density: z.enum(["Light", "Standard", "Full", "Table-Ready", "Design-Only"]).default("Standard"),
  sessionNumber: z.number().int().positive().optional(),
  focus: z.string().optional(),
  locationId: z.string().uuid().optional(),
  expectedDurationHours: z.number().positive().optional(),
  constraints: z.string().optional(),
  includeSystemPrompt: z.boolean().default(true),
  includeCampaignSnapshot: z.boolean().default(true),
  includeRecentSessions: z.boolean().default(true),
  recentSessionsLimit: z.number().int().min(1).max(10).default(5),
  includePlotThreads: z.boolean().default(true),
  includeTruthClues: z.boolean().default(true),
  includeSecrets: z.boolean().default(true),
  includePcHooks: z.boolean().default(true),
  includeFactions: z.boolean().default(true),
  includePlayerFacingState: z.boolean().default(false),
  requestUpdatePack: z.boolean().default(true),
});
```

Output:

```ts
type ChatGptBridgeExportResponse = {
  ok: true;
  filename: string;
  markdown: string;
  estimatedCharacters: number;
  warnings: string[];
};
```

### 7.2 `POST /api/chatgpt-bridge/import/analyze`

Input:

```ts
const chatGptBridgeImportAnalyzeInputSchema = z.object({
  campaignId: z.string().uuid(),
  taskType: z.string(),
  sessionNumber: z.number().int().positive().optional(),
  content: z.string().min(1),
});
```

Output:

```ts
type ChatGptBridgeImportAnalyzeResponse = {
  ok: true;
  detectedTitle?: string;
  detectedSessionNumber?: number;
  hasUpdatePack: boolean;
  updatePack?: unknown;
  markdownWithoutUpdatePack: string;
  warnings: string[];
};
```

### 7.3 `POST /api/chatgpt-bridge/import/save-session`

Salva l'output markdown come sessione o documento collegato alla sessione.

Non sovrascrivere automaticamente contenuti esistenti senza conferma.

### 7.4 `POST /api/chatgpt-bridge/import/review-update-pack`

Converte un `UPDATE PACK` JSON in una lista di modifiche candidate.

Output:

```ts
type ReviewChange =
  | {
      kind: "session_update";
      label: string;
      before: unknown;
      after: unknown;
      applyPayload: unknown;
    }
  | {
      kind: "plot_thread_event_create";
      label: string;
      applyPayload: unknown;
    }
  | {
      kind: "truth_clue_create";
      label: string;
      applyPayload: unknown;
    }
  | {
      kind: "entity_update";
      label: string;
      before: unknown;
      after: unknown;
      applyPayload: unknown;
    }
  | {
      kind: "pc_hook_create";
      label: string;
      applyPayload: unknown;
    };
```

### 7.5 `POST /api/chatgpt-bridge/import/apply`

Applica solo le modifiche selezionate dall'utente.

Mai applicare tutto automaticamente.

---

## 8. Builder del pacchetto markdown

Creare una libreria server-only:

```txt
src/lib/chatgpt-bridge/
  schemas.ts
  types.ts
  export-builder.ts
  context-queries.ts
  prompt-templates.ts
  import-parser.ts
  update-pack.ts
```

### 8.1 `context-queries.ts`

Responsabile di leggere dal DB.

Funzioni consigliate:

```ts
getCampaignSnapshot(campaignId)
getRecentSessions(campaignId, limit)
getActivePlotThreads(campaignId)
getTruthClues(campaignId)
getRelevantEntitySecrets(campaignId, options)
getPcHooks(campaignId)
getFactionSnapshot(campaignId)
getPlayerFacingState(campaignId)
getLocationContext(locationId)
```

### 8.2 `export-builder.ts`

Funzione principale:

```ts
export async function buildChatGptBridgeExport(
  input: ChatGptBridgeExportInput,
): Promise<ChatGptBridgeExportResult>
```

Deve produrre markdown ordinato, leggibile, copiabile.

---

## 9. Formato del pacchetto esportato

Il markdown generato deve avere questa struttura:

```md
# ChatGPT Bridge Export — Sherdan-DM-Tools

## 1. Task per ChatGPT

Comando:
`/sessione --md 9`

Modalità:
`Table-Ready`

Obiettivo:
...

Vincoli specifici del Master:
...

---

## 2. Istruzioni operative

Usa il prompt Architetto di Mondi.
Rispetta la gerarchia delle fonti.
Non inventare canon senza marcarlo come `📝 Lore non definita`.
Proteggi GM-Only e reveal futuri.
Non scrivere azioni, pensieri o emozioni dei PG.
Non rendere PNG onniscienti.
Produci output in italiano.

---

## 3. System Prompt — Architetto di Mondi

[Inserire prompt completo se richiesto, oppure riferimento sintetico]

---

## 4. Snapshot Campagna

...

---

## 5. Dati dal database

### 5.1 Ultime sessioni
...

### 5.2 Plot thread attivi
...

### 5.3 Truth clues
...

### 5.4 Entity secrets rilevanti
...

### 5.5 PC hooks
...

### 5.6 PNG / fazioni rilevanti
...

### 5.7 Player-facing state
...

---

## 6. Off-limits e Reveal protetti

...

---

## 7. Output richiesto

Produci markdown completo pronto da incollare.

Alla fine aggiungi anche un blocco JSON dentro una sezione:

# UPDATE PACK PER SHERDAN-DM-TOOLS
```

---

## 10. Update Pack JSON

Quando `requestUpdatePack=true`, il pacchetto deve chiedere esplicitamente a ChatGPT di produrre un blocco finale:

````md
---

# UPDATE PACK PER SHERDAN-DM-TOOLS

```json
{
  "session": {
    "number": 9,
    "title": "...",
    "recapCandidate": "...",
    "dmNotesCandidate": "..."
  },
  "plotThreadUpdates": [
    {
      "title": "...",
      "suggestedStatus": "hot",
      "event": "..."
    }
  ],
  "truthClueUpdates": [
    {
      "description": "...",
      "status": "planted",
      "truthRevealed": "..."
    }
  ],
  "npcUpdates": [
    {
      "name": "...",
      "state": "...",
      "nextMove": "..."
    }
  ],
  "newHooks": [
    {
      "pc": "...",
      "hookDescription": "..."
    }
  ]
}
```
````

L'import parser deve:

1. individuare la sezione `# UPDATE PACK PER SHERDAN-DM-TOOLS`;
2. estrarre il blocco JSON;
3. validarlo con Zod;
4. mostrare warning se non valido;
5. non fallire il salvataggio markdown se il JSON non è valido.

---

## 11. Sicurezza e privacy

Regole obbligatorie:

1. Nessun contenuto GM-Only deve essere esportato se l'utente sceglie una modalità player-facing.
2. Se `taskType=player_recap`, escludere:
   - `description` GM;
   - `dmNotes`;
   - `prepNotes`;
   - `entity_secrets`;
   - `truthRevealed`;
   - identità true non scoperte;
   - plot thread DM-only.
3. Se il task è GM-facing, includere GM-only solo se checkbox esplicita è attiva.
4. Mostrare sempre un warning visibile quando il pacchetto include segreti GM.
5. Non esportare API key, variabili `.env`, token o cookie.
6. Non loggare l'intero contenuto esportato in produzione.

---

## 12. Player-facing mode

Per richieste come:

- `player_recap`
- handout
- contenuti per dashboard giocatori

aggiungere una modalità:

```ts
audience: "gm" | "player"
```

Default: `"gm"`.

Se `audience="player"`:

- filtrare segreti;
- usare solo `publicDescription`;
- usare solo recap player-safe;
- escludere note GM;
- escludere reveal protetti;
- escludere `truthRevealed`.

---

## 13. UI consigliata

Pagina `/chatgpt-bridge`:

### Layout

- Card sinistra: configurazione export
- Card destra: anteprima markdown
- Footer sticky: azioni

### Azioni

- `Genera pacchetto`
- `Copia`
- `Scarica .md`
- `Importa risposta`
- `Reset`

### UX

- Mostrare contatore caratteri.
- Mostrare warning se export supera 80.000 caratteri.
- Permettere all'utente di disattivare sezioni.
- Evidenziare se il pacchetto contiene GM-only.
- Mostrare “Nessuna API chiamata” come badge.

---

## 14. Clipboard e download

Implementare lato client:

```ts
navigator.clipboard.writeText(markdown)
```

Download:

```ts
const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
```

Filename consigliato:

```txt
chatgpt_sherdan_sessione_9_table-ready_YYYY-MM-DD.md
```

---

## 15. Import controllato

Dopo che l'utente incolla l'output ChatGPT:

1. mostra anteprima markdown;
2. rileva titolo/sessione;
3. cerca `UPDATE PACK`;
4. mostra lista di modifiche candidate;
5. permette selezione manuale;
6. applica solo modifiche selezionate;
7. salva log dell'import.

Non fare update distruttivi.

---

## 16. Tabelle DB opzionali

Se esiste già un sistema documentale, riusarlo.

Se non esiste, creare tabelle additive:

```ts
chatgpt_bridge_exports
chatgpt_bridge_imports
```

Schema minimo suggerito:

```ts
export const chatgptBridgeExports = pgTable("chatgpt_bridge_exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  taskType: text("task_type").notNull(),
  density: text("density").notNull(),
  filename: text("filename").notNull(),
  markdown: text("markdown").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

```ts
export const chatgptBridgeImports = pgTable("chatgpt_bridge_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  taskType: text("task_type").notNull(),
  sessionNumber: integer("session_number"),
  markdown: text("markdown").notNull(),
  updatePack: jsonb("update_pack"),
  appliedChanges: jsonb("applied_changes").default([]).notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

Usare migration additiva.

---

## 17. Env e modalità LLM none

Aggiornare `src/lib/env.ts`:

```ts
LLM_PROVIDER: z.enum(["none", "gemini", "ollama", "openai"]).default("none"),
```

Aggiornare `superRefine`:

- se `LLM_PROVIDER=none`, non richiedere nessuna chiave;
- se `gemini`, richiedere `GOOGLE_AI_API_KEY`;
- se `openai`, richiedere `OPENAI_API_KEY`;
- se `ollama`, non richiedere API key ma mostra eventuali check solo nei comandi LLM.

Aggiornare `.env.example` con:

```env
LLM_PROVIDER=none
```

Aggiornare `scripts/llm-ping.ts`:

```txt
Se LLM_PROVIDER=none:
  stampa "LLM disabled. ChatGPT Web Bridge mode active."
  esci con codice 0.
```

---

## 18. Disabilitare UI AI quando LLM_PROVIDER=none

Qualsiasi bottone che oggi chiama route generative deve:

- essere nascosto;
- oppure mostrare alternativa “Esporta per ChatGPT”.

Esempi:

| Vecchio bottone | Nuovo comportamento |
|---|---|
| `Genera con AI` | `Esporta prompt per ChatGPT` |
| `Session Prep Generate` | `Prepara pacchetto ChatGPT` |
| `Reroll AI` | `Copia richiesta di reroll` |

Non rimuovere le feature LLM esistenti: renderle opzionali.

---

## 19. Test richiesti

### Unit test

- `buildChatGptBridgeExport` produce markdown valido.
- `taskType=session_md` genera comando corretto.
- `audience=player` non include GM-only.
- `requestUpdatePack=true` include istruzioni update pack.
- `import-parser` estrae JSON valido.
- `import-parser` gestisce JSON mancante senza crash.
- `update-pack` valida payload con Zod.
- `LLM_PROVIDER=none` passa env check.

### Integration test

- Export con campaign seed.
- Export con sessioni recenti.
- Import markdown semplice.
- Import con update pack.
- Review changes senza apply.
- Apply selettivo di una modifica.

### E2E smoke

- Apri `/chatgpt-bridge`.
- Seleziona campagna.
- Genera pacchetto.
- Copia o scarica.
- Incolla output finto.
- Analizza.
- Salva import.

---

## 20. Comandi da usare

Prima di iniziare:

```bash
pnpm install
pnpm typecheck
pnpm test
```

Durante sviluppo:

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
```

Se tocchi DB:

```bash
pnpm db:generate
pnpm db:migrate
```

Prima di consegnare:

```bash
pnpm env:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

Se Playwright è configurato:

```bash
pnpm test:e2e
```

---

## 21. Criteri di accettazione

La feature è completa quando:

- `LLM_PROVIDER=none` è supportato.
- `/chatgpt-bridge` è accessibile.
- L'utente può generare un pacchetto `.md`.
- Il pacchetto contiene:
  - task;
  - comando;
  - modalità;
  - vincoli;
  - snapshot;
  - dati campagna;
  - istruzioni output;
  - update pack opzionale.
- L'utente può copiare negli appunti.
- L'utente può scaricare `.md`.
- L'utente può incollare output ChatGPT.
- L'app estrae eventuale update pack JSON.
- L'app mostra modifiche candidate.
- L'app applica solo modifiche selezionate.
- Nessuna API LLM viene chiamata.
- I test principali passano.
- Nessun segreto player-facing viene esportato in modalità player.

---

## 22. Non fare

Non implementare:

- scraping di ChatGPT;
- browser automation;
- salvataggio cookie ChatGPT;
- reverse engineering di endpoint interni;
- uso automatico dell'abbonamento ChatGPT Plus;
- dipendenza obbligatoria da OpenAI API;
- auto-apply degli update senza review;
- dump indiscriminato di tutto il DB;
- esportazione di `.env` o API keys.

---

## 23. Output finale richiesto a Codex

Alla fine del task, fornire:

1. lista dei file creati;
2. lista dei file modificati;
3. migration creata, se presente;
4. comandi eseguiti;
5. test passati;
6. eventuali warning;
7. istruzioni manuali per usare il Bridge.

---

## 24. Nota prodotto

Questa feature non sostituisce ChatGPT.

Serve a rendere Sherdan-DM-Tools il **ponte manuale affidabile** tra:

```txt
database canonico della campagna
+
prompt Architetto di Mondi
+
interfaccia web di ChatGPT
```

Il valore principale è ridurre copia/incolla disordinato, evitare dimenticanze, proteggere i segreti e permettere al Master di importare nel database gli output utili prodotti da ChatGPT web.
