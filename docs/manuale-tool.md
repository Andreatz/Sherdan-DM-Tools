# Manuale Completo di Sherdan DM Tools

Versione documento: 2026-05-15  
Ambito: manuale operativo, tecnico e di manutenzione del tool  
Pubblico: Dungeon Master, sviluppatore del progetto, futuro manutentore

---

## 1. Cos'e Sherdan DM Tools

Sherdan DM Tools e un workspace locale per gestire una campagna D&D 5e
complessa. Il tool nasce per la campagna homebrew Sherdan, ma la struttura e
abbastanza generale da funzionare come piattaforma per:

- wiki di campagna;
- canon narrativo;
- segreti GM;
- identita multiple;
- relazioni tra entita;
- sessioni;
- plot thread;
- briciole di verita;
- dashboard player-safe;
- tabelle casuali;
- lookup regole;
- gestione realtime al tavolo;
- export/import manuale con ChatGPT Web.

La filosofia del progetto e:

```txt
Database locale come fonte canonica
+ UI operativa per il DM
+ Player Dashboard controllata
+ ChatGPT Web Bridge manuale
+ LLM server-side opzionali
```

Il tool deve restare utile anche con:

- `LLM_PROVIDER=none`;
- nessuna API key;
- nessun billing cloud;
- uso locale su una sola macchina;
- esposizione ai giocatori solo via LAN o Tailscale.

---

## 2. Principi Mentali Del Tool

### 2.1 Il Database E Il Canon

Il database Postgres e la fonte di verita. I markdown originali sono sorgenti
storiche e materiale di import, ma una volta importati il lavoro quotidiano
avviene nel database.

Quando modifichi una entity, un plot thread, una sessione o una briciola,
stai modificando il canon operativo.

### 2.2 Verita GM E Versione Pubblica Sono Separate

Il progetto distingue sempre tra:

- cosa e vero per il DM;
- cosa il mondo crede;
- cosa i giocatori hanno scoperto;
- cosa un singolo player puo vedere.

Questa separazione e fondamentale. Non usare mai un campo pubblico per salvare
segreti GM.

### 2.3 ChatGPT Propone, Il DM Applica

Il ChatGPT Web Bridge non aggiorna automaticamente il database. Il flusso
corretto e:

```txt
export dal tool
-> lavoro in ChatGPT Web
-> import output
-> review Update Pack
-> apply selettivo
```

Il DM resta il gate finale.

### 2.4 Player-Safe Non Significa "Tutto Pubblico"

Le route player-facing usano proiezioni sicure. Anche quando un oggetto e
visibile, non vengono esposti campi GM-only come:

- `description`;
- `dmNotes`;
- `prepNotes`;
- `properties`;
- `embedding`;
- segreti;
- `truthRevealed`;
- prompt o output LLM non revisionati.

### 2.5 Local-First Prima Di Tutto

Il progetto non e un SaaS. E pensato per uso personale, locale, con controllo
diretto del database, dei backup e dei contenuti.

---

## 3. Prerequisiti

### 3.1 Software Richiesto

| Tool | Uso | Note |
|---|---|---|
| Node.js 24+ | runtime e build | consigliata versione moderna |
| pnpm 10+ | package manager | usato da tutti gli script |
| Docker Desktop | Postgres locale | necessario per DB standard |
| PostgreSQL client tools | backup/restore | `pg_dump` e `psql` |
| Playwright Chromium | E2E | installabile via pnpm |
| Ollama | opzionale | solo embedding/LLM locale |

### 3.2 Hardware Consigliato

- 16 GB RAM o piu;
- SSD;
- Docker attivo;
- rete locale stabile se usi Player Dashboard da altri dispositivi;
- GPU non necessaria se usi `LLM_PROVIDER=none`.

### 3.3 Provider LLM

Provider possibili:

| Provider | Valore `LLM_PROVIDER` | Quando usarlo |
|---|---|---|
| Nessuno | `none` | percorso consigliato, usa Bridge manuale |
| Gemini | `gemini` | generazione server-side con Google AI |
| OpenAI | `openai` | generazione server-side con OpenAI |
| Ollama | `ollama` | generazione locale |

Il percorso piu stabile e meno costoso e:

