import { z } from "zod";

import type { LootGeneratorInput } from "./loot-input";
import { lootGeneratorOutputSchema } from "./loot-output";
import type { ResolvedLootBundle, ResolvedLootItem } from "./loot-resolver";

export const lootGeneratorSaveRequestSchema = z
  .object({
    output: lootGeneratorOutputSchema,
    encounterId: z
      .preprocess(
        (value) => (value === "" || value === null ? undefined : value),
        z.uuid().optional(),
      )
      .optional(),
  })
  .strict();

export type LootGeneratorSaveRequest = z.infer<
  typeof lootGeneratorSaveRequestSchema
>;

export interface LootResolutionSummaryItem {
  name: string;
  action: "reuse" | "create";
  match: {
    id: string;
    name: string;
    score: number;
    distance: number;
  } | null;
  candidates: Array<{
    id: string;
    name: string;
    score: number;
    distance: number;
  }>;
}

export interface LootResolutionSummary {
  items: LootResolutionSummaryItem[];
  reusedCount: number;
  createCount: number;
  reuseThreshold: number;
  maxCandidates: number;
}

export interface LootGeneratorPreviewResponse {
  input: LootGeneratorInput;
  output: ResolvedLootBundle["output"];
  resolution: LootResolutionSummary;
}

export function summarizeResolvedLootBundle(
  resolved: ResolvedLootBundle,
): LootResolutionSummary {
  return {
    items: resolved.items.map(summarizeResolvedLootItem),
    reusedCount: resolved.metadata.reusedCount,
    createCount: resolved.metadata.createCount,
    reuseThreshold: resolved.metadata.reuseThreshold,
    maxCandidates: resolved.metadata.maxCandidates,
  };
}

function summarizeResolvedLootItem(
  resolved: ResolvedLootItem,
): LootResolutionSummaryItem {
  return {
    name: resolved.item.name,
    action: resolved.action,
    match: resolved.match
      ? {
          id: resolved.match.id,
          name: resolved.match.name,
          score: resolved.match.score,
          distance: resolved.match.distance,
        }
      : null,
    candidates: resolved.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      score: candidate.score,
      distance: candidate.distance,
    })),
  };
}
