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
    let appendedToDmNotesSession: { id: string; number: number } | null = null;
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

      if (
        (input.confirmAppendToPrepNotes || input.confirmAppendToDmNotes) &&
        (analyzed.detectedSessionNumber ?? input.sessionNumber)
      ) {
        const number = analyzed.detectedSessionNumber ?? input.sessionNumber!;
        let [session] = await tx
          .select({
            id: sessions.id,
            number: sessions.number,
            prepNotes: sessions.prepNotes,
            dmNotes: sessions.dmNotes,
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
              dmNotes: sessions.dmNotes,
            });
          session = created;
        }
        if (session) {
          const update: Partial<typeof sessions.$inferInsert> = {};
          if (input.confirmAppendToPrepNotes) {
            update.prepNotes = appendBridgeBlock(session.prepNotes, "Import ChatGPT Web Bridge", markdown);
            appendedToSession = { id: session.id, number: session.number };
          }
          if (input.confirmAppendToDmNotes) {
            update.dmNotes = appendBridgeBlock(session.dmNotes, "Debrief ChatGPT Web Bridge", markdown);
            appendedToDmNotesSession = { id: session.id, number: session.number };
          }
          await tx.update(sessions).set(update).where(eq(sessions.id, session.id));
        } else {
          warnings.push(
            `Sessione ${number} non trovata: import salvato solo nel registro Bridge.`,
          );
        }
      }

      return [importRow];
    });

    return ok({
      ok: true,
      import: saved,
      appendedToSession,
      appendedToDmNotesSession,
      warnings,
    });
  } catch (err) {
    return fail(err);
  }
}

function appendBridgeBlock(existing: string | null, title: string, markdown: string) {
  const trimmed = existing?.trim();
  const block = `## ${title}\n\n${markdown}`;
  return trimmed ? `${trimmed}\n\n---\n\n${block}` : block;
}
