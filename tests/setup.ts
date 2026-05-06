// File caricato da Vitest prima di ogni test (vedi vitest.config.ts).
// Carica le variabili d'ambiente da .env in modo che src/lib/env.ts
// passi la validazione Zod anche in esecuzione test.
//
// Vitest imposta automaticamente NODE_ENV=test prima dei test, quindi
// non serve override esplicito qui.
import "dotenv/config";
