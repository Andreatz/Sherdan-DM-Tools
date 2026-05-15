# Sherdan DM Tools - Roadmap di Miglioramento

Questa roadmap parte dall'audit del 2026-05-15 e copre solo il piano di miglioramento: stabilita, manutenzione, UX, sicurezza, osservabilita, documentazione e refresh grafico. Le nuove feature creative sono volutamente escluse.

## Obiettivo

Portare Sherdan DM Tools da "tool personale avanzato" a "workspace locale affidabile, coerente e piacevole da usare al tavolo".

Metriche di successo:

- i workflow principali sono coperti da test browser end-to-end;
- le pagine condividono un linguaggio visivo coerente;
- i componenti grandi vengono scomposti in parti mantenibili;
- la modalita player-facing e il Bridge restano sicuri anche quando cresce il dataset;
- onboarding, backup, restore e release locale sono documentati e ripetibili.

## Fase 1 - Stabilizzazione Operativa - completata

Priorita: alta  
Durata stimata: 3-5 giorni  
Esito atteso: un comando o checklist affidabile per sapere se l'app e pronta all'uso.

Task:

- [x] Creare una checklist `docs/release-local.md` con sequenza: install, env, docker, migrate, seed/import, content safety, test, build.
- [x] Estendere `/status` con stato DB, migration applicate, modalita LLM, realtime, cartella content e ultimo backup rilevato.
- [x] Aggiungere smoke script per `db:backup` e `db:restore` su database test.
- [x] Uniformare i comandi locali: documentare quando usare `test:integration` vs `test:integration:local` e `test:e2e` vs `test:e2e:local`.
- [x] Aggiungere una sezione "Known limits" nel README con limiti attuali: single-user, rate limit in-memory, LLM opzionali, E2E smoke parziali.

Definition of done:

- `pnpm check` resta verde.
- `pnpm test:integration:local` e `pnpm test:e2e:local` sono documentati come percorso consigliato.
- Il DM puo verificare readiness da `/status` senza leggere cinque file diversi.

## Fase 2 - Design System e Refresh Grafico - completata

Priorita: alta  
Durata stimata: 1-2 settimane  
Esito atteso: l'app appare come un prodotto unico, non come una somma di workbench.

Direzione visiva:

- dashboard da lavoro, non landing page;
- palette sobria ma non monocromatica: grafite, avorio freddo, teal, amber, indigo;
- superfici dense e leggibili;
- border radius contenuto;
- stati chiari per GM-only, player-safe, opzionale, errore, warning e pronto;
- niente decorazione gratuita: ogni elemento deve aiutare scansione, gerarchia o orientamento.

Task fondativi:

- [x] Definire token globali in `globals.css`: background, panel, border, muted text, accent, danger, success, focus ring.
- [x] Aggiornare `AppShell` con background stratificato leggero e larghezze piu ergonomiche per pagine operative.
- [x] Ridisegnare `Sidebar` con gruppi piu leggibili, badge stato coerenti e brand header piu forte.
- [x] Aggiornare `ThemeToggle` con stati piu compatti e accessibili.
- [x] Creare componenti UI riusabili in `src/components/ui/`: `Panel`, `Badge`, `Button`, `Field`, `EmptyState`, `PageHeader`.
- [x] Migrare gradualmente Home, Status e Campaigns ai nuovi componenti; i workbench principali ereditano shell, token, focus ring e sidebar, con refactor profondo rinviato alla Fase 3.

Task UX:

- [x] Standardizzare loading, error, empty state e success message sulle superfici migrate.
- [x] Uniformare pulsanti primari, secondari, distruttivi e ghost tramite `Button` / `ButtonLink`.
- [x] Rendere le tabelle piu leggibili sulle superfici migrate: header distinti, hover row, celle dense, overflow orizzontale.
- [x] Migliorare responsive mobile/tablet per sidebar e pagine migrate senza sacrificare il target desktop.
- [x] Aggiungere focus ring visibile e coerente su input, select, button e link.

Definition of done:

- Home, Status e almeno tre workbench critici usano il nuovo linguaggio visivo.
- La UI resta leggibile in light e dark mode.
- Nessun testo importante va fuori contenitore a 375px e 1440px.

## Fase 3 - Scomposizione Frontend - completata

Priorita: alta  
Durata stimata: 2-3 settimane  
Esito atteso: i componenti grandi diventano modificabili senza paura.

Target iniziali:

- `src/components/chatgpt-bridge-workbench.tsx`
- `src/components/plot-threads-workbench.tsx`
- `src/components/monster-browser.tsx`
- `src/components/truth-clue-workbench.tsx`
- `src/components/dungeon-generator.tsx`
- `src/components/wiki-markdown-editor.tsx`

Pattern di split:

- `*.types.ts` per tipi UI locali;
- `*.api.ts` o hook `useXxxData` per fetch e parsing errori;
- `*.state.ts` o hook `useXxxWorkbench` per stato complesso;
- componenti presentazionali piccoli per lista, detail, editor, toolbar, preview;
- helper puri testabili in `src/lib` quando la logica non dipende dal DOM.

Task:

- [x] Creare convenzione `src/components/<feature>/` per workbench grandi.
- [x] Estrarre API client condiviso per `fetchJson`, `readApiError`, abort controller e optimistic refresh.
- [x] Ridurre ogni componente target sotto 500 righe o motivare l'eccezione.
- [x] Aggiungere test unitari per helper estratti da Bridge e client API condiviso.
- [x] Evitare refactor estetici insieme a refactor logici: un PR/commit per dominio.

Definition of done:

