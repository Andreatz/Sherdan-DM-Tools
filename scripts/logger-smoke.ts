import "dotenv/config";

import { getLogger, logger } from "@/lib/logger";

// Smoke test del logger:
// - tutti i livelli sono emessi correttamente (rispetto al LOG_LEVEL configurato)
// - i child logger con scope appaiono col prefisso
// - la redazione dei campi sensibili funziona

const log = getLogger("smoke");

logger.info("root logger reachable");
log.trace({ note: "trace level" }, "trace");
log.debug({ note: "debug level" }, "debug");
// Nota: `level` e' campo riservato pino — usare nomi diversi nel context.
log.info({ npc: "Garrick", npcLevel: 5 }, "info con context");
log.warn({ retryAfter: 30 }, "warning con campo");
log.error(new Error("errore di esempio"), "error con stack");

// Redazione: questi campi devono apparire come [Redacted]
log.info(
  {
    apiKey: "AIzaSyEXAMPLE",
    DATABASE_URL: "postgresql://user:pass@host/db",
    payload: { password: "very-secret" },
    headers: { authorization: "Bearer xyz" },
  },
  "redazione test",
);
