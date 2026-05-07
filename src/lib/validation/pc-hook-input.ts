import { z } from "zod";

// Pattern Sherdan #6: hook narrativi PG <-> NPC come dato esplicito.
// Diversi da entity_links: sono annotazioni DM su potenziali narrativi,
// non fatti in-fiction. Lifecycle: available -> in_progress -> resolved.
//
// `status` e' open vocab (text). Vincoliamo a livello Zod ai tre valori
// canonici per uniformare la UI; volendo aggiungerne futuri (es.
// "abandoned"), si estende l'enum qui senza migration.
const statusEnum = z.enum(["available", "in_progress", "resolved"]);

export const createPcHookInputSchema = z
  .object({
    campaignId: z.uuid(),
    pcEntityId: z.uuid(),
    targetEntityId: z.uuid(),
    hookDescription: z.string().min(1),
    potentialArc: z.string().nullable().optional(),
    usedInSession: z.uuid().nullable().optional(),
    status: statusEnum.default("available"),
  })
  .strict();

export type CreatePcHookInput = z.infer<typeof createPcHookInputSchema>;

// Update: campaignId / pcEntityId / targetEntityId NON modificabili
// (cambiare a quale PG o quale target appartiene un hook = cancella+ricrea).
export const updatePcHookInputSchema = z
  .object({
    hookDescription: z.string().min(1).optional(),
    potentialArc: z.string().nullable().optional(),
    usedInSession: z.uuid().nullable().optional(),
    status: statusEnum.optional(),
  })
  .strict();

export type UpdatePcHookInput = z.infer<typeof updatePcHookInputSchema>;

export const listPcHooksQuerySchema = z
  .object({
    campaign_id: z.uuid().optional(),
    pc_entity_id: z.uuid().optional(),
    target_entity_id: z.uuid().optional(),
    status: statusEnum.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListPcHooksQuery = z.infer<typeof listPcHooksQuerySchema>;
