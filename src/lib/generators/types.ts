import type { CompleteOptions, LLMInput, LLMProvider } from "@/lib/llm";

export type GeneratorStage =
  | "validateInput"
  | "buildContext"
  | "buildPrompt"
  | "call"
  | "validateOutput"
  | "persist";

export interface GeneratorPrompt {
  input: LLMInput;
  options?: CompleteOptions;
}

export interface GeneratorRunOptions {
  /**
   * Provider iniettato dal chiamante. I generatori concreti possono ignorarlo
   * per path deterministici, ma il runner lo passa a ogni stage.
   */
  llm?: LLMProvider;
  signal?: AbortSignal;
  persist?: boolean;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface GeneratorRunResult<Input, Context, Output, Persisted> {
  generatorName: string;
  input: Input;
  context: Context;
  prompt: GeneratorPrompt;
  rawOutput: unknown;
  output: Output;
  persisted: Persisted | null;
}

export interface Generator<Input, Output, Context = unknown, Persisted = Output> {
  readonly name: string;

  validateInput(
    rawInput: unknown,
    options: GeneratorRunOptions,
  ): Input | Promise<Input>;

  buildContext(
    input: Input,
    options: GeneratorRunOptions,
  ): Context | Promise<Context>;

  buildPrompt(
    input: Input,
    context: Context,
    options: GeneratorRunOptions,
  ): GeneratorPrompt | Promise<GeneratorPrompt>;

  call(
    prompt: GeneratorPrompt,
    input: Input,
    context: Context,
    options: GeneratorRunOptions,
  ): unknown | Promise<unknown>;

  validateOutput(
    rawOutput: unknown,
    input: Input,
    context: Context,
    options: GeneratorRunOptions,
  ): Output | Promise<Output>;

  persist(
    output: Output,
    input: Input,
    context: Context,
    options: GeneratorRunOptions,
  ): Persisted | Promise<Persisted>;
}
