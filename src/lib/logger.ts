import pino, { type LoggerOptions } from "pino";

import { env } from "@/lib/env";

// Logger strutturato (CLAUDE.md sec 3 + sec "Cross-cutting concerns").
//
// Convenzioni:
// - JSON in production / test (ingestione automatica).
// - pino-pretty in development (lettura umana via terminale).
// - Livello da `LOG_LEVEL` env, default `debug` in dev, `info` in prod, `warn`
//   in test (silenzioso ma non muto: vediamo regressioni nei test).
// - Per scopare i log a un modulo usa `getLogger("scope")` invece di
//   importare direttamente `logger`. Il campo `scope` finisce nel JSON
//   come metadata e in pino-pretty come prefisso `[scope]`.
//
// Per Next.js: pino funziona nel runtime Node. Se in futuro useremo Edge
// runtime per qualche route, usare un'astrazione console.* fallback.

const defaultLevel: pino.Level =
  env.NODE_ENV === "production"
    ? "info"
    : env.NODE_ENV === "test"
      ? "warn"
      : "debug";

const options: LoggerOptions = {
  level: env.LOG_LEVEL ?? defaultLevel,
  base: {
    // Niente pid/hostname per default (rumore in single-user/dev). Si
    // possono ri-attivare passando `base: undefined` in futuro.
  },
  // Redazione: chiavi sensibili vengono sostituite con "[Redacted]"
  // ovunque appaiano nei log. Pattern dotted per nested.
  redact: {
    paths: [
      "*.apiKey",
      "*.api_key",
      "apiKey",
      "api_key",
      "*.password",
      "password",
      "*.GOOGLE_AI_API_KEY",
      "GOOGLE_AI_API_KEY",
      "*.DATABASE_URL",
      "DATABASE_URL",
      'headers["x-api-key"]',
      'headers.authorization',
    ],
    censor: "[Redacted]",
  },
  ...(env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
        messageFormat: "{scope} {msg}",
        singleLine: false,
      },
    },
  }),
};

export const logger = pino(options);

/**
 * Logger con `scope` impostato. Usalo nei moduli applicativi:
 *
 *   const log = getLogger("llm.gemini");
 *   log.debug({ model, ms: elapsed }, "request done");
 */
export function getLogger(scope: string) {
  return logger.child({ scope });
}

export type Logger = typeof logger;
