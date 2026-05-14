import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import {
  analyzeChatGptBridgeImport,
  chatGptBridgeImportAnalyzeInputSchema,
} from "@/lib/chatgpt-bridge";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = chatGptBridgeImportAnalyzeInputSchema.parse(body);
    return ok(
      analyzeChatGptBridgeImport({
        content: input.content,
        sessionNumber: input.sessionNumber,
      }),
    );
  } catch (err) {
    return fail(err);
  }
}

