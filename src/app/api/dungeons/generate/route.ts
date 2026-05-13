import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import { generateBspDungeon, dungeonGenerationParamsSchema } from "@/lib/dungeons";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const params = dungeonGenerationParamsSchema.parse(body ?? {});
    const dungeon = generateBspDungeon(params);
    return ok({ dungeon });
  } catch (err) {
    return fail(err);
  }
}