```env
LLM_PROVIDER=none
```

---

## 4. Installazione E Primo Avvio

### 4.1 Installare Dipendenze

```bash
pnpm install
```

### 4.2 Configurare Env

```bash
cp .env.example .env
pnpm env:check
```

Configurazione minima consigliata:

```env
DATABASE_URL=postgresql://sherdan:sherdan_dev@localhost:5432/sherdan_dm
LLM_PROVIDER=none
SHERDAN_PLAYER_ACCESS_CODE=
```

### 4.3 Avviare Database

```bash
docker compose up -d
pnpm db:ping
```

### 4.4 Applicare Migrations

```bash
pnpm db:migrate
```

### 4.5 Avviare App

```bash
pnpm dev
```

App:

```txt
http://localhost:3000
```

Status:

```txt
http://localhost:3000/status
```

---

## 5. Comandi Fondamentali

### 5.1 Sviluppo

```bash
pnpm dev
pnpm build
pnpm start
```

### 5.2 Qualita

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

Percorso completo prima di una sessione importante:

```bash
pnpm env:check
pnpm content:check:safe
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration:local
pnpm test:e2e:local
pnpm db:backup:smoke
pnpm build
```

### 5.3 Database

```bash
pnpm db:ping
pnpm db:migrate
pnpm db:studio
pnpm db:seed
pnpm db:seed:tables
```

### 5.4 Backup E Restore

```bash
pnpm db:backup
pnpm db:backup:smoke
CONFIRM=yes pnpm db:restore -- backups/sherdan-YYYYMMDD-HHMMSS.sql
```

### 5.5 Import Sherdan

```bash
pnpm content:migrate:sherdan
pnpm content:check:safe
pnpm db:bootstrap:sherdan
pnpm db:report:sherdan
pnpm db:validate:sherdan
```

### 5.6 Embedding Opzionali

```bash
ollama serve
ollama pull mxbai-embed-large
pnpm db:embed:sherdan
pnpm db:embed:backfill
pnpm db:embed:rules
```

### 5.7 Manutenzione Player Visibility

```bash
pnpm db:cleanup:player-overrides -- --dry-run
pnpm db:cleanup:player-overrides
```

### 5.8 Performance Locale

```bash
pnpm perf:seed -- --campaign "Performance Seed" --entities 1000 --plot-threads 120 --truth-clues 400
pnpm perf:profile -- <campaign_id>
```

---

## 6. Struttura Dell'Interfaccia

L'app usa una shell laterale con sezioni operative:

- Core;
- Canon;
- Generators;
- AI & Tools;
- Tavolo.

Ogni voce ha uno stato:

| Stato | Significato |
|---|---|
| Pronto | usabile end-to-end |
| Opzionale | dipende da provider extra o da LLM |
| Beta | usabile, ma ancora da rifinire |
| Schema | DB/API presenti, UI incompleta |
| Pianificato | non implementato |

La UI e progettata per desktop/tablet durante la preparazione e per uso rapido
durante la sessione.

---

## 7. Home

Route:

```txt
/
```

La Home e un punto di ingresso. Serve a orientarsi tra:

- Canon;
- Preparazione;
- Tavolo.

Usala quando vuoi ripartire senza ricordarti la route esatta.

---

## 8. Status Progetto

Route:

```txt
/status
```

Questa pagina e la checklist visiva di readiness.

Mostra:

- stato database;
- numero migration;
- modalita LLM;
- ultimo backup rilevato;
- sorgenti privati in `content/sherdan/`;
- assenza di leak in `public/`;
- realtime;
- stato feature.

### 8.1 Quando Usarla

Aprila:

- prima di una sessione;
- dopo una migration;
- dopo un restore;
- quando sospetti leak di contenuti;
- quando vuoi verificare se il tool e pronto.

### 8.2 Interpretazione

| Card | Valore Buono | Azione Se Fallisce |
|---|---|---|
| Database | Connesso | avvia Docker, controlla `DATABASE_URL` |
| Migration | numero non nullo | esegui `pnpm db:migrate` |
| LLM mode | `none` o provider atteso | controlla `.env` |
| Ultimo backup | Trovato | esegui `pnpm db:backup` |
| Leak public | 0 | rimuovi markdown raw da `public/` |

