import type { NextRequest } from "next/server";
import type { z } from "zod";

import { fail, ok } from "@/lib/api/respond";
import {
  NpcGeneratorContextRetriever,
  applyNpcRerollPatch,
  buildNpcRerollPrompt,
  callStructuredOutputLogged,
  npcGeneratorOutputSchemaForDepth,
  npcGeneratorRerollRequestSchema,
  npcRerollPatchSchemaForField,
  summarizeNpcGeneratorContext,
} from "@/lib/generators";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const request = npcGeneratorRerollRequestSchema.parse(body);
    const context = await new NpcGeneratorContextRetriever().retrieve(
      request.input,
    );
    const prompt = buildNpcRerollPrompt({
      context,
      output: request.output,
      field: request.field,
    });
    const patch = await callStructuredOutputLogged({
      prompt,
      schema: npcRerollPatchSchemaForField(request.field) as z.ZodType<unknown>,
      logContext: {
        generatorName: "npc-generator",
        campaignId: request.input.campaignId,
        input: request.input,
        metadata: { phase: "reroll", field: request.field },
      },
    });
    const output = npcGeneratorOutputSchemaForDepth(
      request.input.narrativeDepth,
    ).parse(applyNpcRerollPatch(request.output, request.field, patch));

    return ok({
      input: request.input,
      output,
      context: summarizeNpcGeneratorContext(context),
    });
  } catch (err) {
    return fail(err);
  }
}
