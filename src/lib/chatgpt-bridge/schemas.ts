import { z } from "zod";

export const chatGptBridgeTaskTypeSchema = z.enum([
  "session_md",
  "session_brief",
  "session_audit",
  "session_patch",
  "dialogue",
  "txc",
  "player_recap",
  "gm_recap",
  "lore",
  "npc",
  "faction",
  "city",
  "dungeon",
]);

export const chatGptBridgeDensitySchema = z.enum([
  "Light",
  "Standard",
  "Full",
  "Table-Ready",
  "Design-Only",
]);

export const chatGptBridgeAudienceSchema = z.enum(["gm", "player"]);

export const chatGptBridgeExportInputSchema = z
  .object({
    campaignId: z.uuid(),
    taskType: chatGptBridgeTaskTypeSchema,
    density: chatGptBridgeDensitySchema.default("Standard"),
    audience: chatGptBridgeAudienceSchema.default("gm"),
    sessionNumber: z.number().int().positive().optional(),
    focus: z.string().trim().optional(),
    locationId: z.uuid().optional(),
    expectedDurationHours: z.number().positive().optional(),
    constraints: z.string().trim().optional(),
    includeSystemPrompt: z.boolean().default(true),
    includeCampaignSnapshot: z.boolean().default(true),
    includeRecentSessions: z.boolean().default(true),
    recentSessionsLimit: z.number().int().min(1).max(10).default(5),
    includePlotThreads: z.boolean().default(true),
    includeTruthClues: z.boolean().default(true),
    includeSecrets: z.boolean().default(true),
    includePcHooks: z.boolean().default(true),
    includeFactions: z.boolean().default(true),
    includePlayerFacingState: z.boolean().default(false),
    requestUpdatePack: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.audience === "player" && value.includeSecrets) {
      ctx.addIssue({
        code: "custom",
        path: ["includeSecrets"],
        message: "includeSecrets deve essere false quando audience=player",
      });
    }
  });

export type ChatGptBridgeExportInput = z.infer<
  typeof chatGptBridgeExportInputSchema
>;

export const chatGptBridgeImportAnalyzeInputSchema = z
  .object({
    campaignId: z.uuid(),
    taskType: z.string().trim().min(1),
    sessionNumber: z.number().int().positive().optional(),
    content: z.string().min(1),
  })
  .strict();

export type ChatGptBridgeImportAnalyzeInput = z.infer<
  typeof chatGptBridgeImportAnalyzeInputSchema
>;

export const chatGptBridgeSaveSessionInputSchema =
  chatGptBridgeImportAnalyzeInputSchema.extend({
    detectedTitle: z.string().trim().optional(),
    updatePack: z.unknown().optional(),
    confirmAppendToPrepNotes: z.boolean().default(false),
    confirmAppendToDmNotes: z.boolean().default(false),
    createSessionIfMissing: z.boolean().default(false),
  });

export type ChatGptBridgeSaveSessionInput = z.infer<
  typeof chatGptBridgeSaveSessionInputSchema
>;

export const chatGptBridgeReviewUpdatePackInputSchema = z
  .object({
    campaignId: z.uuid(),
    sessionNumber: z.number().int().positive().optional(),
    updatePack: z.unknown(),
  })
  .strict();

export type ChatGptBridgeReviewUpdatePackInput = z.infer<
  typeof chatGptBridgeReviewUpdatePackInputSchema
>;

const reviewMatchInfoSchema = z
  .object({
    status: z.enum(["exact", "fuzzy", "ambiguous", "none"]),
    subject: z.string(),
    requested: z.string(),
    matched: z.string().optional(),
    matchedBy: z.string().optional(),
    score: z.number().optional(),
    candidates: z.array(z.string()).optional(),
  })
  .optional();

