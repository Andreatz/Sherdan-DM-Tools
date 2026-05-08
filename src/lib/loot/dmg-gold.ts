export const coinTypes = ["cp", "sp", "ep", "gp", "pp"] as const;
export type CoinType = (typeof coinTypes)[number];

export type DmgGoldTierId = "0-4" | "5-10" | "11-16" | "17+";
export type DmgGoldMode = "individual" | "hoard";
export type ChallengeRatingInput =
  | number
  | "0"
  | "1/8"
  | "1/4"
  | "1/2";

export interface DiceExpression {
  dice: number;
  sides: number;
  multiplier?: number;
}

export type CoinFormula = Partial<Record<CoinType, DiceExpression>>;

export interface WeightedCoinFormula {
  chance: number;
  coins: CoinFormula;
}

export interface DmgGoldTier {
  id: DmgGoldTierId;
  crMin: number;
  crMax: number;
  partyLevelMin: number;
  partyLevelMax: number;
  individual: WeightedCoinFormula[];
  hoard: CoinFormula;
}

export interface DmgBaseGoldInput {
  challengeRating?: ChallengeRatingInput;
  partyLevel?: number;
  mode?: DmgGoldMode;
  quantity?: number;
}

export interface DmgBaseGoldResult {
  tier: DmgGoldTierId;
  mode: DmgGoldMode;
  quantity: number;
  gpPerUnit: number;
  totalGp: number;
  averageCoinsPerUnit: Partial<Record<CoinType, number>>;
}

export const coinValueInGold: Record<CoinType, number> = {
  cp: 0.01,
  sp: 0.1,
  ep: 0.5,
  gp: 1,
  pp: 10,
};

// DMG 2014 treasure tables, coin portions only. Gems, art objects and magic
// item rolls are intentionally excluded: the Loot Generator will handle those
// narratively in the next tasks.
export const dmgGoldTiers: readonly DmgGoldTier[] = [
  {
    id: "0-4",
    crMin: 0,
    crMax: 4,
    partyLevelMin: 1,
    partyLevelMax: 4,
    individual: [
      { chance: 30, coins: { cp: dice(5, 6) } },
      { chance: 30, coins: { sp: dice(4, 6) } },
      { chance: 10, coins: { ep: dice(3, 6) } },
      { chance: 25, coins: { gp: dice(3, 6) } },
      { chance: 5, coins: { pp: dice(1, 6) } },
    ],
    hoard: {
      cp: dice(6, 6, 100),
      sp: dice(3, 6, 100),
      gp: dice(2, 6, 10),
    },
  },
  {
    id: "5-10",
    crMin: 5,
    crMax: 10,
    partyLevelMin: 5,
    partyLevelMax: 10,
    individual: [
      { chance: 30, coins: { cp: dice(4, 6, 100), ep: dice(1, 6, 10) } },
      { chance: 30, coins: { sp: dice(6, 6, 10), gp: dice(2, 6, 10) } },
      { chance: 10, coins: { ep: dice(3, 6, 10), gp: dice(2, 6, 10) } },
      { chance: 25, coins: { gp: dice(4, 6, 10) } },
      { chance: 5, coins: { gp: dice(2, 6, 10), pp: dice(3, 6) } },
    ],
    hoard: {
      cp: dice(2, 6, 100),
      sp: dice(2, 6, 1000),
      gp: dice(6, 6, 100),
      pp: dice(3, 6, 10),
    },
  },
  {
    id: "11-16",
    crMin: 11,
    crMax: 16,
    partyLevelMin: 11,
    partyLevelMax: 16,
    individual: [
      { chance: 20, coins: { sp: dice(4, 6, 100), gp: dice(1, 6, 100) } },
      { chance: 15, coins: { ep: dice(1, 6, 100), gp: dice(1, 6, 100) } },
      { chance: 40, coins: { gp: dice(2, 6, 100), pp: dice(1, 6, 10) } },
      { chance: 25, coins: { gp: dice(2, 6, 100), pp: dice(2, 6, 10) } },
    ],
    hoard: {
      gp: dice(4, 6, 1000),
      pp: dice(5, 6, 100),
    },
  },
  {
    id: "17+",
    crMin: 17,
    crMax: 30,
    partyLevelMin: 17,
    partyLevelMax: 20,
    individual: [
      { chance: 15, coins: { ep: dice(2, 6, 1000), gp: dice(8, 6, 100) } },
      { chance: 40, coins: { gp: dice(1, 6, 1000), pp: dice(1, 6, 100) } },
      { chance: 45, coins: { gp: dice(1, 6, 1000), pp: dice(2, 6, 100) } },
    ],
    hoard: {
      gp: dice(12, 6, 1000),
      pp: dice(8, 6, 1000),
    },
  },
] as const;

