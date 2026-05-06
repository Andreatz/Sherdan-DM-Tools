import { z } from "zod";

import { extraField, stringArray } from "./_shared";

// Sherdan: pantheon di sette divinita' originali, di cui la setta della
// "verita' dei Sei" cerca di cancellare la settima — pattern propaganda vs
// verita' applicato anche alla teologia. La gestione propaganda/verita' resta
// sull'entity (description vs public_description), qui si modellano i fatti
// di settore (domini, simbolo, culto, ecc.).
export const deityPropertiesSchema = z
  .object({
    alignment: z.string().optional(),
    domains: stringArray, // life, death, war, knowledge, ...
    symbol: z.string().optional(),
    holy_days: stringArray,
    portfolio: z.string().optional(), // markdown: di cosa e' la divinita'

    pantheon: z.string().optional(), // "Sette di Sherdan", "Pantheon dei Sei"
    avatar_form: z.string().optional(), // se appare fisicamente

    // Se la divinita' ha forme/identita' multiple (pattern Sherdan #1)
    // si modellano via entity_identities, non qui.

    followers_summary: z.string().optional(), // markdown su chi la venera

    // Stato cosmico: e' viva, dormiente, scomparsa, prigioniera?
    status: z.string().optional(),

    extra: extraField,
  })
  .strict();

export type DeityProperties = z.infer<typeof deityPropertiesSchema>;
