import { z } from "zod";

// Ruoli narrativi assegnati a ogni stanza dal layout (euristica BSP),
// poi affinati dal contenuto LLM nello slice 2.
export const dungeonRoomKindSchema = z.enum([
  "entry",
  "standard",
  "boss",
  "treasure",
  "trick",
]);
export type DungeonRoomKind = z.infer<typeof dungeonRoomKindSchema>;

export const dungeonPointSchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .strict();
export type DungeonPoint = z.infer<typeof dungeonPointSchema>;

export const dungeonRoomSchema = z
  .object({
    id: z.string().min(1),
    // Bounding box in coordinate griglia (celle). x,y = corner top-left.
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
    kind: dungeonRoomKindSchema,
    // Centro precalcolato in coordinate griglia (per render e path).
    centerX: z.number(),
    centerY: z.number(),
    label: z.string().optional(),
  })
  .strict();
export type DungeonRoom = z.infer<typeof dungeonRoomSchema>;

export const dungeonEdgeSchema = z
  .object({
    id: z.string().min(1),
    fromRoomId: z.string().min(1),
    toRoomId: z.string().min(1),
    // Path manhattan tra centri (>= 2 punti). Lo slice 1 usa 2-3 punti;
    // pathfinding piu' raffinato e' un task futuro.
    path: z.array(dungeonPointSchema).min(2),
  })
  .strict();
export type DungeonEdge = z.infer<typeof dungeonEdgeSchema>;

// Parametri di generazione: input dell'utente + difese (clamp Zod).
export const dungeonGenerationParamsSchema = z
  .object({
    roomCount: z.number().int().min(4).max(40).default(15),
    gridWidth: z.number().int().min(20).max(200).default(64),
    gridHeight: z.number().int().min(20).max(200).default(44),
    minRoomSize: z.number().int().min(3).max(20).default(4),
    maxRoomSize: z.number().int().min(4).max(40).default(12),
    // Seed deterministico: stessa coppia (params, seed) -> stesso layout.
    seed: z.number().int().nonnegative().default(0),
    // Tag tematico libero (es. "fortezza Obsidium", "cripta dell'Ordine
    // della Cenere"). Lo slice 2 lo passa al prompt.
    theme: z.string().min(1).max(200).default("dungeon"),
  })
  .strict()
  .refine((p) => p.maxRoomSize >= p.minRoomSize, {
    message: "maxRoomSize deve essere >= minRoomSize",
    path: ["maxRoomSize"],
  });
export type DungeonGenerationParams = z.infer<typeof dungeonGenerationParamsSchema>;

// Forma di `entities.properties.map_data` per location kind='dungeon'.
// In Fase 8 slice 3 verra' persistita; oggi serve come tipo di scambio
// API e (futuro) di validazione lato persistenza.
export const dungeonMapDataSchema = z
  .object({
    version: z.literal(1).default(1),
    algorithm: z.literal("bsp"),
    params: dungeonGenerationParamsSchema,
    rooms: z.array(dungeonRoomSchema).min(1),
    edges: z.array(dungeonEdgeSchema).default([]),
    grid: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();
export type DungeonMapData = z.infer<typeof dungeonMapDataSchema>;
