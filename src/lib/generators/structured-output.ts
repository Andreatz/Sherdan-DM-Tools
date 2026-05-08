import { z } from "zod";

import {
  type CompleteOptions,
  type LLMInput,
  type LLMProvider,
  getLLMProvider,
} from "@/lib/llm";

import type { GeneratorPrompt, GeneratorRunOptions } from "./types";

export interface StructuredOutputCallOptions {
  llm?: LLMProvider;
  options?: CompleteOptions;
  signal?: AbortSignal;
}

export interface StructuredOutputCallResult<T> {
  output: T;
  input: LLMInput;
  options: CompleteOptions;
  jsonSchema: unknown;
}

export class StructuredOutputCallError extends Error {
  override readonly name = "StructuredOutputCallError";

  constructor(
    readonly code: "invalid_output",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class StructuredOutputCaller {
  constructor(
    private readonly providerFactory: () => LLMProvider = getLLMProvider,
  ) {}

  async call<T>(
    prompt: GeneratorPrompt,
    schema: z.ZodType<T>,
    options: StructuredOutputCallOptions = {},
  ): Promise<StructuredOutputCallResult<T>> {
    const llm = options.llm ?? this.providerFactory();
    const completeOptions = mergeCompleteOptions(
      prompt.options,
      options.options,
      options.signal,
    );
    const output = await llm.completeStructured(
      prompt.input,
      schema,
      completeOptions,
    );

    const parsed = schema.safeParse(output);
    if (!parsed.success) {
      throw new StructuredOutputCallError(
        "invalid_output",
        "LLM structured output non aderisce allo schema richiesto",
        parsed.error,
      );
    }

    return {
      output: parsed.data,
      input: prompt.input,
      options: completeOptions,
      jsonSchema: z.toJSONSchema(schema),
    };
  }
}

export async function callStructuredOutput<T>(
  prompt: GeneratorPrompt,
  schema: z.ZodType<T>,
  runOptions: GeneratorRunOptions = {},
  callOptions: Omit<StructuredOutputCallOptions, "llm" | "signal"> = {},
): Promise<T> {
  const caller = new StructuredOutputCaller();
  const result = await caller.call(prompt, schema, {
    ...callOptions,
    llm: runOptions.llm,
    signal: runOptions.signal,
  });
  return result.output;
}

function mergeCompleteOptions(
  promptOptions: CompleteOptions | undefined,
  callOptions: CompleteOptions | undefined,
  signal: AbortSignal | undefined,
): CompleteOptions {
  return {
    temperature: 0,
    ...promptOptions,
    ...callOptions,
    signal: signal ?? callOptions?.signal ?? promptOptions?.signal,
  };
}
