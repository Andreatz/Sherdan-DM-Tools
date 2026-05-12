import { describe, expect, it } from "vitest";

import { consumeRateLimit } from "@/lib/security/rate-limit";

describe("consumeRateLimit", () => {
  it("allows up to `limit` requests in the same window and blocks the next one", () => {
    const store = makeStore();
    const now = 1_000_000;
    const config = { bucket: "test", limit: 3, windowMs: 60_000 };
    const deps = { now: () => now, store };

    expect(consumeRateLimit("ip-a", config, deps).allowed).toBe(true);
    expect(consumeRateLimit("ip-a", config, deps).allowed).toBe(true);
    expect(consumeRateLimit("ip-a", config, deps).allowed).toBe(true);
    const blocked = consumeRateLimit("ip-a", config, deps);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("isolates buckets per key (different IPs do not share quota)", () => {
    const store = makeStore();
    const now = 1_000_000;
    const config = { bucket: "test", limit: 2, windowMs: 60_000 };
    const deps = { now: () => now, store };

    expect(consumeRateLimit("ip-a", config, deps).allowed).toBe(true);
    expect(consumeRateLimit("ip-a", config, deps).allowed).toBe(true);
    expect(consumeRateLimit("ip-a", config, deps).allowed).toBe(false);
    // ip-b ha la sua quota intatta
    expect(consumeRateLimit("ip-b", config, deps).allowed).toBe(true);
  });

  it("isolates buckets per namespace (login bucket vs api bucket)", () => {
    const store = makeStore();
    const now = 1_000_000;
    const login = { bucket: "login", limit: 1, windowMs: 60_000 };
    const api = { bucket: "api", limit: 1, windowMs: 60_000 };
    const deps = { now: () => now, store };

    expect(consumeRateLimit("ip-a", login, deps).allowed).toBe(true);
    expect(consumeRateLimit("ip-a", login, deps).allowed).toBe(false);
    // stessa key, namespace diverso → quota separata
    expect(consumeRateLimit("ip-a", api, deps).allowed).toBe(true);
  });

  it("resets after a full window has passed", () => {
    const store = makeStore();
    let now = 1_000_000;
    const config = { bucket: "test", limit: 1, windowMs: 60_000 };
    const deps = { now: () => now, store };

    expect(consumeRateLimit("ip-a", config, deps).allowed).toBe(true);
    expect(consumeRateLimit("ip-a", config, deps).allowed).toBe(false);
    // due finestre dopo: la window prev e' troppo vecchia per pesare
    now += 2 * 60_000;
    expect(consumeRateLimit("ip-a", config, deps).allowed).toBe(true);
  });
});

function makeStore() {
  const map = new Map<
    string,
    { windowStart: number; currentCount: number; previousCount: number }
  >();
  return {
    get: (key: string) => map.get(key),
    set: (
      key: string,
      value: { windowStart: number; currentCount: number; previousCount: number },
    ) => {
      map.set(key, value);
    },
  };
}
