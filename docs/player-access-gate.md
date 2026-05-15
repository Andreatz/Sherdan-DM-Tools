# Player Access Gate

Documento corrente del modello player-facing.

## Stato Attuale

Le route sotto `/api/player/*` sono chiuse da cookie firmato `httpOnly`.
Il login supporta due modalita:

- **per-player**: ogni record `players` ha `campaign_id`, `name`, `code_hash`, `active`, `last_seen_at`;
- **legacy global**: il codice `SHERDAN_PLAYER_ACCESS_CODE` apre un cookie non scoped, utile per uso locale del DM.

Il codice in chiaro non viene salvato: `code_hash` e derivato con HMAC lato server.

## Visibilita

- `public`: contenuto mostrabile al player senza override.
- `discovered`: contenuto scoperto dal party, mostrabile al player.
- `dm_only`: contenuto GM-only, mai esposto dalle route player salvo override esplicito.
- `hidden`: override per-player che nasconde un target anche se pubblico.
- `revealed`: override per-player che rende visibile un target normalmente non visibile.

Gli override vivono in `player_visibility_overrides` e puntano a target polimorfici:
`entity`, `truth_clue`, `entity_secret`. Non hanno FK diretta perche una sola colonna
`target_id` punta a tabelle diverse; per questo esiste il cleanup:

```bash
pnpm db:cleanup:player-overrides -- --dry-run
pnpm db:cleanup:player-overrides
```

## Audit

Le azioni sensibili scrivono in `audit_logs`:

- login player riuscito o negato;
- logout;
- generazione token realtime;
- create/update/delete override player;
- apply Update Pack dal ChatGPT Bridge.

Ogni record puo includere `request_id`, `campaign_id`, `player_id`, `target_type`,
`target_id`, outcome e metadata non sensibili. Le route strumentate ritornano anche
header `x-request-id`.

## Boundary

Questo resta un modello local-first. E adeguato per LAN/Tailscale e uso personale.
Prima di esporlo su internet servono rate limit persistente, auth DM vera, HTTPS
gestito a monte e review dei cookie/sessioni.
