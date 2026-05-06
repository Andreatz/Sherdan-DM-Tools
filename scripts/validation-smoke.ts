import {
  type EntityTypeName,
  safeValidateEntityProperties,
} from "@/lib/validation";

// Smoke one-shot: per ogni entity type esegue un payload "happy" che deve
// passare e uno "broken" che deve fallire. Esce con codice 1 se le
// aspettative non sono rispettate.

type Cases = Record<EntityTypeName, { ok: unknown; bad: unknown }>;

const cases: Cases = {
  npc: {
    ok: {
      race: "human",
      appearance_summary: "Donna di mezza eta', cicatrice all'occhio sinistro.",
      tics: ["si tocca la cicatrice quando mente"],
      voice: { tone: "raspy", speech_patterns: ["usa il presente storico"] },
      sensory_details: { smell: "tabacco e ferro vecchio" },
      goals: { short_term: "trovare la moglie scomparsa" },
      weaknesses: [
        { description: "panico sotto la pioggia", who_could_exploit: "mago di acqua" },
      ],
    },
    bad: {
      // race mancante (required), e tics: number invece di string[]
      appearance_summary: "x",
      tics: [42],
    },
  },
  pc: {
    ok: { race: "elf", class: "ranger", level: 5, ideals: ["liberta'"] },
    bad: { race: "elf", class: "ranger" /* level mancante */ },
  },
  location: {
    ok: {
      kind: "city",
      atmosphere: { sounds: "campane lontane", smells: "salso e legno bagnato" },
    },
    bad: { kind: "metropolis" /* non in enum */ },
  },
  faction: {
    ok: { size: "medium", power_level: 3, methods: ["spionaggio", "corruzione"] },
    bad: { power_level: 99 /* > 5 */ },
  },
  item: {
    ok: { kind: "weapon", rarity: "rare", attunement: true, weight: 3 },
    bad: { kind: "weapon", weight: -1 },
  },
  monster: {
    ok: {
      size: "medium",
      creature_type: "humanoid",
      ac: 14,
      hp_average: 22,
      speed: { walk: 30 },
      abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 11, cha: 9 },
      challenge_rating: "1/2",
    },
    bad: {
      size: "medium",
      creature_type: "humanoid",
      ac: 14,
      hp_average: 22,
      speed: { walk: 30 },
      abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 11 /* cha mancante */ },
      challenge_rating: "1/2",
    },
  },
  deity: {
    ok: { domains: ["death", "knowledge"], symbol: "occhio chiuso su luna nera" },
    bad: { domains: "death" /* deve essere array */ },
  },
  organization: {
    ok: { kind: "guild", purpose: "protezione delle vie commerciali" },
    bad: { kind: "syndicate" /* non in enum */ },
  },
};

let failed = 0;
for (const [type, payloads] of Object.entries(cases) as [
  EntityTypeName,
  Cases[EntityTypeName],
][]) {
  const okResult = safeValidateEntityProperties(type, payloads.ok);
  const badResult = safeValidateEntityProperties(type, payloads.bad);

  if (!okResult.success) {
    console.error(
      `[FAIL] ${type}: payload "ok" doveva passare ma ha fallito:`,
      okResult.error.issues,
    );
    failed++;
  } else if (badResult.success) {
    console.error(
      `[FAIL] ${type}: payload "bad" doveva fallire ma ha passato.`,
    );
    failed++;
  } else {
    const issues = badResult.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join(" | ");
    console.log(`[OK]   ${type}  (rejected bad with: ${issues})`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} smoke case(s) failed.`);
  process.exit(1);
}
console.log("\nAll validation smoke cases passed.");
