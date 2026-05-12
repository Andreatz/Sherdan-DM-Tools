import { z } from "zod";

// Validazione input lato DM per il CRUD di `players`. Il `code` plain
// viene accettato solo in create/update e non viene mai persistito in
// chiaro: il route lo passa a `hashPlayerCode` prima dell'insert.

const nameSchema = z.string().trim().min(1).max(80);
const codeSchema = z.string().trim().min(4).max(200);

export const createPlayerInputSchema = z
  .object({
    campaignId: z.uuid(),
    name: nameSchema,
    code: codeSchema,
    active: z.boolean().optional(),
  })
  .strict();

export type CreatePlayerInput = z.infer<typeof createPlayerInputSchema>;

export const updatePlayerInputSchema = z
  .object({
    // `campaignId` non e' modificabile: cambiarla significa creare un
    // nuovo player nell'altra campagna.
    name: nameSchema.optional(),
    code: codeSchema.optional(),
    active: z.boolean().optional(),
  })
  .strict();

export type UpdatePlayerInput = z.infer<typeof updatePlayerInputSchema>;

export const listPlayersQuerySchema = z
  .object({
    campaign_id: z.uuid(),
    active: z
      .preprocess((value) => {
        if (value === "true") return true;
        if (value === "false") return false;
        return value;
      }, z.boolean())
      .optional(),
  })
  .strict();

export type ListPlayersQuery = z.infer<typeof listPlayersQuerySchema>;
