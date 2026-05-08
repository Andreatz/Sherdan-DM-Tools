import {
  type CompleteOptions,
  type LLMInput,
  type LLMProvider,
  getLLMProvider,
} from "@/lib/llm";

import type { GeneratorPrompt, GeneratorRunOptions } from "./types";

export interface TextStreamCallOptions {
  llm?: LLMProvider;
  options?: CompleteOptions;
  signal?: AbortSignal;
  onChunk?: (chunk: string, accumulatedText: string) => void | Promise<void>;
}

export interface TextStreamCallResult {
  text: string;
  input: LLMInput;
  options: CompleteOptions;
}

export interface TextStreamChunkEvent {
  type: "chunk";
  chunk: string;
  accumulatedText: string;
  index: number;
}

export interface TextStreamDoneEvent {
  type: "done";
  result: TextStreamCallResult;
}

export type TextStreamEvent = TextStreamChunkEvent | TextStreamDoneEvent;

export class TextStreamCaller {
  constructor(
    private readonly providerFactory: () => LLMProvider = getLLMProvider,
  ) {}

  async *stream(
    prompt: GeneratorPrompt,
    options: TextStreamCallOptions = {},
  ): AsyncIterable<TextStreamEvent> {
    const llm = options.llm ?? this.providerFactory();
    const completeOptions = mergeCompleteOptions(
      prompt.options,
      options.options,
      options.signal,
    );

    let text = "";
    let index = 0;
    for await (const chunk of llm.stream(prompt.input, completeOptions)) {
      text += chunk;
      await options.onChunk?.(chunk, text);
      yield {
        type: "chunk",
        chunk,
        accumulatedText: text,
        index,
      };
      index += 1;
    }

    yield {
      type: "done",
      result: {
        text,
        input: prompt.input,
        options: completeOptions,
      },
    };
  }

  async collect(
    prompt: GeneratorPrompt,
    options: TextStreamCallOptions = {},
  ): Promise<TextStreamCallResult> {
    let result: TextStreamCallResult | undefined;
    for await (const event of this.stream(prompt, options)) {
      if (event.type === "done") result = event.result;
    }
    if (!result) {
      throw new Error("Stream completato senza evento done");
    }
    return result;
  }
}

export function streamText(
  prompt: GeneratorPrompt,
  runOptions: GeneratorRunOptions = {},
  callOptions: Omit<TextStreamCallOptions, "llm" | "signal"> = {},
): AsyncIterable<TextStreamEvent> {
  const caller = new TextStreamCaller();
  return caller.stream(prompt, {
    ...callOptions,
    llm: runOptions.llm,
    signal: runOptions.signal,
  });
}

export async function collectStreamedText(
  prompt: GeneratorPrompt,
  runOptions: GeneratorRunOptions = {},
  callOptions: Omit<TextStreamCallOptions, "llm" | "signal"> = {},
): Promise<TextStreamCallResult> {
  const caller = new TextStreamCaller();
  return caller.collect(prompt, {
    ...callOptions,
    llm: runOptions.llm,
    signal: runOptions.signal,
  });
}

function mergeCompleteOptions(
  promptOptions: CompleteOptions | undefined,
  callOptions: CompleteOptions | undefined,
  signal: AbortSignal | undefined,
): CompleteOptions {
  return {
    ...promptOptions,
    ...callOptions,
    signal: signal ?? callOptions?.signal ?? promptOptions?.signal,
  };
}
