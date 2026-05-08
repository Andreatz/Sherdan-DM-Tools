import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import {
  NpcGeneratorContextRetriever,
  buildNpcGeneratorPrompt,
  callStructuredOutput,
  npcGeneratorOutputSchemaForDepth,
  npcGeneratorPreviewRequestSchema,
  summarizeNpcGeneratorContext,
} from "@/lib/generators";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = npcGeneratorPreviewRequestSchema.parse(body);
    const context = await new NpcGeneratorContextRetriever().retrieve(input);
    const prompt = buildNpcGeneratorPrompt(context);
    const output = await callStructuredOutput(
      prompt,
      npcGeneratorOutputSchemaForDepth(input.narrativeDepth),
    );

    return ok({
      input,
      output,
      context: summarizeNpcGeneratorContext(context),
    });
  } catch (err) {
    return fail(err);
  }
}
