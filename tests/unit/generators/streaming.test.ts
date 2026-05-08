import { describe, expect, it } from "vitest";

import {
  TextStreamCaller,
  collectStreamedText,
  streamText,
  type GeneratorPrompt,
} from "@/lib/generators";
import type {
  CompleteOptions,
  LLMInput,
  LLMProvider,
} from "@/lib/llm";

describe("TextStreamCaller", () => {
  it("streams chunk events and finishes with the accumulated text", async () => {
    const provider = new FakeStreamingProvider(["Ciao", " ", "Sherdan"]);
    const prompt: GeneratorPrompt = {
      input: [{ role: "user", content: "Racconta." }],
      options: { maxTokens: 100, temperature: 0.7 },
    };
    const onChunks: Array<{ chunk: string; text: string }> = [];

    const events = await collectEvents(
      new TextStreamCaller(() => provider).stream(prompt, {
        options: { temperature: 0.2, model: "stream-model" },
        onChunk: (chunk, accumulatedText) => {
          onChunks.push({ chunk, text: accumulatedText });
        },
      }),
    );

    expect(events).toEqual([
      {
        type: "chunk",
        chunk: "Ciao",
        accumulatedText: "Ciao",
        index: 0,
      },
      {
        type: "chunk",
        chunk: " ",
        accumulatedText: "Ciao ",
        index: 1,
      },
      {
        type: "chunk",
        chunk: "Sherdan",
        accumulatedText: "Ciao Sherdan",
        index: 2,
      },
      {
        type: "done",
        result: {
          text: "Ciao Sherdan",
          input: prompt.input,
          options: {
            maxTokens: 100,
            temperature: 0.2,
            model: "stream-model",
            signal: undefined,
          },
        },
      },
    ]);
    expect(onChunks).toEqual([
      { chunk: "Ciao", text: "Ciao" },
      { chunk: " ", text: "Ciao " },
      { chunk: "Sherdan", text: "Ciao Sherdan" },
    ]);
    expect(provider.calls).toEqual([
      {
        input: prompt.input,
        options: {
          maxTokens: 100,
          temperature: 0.2,
          model: "stream-model",
          signal: undefined,
        },
      },
    ]);
  });

  it("collects a stream into a final result", async () => {
    const provider = new FakeStreamingProvider(["uno", " due"]);

    const result = await new TextStreamCaller(() => provider).collect({
      input: "Conta.",
      options: { thinking: false },
    });

    expect(result).toEqual({
      text: "uno due",
      input: "Conta.",
      options: { thinking: false, signal: undefined },
    });
  });

  it("can use GeneratorRunOptions via streamText and collectStreamedText", async () => {
    const provider = new FakeStreamingProvider(["run", "-", "options"]);
    const controller = new AbortController();

    const events = await collectEvents(
      streamText(
        { input: "Genera.", options: { maxTokens: 12 } },
        { llm: provider, signal: controller.signal },
        { options: { model: "test-model" } },
      ),
    );

    expect(events.at(-1)).toMatchObject({
      type: "done",
      result: {
        text: "run-options",
        options: {
          maxTokens: 12,
          model: "test-model",
          signal: controller.signal,
        },
      },
    });

    const collected = await collectStreamedText(
      { input: "Raccogli." },
      { llm: new FakeStreamingProvider(["ok"]) },
    );
    expect(collected.text).toBe("ok");
  });

  it("propagates provider stream errors without emitting a done event", async () => {
    const provider = new FakeStreamingProvider([
      "prima",
      new Error("stream interrotto"),
    ]);
    const events: unknown[] = [];

    await expect(async () => {
      for await (const event of new TextStreamCaller(() => provider).stream({
        input: "Genera.",
      })) {
        events.push(event);
      }
    }).rejects.toThrow("stream interrotto");

    expect(events).toEqual([
      {
        type: "chunk",
        chunk: "prima",
        accumulatedText: "prima",
        index: 0,
      },
    ]);
  });
});

async function collectEvents<T>(events: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const event of events) out.push(event);
  return out;
}

class FakeStreamingProvider implements LLMProvider {
  readonly calls: Array<{ input: LLMInput; options: CompleteOptions | undefined }> = [];

  constructor(private readonly chunks: Array<string | Error>) {}

  complete(): Promise<string> {
    throw new Error("complete non usato in questo test");
  }

  completeStructured<T>(): Promise<T> {
    throw new Error("completeStructured non usato in questo test");
  }

  async *stream(
    input: LLMInput,
    options?: CompleteOptions,
  ): AsyncIterable<string> {
    this.calls.push({ input, options });
    for (const chunk of this.chunks) {
      if (chunk instanceof Error) throw chunk;
      yield chunk;
    }
  }

  embed(): Promise<number[]> {
    throw new Error("embed non usato in questo test");
  }

  embedBatch(): Promise<number[][]> {
    throw new Error("embedBatch non usato in questo test");
  }
}
