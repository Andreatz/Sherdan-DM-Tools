import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import { ensureLlmEnabledForRoute } from "@/lib/llm/guards";
import {
  runSessionPrepAgent,
  sessionPrepInputSchema,
} from "@/lib/session-prep";

// Esegue l'agent loop e ritorna l'output completo + trace dei tool chiamati.
// La generate NON persiste niente: il save passa per `/api/session-prep/save`
// quando il DM accetta il risultato.

export async function POST(req: NextRequest) {
  try {
    ensureLlmEnabledForRoute();
    const body = (await req.json()) as unknown;
    const input = sessionPrepInputSchema.parse(body);
    const result = await runSessionPrepAgent(input);
    return ok({
      input,
      output: result.output,
      trace: result.trace,
      iterations: result.iterations,
    });
  } catch (err) {
    return fail(err);
  }
}