- Eccezioni sopra 700 righe motivate in `docs/frontend-refactor.md`.
- Fetch/error handling duplicato ridotto sensibilmente.
- Le modifiche UI future hanno un client condiviso e una convenzione di split.

## Fase 4 - Copertura Workflow E2E - completata

Priorita: alta  
Durata stimata: 1-2 settimane  
Esito atteso: i flussi che userai davvero al tavolo sono protetti.

Workflow da coprire:

- [x] Campaign Wiki: crea entita, identita, segreto, link e verifica detail.
- [x] Sessioni: crea sessione, aggiunge recap/DM notes/prep, verifica aggregati plot e clue.
- [x] Truth Clues: crea briciola, cambia status, verifica reveal.
- [x] Player flow esteso: login, override hidden/revealed, dashboard aggiornata.
- [x] Plot Threads: crea thread caldo, collega entita e verifica board.
- [x] ChatGPT Bridge: export, import, review Update Pack.
- [x] Backup/restore smoke su database test.

Task tecnici:

- [x] Creare fixtures E2E minimali ma realistiche.
- [x] Rendere i test indipendenti dall'ordine e dal contenuto del DB reale.
- [x] Salvare screenshot Playwright solo su failure.
- [x] Aggiungere una guida `docs/e2e.md` per debug locale.

Definition of done:

- Almeno 8 E2E passano in locale.
- CI continua a stare sotto un tempo accettabile.
- Ogni bug critico scoperto in UI riceve un test regressivo.

## Fase 5 - Sicurezza e Privacy Player-Facing - completata

Priorita: media-alta  
Durata stimata: 1 settimana  
Esito atteso: esposizione player piu controllabile e auditabile.

Task:

- [x] Aggiungere audit log persistente per login player, logout, override reveal/hide, generazione token realtime e apply Update Pack.
- [x] Aggiornare `docs/player-access-gate.md` allo stato reale con player identity e override per-player.
- [x] Creare un job di consistenza per override verso target cancellati.
- [x] Documentare chiaramente differenza tra `public`, `discovered`, `dm_only`, `hidden` e `revealed`.
- [x] Aggiungere test integration per audit log e cleanup target orfani.
- [x] Valutare storage rate limit persistente solo se l'app viene esposta oltre LAN/Tailscale: resta rimandato finche l'app rimane local-first/LAN/Tailscale.

Definition of done:

- Le azioni player-sensitive lasciano traccia consultabile.
- La documentazione non promette un modello di sicurezza vecchio.
- I target polimorfici senza FK hanno verifica periodica.

## Fase 6 - Osservabilita e Diagnostica - completata

Priorita: media  
Durata stimata: 3-5 giorni  
Esito atteso: quando qualcosa rallenta o fallisce, il motivo e visibile.

Task:

- [x] Introdurre `requestId` per API route e log correlati.
- [x] Loggare durata route principali e query costose.
- [x] Aggiungere metriche Bridge: dimensione export, warnings, sezioni incluse, apply count.
- [x] Migliorare Generation Log con filtri per provider, modello, errore, durata e feature.
- [x] Creare endpoint diagnostico server-only per environment non sensibile.

Definition of done:

- Un errore API o Bridge puo essere seguito nei log con un id.
- I rallentamenti ricorrenti sono distinguibili da errori funzionali.

## Fase 7 - Documentazione Corrente - completata

Priorita: media  
Durata stimata: 3-4 giorni  
Esito atteso: README e docs spiegano lo stato attuale, non solo la storia.

Task:

- [x] Separare documenti correnti da decision log storico.
- [x] Creare `docs/current-architecture.md` con schema alto livello e confini player-safe.
- [x] Creare `docs/operator-guide.md` per uso quotidiano del DM.
- [x] Creare `docs/bridge-workflow.md` con esempi export/import e regole Update Pack.
- [x] Ripulire README: quickstart, stato feature, comandi essenziali, link ai docs.
- [x] Lasciare `ROADMAP.md` come storico esteso e puntare questa roadmap come piano attuale.

Definition of done:

- Un "te futuro" puo riprendere il progetto in meno di 30 minuti.
- I docs non duplicano tabelle lunghe in tre posti diversi senza fonte unica.

## Fase 8 - Performance e Scalabilita Locale - completata

Priorita: media  
Durata stimata: 1 settimana  
Esito atteso: il progetto resta fluido mentre cresce il canon.

Task:

- [x] Profilare query di global search, entity graph, Bridge export e status dashboard.
- [x] Aggiungere indici mancanti rilevati dal profiling.
- [x] Paginare o virtualizzare liste potenzialmente lunghe.
- [x] Ridurre payload API che includono JSONB pesanti non necessari.
- [x] Valutare caching lato server per lookup statici SRD/Open5e: non introdotto ora, perche le superfici statiche non sono ancora il collo di bottiglia misurato.
- [x] Aggiungere test o script di seed volumetrico per 1.000+ entita.

Definition of done:

- Le pagine core restano utilizzabili con dataset sensibilmente piu grande.
- Il Bridge non genera dump enormi quando basta un relevance budget.

## Ordine Consigliato

1. Fase 1: stabilizzazione operativa.
2. Fase 2: refresh grafico e design system.
3. Fase 4: workflow E2E critici.
4. Fase 3: scomposizione frontend progressiva.
5. Fase 5: sicurezza player-facing.
6. Fase 6: osservabilita.
7. Fase 7: documentazione corrente.
8. Fase 8: performance.

La Fase 2 puo procedere in parallelo alla Fase 3, ma conviene prima definire token e componenti comuni: senza quella base, ogni workbench rischia di essere rifatto due volte.
