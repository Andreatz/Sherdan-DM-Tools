import { describe, expect, it } from "vitest";

import {
  type EntityTypeName,
  safeValidateEntityProperties,
  validateEntityProperties,
} from "@/lib/validation";

// Test del discriminator e degli schemi `properties` JSONB per ogni
// entity_type. Migrato da scripts/validation-smoke.ts (che resta per
// uso manuale rapido).

interface Case {
  ok: unknown;
  bad: unknown;
  /** Path Zod che ci aspettiamo nel primo issue del payload bad. */
  badIssuePath: (string | number)[];
}

const cases: Record<EntityTypeName, Case> = {
  npc: {
    ok: {
      race: "human",
      appearance_summary: "Donna di mezza eta', cicatrice all'occhio sinistro.",
      tics: ["si tocca la cicatrice quando mente"],
      voice: { tone: "raspy", speech_patterns: ["usa il presente storico"] },
      sensory_details: { smell: "tabacco e ferro vecchio" },
      goals: { short_term: "trovare la moglie scomparsa" },
      weaknesses: [
        {
          description: "panico sotto la pioggia",
          who_could_exploit: "mago di acqua",
        },
      ],
    },
    bad: { appearance_summary: "x", tics: [42] },
    badIssuePath: ["race"],
  },
  pc: {
    ok: { race: "elf", class: "ranger", level: 5, ideals: ["liberta'"] },
    bad: { race: "elf", class: "ranger" },
    badIssuePath: ["level"],
  },
  location: {
    ok: {
      kind: "city",
      atmosphere: {
        sounds: "campane lontane",
        smells: "salso e legno bagnato",
      },
    },
    bad: { kind: "metropolis" },
    badIssuePath: ["kind"],
  },
  faction: {
    ok: { size: "medium", power_level: 3, methods: ["spionaggio"] },
    bad: { power_level: 99 },
    badIssuePath: ["power_level"],
  },
  item: {
    ok: { kind: "weapon", rarity: "rare", attunement: true, weight: 3 },
    bad: { kind: "weapon", weight: -1 },
    badIssuePath: ["weight"],
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
      abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 11 },
      challenge_rating: "1/2",
    },
    badIssuePath: ["abilities", "cha"],
  },
  deity: {
    ok: { domains: ["death", "knowledge"], symbol: "occhio chiuso su luna" },
    bad: { domains: "death" },
    badIssuePath: ["domains"],
  },
  organization: {
    ok: { kind: "guild", purpose: "protezione delle vie commerciali" },
    bad: { kind: "syndicate" },
    badIssuePath: ["kind"],
  },
};

const types = Object.keys(cases) as EntityTypeName[];

describe("validation/properties: happy paths", () => {
  it.each(types)(
    "%s accetta payload valido",
    (type) => {
      const result = safeValidateEntityProperties(type, cases[type].ok);
      expect(result.success, JSON.stringify(result, null, 2)).toBe(true);
    },
  );
});

describe("validation/properties: bad paths", () => {
  it.each(types)(
    "%s rifiuta payload invalido",
    (type) => {
      const result = safeValidateEntityProperties(type, cases[type].bad);
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path);
        // Almeno un issue deve avere il path atteso.
        const expected = cases[type].badIssuePath;
        const found = paths.some(
          (p) =>
            p.length === expected.length &&
            p.every((seg, idx) => seg === expected[idx]),
        );
        expect(found, `expected issue path ${JSON.stringify(expected)} in ${JSON.stringify(paths)}`).toBe(true);
      }
    },
  );
});

describe("validation/properties: throw vs safe", () => {
  it("validateEntityProperties throws su payload invalido", () => {
    expect(() => validateEntityProperties("npc", { tics: [42] })).toThrow();
  });

  it("validateEntityProperties ritorna data parsato su payload valido", () => {
    const data = validateEntityProperties("npc", cases.npc.ok);
    expect(data.race).toBe("human");
    expect(data.tics).toContain("si tocca la cicatrice quando mente");
  });
});

describe("validation/properties: edge cases NPC (pattern Sherdan)", () => {
  it("NPC con tutti i campi tipizzati Sherdan-style passa", () => {
    const sherdanNpc = {
      race: "umano",
      class: "ladro",
      level: 3,
      occupation: "informatore",
      appearance_summary: "Magro, occhi gialli, sempre incappucciato.",
      sensory_details: {
        sight: "una cicatrice a forma di mezzaluna sotto l'orecchio destro",
        smell: "menta e cuoio",
        sound: "tossicchia prima di parlare",
      },
      voice: {
        tone: "sussurrato",
        accent: "del Cappello",
        speech_patterns: ["finisce ogni frase con un mezzo sorriso"],
      },
      tics: ["si schiocca le nocche", "evita lo sguardo diretto"],
      motivations: ["proteggere la sorella minore"],
      goals: {
        short_term: "consegnare un messaggio a Lunacupa",
        medium_term: "trovare un porto sicuro fuori dal Cappello",
        long_term: "vendetta contro chi ha tradito il padre",
      },
      weaknesses: [
        {
          description: "alcolizzato sotto stress",
          who_could_exploit: "chiunque gli offra una bottiglia",
        },
      ],
    };
    const result = safeValidateEntityProperties("npc", sherdanNpc);
    expect(result.success).toBe(true);
  });

  it("NPC con chiavi non documentate viene rifiutato (.strict())", () => {
    const result = safeValidateEntityProperties("npc", {
      race: "human",
      appearance_summary: "x",
      hairColor: "black", // non in schema
    });
    expect(result.success).toBe(false);
  });

  it("NPC con extras dentro `extra` passa", () => {
    const result = safeValidateEntityProperties("npc", {
      race: "human",
      appearance_summary: "x",
      extra: { hairColor: "black", hatStyle: "tricorno" },
    });
    expect(result.success).toBe(true);
  });
});

describe("validation/properties: edge cases segreti stratificati", () => {
  // I segreti vanno in entity_secrets, NON dentro properties. Verifichiamo
  // che lo schema NPC NON accetti un campo `secrets` in properties (deve
  // andare nel campo `extra` o nella tabella dedicata).
  it("NPC con `secrets` top-level viene rifiutato (deve usare entity_secrets)", () => {
    const result = safeValidateEntityProperties("npc", {
      race: "human",
      appearance_summary: "x",
      secrets: [{ layer: "deep", content: "..." }],
    });
    expect(result.success).toBe(false);
  });
});
