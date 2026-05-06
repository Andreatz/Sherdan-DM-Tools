import { z } from "zod";

import { extraField, stringArray } from "./_shared";

export const itemKindSchema = z.enum([
  "weapon",
  "armor",
  "shield",
  "wondrous",
  "consumable",
  "tool",
  "currency",
  "document",
  "artifact",
  "material", // componente di crafting (Forgia di Sherdan)
  "trinket",
]);

export const itemRaritySchema = z.enum([
  "common",
  "uncommon",
  "rare",
  "very_rare",
  "legendary",
  "artifact",
]);

export const itemPropertiesSchema = z
  .object({
    kind: itemKindSchema,
    rarity: itemRaritySchema.optional(),
    attunement: z.boolean().default(false),

    weight: z.number().nonnegative().optional(), // libbre
    value_gp: z.number().nonnegative().optional(),

    // Effetti narrativi/meccanici. Lasciamo libero perche' la varieta' e'
    // tale che un schema rigido sarebbe peggio della prosa.
    effects: stringArray,

    // Statistiche meccaniche tipizzate (damage dice, AC bonus, save DC, ecc.)
    // Forma libera finche' la Fase 5 (Encounter Builder) non stabilizza un
    // pattern condiviso con i monster statblock.
    mechanics: z.unknown().optional(),

    // Origine/lore: per item magici Sherdan-specifici.
    origin: z.string().optional(),

    // Per il sistema di crafting "Forgia di Sherdan": materiali necessari
    // e tier di raffinazione.
    crafted_from: z.array(z.uuid()).default([]),
    refinement_tier: z.number().int().min(0).optional(),

    extra: extraField,
  })
  .strict();

export type ItemProperties = z.infer<typeof itemPropertiesSchema>;
