import { z } from "zod";

import { extraField, stringArray } from "./_shared";

// Tipologie di location. Aggiunte future via update enum (additivo, OK).
export const locationKindSchema = z.enum([
  "city",
  "town",
  "village",
  "settlement", // generico
  "dungeon",
  "wilderness",
  "building",
  "region",
  "plane",
  "structure", // landmark, rovina, torre isolata, ecc.
  "room", // sottocomponente di un dungeon procedurale (Fase 8 slice 3).
]);

// Multi-sensorialita' applicata alla location (atmosfera, suoni, odori).
// Distinta da `sensory_details` degli NPC perche' descrive l'ambiente.
const locationAtmosphereSchema = z
  .object({
    layout: z.string().optional(), // disposizione, geografia
    atmosphere: z.string().optional(), // tono / mood
    sights: z.string().optional(),
    sounds: z.string().optional(),
    smells: z.string().optional(),
  })
  .strict();

export const locationPropertiesSchema = z
  .object({
    kind: locationKindSchema,
    size: z.string().optional(), // "piccola", "30 case", "metropoli da 200k"
    population: z.string().optional(), // testo libero (preciso o vago)
    climate: z.string().optional(),
    terrain: z.string().optional(),

    atmosphere: locationAtmosphereSchema.default({}),

    notable_features: stringArray, // landmark, edifici noti
    services: stringArray, // taverne, locande, fabbri, templi disponibili

    ruling_faction_id: z.uuid().optional(),
    danger_level: z.number().int().min(0).max(5).optional(),

    // Per dungeon procedurali (Fase 8): grafo room/edges, mappa, theme.
    // Schema interno libero finche' la Fase 8 non stabilizza la forma.
    map_data: z.unknown().optional(),

    extra: extraField,
  })
  .strict();

export type LocationProperties = z.infer<typeof locationPropertiesSchema>;
