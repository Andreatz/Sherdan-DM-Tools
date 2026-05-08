import { z } from "zod";

import { npcPropertiesSchema } from "@/lib/validation/npc";

import {
  npcGeneratorToneOptions,
  npcNarrativeDepthOptions,
  type NpcNarrativeDepth,
} from "./npc-input";

const requiredText = z.string().trim().min(1);
const generatedStringArray = z.array(requiredText).default([]);
const secretLayerSchema = z.enum(["surface", "intermediate", "deep"]);

export const npcGeneratorMetadataSchema = z
  .object({
    npc_type: requiredText,
    tone: z.enum(npcGeneratorToneOptions),
    narrative_depth: z.enum(npcNarrativeDepthOptions),
    location_id: z.uuid(),
    nearby_faction_ids: z.array(z.uuid()).default([]),
    nearby_npc_ids: z.array(z.uuid()).default([]),
    plot_hooks: generatedStringArray,
    differentiation_note: requiredText,
  })
  .catchall(z.unknown());

export const npcGeneratorPropertiesSchema = npcPropertiesSchema.extend({
  race: requiredText,
  class: requiredText.optional(),
  age: requiredText.optional(),
  alignment: requiredText.optional(),
  occupation: requiredText.optional(),
  appearance_summary: requiredText,
  sensory_details: z
    .object({
      sight: requiredText,
      smell: requiredText,
      sound: requiredText,
      touch: requiredText.optional(),
    })
    .strict(),
  voice: z
    .object({
      tone: requiredText,
      accent: requiredText.optional(),
      speech_patterns: z.array(requiredText).min(1),
    })
    .strict(),
  tics: z.array(requiredText).min(1),
  mannerisms: z.array(requiredText).min(1),
  motivations: z.array(requiredText).min(1),
  goals: z
    .object({
      short_term: requiredText,
      medium_term: requiredText,
      long_term: requiredText,
    })
    .strict(),
  weaknesses: z
    .array(
      z
        .object({
          description: requiredText,
          who_could_exploit: requiredText,
        })
        .strict(),
    )
    .min(1),
  extra: npcGeneratorMetadataSchema,
});

export const npcGeneratorSecretSchema = z
  .object({
    layer: secretLayerSchema,
    content: requiredText,
    exploit_hint: requiredText.optional(),
  })
  .strict();

export const npcGeneratorOutputSchema = z
  .object({
    name: requiredText.max(200),
    public_description: requiredText,
    description: requiredText,
    tags: z.array(requiredText).default([]),
    properties: npcGeneratorPropertiesSchema,
    secrets: z.array(npcGeneratorSecretSchema).default([]),
  })
  .strict();

export type NpcGeneratorOutput = z.infer<typeof npcGeneratorOutputSchema>;
export type NpcGeneratorSecret = z.infer<typeof npcGeneratorSecretSchema>;
export type NpcGeneratorProperties = z.infer<
  typeof npcGeneratorPropertiesSchema
>;

export function npcGeneratorOutputSchemaForDepth(depth: NpcNarrativeDepth) {
  return npcGeneratorOutputSchema.superRefine((output, ctx) => {
    if (depth === "principale") {
      const layers = new Set(output.secrets.map((secret) => secret.layer));
      for (const layer of secretLayerSchema.options) {
        if (!layers.has(layer)) {
          ctx.addIssue({
            code: "custom",
            path: ["secrets"],
            message: `NPC principale richiede almeno un segreto ${layer}`,
          });
        }
      }
    }

    if (
      depth === "comparsa" &&
      output.secrets.some((secret) => secret.layer === "deep")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["secrets"],
        message: "Una comparsa non deve introdurre segreti deep",
      });
    }

    if (output.properties.extra.narrative_depth !== depth) {
      ctx.addIssue({
        code: "custom",
        path: ["properties", "extra", "narrative_depth"],
        message: `narrative_depth deve essere coerente con l'input (${depth})`,
      });
    }
  });
}
