import {
  callStructuredOutputLogged,
  StyleCalibrator,
  type GeneratorRunOptions,
} from "@/lib/generators";
import { DrizzleNpcGeneratorContextStore } from "@/lib/generators/npc-context";

import {
  composeDungeonContent,
  dungeonContentLLMOutputSchema,
  type DungeonContentInput,
  type DungeonContentResult,
} from "./content-schema";
import {
  buildDungeonContentPrompt,
  resolveTargetedRoomIds,
} from "./content-prompt";

export interface DungeonContentGeneratorOptions {
  runOptions?: GeneratorRunOptions;
  // Test-only: inietta un fetcher di entita' style invece di toccare il DB.
  styleEntityFetcher?: (
    campaignId: string,
    limit: number,
  ) => Promise<
    Array<{
      id: string;
      type:
        | "npc"
        | "pc"
        | "location"
        | "faction"
        | "item"
        | "monster"
        | "deity"
        | "organization";
      name: string;
      description: string | null;
      publicDescription: string | null;
      properties: unknown;
      tags?: string[];
    }>
  >;
  styleEntityLimit?: number;
}

const DEFAULT_STYLE_ENTITY_LIMIT = 60;

export async function generateDungeonContent(
  input: DungeonContentInput,
  options: DungeonContentGeneratorOptions = {},
): Promise<DungeonContentResult> {
  const targetedRoomIds = resolveTargetedRoomIds(input);
  const existingContent = input.existingContent ?? [];

  let styleMarkdown: string | null = null;
  let styleEntitiesAnalyzed = 0;

  if (input.campaignId) {
    const fetcher =
      options.styleEntityFetcher ?? defaultStyleEntityFetcher();
    const styleEntities = await fetcher(
      input.campaignId,
      options.styleEntityLimit ?? DEFAULT_STYLE_ENTITY_LIMIT,
    );
    if (styleEntities.length > 0) {
      const calibration = new StyleCalibrator().calibrate(styleEntities);
      styleMarkdown = calibration.promptBlock;
      styleEntitiesAnalyzed = calibration.profile.entitiesAnalyzed;
    }
  }

  const prompt = buildDungeonContentPrompt({
    dungeon: input.dungeon,
    targetedRoomIds,
    existingContent,
    styleCalibrationMarkdown: styleMarkdown,
  });

  const llmOutput = await callStructuredOutputLogged({
    prompt,
    schema: dungeonContentLLMOutputSchema,
    logContext: {
      generatorName: "dungeon-content",
      campaignId: input.campaignId ?? null,
      input: {
        theme: input.dungeon.params.theme,
        seed: input.dungeon.params.seed,
        roomCount: input.dungeon.rooms.length,
        targetedRoomCount: targetedRoomIds.length,
        hasExistingContent: existingContent.length > 0,
        hasCampaignContext: Boolean(input.campaignId),
      },
      metadata: {
        styleEntitiesAnalyzed,
        targetedRoomIds,
      },
    },
    runOptions: options.runOptions,
  });

  return composeDungeonContent({
    dungeon: input.dungeon,
    targetedRoomIds,
    llmRooms: llmOutput.rooms,
    existing: existingContent,
    styleEntitiesAnalyzed,
  });
}

function defaultStyleEntityFetcher() {
  const store = new DrizzleNpcGeneratorContextStore();
  return (campaignId: string, limit: number) =>
    store.getCampaignStyleEntities(campaignId, limit);
}
