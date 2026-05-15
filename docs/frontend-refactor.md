# Frontend refactor plan

Questo documento chiude la Fase 3 della roadmap di miglioramento: introduce la convenzione e documenta le eccezioni per i workbench ancora grandi.

## Convenzioni introdotte

- Fetch JSON condiviso in `src/lib/client-api.ts`.
- Componenti visuali condivisi in `src/components/ui/`.
- Feature subfolders per estrazioni progressive, es. `src/components/chatgpt-bridge/`.
- Helper puri testabili quando una funzione non dipende da React o dal DOM.

## Refactor completati

- `apiFetch`, `readApiError`, `ClientApiError` e `messageForError` centralizzati.
- Workbench collegati al client condiviso:
  - `sessions-workbench.tsx`
  - `plot-threads-workbench.tsx`
  - `truth-clue-workbench.tsx`
  - `monster-browser.tsx`
  - `chatgpt-bridge-workbench.tsx`
- Helper Bridge `targetLabel` estratto in `src/components/chatgpt-bridge/review-utils.ts`.
- Test unitari aggiunti per client API e helper Bridge.

## Eccezioni motivate

Alcuni workbench restano sopra la soglia ideale. Non sono stati spezzati meccanicamente per evitare un refactor cosmetico che aumenterebbe il rischio senza migliorare davvero la manutenzione.

Target da ridurre nella prossima fase di refactor profondo:

| File | Motivo eccezione | Split consigliato |
|---|---|---|
| `monster-browser.tsx` | Combina ricerca, filtri, encounter draft, CR calculator e save. | `monster-browser/filters.tsx`, `monster-browser/results.tsx`, `monster-browser/draft-panel.tsx`, `monster-browser/save-dialog.tsx`. |
| `chatgpt-bridge-workbench.tsx` | Flusso export/import/review/apply molto accoppiato allo stato locale. | `chatgpt-bridge/export-form.tsx`, `markdown-preview.tsx`, `import-panel.tsx`, `review-change-list.tsx`. |
| `plot-threads-workbench.tsx` | Board, detail, timeline, entity links ed eventi nello stesso file. | `plot-threads/board.tsx`, `thread-detail.tsx`, `event-list.tsx`, `entity-list.tsx`. |
| `truth-clue-workbench.tsx` | Lista, form, detail, override player e copy-for-ChatGPT nello stesso file. | `truth-clues/filter-bar.tsx`, `clue-list.tsx`, `clue-detail.tsx`, `clue-form.tsx`. |
| `dungeon-generator.tsx` | Generazione layout, contenuto LLM, preview e save sono accoppiati. | `dungeon-generator/layout-controls.tsx`, `map-preview.tsx`, `content-panel.tsx`, `save-panel.tsx`. |
| `wiki-markdown-editor.tsx` | Editor Lexical, entity picker e save sono intrecciati. | `wiki-editor/editor-shell.tsx`, `entity-suggestions.tsx`, `toolbar.tsx`, `save-status.tsx`. |

## Regola per i prossimi refactor

Ogni split deve:

- mantenere invariata la logica utente;
- evitare cambiamenti visivi non necessari nello stesso commit;
- aggiungere o mantenere almeno un test attorno all'helper estratto;
- preferire componenti presentazionali piccoli e hook locali per stato complesso.