---

## 9. Campagne E Campaign Wiki

Route:

```txt
/campaigns
/campaigns/[id]
```

La Campaign Wiki e il cuore del tool.

### 9.1 Concetto Di Campaign

Una campaign contiene:

- entita;
- sessioni;
- plot thread;
- truth clues;
- player;
- visibility override;
- player dashboard state;
- export/import Bridge.

### 9.2 Creare Una Campagna

Vai su `/campaigns` e crea una campagna con nome e descrizione.

### 9.3 Lista Entita

Dentro una campagna trovi:

- filtro per tipo;
- filtro tag;
- ricerca testuale;
- tabella entita;
- detail panel;
- grafo entita.

### 9.4 Tipi Di Entita

Tipi principali:

- `npc`;
- `pc`;
- `location`;
- `faction`;
- `item`;
- `monster`;
- `deity`;
- `organization`.

### 9.5 Campi Principali Di Una Entita

| Campo | Uso |
|---|---|
| `name` | nome canonico |
| `type` | tipo entita |
| `description` | verita GM, mai player-facing |
| `publicDescription` | versione pubblica/player-safe |
| `visibility` | `dm_only`, `discovered`, `public` |
| `properties` | JSONB tipizzato per tipo |
| `tags` | categorizzazione |
| `parentId` | gerarchie location/faction |

### 9.6 Tab Detail Entita

Ogni entita ha tab:

| Tab | Scopo |
|---|---|
| Verita GM | contenuto privato del DM |
| Versione pubblica | testo mostrabile o riassumibile ai player |
| Properties | dati strutturati type-specific |
| Identita | alias, false identity, true identity |
| Segreti | segreti surface/intermediate/deep |
| Links | relazioni in uscita |
| Backlinks | relazioni in entrata |
| Hooks PG | agganci narrativi PG-target |
| Plot threads | collegamenti narrativi |
| Visibility player | override per-player |

### 9.7 Identita

Le identita servono quando un personaggio o'entita ha piu volti.

Esempi:

- nome pubblico;
- alias;
- vera identita;
- forma mascherata;
- identita usata in una sessione specifica.

Campi importanti:

- nome;
- `isTrueIdentity`;
- appearance;
- voice;
- mannerisms;
- active from/until session;
- visibility;
- notes.

### 9.8 Segreti Stratificati

I segreti hanno layer:

| Layer | Significato |
|---|---|
| `surface` | segreto superficiale, facile da scoprire |
| `intermediate` | segreto medio, richiede indagine |
| `deep` | verita profonda o twist importante |

Un segreto puo puntare a:

- entity;
- plot thread.

### 9.9 Link Entita

I link descrivono relazioni in-fiction.

Campi:

- source entity;
- target entity;
- relation type reale;
- public relation type;
- strength;
- description;
- visibility.

Esempio:

```txt
Mara -> Velkan
relationType: blackmails
publicRelationType: knows
visibility: dm_only
```

### 9.10 Hooks PG

I PC hooks non sono semplici relazioni. Sono opportunita narrative.

Usali per:

- legare un PG a un PNG;
- annotare un arco potenziale;
- ricordare una leva drammatica;
- segnare se un hook e disponibile, in corso o risolto.

### 9.11 Grafo Entita

Il grafo visualizza le relazioni. E utile per:

- vedere cluster;
- trovare PNG isolati;
- capire fazioni e alleanze;
- verificare se un link manca;
- preparare sessioni sociali.

---

## 10. Sessioni

Route:

```txt
/sessions
```

La workbench Sessioni gestisce il registro delle sessioni.

### 10.1 Campi Sessione

| Campo | Uso |
|---|---|
| number | numero progressivo |
| title | titolo sessione |
| date | data reale |
| recap | riassunto player-facing |
| dmNotes | note private GM |
| prepNotes | materiale di preparazione |

### 10.2 Aggregati Sessione

La pagina mostra anche:

- plot thread events collegati;
- truth clues piantate in sessione;
- loot bundles;
- encounters usati;
- note operative.

### 10.3 Best Practice

Dopo ogni sessione:

1. aggiorna recap;
2. aggiungi DM notes;
3. sposta materiale utile in prep notes della sessione futura;
4. registra eventi plot thread;
5. aggiorna truth clues;
6. fai backup.

