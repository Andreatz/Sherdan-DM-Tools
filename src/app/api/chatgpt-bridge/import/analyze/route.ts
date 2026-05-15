import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import { buildCanonDiff } from "@/lib/chatgpt-bridge/canon-diff";
import {
  analyzeChatGptBridgeImport,
  chatGptBridgeImportAnalyzeInputSchema,
} from "@/lib/chatgpt-bridge";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = chatGptBridgeImportAnalyzeInputSchema.parse(body);
    const analyzed = analyzeChatGptBridgeImport({
      content: input.content,
      sessionNumber: input.sessionNumber,
    });
    const sessionNumber = analyzed.detectedSessionNumber ?? input.sessionNumber;
    if (!sessionNumber) return ok(analyzed);

    const [session] = await db
      .select({
        number: sessions.number,
        title: sessions.title,
        recap: sessions.recap,
        dmNotes: sessions.dmNotes,
        prepNotes: sessions.prepNotes,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.campaignId, input.campaignId),
          eq(sessions.number, sessionNumber),
        ),
      )
      .limit(1);

    if (!session) return ok(analyzed);
    return ok({
      ...analyzed,
      canonDiff: buildCanonDiff({
        importedMarkdown: analyzed.markdownWithoutUpdatePack,
        comparedTo: `Sessione ${session.number}${session.title ? ` - ${session.title}` : ""}`,
        canonSections: [
          { label: "Recap", markdown: session.recap },
          { label: "DM notes", markdown: session.dmNotes },
          { label: "Prep notes", markdown: session.prepNotes },
        ],
      }),
    });
  } catch (err) {
    return fail(err);
  }
}
