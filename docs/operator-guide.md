# Operator Guide

Guida rapida per usare il progetto al tavolo.

## Prima Della Sessione

1. Avvia Postgres e app.
2. Apri `/status`.
3. Verifica DB, backup recente, content safety e LLM mode.
4. Esegui un backup:

```bash
pnpm db:backup
```

5. Prepara Sessioni, Plot Threads, Truth Clues e Player visibility.

## Durante La Sessione

- Usa `/session-run` per vista da tavolo.
- Usa `/sessions` per recap e note private.
- Usa `/truth-clues` per aggiornare lo stato delle briciole.
- Usa `/player` solo tramite cookie player configurato.

## Dopo La Sessione

1. Aggiorna recap, DM notes e plot events.
2. Esegui un export Bridge se vuoi far sintetizzare o criticare la sessione.
3. Applica solo Update Pack revisionati.
4. Fai un backup finale.

## Manutenzione

```bash
pnpm check
pnpm test:integration:local
pnpm test:e2e:local
pnpm db:backup:smoke
pnpm db:cleanup:player-overrides -- --dry-run
```
