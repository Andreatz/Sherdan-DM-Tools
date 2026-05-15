# Performance Locale

Strumenti per controllare la crescita del canon.

## Seed Volumetrico

```bash
pnpm perf:seed -- --campaign "Performance Seed" --entities 1000 --plot-threads 120 --truth-clues 400
```

Crea un dataset sintetico nella campagna indicata. E pensato per sviluppo locale
e database test, non per dati canonici reali.

## Profiling

```bash
pnpm perf:profile -- <campaign_id>
```

Esegue `EXPLAIN (ANALYZE, BUFFERS)` su query rappresentative:

- lista entita per campagna;
- link del grafo;
- contesto Plot Threads per Bridge;
- contesto Truth Clues per Bridge.

## Indici Aggiunti

La migration `0007_audit_observability_performance` aggiunge indici su:

- liste entita per campagna/nome e campagna/update;
- plot thread per campagna/status/priority;
- truth clues per campagna/created;
- entity secrets per campagna;
- history Bridge per campagna/created;
- Generation Log per provider/model e metadata JSONB.
