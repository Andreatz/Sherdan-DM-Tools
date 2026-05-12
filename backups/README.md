# Backups

Local-only directory for database dumps and per-campaign JSON exports.

**Never commit the dumps**: they contain GM-only secrets (Sherdan layered
secrets, propaganda vs truth, plot threads, dm_notes). The `.gitignore`
keeps this folder structure but excludes every `*.sql` / `*.json` here.

## Scripts

```bash
pnpm db:backup
# → backups/sherdan-YYYYMMDD-HHMMSS.sql
# Full SQL dump via `docker compose exec` + pg_dump (no host pg_dump required).

pnpm db:restore -- backups/sherdan-YYYYMMDD-HHMMSS.sql
# Destructive: requires CONFIRM=yes in env. Pipes the dump into psql.

pnpm db:export:campaign -- --name "Sherdan"
# or
pnpm db:export:campaign -- --id <campaign-uuid>
# → backups/campaign-<slug>-<timestamp>.json
# Self-contained JSON: entities, identities, secrets, links, hooks,
# sessions, plot threads + events + entity assignments, truth clues,
# encounters + participants, loot bundles. Excludes rule_documents,
# random_tables, generation_log and embeddings (recomputable).
```

## Recommended workflow

- Run `pnpm db:backup` before risky migrations or schema changes.
- Run `pnpm db:export:campaign` before major content edits, so you can
  diff/inspect the JSON later.
- Periodically sync this folder to private cloud storage (rclone, Time
  Machine, etc.). It is **not** under git.
