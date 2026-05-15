import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { chatgptBridgeExports } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import { withApiTelemetry } from "@/lib/api/request-telemetry";
import {
  buildChatGptBridgeExport,
  chatGptBridgeExportInputSchema,
  type ChatGptBridgeExportInput,
} from "@/lib/chatgpt-bridge";

export async function POST(req: NextRequest) {
  return withApiTelemetry(req, "/api/chatgpt-bridge/export", async ({ requestId }) => {
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
        exportBytes: Buffer.byteLength(result.markdown, "utf8"),
        warningsCount: result.warnings.length,
        warnings: result.warnings,
        includedSections: includedSectionsForExport(input),
        requestUpdatePack: input.requestUpdatePack,
        requestId,
      },
    });

    return ok(result);
  } catch (err) {
    return fail(err);
  }
  });
}

function includedSectionsForExport(input: ChatGptBridgeExportInput) {
  return {
    campaignSnapshot: input.includeCampaignSnapshot,
    recentSessions: input.includeRecentSessions,
    plotThreads: input.includePlotThreads,
    truthClues: input.includeTruthClues,
    secrets: input.includeSecrets,
    pcHooks: input.includePcHooks,
    factions: input.includeFactions,
    playerFacingState: input.includePlayerFacingState,
  };
}