---

## 11. Plot Thread Tracker

Route:

```txt
/plot-threads
```

Il Plot Thread Tracker gestisce archi narrativi.

### 11.1 Status

| Status | Significato |
|---|---|
| `hot` | immediato, rilevante alla prossima sessione |
| `warm` | attivo, ma non urgente |
| `cold` | presente sullo sfondo |
| `resolved` | chiuso |
| `abandoned` | abbandonato o non piu utile |

### 11.2 Campi

- title;
- description GM;
- public description;
- status;
- priority;
- visibility;
- last advanced at.

### 11.3 Timeline Eventi

Ogni thread puo avere eventi:

- introduced;
- advanced;
- twist;
- resolved;
- public reveal;
- private reveal;
- chatgpt_bridge_update.

### 11.4 Entita Collegate

Collega entita con ruolo:

- instigator;
- victim;
- ally;
- enemy;
- witness;
- location;
- artifact;
- other.

### 11.5 Stale Alerts

I thread non avanzati da tempo possono emergere come stale. Usali per decidere:

- rilanciarli;
- raffreddarli;
- chiuderli;
- trasformarli in background.

---

## 12. Truth Clue Tracker

Route:

```txt
/truth-clues
```

Le truth clues sono briciole che puntano a una verita GM.

### 12.1 Differenza Tra Clue E Truth

| Elemento | Esempio |
|---|---|
| clue | "Il simbolo odora di sale e cenere." |
| truth | "Il contrabbando passa dal vecchio faro." |

La clue e cio che appare in fiction. La truth e cio che significa davvero.

### 12.2 Status

| Status | Significato |
|---|---|
| planted | piantata in scena |
| noticed | notata ma non capita |
| misinterpreted | capita male |
| understood | capita correttamente |
| lost | persa |

### 12.3 Collegamenti

Una clue puo essere collegata a:

- campagna;
- plot thread;
- sessione in cui e stata piantata;
- entita correlate.

### 12.4 Uso Al Tavolo

Durante una sessione:

- segna una clue come noticed se il party l'ha vista;
- segna misinterpreted se hanno preso una direzione sbagliata;
- segna understood solo quando hanno collegato la verita;
- usa status notes per annotare come l'hanno interpretata.

---

## 13. Player Dashboard

Route:

```txt
/player
```

La Player Dashboard e la superficie player-facing.

### 13.1 Accesso

L'accesso avviene con codice. Il server imposta un cookie firmato:

```txt
sherdan_player_access
```

Il cookie e:

- HTTP-only;
- firmato;
- scoped a un player/campagna quando possibile;
- valido per uso local-first.

### 13.2 Modalita Login

| Modalita | Descrizione |
|---|---|
| per-player | codice individuale salvato come hash |
| legacy global | codice master da env |

### 13.3 Player-Safe API

Le route player sono sotto:

```txt
/api/player/*
```

Queste route non devono esporre segreti GM.

### 13.4 Visibility Base

| Visibility | Effetto player-facing |
|---|---|
| `public` | visibile |
| `discovered` | visibile |
| `dm_only` | nascosto |

### 13.5 Override Per-Player

| Override | Effetto |
|---|---|
| `hidden` | nasconde anche se pubblico |
| `revealed` | mostra anche se normalmente nascosto |

Target override:

- entity;
- truth clue;
- entity secret.

### 13.6 Cleanup Override Orfani

Poiche gli override puntano a target polimorfici senza FK diretta, esiste un
cleanup:

```bash
pnpm db:cleanup:player-overrides -- --dry-run
pnpm db:cleanup:player-overrides
```

Eseguilo dopo cancellazioni massive o refactor del canon.

---

## 14. Session Run Mode

Route:

```txt
/session-run
```

Vista operativa da usare durante la sessione.

Mostra:

- scena live;
- sessione selezionata;
- iniziativa;
- entita attive;
- plot thread hot/warm;
- truth clues aperte;
- contesto copiabile per ChatGPT.

Non sostituisce gli editor canonici. Serve come cockpit durante il gioco.

---

## 15. Combat Tracker

Route:

```txt
/combat-tracker
```

