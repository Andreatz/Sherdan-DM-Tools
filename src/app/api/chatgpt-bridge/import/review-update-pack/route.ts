import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import {
  chatGptBridgeReviewUpdatePackInputSchema,
  reviewUpdatePack,
} from "@/lib/chatgpt-bridge";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = chatGptBridgeReviewUpdatePackInputSchema.parse(body);
    return ok(await reviewUpdatePack(input));
  } catch (err) {
    return fail(err);
  }
}

