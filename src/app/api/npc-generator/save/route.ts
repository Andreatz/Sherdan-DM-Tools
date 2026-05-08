import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { entities, entitySecrets } from "@/db/schema";
import { AppError, ValidationFailedError } from "@/lib/api/errors";
import { created, fail } from "@/lib/api/respond";
import {
  npcOutputToEntityInsert,
  npcOutputToSecretInserts,
  parseNpcGeneratorSaveRequest,
} from "@/lib/generators/npc-save";
import { validateEntityProperties } from "@/lib/validation";

const entityColumns = {
  id: entities.id,
  campaignId: entities.campaignId,
  type: entities.type,
  name: entities.name,
  description: entities.description,
  publicDescription: entities.publicDescription,
  properties: entities.properties,
  tags: entities.tags,
  parentId: entities.parentId,
  visibility: entities.visibility,
  createdAt: entities.createdAt,
  updatedAt: entities.updatedAt,
} as const;

const secretColumns = {
  id: entitySecrets.id,
  campaignId: entitySecrets.campaignId,
  entityId: entitySecrets.entityId,
  layer: entitySecrets.layer,
  content: entitySecrets.content,
  exploitHint: entitySecrets.exploitHint,
  discoveredAtSession: entitySecrets.discoveredAtSession,
  discoveryNotes: entitySecrets.discoveryNotes,
  createdAt: entitySecrets.createdAt,
} as const;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const { input, output } = parseNpcGeneratorSaveRequest(body);

    try {
      validateEntityProperties("npc", output.properties);
    } catch (zerr) {
      throw new ValidationFailedError(
        zerr,
        "'properties' generate non valide per type='npc'",
      );
    }

    const saved = await db.transaction(async (tx) => {
      const [entity] = await tx
        .insert(entities)
        .values(npcOutputToEntityInsert(input, output))
        .returning(entityColumns);

      if (!entity) {
        throw new AppError(
          "Salvataggio NPC non riuscito",
          500,
          "npc_save_failed",
        );
      }

      const secretValues = npcOutputToSecretInserts(input, output, entity.id);
      const secrets =
        secretValues.length > 0
          ? await tx
              .insert(entitySecrets)
              .values(secretValues)
              .returning(secretColumns)
          : [];

      return { entity, secrets };
    });

    return created(saved);
  } catch (err) {
    return fail(err);
  }
}
