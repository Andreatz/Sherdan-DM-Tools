# Architettura Corrente

Sherdan DM Tools e un workspace locale Next.js + Postgres.

## Confini

- `src/app/*`: pagine e route API.
- `src/components/*`: workbench e UI condivisa.
- `src/lib/*`: logica testabile, sicurezza, generatori, Bridge, import/export.
- `src/db/schema/*`: contratto Drizzle del database.
- `src/db/migrations/*`: evoluzione SQL applicata da `pnpm db:migrate`.
- `scripts/*`: operazioni locali, import, backup, profiling, seed.

## Player-Safe

Le route player-facing stanno sotto `/api/player/*` e usano solo proiezioni sicure.
Non devono restituire `description`, `properties`, segreti GM, `dm_notes` o prompt.
Gli override per-player modificano la visibilita ma non cambiano il dato canonico.

## Bridge

Il ChatGPT Web Bridge e manuale: esporta markdown, analizza output incollato,
genera review changes e applica solo modifiche selezionate. Gli apply vengono
auditati in `audit_logs`; export/import restano in `chatgpt_bridge_exports` e
`chatgpt_bridge_imports`.

## Osservabilita

Le route critiche usano `x-request-id` e log strutturati. Il Generation Log copre
le chiamate LLM server-side; `/api/diagnostics` espone solo dati non sensibili in
ambienti non production.
