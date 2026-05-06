import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(root, "src"),
    },
  },
  test: {
    // Tests vivono in tests/, separati da src/ (CLAUDE.md sec 6).
    // Convenzione: tests/unit/<area>/*.test.ts, tests/integration/...
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Default reporter compatto; per l'UI: pnpm test:ui
    reporters: ["default"],
    // Tests Sherdan sono pochi e leggeri: niente isolazione per default
    // (piu' veloce). Si puo' opt-in per file specifici.
    pool: "threads",
    // Caricamento di .env per test che leggono env (es. validation
    // import implicito di src/lib/env.ts che lo richiede).
    env: process.env as Record<string, string>,
    setupFiles: ["tests/setup.ts"],
  },
});
