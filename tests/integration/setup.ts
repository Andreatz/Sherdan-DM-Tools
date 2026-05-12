// Setup file caricato da vitest.integration.config.ts. Riusa il dotenv
// dello unit test, in piu' verifica che `DATABASE_URL` sia presente e
// **non** punti al database di sviluppo (heuristic per evitare di
// `TRUNCATE` accidentalmente il DB dove tieni i contenuti reali).
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "Test integrazione richiedono DATABASE_URL. Esempio locale: postgres://sherdan:sherdan_dev@localhost:5432/sherdan_dm_test",
  );
}

// Allow-list: il DB di test deve avere `test` nel nome (o `ci` per il
// runner GitHub). Cosi' un errore di copia-incolla non spazza il DB di
// sviluppo Sherdan.
const dbName = url.split("/").pop()?.split("?")[0];
if (!dbName || (!/test/i.test(dbName) && dbName !== "ci")) {
  throw new Error(
    `DATABASE_URL per i test integrazione DEVE avere "test" nel nome del database (o essere "ci"). Trovato: "${dbName ?? "(?)"}". Crea un DB dedicato e riprova.`,
  );
}
