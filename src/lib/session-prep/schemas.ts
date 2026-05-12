import { z } from "zod";

import { entityType, plotThreadStatus } from "@/db/schema";

// Input del Session Prep Assistant. Il DM specifica location corrente
// (opzionale: se manca, l'agent puo' suggerire location dai plot thread
// hot), il "vibe" desiderato, e un focus opzionale ("voglio piantare due
// briciole sull'identita' di Malakor"). Tutto il resto e' inferito dallo
// stato della campagna.
export const sessionPrepInputSchema = z
  .object({
    campaignId: z.uuid(),
    locationId: z.uuid().nullable().optional(),
    partyLevel: z.coerce.number().int().min(1).max(20).default(5),
    partySize: z.coerce.number().int().min(1).max(8).default(4),
    /** Tono richiesto, libero (es. "intrigo politico", "investigazione"). */
    vibe: z.string().trim().min(1).max(200).optional(),
    /**
     * Focus narrativo opzionale. Quando presente, l'agent privilegia
     * proposte allineate a questa direzione (es. "due briciole su
     * Malakor", "spotlight su Axton"). Libero.
     */
    focus: z.string().trim().max(500).optional(),
  })
  .strict();

export type SessionPrepInput = z.infer<typeof sessionPrepInputSchema>;

// Le proposte dell'agent sono volutamente "seed", non oggetti pronti da
// persistere automaticamente: il DM li rivede e decide cosa farne. La
// granularita' permette accept/reject per pezzo nelle slice successive.

const hookProposalSchema = z
  .object({
    /** Id del PG su cui agganciare. Null = hook generico per il party. */
    pcEntityId: z.uuid().nullable(),
    pcName: z.string().min(1),
    /** Id dell'entita' target (NPC, fazione, location, ...). */
    targetEntityId: z.uuid().nullable(),
    targetName: z.string().min(1),
    hookDescription: z.string().min(1),
    /** Cosa potrebbe diventare se il party morde. */
    potentialArc: z.string().min(1),
    /** Perche' l'agent ha scelto questo hook ora. */
    rationale: z.string().min(1),
  })
  .strict();

const npcSeedSchema = z
  .object({
    /**
     * Se l'NPC esiste gia' nel wiki, il suo id. Null = nuovo NPC da
     * creare via NPC generator quando il DM accetta.
     */
    existingEntityId: z.uuid().nullable(),
    name: z.string().min(1),
    /**
     * Ruolo narrativo nell'economia della sessione, libero (es.
     * "informatore riluttante", "guardia da corrompere").
     */
    narrativeRole: z.string().min(1),
    /** Tipo entity proposto se nuovo (default `npc`). */
    proposedType: z
      .enum(entityType.enumValues)
      .default("npc"),
    /** Tono/personalita' rapida — usata come hint per il generator NPC. */
    tone: z.string().min(1),
    /** Perche' qui, ora. */
    rationale: z.string().min(1),
  })
  .strict();

const encounterSeedSchema = z
  .object({
    title: z.string().min(1),
    concept: z.string().min(1),
    /** Difficolta' suggerita per il party indicato in input. */
    difficultyHint: z.enum(["easy", "medium", "hard", "deadly"]),
    /** Idee monster libere (l'agent NON ha tool monster browser). */
    creatureHints: z.array(z.string()).min(1).max(6),
    rationale: z.string().min(1),
  })
  .strict();

const suggestedClueSchema = z
  .object({
    /** Plot thread a cui appartiene la briciola. Null = orfana. */
    relatedPlotThreadId: z.uuid().nullable(),
    plotThreadTitle: z.string().nullable(),
    description: z.string().min(1),
    /** A che verita' GM punta. Solo per il DM. */
    truthRevealed: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export const sessionPrepOutputSchema = z
  .object({
    /** Riassunto in stile cinematografico per i giocatori. */
    previouslyOn: z.string().min(1),
    hooks: z.array(hookProposalSchema).min(0).max(5),
    npcSeeds: z.array(npcSeedSchema).min(0).max(8),
    encounterSeeds: z.array(encounterSeedSchema).min(0).max(4),
    suggestedClues: z.array(suggestedClueSchema).min(0).max(6),
    /**
     * Nota dell'agent al DM: cose che ha notato e che dovrebbero
     * guidare la sessione (es. "Bellamy non ha avuto spotlight dalla
     * S3"). Libero, max 5 punti.
     */
    notes: z.array(z.string().min(1)).max(5).default([]),
  })
  .strict();

export type SessionPrepOutput = z.infer<typeof sessionPrepOutputSchema>;

// Sub-schemi esportati per riusarli nei test.
export const sessionPrepProposalSchemas = {
  hook: hookProposalSchema,
  npcSeed: npcSeedSchema,
  encounterSeed: encounterSeedSchema,
  clue: suggestedClueSchema,
};

// Tipo plot status usato nei tool. Lo riesportiamo qui per evitare che
// i test importino lo schema Drizzle direttamente.
export const plotStatusEnum = z.enum(plotThreadStatus.enumValues);
export type PlotStatus = z.infer<typeof plotStatusEnum>;
