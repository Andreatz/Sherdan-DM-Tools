import {
  callStructuredOutputLogged,
  type Generator,
  type GeneratorPrompt,
  type GeneratorRunOptions,
} from "@/lib/generators";

import { calculateDmgBaseGold } from "./dmg-gold";
import type { LootGeneratorContext } from "./loot-context";
import { LootGeneratorContextRetriever } from "./loot-context";
import {
  composeLootGeneratorOutput,
  lootGeneratorLLMOutputSchema,
  type LootGeneratorLLMOutput,
  type LootGeneratorOutput,
} from "./loot-output";
import { lootGeneratorInputSchema, type LootGeneratorInput } from "./loot-input";
import { buildLootGeneratorPrompt } from "./loot-prompt";

export interface LootGeneratorContextProvider {
  retrieve(input: unknown): Promise<LootGeneratorContext>;
}

export class LootGenerator
  implements
    Generator<
      LootGeneratorInput,
      LootGeneratorOutput,
      LootGeneratorContext,
      LootGeneratorOutput
    >
{
  readonly name = "loot-generator";

  constructor(
    private readonly contextRetriever: LootGeneratorContextProvider = new LootGeneratorContextRetriever(),
  ) {}

  validateInput(rawInput: unknown): LootGeneratorInput {
    return lootGeneratorInputSchema.parse(rawInput);
  }

  async buildContext(input: LootGeneratorInput): Promise<LootGeneratorContext> {
    return this.contextRetriever.retrieve(input);
  }

  buildPrompt(
    input: LootGeneratorInput,
    context: LootGeneratorContext,
  ): GeneratorPrompt {
    const baseGold = calculateDmgBaseGold({
      partyLevel: input.partyLevel,
      mode: "hoard",
    });

    return buildLootGeneratorPrompt(context, { baseGold });
  }

  async call(
    prompt: GeneratorPrompt,
    input: LootGeneratorInput,
    _context: LootGeneratorContext,
    options: GeneratorRunOptions,
  ): Promise<LootGeneratorLLMOutput> {
    return callStructuredOutputLogged({
      prompt,
      schema: lootGeneratorLLMOutputSchema,
      logContext: {
        generatorName: this.name,
        campaignId: input.campaignId,
        input,
      },
      runOptions: options,
    });
  }

  validateOutput(
    rawOutput: unknown,
    input: LootGeneratorInput,
    context: LootGeneratorContext,
  ): LootGeneratorOutput {
    const llmOutput = lootGeneratorLLMOutputSchema.parse(rawOutput);
    const baseGold = calculateDmgBaseGold({
      partyLevel: input.partyLevel,
      mode: "hoard",
    });

    return composeLootGeneratorOutput(input, context, baseGold, llmOutput);
  }

  persist(output: LootGeneratorOutput): LootGeneratorOutput {
    return output;
  }
}
