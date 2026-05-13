import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import {
  dungeonContentInputSchema,
  generateDungeonContent,
} from "@/lib/dungeons";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = dungeonContentInputSchema.parse(body);
    const result = await generateDungeonContent(input);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
