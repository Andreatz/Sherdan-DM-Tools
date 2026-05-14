import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { chatgptBridgeExports } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import {
  buildChatGptBridgeExport,
  chatGptBridgeExportInputSchema,
} from "@/lib/chatgpt-bridge";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = chatGptBridgeExportInputSchema.parse(body);
    const result = await buildChatGptBridgeExport(input);

    await db.insert(chatgptBridgeExports).values({
      campaignId: input.campaignId,
      taskType: input.taskType,
      density: input.density,
      filename: result.filename,
      markdown: result.markdown,
      metadata: {
        audience: input.audience,
        estimatedCharacters: result.estimatedCharacters,
        warnings: result.warnings,
        requestUpdatePack: input.requestUpdatePack,
      },
    });

    return ok(result);
  } catch (err) {
    return fail(err);
  }
}

