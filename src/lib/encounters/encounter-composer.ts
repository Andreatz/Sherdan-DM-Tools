import {
  calculateEncounterDifficulty,
  partyFromAverageLevel,
  type EncounterDifficultyResult,
} from "./cr-calculator";
import type {
  EncounterCompositionParticipant,
  SuggesterMonster,
} from "./encounter-suggester";

export interface EncounterDraftParticipant {
  monster: SuggesterMonster;
  count: number;
}

export function addMonsterToDraft(
  draft: EncounterDraftParticipant[],
  monster: SuggesterMonster,
): EncounterDraftParticipant[] {
  const existing = draft.find(
    (participant) => participant.monster.id === monster.id,
  );
  if (existing) {
    return setMonsterCountInDraft(draft, monster.id, existing.count + 1);
  }
  return [...draft, { monster, count: 1 }];
}

export function setMonsterCountInDraft(
  draft: EncounterDraftParticipant[],
  monsterId: string,
  count: number,
): EncounterDraftParticipant[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("count deve essere un intero non negativo");
  }
  if (count === 0) {
    return draft.filter((participant) => participant.monster.id !== monsterId);
  }
  return draft.map((participant) =>
    participant.monster.id === monsterId
      ? { ...participant, count }
      : participant,
  );
}

export function participantsToDraft(
  participants: EncounterCompositionParticipant[],
): EncounterDraftParticipant[] {
  return participants.map((participant) => ({
    monster: participant.monster,
    count: participant.count,
  }));
}

export function calculateDraftDifficulty(input: {
  partyLevel: number;
  partySize: number;
  draft: EncounterDraftParticipant[];
}): EncounterDifficultyResult | null {
  if (input.draft.length === 0) return null;
  return calculateEncounterDifficulty({
    party: partyFromAverageLevel({
      partyLevel: input.partyLevel,
      partySize: input.partySize,
    }),
    monsters: input.draft.map((participant) => ({
      xp: participant.monster.xp,
      count: participant.count,
    })),
  });
}
