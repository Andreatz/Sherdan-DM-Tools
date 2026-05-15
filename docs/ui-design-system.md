# UI design system

Il refresh grafico usa token CSS globali e piccoli componenti condivisi. L'obiettivo e mantenere l'app densa, leggibile e coerente senza trasformarla in una landing page.

## Direzione

- workspace operativo per DM;
- palette non monocromatica: avorio freddo, grafite, teal, amber, indigo;
- pannelli sobri, radius contenuto, gerarchia chiara;
- dark mode leggibile, non solo inversione colori;
- stati chiari per pronto, opzionale, warning, danger e player-safe.

## Token globali

I token vivono in `src/app/globals.css`:

- `--background`
- `--foreground`
- `--surface`
- `--surface-raised`
- `--surface-muted`
- `--border`
- `--muted`
- `--accent`
- `--warning`
- `--danger`
- `--success`
- `--focus`

Usa questi token prima di introdurre nuovi colori hardcoded.

## Componenti base

I componenti condivisi vivono in `src/components/ui/`:

- `Badge`
- `Button`
- `ButtonLink`
- `EmptyState`
- `PageHeader`
- `Panel`

Nuove pagine e refactor di workbench devono partire da questi componenti.

## Regole pratiche

- Non creare card dentro card.
- Usa `PageHeader` per titolo e sottotitolo pagina.
- Usa `Panel` per sezioni operative o superfici ripetute.
- Usa `Badge` per stato, non testo colorato libero.
- Usa `ButtonLink`/`Button` per azioni principali e secondarie.
- Evita gradienti decorativi dentro i workbench: il background globale e sufficiente.
- Mantieni UI compatte: l'app serve durante preparazione e sessione, non come brochure.
