import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import { withApiTelemetry } from "@/lib/api/request-telemetry";
import { writeAuditLog } from "@/lib/audit-log";
import {
  applyReviewChanges,
  chatGptBridgeApplyInputSchema,
} from "@/lib/chatgpt-bridge";

export async function POST(req: NextRequest) {
  return withApiTelemetry(req, "/api/chatgpt-bridge/import/apply", async ({ requestId }) => {
  try {
    const body = (await req.json()) as unknown;
    const input = chatGptBridgeApplyInputSchema.parse(body);
    const result = await applyReviewChanges(input);
    await writeAuditLog({
      action: "chatgpt_bridge.apply_update_pack",
      actorType: "dm",
      campaignId: input.campaignId,
      targetType: "chatgpt_bridge_import",
      targetId: input.importId ?? null,
      outcome: "succeeded",
      requestId,
      metadata: {
        selectedCount: input.selectedChanges.length,
        appliedCount: result.applied.length,
        kinds: Array.from(new Set(result.applied.map((change) => change.kind))),
      },
    });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
  });
}
