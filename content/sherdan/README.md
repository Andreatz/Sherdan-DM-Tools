# Sherdan raw content

Questa cartella e' la posizione preferita per i sorgenti markdown della campagna Sherdan.

I file markdown reali contengono materiale GM-only, segreti stratificati e spoiler pesanti della campagna. Per questo motivo sono ignorati da git tramite `.gitignore` e non devono stare in `public/` quando l'app viene esposta fuori dalla macchina locale.

## File attesi

- `NPC.md`
- `Fazioni.md`
- `Lore.md`
- `Campagna.md`
- `Background Personaggi.md`
- `Manuale del Giocatore.md`

## Migrazione consigliata

```bash
pnpm content:migrate:sherdan
pnpm content:check
```

Quando hai verificato che l'import funziona dalla cartella privata:

```bash
pnpm content:migrate:sherdan:delete-public
pnpm content:check -- --strict
```

`public/` resta valido solo come fallback temporaneo per sviluppo locale. Non usare `public/*.md` con Player Dashboard o deployment pubblico/semi-pubblico.
