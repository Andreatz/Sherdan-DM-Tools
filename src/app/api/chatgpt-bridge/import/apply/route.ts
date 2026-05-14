import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import {
  applyReviewChanges,
  chatGptBridgeApplyInputSchema,
} from "@/lib/chatgpt-bridge";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = chatGptBridgeApplyInputSchema.parse(body);
    return ok(await applyReviewChanges(input));
  } catch (err) {
    return fail(err);
  }
}