Gestisce iniziativa runtime.

Funzioni:

- round;
- stato attivo/pausa;
- combattenti;
- iniziativa;
- HP;
- note e condizioni;
- push realtime alla Player Dashboard.

Lo stato viene salvato nel player dashboard state, quindi puo essere riflesso
ai giocatori.

---

## 16. Knowledge Matrix

Route:

```txt
/knowledge-matrix
```

La Matrice Conoscenza mostra player x target.

Serve per capire:

- cosa vede ogni player;
- quali PNG sono nascosti;
- quali reveal sono individuali;
- quali target sono forzati hidden/revealed.

Azioni tipiche:

- reveal a un player;
- hide a un player;
- reset override;
- filtrare per tipo target.

---

## 17. Reveal Tracker / Spoiler Gate

Route:

```txt
/reveal-tracker
```

Dashboard per controllare spoiler e reveal.

Raccoglie:

- truth clues;
- entity secrets;
- override per-player;
- stato party-level.

Uso consigliato:

- prima di una sessione social o investigativa;
- prima di aprire la Player Dashboard;
- dopo una grande rivelazione;
- quando devi capire chi sa cosa.

---

## 18. Random Tables

Route:

```txt
/random-tables
```

Motore tabelle casuali.

Supporta:

- tabelle pesate;
- tabelle uniformi;
- subtabelle;
- template;
- import;
- roll history.

Uso:

1. crea tabella;
2. aggiungi righe;
3. imposta pesi;
4. tira;
5. salva risultato nel contesto se utile.

---

## 19. Rules Lookup

Route:

```txt
/rules
```

Lookup regole homebrew/SRD.

Funzioni:

- ricerca full-text/fuzzy;
- search ibrida;
- citazioni;
- Q&A opzionale se LLM attivo.

Usalo per:

- trovare regole homebrew;
- controllare citazioni;
- evitare di cercare nei markdown raw;
- preparare ruling coerenti.

---

## 20. ChatGPT Web Bridge

Route:

```txt
/chatgpt-bridge
/chatgpt-bridge/history
```

Il Bridge e la modalita consigliata di lavoro con ChatGPT.

### 20.1 Export

Parametri principali:

| Parametro | Uso |
|---|---|
| campaign | campagna |
| task type | tipo di lavoro richiesto |
| density | dimensione/approfondimento |
| audience | GM o player |
| focus | argomento libero |
| location | location specifica |
| constraints | vincoli |
| include sections | sezioni da includere |
| request update pack | chiedere output applicabile |

### 20.2 Density

| Density | Budget Indicativo |
|---|---|
| Light | pacchetto piccolo |
| Standard | uso normale |
| Full | archi grandi |
| Table-Ready | materiale pronto al tavolo |
| Design-Only | progettazione GM |

Il Bridge applica relevance budget: non esporta tutto se bastano sezioni
rilevanti.

### 20.3 Audience

| Audience | Effetto |
|---|---|
| GM | include materiale privato selezionato |
| player | rimuove segreti, truth revealed, dm notes, properties private |

### 20.4 Import

Incolla l'output di ChatGPT. Il tool puo:

- rilevare titolo;
- rilevare session number;
- separare markdown e Update Pack;
- generare canon diff;
- proporre review changes.

### 20.5 Update Pack

Tipi di modifica possibili:

- session update;
- plot thread event create;
- truth clue create;
- entity update;
- pc hook create;
- entity identity create;
- entity secret create;
- entity link create.

### 20.6 Review

Prima dell'apply controlla:

- label;
- kind;
- match exact/fuzzy/ambiguous/none;
- before/after;
- apply payload;
- warning;
- rischio.

### 20.7 Apply

Solo le modifiche selezionate vengono applicate. Gli apply vengono auditati in
`audit_logs`.

### 20.8 History

La history mostra:

- export;
- import;
- warning;
- update pack;
- numero modifiche applicate;
- metadata.

---

## 21. Contradiction Detector

Route:

```txt
/contradictions
```

Audit deterministico del canon.

Trova:

- nomi duplicati;
- collisioni alias/identita;
- identita vere multiple;
- link duplicati;
- link incoerenti;
- visibility gap;
- truth clues aperte su thread chiusi;
- target mancanti.

