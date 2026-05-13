import { z } from "zod";

export const exposureModeSchema = z.enum([
  "name_only",
  "public_description",
  "discovered_description",
]);

export const visibilitySchema = z.enum(["dm_only", "discovered", "public"]);

export const dashboardHandoutSchema = z
  .object({
    id: z.string().min(1).max(80),
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().max(5000).default(""),
    imageUrl: z.string().trim().max(1000).nullable().default(null),
    kind: z.enum(["text", "image", "mixed"]).default("text"),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export const dashboardMapRevealSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().trim().max(80).default(""),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().min(1).max(100),
    height: z.number().min(1).max(100),
  })
  .strict();

export const dashboardMapFogSchema = z
  .object({
    reveals: z.array(dashboardMapRevealSchema).max(80).default([]),
  })
  .strict();

export const dashboardInitiativeSchema = z
  .object({
    active: z.boolean().default(false),
    round: z.number().int().min(1).max(999).optional(),
    turns: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(120),
            initiative: z.number().int().min(-10).max(60).optional(),
            hp: z.string().trim().max(40).optional(),
            note: z.string().trim().max(180).optional(),
          })
          .strict(),
      )
      .max(40)
      .default([]),
  })
  .strict();

export const updateDashboardStateSchema = z
  .object({
    campaignId: z.uuid(),
    sceneTitle: z.string().trim().max(160).nullable().optional(),
    sceneText: z.string().trim().max(12000).nullable().optional(),
    imageUrl: z.string().trim().max(1000).nullable().optional(),
    mapImageUrl: z.string().trim().max(1000).nullable().optional(),
    mapFogData: dashboardMapFogSchema.optional(),
    handouts: z.array(dashboardHandoutSchema).max(60).optional(),
    activeEntityIds: z.array(z.uuid()).max(80).optional(),
    initiative: dashboardInitiativeSchema.nullable().optional(),
  })
  .strict();

export const dashboardQuerySchema = z
  .object({
    campaign_id: z.uuid(),
  })
  .strict();

export const updateEntityExposureSchema = z
  .object({
    campaignId: z.uuid(),
    entityId: z.uuid(),
    visibility: visibilitySchema.optional(),
    exposureMode: exposureModeSchema.optional(),
  })
  .strict()
  .refine((value) => value.visibility !== undefined || value.exposureMode !== undefined, {
    message: "Almeno uno tra visibility ed exposureMode e' richiesto.",
  });

export type DashboardHandout = z.infer<typeof dashboardHandoutSchema>;
export type DashboardMapFog = z.infer<typeof dashboardMapFogSchema>;
export type DashboardInitiative = z.infer<typeof dashboardInitiativeSchema>;
export type ExposureMode = z.infer<typeof exposureModeSchema>;
