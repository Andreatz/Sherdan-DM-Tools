import { z } from "zod";

import {
  calculateEncounterDifficulty,
  calculatePartyThresholds,
  partyFromAverageLevel,
  type EncounterDifficultyName,
  type EncounterDifficultyResult,
  type EncounterThresholds,
} from "./cr-calculator";
import type { MonsterBrowserRecord } from "./monster-browser";

export const encounterSuggesterDifficultyOptions = [
  "easy",
  "medium",
  "hard",
  "deadly",
] as const;

export type EncounterSuggesterDifficulty =
  (typeof encounterSuggesterDifficultyOptions)[number];

export const encounterSuggesterInputSchema = z
  .object({
    campaignId: z.uuid(),
    partyLevel: z.coerce.number().int().min(1).max(20),
    partySize: z.coerce.number().int().min(1).max(8),
    difficulty: z.enum(encounterSuggesterDifficultyOptions),
    creatureType: z.string().trim().min(1).optional(),
    environment: z.string().trim().min(1).optional(),
    size: z.string().trim().min(1).optional(),
    maxSuggestions: z.coerce.number().int().min(1).max(12).default(6),
  })
  .strict();

export type EncounterSuggesterInput = z.infer<
  typeof encounterSuggesterInputSchema
>;

export interface SuggesterMonster {
  id: string;
  name: string;
  xp: number;
  challengeRating: string;
  creatureType: string;
  size: string;
  environment: string[];
}

export interface EncounterCompositionParticipant {
  monster: SuggesterMonster;
  count: number;
}

export interface EncounterCompositionSuggestion {
  participants: EncounterCompositionParticipant[];
  difficulty: EncounterDifficultyResult;
  score: number;
}

interface DifficultyBand {
  lower: number;
  upper: number;
  target: number;
}

const MAX_SAME_MONSTER_COUNT = 8;

export function suggestEncounterCompositions(input: {
  partyLevel: number;
  partySize: number;
  difficulty: EncounterSuggesterDifficulty;
  monsters: SuggesterMonster[];
  maxSuggestions?: number;
}): EncounterCompositionSuggestion[] {
  const party = partyFromAverageLevel({
    partyLevel: input.partyLevel,
    partySize: input.partySize,
  });
  const thresholds = calculatePartyThresholds(party);
  const band = difficultyBand(input.difficulty, thresholds);
  const maxSuggestions = input.maxSuggestions ?? 6;
  const monsters = input.monsters
    .filter((monster) => Number.isFinite(monster.xp) && monster.xp > 0)
    .sort((a, b) => a.xp - b.xp || a.name.localeCompare(b.name));

  const suggestions = new Map<string, EncounterCompositionSuggestion>();

  for (const monster of monsters) {
    for (let count = 1; count <= MAX_SAME_MONSTER_COUNT; count += 1) {
      addSuggestion(suggestions, band, party, [
        { monster, count },
      ]);
    }
  }

  for (let leftIndex = 0; leftIndex < monsters.length; leftIndex += 1) {
    const left = monsters[leftIndex];
    if (!left) continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < monsters.length;
      rightIndex += 1
    ) {
      const right = monsters[rightIndex];
      if (!right) continue;
      for (let leftCount = 1; leftCount <= 4; leftCount += 1) {
        for (let rightCount = 1; rightCount <= 4; rightCount += 1) {
          addSuggestion(suggestions, band, party, [
            { monster: left, count: leftCount },
            { monster: right, count: rightCount },
          ]);
        }
      }
    }
  }

  return Array.from(suggestions.values())
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.difficulty.adjustedXp - b.difficulty.adjustedXp ||
        suggestionLabel(a).localeCompare(suggestionLabel(b)),
    )
    .slice(0, maxSuggestions);
}

export function monsterRecordToSuggesterMonster(
  record: MonsterBrowserRecord,
): SuggesterMonster | null {
  const xp = record.properties.xp;
  if (!xp || xp <= 0) return null;

  return {
    id: record.id,
    name: record.name,
    xp,
    challengeRating: record.properties.challenge_rating,
    creatureType: record.properties.creature_type,
    size: record.properties.size,
    environment: record.properties.environment,
  };
}

export function filterSuggesterMonsters(
  monsters: SuggesterMonster[],
  filters: Pick<
    EncounterSuggesterInput,
    "creatureType" | "environment" | "size"
  >,
): SuggesterMonster[] {
  return monsters.filter((monster) => {
    if (filters.creatureType && monster.creatureType !== filters.creatureType) {
      return false;
    }
    if (filters.size && monster.size !== filters.size) return false;
    if (
      filters.environment &&
      !monster.environment
        .map((entry) => entry.toLowerCase())
        .includes(filters.environment.toLowerCase())
    ) {
      return false;
    }
    return true;
  });
}

function addSuggestion(
  suggestions: Map<string, EncounterCompositionSuggestion>,
  band: DifficultyBand,
  party: ReturnType<typeof partyFromAverageLevel>,
  participants: EncounterCompositionParticipant[],
) {
  const difficulty = calculateEncounterDifficulty({
    party,
    monsters: participants.map((participant) => ({
      xp: participant.monster.xp,
      count: participant.count,
    })),
  });

  if (!isInBand(difficulty.difficulty, difficulty.adjustedXp, band)) return;

  const suggestion: EncounterCompositionSuggestion = {
    participants,
    difficulty,
    score: Math.abs(difficulty.adjustedXp - band.target),
  };
  suggestions.set(suggestionKey(suggestion), suggestion);
}

function isInBand(
  difficulty: EncounterDifficultyName,
  adjustedXp: number,
  band: DifficultyBand,
) {
  return (
    difficulty !== "trivial" &&
    adjustedXp >= band.lower &&
    adjustedXp < band.upper
  );
}

function difficultyBand(
  difficulty: EncounterSuggesterDifficulty,
  thresholds: EncounterThresholds,
): DifficultyBand {
  if (difficulty === "easy") {
    return {
      lower: thresholds.easy,
      upper: thresholds.medium,
      target: midpoint(thresholds.easy, thresholds.medium),
    };
  }
  if (difficulty === "medium") {
    return {
      lower: thresholds.medium,
      upper: thresholds.hard,
      target: midpoint(thresholds.medium, thresholds.hard),
    };
  }
  if (difficulty === "hard") {
    return {
      lower: thresholds.hard,
      upper: thresholds.deadly,
      target: midpoint(thresholds.hard, thresholds.deadly),
    };
  }

  return {
    lower: thresholds.deadly,
    upper: thresholds.deadly * 1.5,
    target: thresholds.deadly * 1.2,
  };
}

function midpoint(left: number, right: number): number {
  return (left + right) / 2;
}

function suggestionKey(suggestion: EncounterCompositionSuggestion): string {
  return suggestion.participants
    .map((participant) => `${participant.monster.id}:${participant.count}`)
    .join("|");
}

function suggestionLabel(suggestion: EncounterCompositionSuggestion): string {
  return suggestion.participants
    .map((participant) => `${participant.count}x ${participant.monster.name}`)
    .join(", ");
}