Funzioni:

- severita;
- target coinvolti;
- deep link;
- quick fix sicuri;
- ignore-list persistente;
- export markdown del report.

Usalo:

- prima di un export Bridge importante;
- prima di un recap player-facing;
- dopo import massivi;
- quando il canon inizia a sembrare incoerente.

---

## 22. Generation Log

Route:

```txt
/generation-log
```

Mostra chiamate LLM server-side quando provider diversi da `none` sono attivi.

Filtri:

- campagna;
- generator;
- provider;
- modello;
- feature;
- status;
- solo errori;
- durata minima.

Informazioni:

- input tokens;
- output tokens;
- total tokens;
- costo stimato;
- latency;
- error;
- metadata;
- prompt/output dettagliato.

Usalo per:

- debug provider;
- analisi costo;
- errori LLM;
- regressioni di latenza.

---

## 23. NPC Generator

Route:

```txt
/npc-generator
```

Feature opzionale, richiede LLM server-side se usata come generatore automatico.

Uso consigliato:

- preferire Bridge per generazione creativa importante;
- usare NPC Generator per bozze rapide;
- salvare solo output revisionati;
- non considerare l'output canonico finche non e salvato.

---

## 24. Loot Generator

Route:

```txt
/loot-generator
```

Feature opzionale. Genera loot bundle con supporto LLM.

Uso:

- specifica campagna;
- contesto;
- rarita o tema;
- genera;
- revisiona;
- salva.

---

## 25. Encounter Builder

Route:

```txt
/encounter-builder
```

Funzioni pronte:

- browser mostri;
- calcolo CR/difficolta;
- composizione encounter;
- salvataggio encounter.

Assist LLM opzionale.

---

## 26. Dungeon Generator

Route:

```txt
/dungeon-generator
```

Genera layout BSP deterministici e contenuto dungeon opzionale.

Uso:

- imposta seed;
- theme;
- dimensioni;
- parametri layout;
- genera mappa;
- opzionalmente genera contenuto narrativo;
- salva come location/entity graph.

---

## 27. Session Prep

Route:

```txt
/session-prep
```

Assistant LLM server-side opzionale.

Nota: il workflow consigliato oggi e il ChatGPT Web Bridge. Session Prep resta
utile se vuoi una pipeline server-side automatica.

---

## 28. Import Sherdan

### 28.1 Cartella Corretta

I markdown sorgenti devono stare in:

```txt
content/sherdan/
```

Non devono stare in:

```txt
public/
```

### 28.2 File Attesi

- `NPC.md`;
- `Fazioni.md`;
- `Lore.md`;
- `Campagna.md`;
- `Background Personaggi.md`;
- `Manuale del Giocatore.md`;
- `Agente AI Worldbuilding.md`.

### 28.3 Pipeline

```bash
pnpm content:migrate:sherdan
pnpm content:check:safe
pnpm db:bootstrap:sherdan
pnpm db:report:sherdan
pnpm db:validate:sherdan
```

### 28.4 Cosa Importa

| File | Output |
|---|---|
| NPC.md | NPC, identita, segreti, hooks, links |
| Fazioni.md | fazioni, membri, segreti, hooks |
| Lore.md | luoghi, organizzazioni, divinita, versioni pubbliche |
| Campagna.md | sessioni, plot thread, prep |
| Background Personaggi.md | PG, identita, legami |
| Manuale del Giocatore.md | rule documents |
| Agente AI Worldbuilding.md | prompt Bridge |

---

## 29. Sicurezza E Privacy

### 29.1 Content Safety

Controllo:

```bash
pnpm content:check:safe
```

Fallisce se trova markdown Sherdan raw in `public/`.

### 29.2 Audit Log

Tabella:

```txt
audit_logs
```

Azioni auditabili:

- login player;
- logout;
- token realtime;
- override create/update/delete;
- apply Update Pack.

Campi:

- action;
- actorType;
- playerId;
- campaignId;
- targetType;
- targetId;
- outcome;
- requestId;
- ip;
- userAgent;
- metadata;
- createdAt.

### 29.3 Request ID

Le route strumentate usano:

```txt
x-request-id
```

Se il client non lo manda, il server lo genera.

