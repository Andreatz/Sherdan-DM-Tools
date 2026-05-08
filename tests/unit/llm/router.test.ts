import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  LLMError,
  RoutedProvider,
  type LLMProvider,
} from "@/lib/llm";

const structuredSchema = z.object({ name: z.string() });

describe("RoutedProvider", () => {
  it("retries transient primary errors before returning success", async () => {
    const primary = new FakeProvider([
      new LLMError("temporaneo", undefined, 503),
      "primary-ok",
    ]);
    const fallback = new FakeProvider(["fallback-ok"]);
    const retryEvents: unknown[] = [];

    const router = testRouter(primary, fallback, {
      onRetry: (event) => retryEvents.push(event),
    });

    await expect(router.complete("ciao")).resolves.toBe("primary-ok");
    expect(primary.completeCalls).toBe(2);
    expect(fallback.completeCalls).toBe(0);
    expect(retryEvents).toMatchObject([
      { op: "complete", provider: "primary", retryAttempt: 1 },
    ]);
  });

  it("falls back after exhausting primary retries", async () => {
    const primary = new FakeProvider([
      new LLMError("rate limit", undefined, 429),
      new LLMError("ancora rate limit", undefined, 429),
    ]);
    const fallback = new FakeProvider(["fallback-ok"]);
    const fallbacks: Array<{ op: string; err: unknown }> = [];

    const router = testRouter(primary, fallback, {
      onFallback: (op, err) => fallbacks.push({ op, err }),
    });

    await expect(router.complete("ciao")).resolves.toBe("fallback-ok");
    expect(primary.completeCalls).toBe(2);
    expect(fallback.completeCalls).toBe(1);
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0]?.op).toBe("complete");
  });

  it("retries the fallback provider too when it fails transiently", async () => {
    const primary = new FakeProvider([
      new LLMError("primary giu", undefined, 500),
      new LLMError("primary ancora giu", undefined, 500),
    ]);
    const fallback = new FakeProvider([
      new LLMError("fallback network"),
      "fallback-ok",
    ]);

    const router = testRouter(primary, fallback);

    await expect(router.complete("ciao")).resolves.toBe("fallback-ok");
    expect(primary.completeCalls).toBe(2);
    expect(fallback.completeCalls).toBe(2);
  });

  it("does not retry or fallback on non-transient provider errors", async () => {
    const primary = new FakeProvider([
      new LLMError("prompt invalido", undefined, 400),
    ]);
    const fallback = new FakeProvider(["fallback-ok"]);

    const router = testRouter(primary, fallback);

    await expect(router.complete("ciao")).rejects.toMatchObject({
      message: "prompt invalido",
      status: 400,
    });
    expect(primary.completeCalls).toBe(1);
    expect(fallback.completeCalls).toBe(0);
  });

  it("applies the same retry and fallback chain to structured output", async () => {
    const primary = new FakeProvider([
      new LLMError("primary structured giu", undefined, 503),
      new LLMError("primary structured ancora giu", undefined, 503),
    ]);
    const fallback = new FakeProvider([{ name: "fallback-structured" }]);

    const router = testRouter(primary, fallback);

    await expect(
      router.completeStructured("genera", structuredSchema),
    ).resolves.toEqual({ name: "fallback-structured" });
    expect(primary.structuredCalls).toBe(2);
    expect(fallback.structuredCalls).toBe(1);
  });

  it("falls back for streams only before chunks are emitted", async () => {
    const primary = new FakeProvider([
      new LLMError("stream giu", undefined, 500),
      new LLMError("stream ancora giu", undefined, 500),
    ]);
    const fallback = new FakeProvider([["a", "b"]]);
    const router = testRouter(primary, fallback);

    const chunks: string[] = [];
    for await (const chunk of router.stream("stream")) chunks.push(chunk);

    expect(chunks).toEqual(["a", "b"]);
    expect(primary.streamCalls).toBe(2);
    expect(fallback.streamCalls).toBe(1);
  });

  it("does not fallback after a stream has yielded a chunk", async () => {
    const primary = new FakeProvider([["prima", new LLMError("mid-stream", undefined, 500)]]);
    const fallback = new FakeProvider([["fallback"]]);
    const router = testRouter(primary, fallback);

    const chunks: string[] = [];
    await expect(async () => {
      for await (const chunk of router.stream("stream")) chunks.push(chunk);
    }).rejects.toThrow("mid-stream");

    expect(chunks).toEqual(["prima"]);
    expect(fallback.streamCalls).toBe(0);
  });
});

function testRouter(
  primary: LLMProvider,
  fallback: LLMProvider,
  hooks: {
    onRetry?: ConstructorParameters<typeof RoutedProvider>[0]["onRetry"];
    onFallback?: ConstructorParameters<typeof RoutedProvider>[0]["onFallback"];
  } = {},
): RoutedProvider {
  return new RoutedProvider({
    chatPrimary: primary,
    chatFallback: fallback,
    embed: primary,
    retry: {
      maxRetries: 1,
      initialDelayMs: 5,
      maxDelayMs: 5,
      sleep: async () => {},
    },
    ...hooks,
  });
}

type FakeResult = string | unknown | Error | Array<string | Error>;

class FakeProvider implements LLMProvider {
  completeCalls = 0;
  structuredCalls = 0;
  streamCalls = 0;

  constructor(private readonly results: FakeResult[]) {}

  async complete(): Promise<string> {
    this.completeCalls += 1;
    const result = this.next();
    if (result instanceof Error) throw result;
    if (typeof result !== "string") throw new Error("Fake complete result invalido");
    return result;
  }

  async completeStructured<T>(): Promise<T> {
    this.structuredCalls += 1;
    const result = this.next();
    if (result instanceof Error) throw result;
    return result as T;
  }

  async *stream(): AsyncIterable<string> {
    this.streamCalls += 1;
    const result = this.next();
    if (result instanceof Error) throw result;
    if (!Array.isArray(result)) throw new Error("Fake stream result invalido");
    for (const chunk of result) {
      if (chunk instanceof Error) throw chunk;
      yield chunk;
    }
  }

  embed(): Promise<number[]> {
    throw new Error("embed non usato in questi test");
  }

  embedBatch(): Promise<number[][]> {
    throw new Error("embedBatch non usato in questi test");
  }

  private next(): FakeResult {
    const result = this.results.shift();
    if (result === undefined) throw new Error("FakeProvider senza risultati");
    return result;
  }
}