export function calculateDmgBaseGold(
  input: DmgBaseGoldInput,
): DmgBaseGoldResult {
  const mode = input.mode ?? "hoard";
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("quantity deve essere un intero positivo");
  }

  const tier = resolveDmgGoldTier(input);
  const averageCoinsPerUnit =
    mode === "hoard"
      ? averageCoinsForFormula(tier.hoard)
      : averageCoinsForWeightedFormula(tier.individual);
  const gpPerUnit = gpValueForCoins(averageCoinsPerUnit);

  return {
    tier: tier.id,
    mode,
    quantity,
    gpPerUnit: roundGold(gpPerUnit),
    totalGp: roundGold(gpPerUnit * quantity),
    averageCoinsPerUnit,
  };
}

export function resolveDmgGoldTier(input: DmgBaseGoldInput): DmgGoldTier {
  const challengeRating = input.challengeRating;
  const partyLevel = input.partyLevel;
  const hasCr = challengeRating !== undefined;
  const hasLevel = partyLevel !== undefined;
  if (hasCr === hasLevel) {
    throw new Error(
      "Specifica esattamente uno tra challengeRating e partyLevel",
    );
  }

  if (hasCr) {
    const cr = normalizeChallengeRating(challengeRating);
    const tier = dmgGoldTiers.find((row) => cr >= row.crMin && cr <= row.crMax);
    if (!tier) throw new Error(`Challenge rating fuori range: ${cr}`);
    return tier;
  }

  if (partyLevel === undefined) {
    throw new Error("partyLevel mancante");
  }
  const level = partyLevel;
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new Error("partyLevel deve essere un intero tra 1 e 20");
  }
  const tier = dmgGoldTiers.find(
    (row) => level >= row.partyLevelMin && level <= row.partyLevelMax,
  );
  if (!tier) throw new Error(`Party level fuori range: ${level}`);
  return tier;
}

export function normalizeChallengeRating(input: ChallengeRatingInput): number {
  if (input === "0") return 0;
  if (input === "1/8") return 0.125;
  if (input === "1/4") return 0.25;
  if (input === "1/2") return 0.5;
  if (!Number.isFinite(input) || input < 0 || input > 30) {
    throw new Error("challengeRating deve essere un numero tra 0 e 30");
  }
  return input;
}

export function averageDice(expression: DiceExpression): number {
  const multiplier = expression.multiplier ?? 1;
  return (expression.dice * (expression.sides + 1) * multiplier) / 2;
}

function dice(diceCount: number, sides: number, multiplier = 1): DiceExpression {
  return { dice: diceCount, sides, multiplier };
}

function averageCoinsForFormula(
  formula: CoinFormula,
): Partial<Record<CoinType, number>> {
  const coins: Partial<Record<CoinType, number>> = {};
  for (const coin of coinTypes) {
    const expression = formula[coin];
    if (expression) coins[coin] = averageDice(expression);
  }
  return coins;
}

function averageCoinsForWeightedFormula(
  rows: readonly WeightedCoinFormula[],
): Partial<Record<CoinType, number>> {
  const totalChance = rows.reduce((sum, row) => sum + row.chance, 0);
  if (totalChance !== 100) {
    throw new Error(`Tabella treasure invalida: chance totale ${totalChance}`);
  }

  const coins: Partial<Record<CoinType, number>> = {};
  for (const row of rows) {
    const weight = row.chance / 100;
    const rowCoins = averageCoinsForFormula(row.coins);
    for (const coin of coinTypes) {
      coins[coin] = (coins[coin] ?? 0) + (rowCoins[coin] ?? 0) * weight;
    }
  }
  return coins;
}

function gpValueForCoins(coins: Partial<Record<CoinType, number>>): number {
  return coinTypes.reduce(
    (sum, coin) => sum + (coins[coin] ?? 0) * coinValueInGold[coin],
    0,
  );
}

function roundGold(value: number): number {
  return Math.round(value * 100) / 100;
}
