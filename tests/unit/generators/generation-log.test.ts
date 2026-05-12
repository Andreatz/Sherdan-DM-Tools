import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  callStructuredOutputLogged,
  type GenerationLogSink,
  type PersistLogRow,
} from "@/lib/generators";
import type { CompleteOptions, LLMInput, LLMProvider } from "@/lib/llm";

const outputSchema = z.object({ value: z.string().min(1) });

describe("callStructuredOutputLogged", () => {
  it("logs a 'succeeded' row with prompt/input/output and latency metadata", async () => {
    const sink = new FakeSink();
    const provider = new FakeProvider({ value: "ok" });

    const result = await callStructuredOutputLogged({
      prompt: {
        input: [{ role: "user", content: "Genera." }],
        options: { model: "test-model" },
      },
      schema: outputSchema,
      logContext: {
        generatorName: "test-generator",
        campaignId: "00000000-0000-4000-8000-000000000000",
        input: { foo: "bar" },
        metadata: { phase: "unit-test" },
      },
      runOptions: { llm: provider },
      sink,
    });

    expect(result).toEqual({ value: "ok" });
    expect(sink.rows).toHaveLength(1);
    const row = sink.rows[0]!;
    expect(row.status).toBe("succeeded");
    expect(row.generatorName).toBe("test-generator");
    expect(row.model).toBe("test-model");
    expect(row.input).toEqual({ foo: "bar" });
    expect(row.output).toEqual({ value: "ok" });
    expect(row.error).toBeNull();
    expect(row.metadata).toMatchObject({
      phase: "unit-test",
      latencyMs: expect.any(Number),
    });
  });

  it("logs a 'failed' row and rethrows when the LLM provider errors", async () => {
    const sink = new FakeSink();
    const provider = new FakeProvider(
      { value: "ignored" },
      new Error("provider exploded"),
    );

    await expect(
      callStructuredOutputLogged({
        prompt: { input: "Genera." },
        schema: outputSchema,
        logContext: {
          generatorName: "test-generator",
          input: { foo: "bar" },
        },
        runOptions: { llm: provider },
        sink,
      }),
    ).rejects.toThrow("provider exploded");

    expect(sink.rows).toHaveLength(1);
    const row = sink.rows[0]!;
    expect(row.status).toBe("failed");
    expect(row.output).toBeNull();
    expect(row.error).toMatchObject({
      name: "Error",
      message: "provider exploded",
    });
  });

  it("never throws when the sink itself errors (fire-and-forget logging)", async () => {
    const failingSink: GenerationLogSink = {
      async insert() {
        throw new Error("db down");
      },
    };
    const provider = new FakeProvider({ value: "ok" });

    const result = await callStructuredOutputLogged({
      prompt: { input: "Genera." },
      schema: outputSchema,
      logContext: { generatorName: "test-generator", input: {} },
      runOptions: { llm: provider },
      sink: failingSink,
    });

    expect(result).toEqual({ value: "ok" });
  });
});

class FakeSink implements GenerationLogSink {
  readonly rows: PersistLogRow[] = [];
  async insert(row: PersistLogRow): Promise<void> {
    this.rows.push(row);
  }
}

class FakeProvider implements LLMProvider {
  constructor(
    private readonly structuredOutput: unknown,
    private readonly throwOnCall?: Error,
  ) {}

  complete(): Promise<string> {
    throw new Error("complete non usato");
  }

  async completeStructured<T>(
    input: LLMInput,
    schema: z.ZodType<T>,
    options?: CompleteOptions,
  ): Promise<T> {
    if (this.throwOnCall) throw this.throwOnCall;
    void input;
    void schema;
    void options;
    return this.structuredOutput as T;
  }

  async *stream(): AsyncIterable<string> {
    throw new Error("stream non usato");
  }

  embed(): Promise<number[]> {
    throw new Error("embed non usato");
  }

  embedBatch(): Promise<number[][]> {
    throw new Error("embedBatch non usato");
  }
}
