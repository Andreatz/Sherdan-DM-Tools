import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { chatgptBridgeImports, sessions } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import {
  analyzeChatGptBridgeImport,
  chatGptBridgeSaveSessionInputSchema,
} from "@/lib/chatgpt-bridge";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = chatGptBridgeSaveSessionInputSchema.parse(body);
    const analyzed = analyzeChatGptBridgeImport({
      content: input.content,
      sessionNumber: input.sessionNumber,
    });
    const markdown = analyzed.markdownWithoutUpdatePack || input.content;
    let appendedToSession: { id: string; number: number } | null = null;
    const warnings = [...analyzed.warnings];

    const [saved] = await db.transaction(async (tx) => {
      const [importRow] = await tx
        .insert(chatgptBridgeImports)
        .values({
          campaignId: input.campaignId,
          taskType: input.taskType,
          sessionNumber: analyzed.detectedSessionNumber ?? input.sessionNumber ?? null,
          markdown,
          updatePack: input.updatePack ?? analyzed.updatePack ?? null,
          metadata: {
            detectedTitle: input.detectedTitle ?? analyzed.detectedTitle,
            warnings: analyzed.warnings,
          },
        })
        .returning();

      if (input.confirmAppendToPrepNotes && (analyzed.detectedSessionNumber ?? input.sessionNumber)) {
        const number = analyzed.detectedSessionNumber ?? input.sessionNumber!;
        let [session] = await tx
          .select({
            id: sessions.id,
            number: sessions.number,
            prepNotes: sessions.prepNotes,
          })
          .from(sessions)
          .where(and(eq(sessions.campaignId, input.campaignId), eq(sessions.number, number)))
          .limit(1);
        if (!session && input.createSessionIfMissing) {
          const [created] = await tx
            .insert(sessions)
            .values({
              campaignId: input.campaignId,
              number,
              title:
                input.detectedTitle ?? analyzed.detectedTitle ?? `Import ChatGPT ${number}`,
            })
            .returning({
              id: sessions.id,
              number: sessions.number,
              prepNotes: sessions.prepNotes,
            });
          session = created;
        }
        if (session) {
          const existing = session.prepNotes?.trim();
          const next = existing
            ? `${existing}\n\n---\n\n## Import ChatGPT Web Bridge\n\n${markdown}`
            : `## Import ChatGPT Web Bridge\n\n${markdown}`;
          await tx.update(sessions).set({ prepNotes: next }).where(eq(sessions.id, session.id));
          appendedToSession = { id: session.id, number: session.number };
        } else {
          warnings.push(
            `Sessione ${number} non trovata: import salvato solo nel registro Bridge.`,
          );
        }
      }

      return [importRow];
    });

    return ok({ ok: true, import: saved, appendedToSession, warnings });
  } catch (err) {
    return fail(err);
  }
}
