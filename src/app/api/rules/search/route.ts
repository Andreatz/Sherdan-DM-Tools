import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import { getLLMProvider } from "@/lib/llm";
import { rulesSearchInputSchema, searchRules } from "@/lib/rules";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = rulesSearchInputSchema.parse(body);
    const result = await searchRules(input, {
      embedQuery: async (text: string) => getLLMProvider().embed(text),
    });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
