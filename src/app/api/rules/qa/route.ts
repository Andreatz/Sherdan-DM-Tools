import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import { answerRulesQuestion, rulesQaInputSchema } from "@/lib/rules";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = rulesQaInputSchema.parse(body);
    const result = await answerRulesQuestion(input);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
