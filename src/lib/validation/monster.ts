import { z } from "zod";

import { extraField, stringArray } from "./_shared";

// Statblock D&D 5e. Riempito da:
// - importer SRD in Fase 5 (open5e API o JSON dump)
// - generator NPC quando un NPC ha bisogno di stat
// - inserimento manuale per mostri custom Sherdan
//
// Volutamente fedele al formato classico per facilitare l'import. Campi
// non standard (varianti homebrew) vanno in `extra`.

const sizeSchema = z.enum([
  "tiny",
  "small",
  "medium",
  "large",
  "huge",
  "gargantuan",
]);

const abilityScoresSchema = z
  .object({
    str: z.number().int(),
    dex: z.number().int(),
    con: z.number().int(),
    int: z.number().int(),
    wis: z.number().int(),
    cha: z.number().int(),
  })
  .strict();

const speedSchema = z
  .object({
    walk: z.number().int().nonnegative().optional(),
    fly: z.number().int().nonnegative().optional(),
    swim: z.number().int().nonnegative().optional(),
    climb: z.number().int().nonnegative().optional(),
    burrow: z.number().int().nonnegative().optional(),
    hover: z.boolean().optional(),
  })
  .strict();

const featureSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    // Per legendary/lair: costo in usi, frequenza, ecc.
    usage: z.string().optional(),
  })
  .strict();

// CR rappresentato come stringa per supportare "1/8", "1/4", "1/2", "0".
const challengeRatingSchema = z
  .string()
  .regex(/^(0|1\/8|1\/4|1\/2|[1-9][0-9]?|3[0-3])$/);

export const monsterPropertiesSchema = z
  .object({
    // Categoria & taglia
    size: sizeSchema,
    creature_type: z.string().min(1), // "humanoid", "undead", "fiend", ecc.
    subtype: z.string().optional(), // "(human)", "(devil)"
    alignment: z.string().optional(),

    // Difesa
    ac: z.number().int().min(0),
    ac_note: z.string().optional(), // "16 (cotta di maglia, scudo)"
    hp_average: z.number().int().min(1),
    hp_formula: z.string().optional(), // "8d8 + 16"
    speed: speedSchema,

    // Stats
    abilities: abilityScoresSchema,
    saving_throws: z.record(z.string(), z.number().int()).optional(),
    skills: z.record(z.string(), z.number().int()).optional(),

    damage_resistances: stringArray,
    damage_immunities: stringArray,
    damage_vulnerabilities: stringArray,
    condition_immunities: stringArray,

    senses: stringArray, // "darkvision 120 ft.", "passive Perception 16"
    languages: stringArray,

    // Sfida
    challenge_rating: challengeRatingSchema,
    xp: z.number().int().nonnegative().optional(),
    proficiency_bonus: z.number().int().nonnegative().optional(),

    // Sezioni narrative del block
    traits: z.array(featureSchema).default([]),
    actions: z.array(featureSchema).default([]),
    bonus_actions: z.array(featureSchema).default([]),
    reactions: z.array(featureSchema).default([]),
    legendary_actions: z.array(featureSchema).default([]),
    lair_actions: z.array(featureSchema).default([]),

    // Habitat
    environment: stringArray,

    // Source (SRD, MM, custom Sherdan)
    source: z.string().optional(),

    extra: extraField,
  })
  .strict();

export type MonsterProperties = z.infer<typeof monsterPropertiesSchema>;
