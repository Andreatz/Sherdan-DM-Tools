export const encounterDifficultyOptions = [
  "trivial",
  "easy",
  "medium",
  "hard",
  "deadly",
] as const;

export type EncounterDifficultyName =
  (typeof encounterDifficultyOptions)[number];

export interface PartyMember {
  level: number;
}

export interface EncounterMonsterXp {
  xp: number;
  count?: number;
}

export interface EncounterThresholds {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
}

export interface EncounterDifficultyResult {
  partySize: number;
  thresholds: EncounterThresholds;
  monsterCount: number;
  baseXp: number;
  multiplier: number;
  adjustedXp: number;
  difficulty: EncounterDifficultyName;
}

const XP_THRESHOLDS_BY_LEVEL: Record<number, EncounterThresholds> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

const MULTIPLIER_STEPS = [1, 1.5, 2, 2.5, 3, 4] as const;

export function calculatePartyThresholds(
  party: PartyMember[],
): EncounterThresholds {
  assertParty(party);

  return party.reduce<EncounterThresholds>(
    (sum, member) => {
      const row = thresholdForLevel(member.level);
      return {
        easy: sum.easy + row.easy,
        medium: sum.medium + row.medium,
        hard: sum.hard + row.hard,
        deadly: sum.deadly + row.deadly,
      };
    },
    { easy: 0, medium: 0, hard: 0, deadly: 0 },
  );
}

export function calculateEncounterDifficulty(input: {
  party: PartyMember[];
  monsters: EncounterMonsterXp[];
}): EncounterDifficultyResult {
  assertParty(input.party);
  const expandedMonsters = expandMonsters(input.monsters);
  if (expandedMonsters.length === 0) {
    throw new Error("Encounter senza mostri");
  }

  const thresholds = calculatePartyThresholds(input.party);
  const baseXp = expandedMonsters.reduce((sum, xp) => sum + xp, 0);
  const multiplier = encounterXpMultiplier(
    expandedMonsters.length,
    input.party.length,
  );
  const adjustedXp = Math.round(baseXp * multiplier);

  return {
    partySize: input.party.length,
    thresholds,
    monsterCount: expandedMonsters.length,
    baseXp,
    multiplier,
    adjustedXp,
    difficulty: classifyEncounterDifficulty(adjustedXp, thresholds),
  };
}

export function encounterXpMultiplier(
  monsterCount: number,
  partySize: number,
): number {
  if (!Number.isInteger(monsterCount) || monsterCount <= 0) {
    throw new Error("monsterCount deve essere positivo");
  }
  if (!Number.isInteger(partySize) || partySize <= 0) {
    throw new Error("partySize deve essere positivo");
  }

  const baseIndex = multiplierIndexForMonsterCount(monsterCount);
  const adjustedIndex =
    partySize < 3 ? baseIndex + 1 : partySize > 5 ? baseIndex - 1 : baseIndex;
  const clampedIndex = Math.min(
    Math.max(adjustedIndex, 0),
    MULTIPLIER_STEPS.length - 1,
  );

  return MULTIPLIER_STEPS[clampedIndex]!;
}

export function classifyEncounterDifficulty(
  adjustedXp: number,
  thresholds: EncounterThresholds,
): EncounterDifficultyName {
  if (adjustedXp >= thresholds.deadly) return "deadly";
  if (adjustedXp >= thresholds.hard) return "hard";
  if (adjustedXp >= thresholds.medium) return "medium";
  if (adjustedXp >= thresholds.easy) return "easy";
  return "trivial";
}

export function partyFromAverageLevel(input: {
  partyLevel: number;
  partySize: number;
}): PartyMember[] {
  if (!Number.isInteger(input.partyLevel) || input.partyLevel < 1 || input.partyLevel > 20) {
    throw new Error("partyLevel deve essere tra 1 e 20");
  }
  if (!Number.isInteger(input.partySize) || input.partySize < 1) {
    throw new Error("partySize deve essere positivo");
  }

  return Array.from({ length: input.partySize }, () => ({
    level: input.partyLevel,
  }));
}

function thresholdForLevel(level: number): EncounterThresholds {
  const row = XP_THRESHOLDS_BY_LEVEL[level];
  if (!row) {
    throw new Error(`Livello party non valido: ${level}`);
  }
  return row;
}

function multiplierIndexForMonsterCount(monsterCount: number): number {
  if (monsterCount === 1) return 0;
  if (monsterCount === 2) return 1;
  if (monsterCount <= 6) return 2;
  if (monsterCount <= 10) return 3;
  if (monsterCount <= 14) return 4;
  return 5;
}

function expandMonsters(monsters: EncounterMonsterXp[]): number[] {
  return monsters.flatMap((monster) => {
    const count = monster.count ?? 1;
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error("count mostro deve essere positivo");
    }
    if (!Number.isFinite(monster.xp) || monster.xp < 0) {
      throw new Error("xp mostro non valido");
    }
    return Array.from({ length: count }, () => monster.xp);
  });
}

function assertParty(party: PartyMember[]) {
  if (party.length === 0) {
    throw new Error("Party vuoto");
  }
  for (const member of party) {
    if (!Number.isInteger(member.level) || member.level < 1 || member.level > 20) {
      throw new Error(`Livello party non valido: ${member.level}`);
    }
  }
}
