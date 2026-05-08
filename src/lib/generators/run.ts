import { GeneratorPipelineError } from "./errors";
import type {
  Generator,
  GeneratorRunOptions,
  GeneratorRunResult,
  GeneratorStage,
} from "./types";

export async function runGenerator<Input, Output, Context = unknown, Persisted = Output>(
  generator: Generator<Input, Output, Context, Persisted>,
  rawInput: unknown,
  options: GeneratorRunOptions = {},
): Promise<GeneratorRunResult<Input, Context, Output, Persisted>> {
  const input = await runStage(generator, "validateInput", () =>
    generator.validateInput(rawInput, options),
  );
  const context = await runStage(generator, "buildContext", () =>
    generator.buildContext(input, options),
  );
  const prompt = await runStage(generator, "buildPrompt", () =>
    generator.buildPrompt(input, context, options),
  );
  const rawOutput = await runStage(generator, "call", () =>
    generator.call(prompt, input, context, options),
  );
  const output = await runStage(generator, "validateOutput", () =>
    generator.validateOutput(rawOutput, input, context, options),
  );
  const persisted =
    options.persist === false
      ? null
      : await runStage(generator, "persist", () =>
          generator.persist(output, input, context, options),
        );

  return {
    generatorName: generator.name,
    input,
    context,
    prompt,
    rawOutput,
    output,
    persisted,
  };
}

async function runStage<T>(
  generator: { readonly name: string },
  stage: GeneratorStage,
  fn: () => T | Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GeneratorPipelineError) throw err;
    throw new GeneratorPipelineError(generator.name, stage, err);
  }
}