### 29.4 Diagnostica

Endpoint:

```txt
/api/diagnostics
```

Non espone segreti. In production ritorna not found.

---

## 30. Backup, Restore E Release Locale

### 30.1 Backup

```bash
pnpm db:backup
```

I backup finiscono in:

```txt
backups/
```

La cartella e git-ignored perche puo contenere segreti GM.

### 30.2 Restore

```bash
CONFIRM=yes pnpm db:restore -- backups/sherdan-YYYYMMDD-HHMMSS.sql
```

Attenzione: restore ricrea schema e dati dal dump.

### 30.3 Smoke Backup/Restore

```bash
pnpm db:backup:smoke
```

Usa database test e verifica che backup e restore siano funzionanti.

### 30.4 Checklist Pre-Sessione

```bash
pnpm env:check
pnpm content:check:safe
pnpm db:ping
pnpm test:integration:local
pnpm test:e2e:local
pnpm db:backup
```

Poi apri:

```txt
/status
```

---

## 31. Performance E Scalabilita Locale

### 31.1 Seed Volumetrico

```bash
pnpm perf:seed -- --campaign "Performance Seed" --entities 1000 --plot-threads 120 --truth-clues 400
```

Serve a creare dataset sintetico per stress locale.

### 31.2 Profiling

```bash
pnpm perf:profile -- <campaign_id>
```

Esegue query rappresentative con:

```sql
EXPLAIN (ANALYZE, BUFFERS)
```

### 31.3 Indici Performance

La migration `0007_audit_observability_performance` aggiunge indici su:

- audit logs;
- entities per campaign/name;
- entities per campaign/updated;
- plot threads per campaign/status/priority;
- truth clues per campaign/created;
- entity secrets per campaign;
- Bridge history;
- generation log provider/model;
- generation log metadata GIN.

---

## 32. Test

### 32.1 Unit

```bash
pnpm test
```

Copre:

- validation;
- generators;
- parsers;
- security;
- Bridge;
- random tables;
- dungeons;
- rules;
- realtime.

### 32.2 Integration

```bash
pnpm test:integration:local
```

Usa DB test derivato da `DATABASE_URL`.

Copre:

- CRUD campagne;
- entities;
- player auth;
- player leakage;
- truth clues;
- session prep accept;
- audit log;
- cleanup override orfani.

### 32.3 E2E

```bash
pnpm test:e2e:local
```

Copre:

- Campaign Wiki;
- ChatGPT Bridge;
- Player flow;
- Plot Threads;
- Sessioni;
- Truth Clues;
- Status readiness.

---

## 33. Workflow Consigliati

### 33.1 Preparare Una Sessione

1. Apri `/status`.
2. Verifica backup.
3. Apri `/plot-threads`.
4. Porta a `hot` i thread rilevanti.
5. Apri `/truth-clues`.
6. Prepara clue da piantare.
7. Apri `/sessions`.
8. Compila prep notes.
9. Se vuoi aiuto creativo, usa `/chatgpt-bridge`.
10. Fai backup.

### 33.2 Durante La Sessione

1. Apri `/session-run`.
2. Tieni aperto `/combat-tracker` se serve.
3. Aggiorna clue quando il party le nota.
4. Aggiorna scena live per Player Dashboard.
5. Evita modifiche massive durante il gioco.

### 33.3 Dopo La Sessione

1. Aggiorna recap.
2. Scrivi DM notes.
3. Crea eventi plot thread.
4. Aggiorna truth clues.
5. Fai export Bridge per debrief, se utile.
6. Applica solo Update Pack revisionati.
7. Esegui backup.

### 33.4 Prima Di Esporre Ai Player

1. `pnpm content:check:safe`.
2. Apri `/knowledge-matrix`.
3. Apri `/reveal-tracker`.
4. Controlla visibility e override.
5. Verifica player attivi.
6. Prova login `/player`.

### 33.5 Dopo Import O Refactor Canon

1. Apri `/contradictions`.
2. Risolvi issue alte.
3. Esegui cleanup override:

```bash
pnpm db:cleanup:player-overrides -- --dry-run
```

4. Esegui E2E locali se hai toccato flussi UI.

---

## 34. Troubleshooting

