import type { NextRequest } from "next/server";

import { AppError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/respond";
import { runGenerator } from "@/lib/generators";
import {
  LootGenerator,
  LootItemResolver,
  LootItemResolverError,
  summarizeResolvedLootBundle,
} from "@/lib/loot";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const result = await runGenerator(new LootGenerator(), body, {
      persist: false,
    });
    const resolved = await resolveLootItemsForPreview(result.output);

    return ok({
      input: result.input,
      output: result.output,
      resolution: summarizeResolvedLootBundle(resolved),
    });
  } catch (err) {
    return fail(err);
  }
}

async function resolveLootItemsForPreview(
  output: Awaited<ReturnType<LootGenerator["validateOutput"]>>,
) {
  try {
    return await new LootItemResolver().resolve(output);
  } catch (err) {
    if (err instanceof LootItemResolverError) {
      throw new AppError(
        "Risoluzione item loot non disponibile: verifica il provider embedding.",
        503,
        "loot_item_resolution_unavailable",
        err.message,
      );
    }
    throw err;
  }
}
