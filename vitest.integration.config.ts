import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

// Config separato dai test unit: percorsi diversi (tests/integration/**),
// setup separato (verifica DATABASE_URL contiene "test"), niente parallel
// per file (i test condividono il DB e si TRUNCATE-ano fra loro).
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(root, "src"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    reporters: ["default"],
    // Test integrazione condividono il DB di test: serializziamo per
    // evitare race tra TRUNCATE di un file e SELECT di un altro.
    pool: "forks",
    fileParallelism: false,
    env: process.env as Record<string, string>,
    setupFiles: ["tests/integration/setup.ts"],
    // Timeout per test piu' generoso: alcune chiamate fanno migrate o
    // multi-step DB.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
