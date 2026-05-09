import { describe, expect, it } from "vitest";

import {
  addMonsterToDraft,
  calculateDraftDifficulty,
  participantsToDraft,
  setMonsterCountInDraft,
  type EncounterCompositionParticipant,
  type SuggesterMonster,
} from "@/lib/encounters";

describe("encounter composer", () => {
  it("adds monsters and increments existing rows", () => {
    const draft = addMonsterToDraft([], monsterFixture("wight", 700));
    const updated = addMonsterToDraft(draft, monsterFixture("wight", 700));

    expect(updated).toHaveLength(1);
    expect(updated[0]?.count).toBe(2);
  });

  it("sets count and removes rows at zero", () => {
    const draft = [{ monster: monsterFixture("wight", 700), count: 2 }];

    expect(setMonsterCountInDraft(draft, "wight", 3)[0]?.count).toBe(3);
    expect(setMonsterCountInDraft(draft, "wight", 0)).toEqual([]);
  });

  it("materializes a suggestion as draft participants", () => {
    const participants: EncounterCompositionParticipant[] = [
      { monster: monsterFixture("wight", 700), count: 2 },
    ];

    expect(participantsToDraft(participants)).toEqual(participants);
  });

  it("calculates live difficulty for the current draft", () => {
    const difficulty = calculateDraftDifficulty({
      partyLevel: 5,
      partySize: 4,
      draft: [{ monster: monsterFixture("wight", 700), count: 2 }],
    });

    expect(difficulty).toMatchObject({
      baseXp: 1400,
      multiplier: 1.5,
      adjustedXp: 2100,
      difficulty: "medium",
    });
  });

  it("returns null for an empty draft", () => {
    expect(
      calculateDraftDifficulty({ partyLevel: 5, partySize: 4, draft: [] }),
    ).toBeNull();
  });
});

function monsterFixture(id: string, xp: number): SuggesterMonster {
  return {
    id,
    name: "Wight",
    xp,
    challengeRating: "3",
    creatureType: "undead",
    size: "medium",
    environment: ["Ruins"],
  };
}
