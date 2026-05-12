import type { NextRequest } from "next/server";

import { TooManyRequestsError } from "@/lib/api/errors";

// Rate limit in-process basato su sliding-window counter, sufficiente per
// l'app local-first single-user: blocca brute-force su login e abuso delle
// API player. Per scale-out servirebbe Redis o un equivalente. Le finestre
// sono per-(bucket, key) cosi' lo stesso IP puo' avere quote diverse su
// `player-login` (strict) e su `player-api` (loose).
//
// Implementazione: sliding-window approssimato con due bucket (corrente +
// precedente) ponderati linearmente. Buono al ~95% di un vero sliding
// window senza il costo di memorizzare ogni timestamp.

interface RateLimitBucketState {
  windowStart: number;
  currentCount: number;
  previousCount: number;
}

interface RateLimitStore {
  get(key: string): RateLimitBucketState | undefined;
  set(key: string, state: RateLimitBucketState): void;
}

const defaultStore: RateLimitStore = (() => {
  const map = new Map<string, RateLimitBucketState>();
  return {
    get: (key) => map.get(key),
    set: (key, state) => map.set(key, state),
  };
})();

export interface RateLimitConfig {
  /** Namespace logico, es. "player-login" o "player-api". */
  bucket: string;
  /** Numero massimo di richieste nella finestra. */
  limit: number;
  /** Lunghezza della finestra in millisecondi. */
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Quante richieste sono state contate in questa finestra (post-incremento). */
  count: number;
  /** Secondi prima che la finestra corrente scada. Utile per Retry-After. */
  retryAfterSeconds: number;
}

export interface RateLimitDeps {
  now?: () => number;
  store?: RateLimitStore;
}

export function consumeRateLimit(
  key: string,
  config: RateLimitConfig,
  deps: RateLimitDeps = {},
): RateLimitDecision {
  const now = deps.now ?? Date.now;
  const store = deps.store ?? defaultStore;
  const compositeKey = `${config.bucket}:${key}`;
  const tick = now();
  const windowStart = Math.floor(tick / config.windowMs) * config.windowMs;
  const state = store.get(compositeKey);

  let currentCount: number;
  let previousCount: number;
  if (!state) {
    currentCount = 0;
    previousCount = 0;
  } else if (state.windowStart === windowStart) {
    currentCount = state.currentCount;
    previousCount = state.previousCount;
  } else if (state.windowStart === windowStart - config.windowMs) {
    currentCount = 0;
    previousCount = state.currentCount;
  } else {
    currentCount = 0;
    previousCount = 0;
  }

  const elapsed = tick - windowStart;
  const previousWeight = (config.windowMs - elapsed) / config.windowMs;
  const projected = currentCount + 1 + previousCount * previousWeight;
  const allowed = projected <= config.limit;
  const nextCurrent = allowed ? currentCount + 1 : currentCount;

  store.set(compositeKey, {
    windowStart,
    currentCount: nextCurrent,
    previousCount,
  });

  const retryAfterMs = allowed
    ? 0
    : Math.max(1, config.windowMs - elapsed);

  return {
    allowed,
    count: Math.round(projected),
    retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
  };
}

export function enforceRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  deps: RateLimitDeps = {},
): RateLimitDecision {
  const key = clientKey(req);
  const decision = consumeRateLimit(key, config, deps);
  if (!decision.allowed) {
    throw new TooManyRequestsError(
      "Troppe richieste, riprova tra poco.",
      decision.retryAfterSeconds,
      { bucket: config.bucket, limit: config.limit },
    );
  }
  return decision;
}

// Estrae un identificatore "client" stabile per il rate limit. Preferisce
// x-forwarded-for (primo IP), poi x-real-ip, poi req.ip se disponibile,
// altrimenti "unknown". In ambiente local-first dietro Tailscale ognuno ha
// un IP stabile, quindi questo identificatore e' affidabile.
export function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const reqIp = (req as { ip?: string }).ip;
  if (reqIp) return reqIp;
  return "unknown";
}
