import { z } from "zod";

import { playerVisibilityMode, playerVisibilityTarget } from "@/db/schema";

const targetTypeEnum = z.enum(playerVisibilityTarget.enumValues);
const modeEnum = z.enum(playerVisibilityMode.enumValues);

export const createPlayerOverrideInputSchema = z
  .object({
    playerId: z.uuid(),
    targetType: targetTypeEnum,
    targetId: z.uuid(),
    mode: modeEnum,
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export type CreatePlayerOverrideInput = z.infer<
  typeof createPlayerOverrideInputSchema
>;

export const updatePlayerOverrideInputSchema = z
  .object({
    // playerId / targetType / targetId non sono modificabili: cancellare e
    // ricreare e' piu' chiaro semanticamente che "spostare un override".
    mode: modeEnum.optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export type UpdatePlayerOverrideInput = z.infer<
  typeof updatePlayerOverrideInputSchema
>;

export const listPlayerOverridesQuerySchema = z
  .object({
    player_id: z.uuid().optional(),
    target_type: targetTypeEnum.optional(),
    target_id: z.uuid().optional(),
    campaign_id: z.uuid().optional(),
  })
  .strict();

export type ListPlayerOverridesQuery = z.infer<
  typeof listPlayerOverridesQuerySchema
>;
