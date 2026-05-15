# Bridge Workflow

Il ChatGPT Web Bridge evita chiamate LLM server-side: prepara un pacchetto markdown,
lo incolli in ChatGPT, poi reimporti la risposta.

## Export

1. Apri `/chatgpt-bridge`.
2. Scegli campagna, task, densita e audience.
3. Riduci le sezioni se il pacchetto supera il budget consigliato.
4. Copia il markdown generato.

Le metriche di export vengono salvate nei metadata: caratteri, byte, warning,
sezioni incluse e `requestId`.

## Import

1. Incolla la risposta.
2. Analizza.
3. Se presente un Update Pack, apri la review.
4. Applica solo le modifiche selezionate.

Gli apply scrivono audit persistente con numero di modifiche selezionate/applicate
e tipi di cambio.

## Regole Update Pack

- Nessuna modifica ad alto rischio va applicata senza conferma esplicita.
- Un match fuzzy o ambiguo va letto prima dell'apply.
- Se il modello inventa un target, la modifica resta warning e non deve passare
  come update silenzioso.
