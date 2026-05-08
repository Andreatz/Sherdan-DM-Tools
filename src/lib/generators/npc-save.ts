import { z } from "zod";

import type { entities, entitySecrets } from "@/db/schema";
import { buildEntityEmbeddingText } from "@/lib/import/entity-embedding-text";

import { npcGeneratorInputSchema, type NpcGeneratorInput } from "./npc-input";
import {
  npcGeneratorOutputSchema,
  npcGeneratorOutputSchemaForDepth,
  type NpcGeneratorOutput,
} from "./npc-output";

export const npcGeneratorSaveRequestSchema = z
  .object({
    input: npcGeneratorInputSchema,
    output: npcGeneratorOutputSchema,
  })
  .strict();

export type NpcGeneratorSaveRequest = z.infer<
  typeof npcGeneratorSaveRequestSchema
>;

export type NpcGeneratedEntityInsert = typeof entities.$inferInsert;
export type NpcGeneratedSecretInsert = typeof entitySecrets.$inferInsert;

interface NpcOutputToEntityInsertOptions {
  embedding?: number[];
}

export function parseNpcGeneratorSaveRequest(
  value: unknown,
): NpcGeneratorSaveRequest {
  const request = npcGeneratorSaveRequestSchema.parse(value);
  return {
    ...request,
    output: npcGeneratorOutputSchemaForDepth(
      request.input.narrativeDepth,
    ).parse(request.output),
  };
}

export function npcOutputToEntityInsert(
  input: NpcGeneratorInput,
  output: NpcGeneratorOutput,
  options: NpcOutputToEntityInsertOptions = {},
): NpcGeneratedEntityInsert {
  const insert: NpcGeneratedEntityInsert = {
    campaignId: input.campaignId,
    type: "npc",
    name: output.name,
    description: output.description,
    publicDescription: output.public_description,
    properties: output.properties,
    tags: normalizeNpcTags(output.tags),
    parentId: input.locationId,
    visibility: "dm_only",
  };

  if (options.embedding) {
    insert.embedding = options.embedding;
  }

  return insert;
}

export function npcOutputToSecretInserts(
  input: NpcGeneratorInput,
  output: NpcGeneratorOutput,
  entityId: string,
): NpcGeneratedSecretInsert[] {
  return output.secrets.map((secret) => ({
    campaignId: input.campaignId,
    entityId,
    plotThreadId: null,
    layer: secret.layer,
    content: secret.content,
    exploitHint: secret.exploit_hint ?? null,
    discoveredAtSession: null,
    discoveryNotes: null,
  }));
}

export function buildNpcSaveEmbeddingText(
  input: NpcGeneratorInput,
  output: NpcGeneratorOutput,
): string {
  const entity = npcOutputToEntityInsert(input, output);
  return buildEntityEmbeddingText({
    type: entity.type,
    name: entity.name,
    description: entity.description ?? null,
    publicDescription: entity.publicDescription ?? null,
    properties: entity.properties,
    tags: entity.tags ?? [],
    visibility: entity.visibility ?? "dm_only",
    extraSections: [
      {
        title: "Segreti stratificati",
        content: output.secrets
          .map((secret) => {
            const exploit = secret.exploit_hint
              ? ` | Sfruttabile: ${secret.exploit_hint}`
              : "";
            return `- ${secret.layer}: ${secret.content}${exploit}`;
          })
          .join("\n"),
      },
    ],
  });
}

function normalizeNpcTags(tags: string[]): string[] {
  const values = ["npc", "generated", ...tags].map((tag) =>
    tag.trim().toLowerCase(),
  );
  return [...new Set(values)].filter((tag) => tag.length > 0);
}
