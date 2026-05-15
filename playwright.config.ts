import { defineConfig, devices } from "@playwright/test";

// Smoke E2E browser per il flusso player + override visibility. Setup:
// - dev server Next sulla porta 3100 (separata da 3000 cosi' non
//   collide col dev locale lasciato aperto durante l'iterazione);
// - `DATABASE_URL` punta al DB di test (l'helper `tests/e2e/_setup`
//   carica dati di seed per ogni run);
// - `SHERDAN_PLAYER_ACCESS_CODE` impostato a un valore noto in test;
// - `LLM_PROVIDER=ollama` per evitare check su Gemini API key, no
//   chiamata LLM nel flusso smoke.
//
// Niente parallelism: usiamo un singolo DB di test e i test si
// preparano lo stato in beforeEach via TRUNCATE/seed.

const PORT = Number(process.env.PORT ?? "3100");
// `localhost` (non 127.0.0.1) perche' Next 16 dev blocca cross-origin
// /_next/webpack-hmr da host alternativi al hostname con cui il server
// risponde. Usare lo stesso nome host garantisce HMR funzionante e
// niente warning rumorosi nei log.
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/*.spec.ts"],
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Browser smoke: serializziamo perche' condividiamo il DB di test.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `pnpm next dev --port ${PORT}`,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // Forziamo l'env minimo: il dev server eredita comunque .env, ma
      // qui ribadiamo i valori critici per i test.
      ...process.env,
      PORT: String(PORT),
      NEXT_DIST_DIR: ".next-e2e",
      // Codice globale legacy: garantisce che la login route abbia il
      // secret HMAC per firmare i cookie player. I test creano un
      // player con codice individuale e usano quello; questo serve
      // solo a non far fallire la login con "Player access non
      // configurato".
      SHERDAN_PLAYER_ACCESS_CODE:
        process.env.SHERDAN_PLAYER_ACCESS_CODE ?? "e2e-fallback-secret",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
