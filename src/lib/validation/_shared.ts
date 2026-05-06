import { z } from "zod";

// Multi-sensorialita': pattern Sherdan #5. Riusato da NPC, PC, Location.
// Mai sepolto in description: l'NPC generator e il render UI ne hanno bisogno
// in forma strutturata.
export const sensoryDetailsSchema = z
  .object({
    sight: z.string().optional(),
    smell: z.string().optional(),
    sound: z.string().optional(),
    touch: z.string().optional(),
  })
  .strict();

// Profilo voce + parlata. Riusato da NPC e PC.
export const voiceSchema = z
  .object({
    tone: z.string().optional(),
    accent: z.string().optional(),
    speech_patterns: z.array(z.string()).default([]),
  })
  .strict();

// Goals stratificati su tre orizzonti. Riusato da NPC, PC, Faction.
export const goalsSchema = z
  .object({
    short_term: z.string().optional(),
    medium_term: z.string().optional(),
    long_term: z.string().optional(),
  })
  .strict();

// Punto debole con esplicito who_could_exploit (pattern Sherdan: ogni
// antagonista ha una leva narrativa nominata).
export const weaknessSchema = z
  .object({
    description: z.string().min(1),
    who_could_exploit: z.string().min(1),
  })
  .strict();

// Spazio per campi non typed. Tutti gli schemi sono `.strict()`, le estensioni
// devono passare da qui — niente data loss silenzioso.
export const extraField = z
  .record(z.string(), z.unknown())
  .optional();

// Helper per non ripetere il `default([])` su array opzionali con default vuoto.
export const stringArray = z.array(z.string()).default([]);
