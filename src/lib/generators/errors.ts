import type { GeneratorStage } from "./types";

export class GeneratorPipelineError extends Error {
  override readonly name = "GeneratorPipelineError";

  constructor(
    readonly generatorName: string,
    readonly stage: GeneratorStage,
    readonly cause: unknown,
  ) {
    super(
      `Generator '${generatorName}' failed during ${stage}: ${messageForCause(
        cause,
      )}`,
    );
  }
}

function messageForCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
