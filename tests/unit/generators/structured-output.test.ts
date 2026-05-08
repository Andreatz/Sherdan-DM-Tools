import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  StructuredOutputCallError,
  StructuredOutputCaller,
  callStructuredOutput,
  type GeneratorPrompt,
} from "@/lib/generators";
import type {
  CompleteOptions,
  LLMInput,
  LLMProvider,
} from "@/lib/llm";

const outputSchema = z.object({
  name: z.string().min(1),
  hook: z.string().min(1),
});

describe("StructuredOutputCaller", () => {
  it("calls the provider with prompt input, merged options and JSON schema metadata", async () => {
    const provider = new FakeProvider({
      name: "Mara",
      hook: "Ha visto Dante entrare dalla porta sbagliata.",
    });
    const controller = new AbortController();
    const prompt: GeneratorPrompt = {
      input: [{ role: "user", content: "Genera un hook." }],
      options: { maxTokens: 400, temperature: 0.4 },
    };

    const result = await new StructuredOutputCaller(() => provider).call(
      prompt,
      outputSchema,
      {
        signal: controller.signal,
        options: { temperature: 0.1, thinking: false },
      },
    );

    expect(result.output).toEqual({
      name: "Mara",
      hook: "Ha visto Dante entrare dalla porta sbagliata.",
    });
    expect(result.options).toMatchObject({
      maxTokens: 400,
      temperature: 0.1,
      thinking: false,
      signal: controller.signal,
    });
    expect(result.jsonSchema).toMatchObject({
      type: "object",
      properties: expect.objectContaining({
        name: expect.any(Object),
        hook: expect.any(Object),
      }),
    });
    expect(provider.calls).toEqual([
      {
        input: prompt.input,
        options: result.options,
      },
    ]);
  });

  it("defaults structured calls to deterministic temperature when no prompt option overrides it", async () => {
    const provider = new FakeProvider({ name: "Ivar", hook: "Conosce il prezzo del silenzio." });
    const result = await new StructuredOutputCaller(() => provider).call(
      { input: "Genera.", options: { maxTokens: 200 } },
      outputSchema,
    );

    expect(result.options).toMatchObject({ temperature: 0, maxTokens: 200 });
  });

  it("can use GeneratorRunOptions via callStructuredOutput", async () => {
    const provider = new FakeProvider({
      name: "Rotella",
      hook: "Ha costruito una protesi con un pezzo proibito.",
    });

    const output = await callStructuredOutput(
      { input: "Genera un NPC.", options: { maxTokens: 300 } },
      outputSchema,
      { llm: provider },
      { options: { model: "test-model" } },
    );

    expect(output.name).toBe("Rotella");
    expect(provider.calls[0]?.options).toMatchObject({
      model: "test-model",
      maxTokens: 300,
    });
  });

  it("re-validates provider output and throws a typed error when invalid", async () => {
    const provider = new FakeProvider({ name: "", hook: "" });

    await expect(
      new StructuredOutputCaller(() => provider).call(
        { input: "Genera." },
        outputSchema,
      ),
    ).rejects.toMatchObject({
      name: "StructuredOutputCallError",
      code: "invalid_output",
    } satisfies Partial<StructuredOutputCallError>);
  });
});

class FakeProvider implements LLMProvider {
  readonly calls: Array<{ input: LLMInput; options: CompleteOptions | undefined }> = [];

  constructor(private readonly structuredOutput: unknown) {}

  complete(): Promise<string> {
    throw new Error("complete non usato in questo test");
  }

  async completeStructured<T>(
    input: LLMInput,
    _schema: z.ZodType<T>,
    options?: CompleteOptions,
  ): Promise<T> {
    this.calls.push({ input, options });
    return this.structuredOutput as T;
  }

  async *stream(): AsyncIterable<string> {
    throw new Error("stream non usato in questo test");
  }

  embed(): Promise<number[]> {
    throw new Error("embed non usato in questo test");
  }

  embedBatch(): Promise<number[][]> {
    throw new Error("embedBatch non usato in questo test");
  }
}
