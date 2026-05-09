import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { entities, entitySecrets } from "@/db/schema";
import { AppError, ValidationFailedError } from "@/lib/api/errors";
import { created, fail } from "@/lib/api/respond";
import {
  buildNpcSaveEmbeddingText,
  npcOutputToEntityInsert,
  npcOutputToSecretInserts,
  parseNpcGeneratorSaveRequest,
} from "@/lib/generators/npc-save";
import { assertEmbeddingDimensions } from "@/lib/import/entity-embedding-text";
import { getLogger } from "@/lib/logger";
import { getLLMProvider } from "@/lib/llm";
import { validateEntityProperties } from "@/lib/validation";

const log = getLogger("api.npc-generator.save");

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

interface EmbeddingResult {
  vector: number[] | null;
  status: "generated" | "unavailable";
  dimensions: number | null;
  error?: string;
}

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

    // Fail-forward: l'embedding migliora search/RAG, ma non deve mai far
    // perdere un NPC gia' generato. Se Ollama o il modello embedding non sono
    // disponibili, salviamo comunque l'entity e segnaliamo lo stato al client.
    const embedding = await tryGenerateNpcEmbedding(
      buildNpcSaveEmbeddingText(input, output),
    );

    const saved = await db.transaction(async (tx) => {
      const [entity] = await tx
        .insert(entities)
        .values(
          npcOutputToEntityInsert(
            input,
            output,
            embedding.vector ? { embedding: embedding.vector } : {},
          ),
        )
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

      return {
        entity,
        secrets,
        embedding: {
          status: embedding.status,
          generated: embedding.status === "generated",
          dimensions: embedding.dimensions,
          ...(embedding.error ? { error: embedding.error } : {}),
        },
      };
    });

    return created(saved);
  } catch (err) {
    return fail(err);
  }
}

async function tryGenerateNpcEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    const vector = await getLLMProvider().embed(text);
    assertEmbeddingDimensions(vector);
    return { vector, status: "generated", dimensions: vector.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(
      { err: message },
      "NPC saved without embedding; run embedding backfill after Ollama setup",
    );
    return {
      vector: null,
      status: "unavailable",
      dimensions: null,
      error:
        "Embedding NPC non disponibile: NPC salvato comunque. Verifica Ollama/modello embedding e rigenera gli embedding mancanti.",
    };
  }
}
