# Test E2E locali

Gli E2E usano Playwright e devono girare su un database test dedicato.

## Comando consigliato

```bash
pnpm test:e2e:local
```

Questo comando:

- deriva `sherdan_dm_test` da `DATABASE_URL`;
- crea il DB se manca;
- abilita `vector` e `pg_trgm`;
- avvia il dev server Playwright su porta dedicata;
- rifiuta database che non contengono `test` nel nome.

## Integration test

```bash
pnpm test:integration:local
```

Non usare `pnpm test:integration` direttamente sul PC a meno che `DATABASE_URL` punti gia a un DB test. La guardia in `tests/integration/setup.ts` blocca il DB reale.

## Debug

UI Playwright:

```bash
pnpm test:e2e:ui
```

Screenshot e trace finiscono in:

```txt
test-results/
playwright-report/
```

Queste cartelle non devono essere considerate sorgenti canonici.