### 34.1 Database Non Risponde

Sintomo:

```txt
ECONNREFUSED
```

Soluzione:

```bash
docker compose up -d
pnpm db:ping
```

### 34.2 Migration Mancante

Sintomo:

- tabella non esiste;
- colonna non esiste;
- `/status` mostra migration inattesa.

Soluzione:

```bash
pnpm db:migrate
```

### 34.3 Env Non Allineato

```bash
pnpm env:check
```

Se fallisce, allinea:

- `.env.example`;
- `src/lib/env.ts`;
- `.env` locale.

### 34.4 Leak In Public

```bash
pnpm content:check:safe
```

Se fallisce:

```bash
pnpm content:migrate:sherdan
pnpm content:migrate:sherdan:delete-public
pnpm content:check:safe
```

### 34.5 Playwright Fallisce

Installa browser:

```bash
pnpm exec playwright install chromium
```

Rilancia:

```bash
pnpm test:e2e:local
```

Controlla:

- screenshot in `test-results`;
- trace Playwright;
- DB test;
- dev server port 3100.

### 34.6 LLM Non Funziona

Se usi `LLM_PROVIDER=none`, e normale che generatori server-side siano
opzionali. Usa Bridge.

Se usi Ollama:

```bash
ollama serve
ollama pull qwen2.5:7b-instruct-q4_K_M
ollama pull mxbai-embed-large
pnpm llm:ping
```

Se usi Gemini/OpenAI:

- controlla API key;
- controlla quota;
- controlla billing;
- controlla modello.

### 34.7 Player Non Vede Un Target

Controlla:

1. visibility base entity;
2. override hidden/revealed;
3. player attivo;
4. campaign scope del cookie;
5. Knowledge Matrix;
6. Reveal Tracker.

### 34.8 Bridge Produce Pacchetto Troppo Grande

Riduci:

- density;
- recent sessions;
- plot threads;
- truth clues;
- secrets;
- factions;
- player-facing state.

Usa `Light` o `Standard`.

---

## 35. Glossario

| Termine | Significato |
|---|---|
| Canon | fonte narrativa ufficiale nel DB |
| Entity | oggetto/persona/luogo/fazione/concetto strutturato |
| Verita GM | campo privato, non player-facing |
| Versione pubblica | rappresentazione mostrabile ai player |
| Truth clue | indizio che punta a una verita |
| Plot thread | arco narrativo tracciabile |
| Update Pack | blocco strutturato proposto da ChatGPT per update DB |
| Review Change | singola modifica candidata derivata da Update Pack |
| Apply | scrittura effettiva nel DB dopo review |
| Visibility | stato base di esposizione |
| Override | eccezione per singolo player |
| Player-safe | output che non contiene segreti GM |
| Bridge | workflow manuale con ChatGPT Web |
| Audit log | traccia persistente di azioni sensibili |
| Relevance budget | limite intelligente alle sezioni esportate |

---

## 36. Regole D'Oro

1. Fai backup prima di sessioni importanti.
2. Tieni i markdown raw fuori da `public/`.
3. Non mettere segreti in `publicDescription`.
4. Usa `description` per la verita GM.
5. Usa `truthRevealed` solo per il DM.
6. Non applicare Update Pack senza review.
7. Usa `/contradictions` prima dei grandi recap.
8. Usa `/knowledge-matrix` prima di esporre contenuti player.
9. Usa `LLM_PROVIDER=none` se vuoi stabilita e zero costi API.
10. Esegui `pnpm db:migrate` dopo nuove migration.

---

## 37. Percorso Di Ripresa Rapida

Se torni sul progetto dopo settimane:

```bash
pnpm install
pnpm env:check
docker compose up -d
pnpm db:ping
pnpm db:migrate
pnpm content:check:safe
pnpm test:integration:local
pnpm test:e2e:local
pnpm dev
```

Poi leggi, in ordine:

1. `README.md`;
2. `docs/manuale-tool.md`;
3. `docs/operator-guide.md`;
4. `docs/current-architecture.md`;
5. `docs/player-access-gate.md`;
6. `docs/bridge-workflow.md`;
7. `ROADMAP_IMPROVEMENT.md`;
8. `ROADMAP.md` solo come storico esteso.