export const reviewChangeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("session_update"),
    label: z.string(),
    before: z.unknown(),
    after: z.unknown(),
    applyPayload: z.unknown(),
    match: reviewMatchInfoSchema,
  }),
  z.object({
    kind: z.literal("plot_thread_event_create"),
    label: z.string(),
    applyPayload: z.unknown(),
    match: reviewMatchInfoSchema,
  }),
  z.object({
    kind: z.literal("truth_clue_create"),
    label: z.string(),
    applyPayload: z.unknown(),
    match: reviewMatchInfoSchema,
  }),
  z.object({
    kind: z.literal("entity_update"),
    label: z.string(),
    before: z.unknown(),
    after: z.unknown(),
    applyPayload: z.unknown(),
    match: reviewMatchInfoSchema,
  }),
  z.object({
    kind: z.literal("pc_hook_create"),
    label: z.string(),
    applyPayload: z.unknown(),
    match: reviewMatchInfoSchema,
  }),
  z.object({
    kind: z.literal("entity_identity_create"),
    label: z.string(),
    applyPayload: z.unknown(),
    match: reviewMatchInfoSchema,
  }),
  z.object({
    kind: z.literal("entity_secret_create"),
    label: z.string(),
    applyPayload: z.unknown(),
    match: reviewMatchInfoSchema,
  }),
  z.object({
    kind: z.literal("entity_link_create"),
    label: z.string(),
    applyPayload: z.unknown(),
    match: reviewMatchInfoSchema,
  }),
]);

export const chatGptBridgeApplyInputSchema = z
  .object({
    campaignId: z.uuid(),
    importId: z.uuid().optional(),
    selectedChanges: z.array(reviewChangeSchema).min(1),
  })
  .strict();

export type ChatGptBridgeApplyInput = z.infer<
  typeof chatGptBridgeApplyInputSchema
>;

export const updatePackSchema = z
  .object({
    session: z
      .object({
        number: z.number().int().positive().optional(),
        title: z.string().optional(),
        recapCandidate: z.string().optional(),
        dmNotesCandidate: z.string().optional(),
      })
      .optional(),
    plotThreadUpdates: z
      .array(
        z.object({
          title: z.string().min(1),
          suggestedStatus: z.string().optional(),
          event: z.string().min(1).optional(),
        }),
      )
      .default([]),
    truthClueUpdates: z
      .array(
        z.object({
          description: z.string().min(1),
          status: z.string().optional(),
          truthRevealed: z.string().optional(),
        }),
      )
      .default([]),
    npcUpdates: z
      .array(
        z.object({
          name: z.string().min(1),
          state: z.string().optional(),
          nextMove: z.string().optional(),
        }),
      )
      .default([]),
    newHooks: z
      .array(
        z.object({
          pc: z.string().min(1),
          target: z.string().optional(),
          hookDescription: z.string().min(1),
        }),
      )
      .default([]),
    newIdentities: z
      .array(
        z.object({
          entity: z.string().min(1),
          name: z.string().min(1),
          isTrueIdentity: z.boolean().optional(),
          appearance: z.string().optional(),
          voice: z.string().optional(),
          mannerisms: z.array(z.string()).optional(),
          visibility: z.string().optional(),
          notes: z.string().optional(),
        }),
      )
      .default([]),
    newSecrets: z
      .array(
        z.object({
          entity: z.string().min(1).optional(),
          plotThread: z.string().min(1).optional(),
          layer: z.string().optional(),
          content: z.string().min(1),
          exploitHint: z.string().optional(),
        }),
      )
      .default([]),
    newLinks: z
      .array(
        z.object({
          source: z.string().min(1),
          target: z.string().min(1),
          relationType: z.string().min(1),
          publicRelationType: z.string().optional(),
          strength: z.number().int().min(-10).max(10).optional(),
          description: z.string().optional(),
          visibility: z.string().optional(),
        }),
      )
      .default([]),
  })
  .passthrough();

export type ChatGptBridgeUpdatePack = z.infer<typeof updatePackSchema>;
