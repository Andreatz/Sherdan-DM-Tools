import { z } from "zod";

import type { NpcGeneratorContext } from "./npc-context";
import { npcGeneratorInputSchema } from "./npc-input";
import {
  npcGeneratorOutputSchema,
  npcGeneratorSecretSchema,
  type NpcGeneratorOutput,
} from "./npc-output";

export const npcRerollFieldOptions = [
  "name",
  "voice",
  "surface_secret",
  "intermediate_secret",
  "deep_secret",
] as const;

export type NpcRerollField = (typeof npcRerollFieldOptions)[number];

export const npcGeneratorPreviewRequestSchema = npcGeneratorInputSchema;

export const npcGeneratorRerollRequestSchema = z
  .object({
    input: npcGeneratorInputSchema,
    output: npcGeneratorOutputSchema,
    field: z.enum(npcRerollFieldOptions),
  })
  .strict();

export const npcNameRerollPatchSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const npcVoiceRerollPatchSchema = z.object({
  voice: z
    .object({
      tone: z.string().trim().min(1),
      accent: z.string().trim().min(1).optional(),
      speech_patterns: z.array(z.string().trim().min(1)).min(1),
    })
    .strict(),
});

export const npcSecretRerollPatchSchema = z.object({
  secret: npcGeneratorSecretSchema,
});

export type NpcGeneratorPreviewRequest = z.infer<
  typeof npcGeneratorPreviewRequestSchema
>;
export type NpcGeneratorRerollRequest = z.infer<
  typeof npcGeneratorRerollRequestSchema
>;

export interface NpcGeneratorPreviewContextSummary {
  location: {
    id: string;
    name: string;
  };
  styleReference: {
    id: string;
    name: string;
  } | null;
  nearbyFactions: Array<{
    id: string;
    name: string;
  }>;
  nearbyNpcs: Array<{
    id: string;
    name: string;
  }>;
  styleEntitiesAnalyzed: number;
  similaritySkipped: boolean;
}

export interface NpcGeneratorPreviewResponse {
  input: NpcGeneratorPreviewRequest;
  output: NpcGeneratorOutput;
  context: NpcGeneratorPreviewContextSummary;
}

export function summarizeNpcGeneratorContext(
  context: NpcGeneratorContext,
): NpcGeneratorPreviewContextSummary {
  return {
    location: {
      id: context.location.id,
      name: context.location.name,
    },
    styleReference: context.styleReference
      ? {
          id: context.styleReference.id,
          name: context.styleReference.name,
        }
      : null,
    nearbyFactions: context.nearbyFactions.map((entity) => ({
      id: entity.id,
      name: entity.name,
    })),
    nearbyNpcs: context.nearbyNpcs.map((entity) => ({
      id: entity.id,
      name: entity.name,
    })),
    styleEntitiesAnalyzed: context.metadata.styleEntitiesAnalyzed,
    similaritySkipped: context.metadata.similaritySkipped,
  };
}

export function applyNpcRerollPatch(
  output: NpcGeneratorOutput,
  field: NpcRerollField,
  patch: unknown,
): NpcGeneratorOutput {
  switch (field) {
    case "name": {
      const parsed = npcNameRerollPatchSchema.parse(patch);
      return { ...output, name: parsed.name };
    }
    case "voice": {
      const parsed = npcVoiceRerollPatchSchema.parse(patch);
      return {
        ...output,
        properties: {
          ...output.properties,
          voice: parsed.voice,
        },
      };
    }
    case "surface_secret":
      return replaceSecret(output, "surface", patch);
    case "intermediate_secret":
      return replaceSecret(output, "intermediate", patch);
    case "deep_secret":
      return replaceSecret(output, "deep", patch);
  }
}

function replaceSecret(
  output: NpcGeneratorOutput,
  layer: "surface" | "intermediate" | "deep",
  patch: unknown,
): NpcGeneratorOutput {
  const parsed = npcSecretRerollPatchSchema.parse(patch);
  const secret = { ...parsed.secret, layer };
  const existingIndex = output.secrets.findIndex((item) => item.layer === layer);
  const secrets =
    existingIndex >= 0
      ? output.secrets.map((item, index) =>
          index === existingIndex ? secret : item,
        )
      : [...output.secrets, secret];

  return { ...output, secrets };
}
