import type { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  encounters,
  entities,
  pcHooks,
  plotThreads,
  sessions,
  truthClues,
} from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { created, fail } from "@/lib/api/respond";
import {
  formatSessionPrepAsMarkdown,
  selectAcceptedPieces,
  sessionPrepAcceptSchema,
} from "@/lib/session-prep";

const DRAFT_TAG = "session-prep-draft";

// Trasforma i pezzi accettati dell'output in record reali del DB:
// - briciole accettate -> `truth_clues` con `status='planted'`;
// - NPC seed -> `entities` `type='npc'`, `visibility='dm_only'`,
//   `tags=[session-prep-draft]`, properties NPC minime valide;
// - encounter seed -> `encounters` senza participants (draft tattico,
//   il DM completera' nell'Encounter Builder);
// - hook con `pcEntityId` + `targetEntityId` validi -> `pc_hooks` con
//   `status='available'`.
// Aggiorna anche `sessions.prep_notes` (append Markdown dei soli pezzi
// accettati). Tutto in una transazione: o passa tutto o niente.

export interface SessionPrepAcceptResult {
  session: {
    id: string;
    number: number;
    prepNotes: string | null;
  };
  created: {
    clues: Array<{ id: string; description: string }>;
    npcs: Array<{ id: string; name: string }>;
    encounters: Array<{ id: string; title: string }>;
    pcHooks: Array<{ id: string; pcName: string; targetName: string }>;
  };
  skipped: {
    hookInvalid: number;
    cluePlotThreadInvalid: number;
  };
  markdown: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = sessionPrepAcceptSchema.parse(body);

    // Pre-flight: sessione di destinazione deve esistere ed appartenere
    // alla campagna richiesta.
    const [session] = await db
      .select({
        id: sessions.id,
        number: sessions.number,
        campaignId: sessions.campaignId,
        prepNotes: sessions.prepNotes,
      })
      .from(sessions)
      .where(eq(sessions.id, input.sessionId))
      .limit(1);
    if (!session) throw new NotFoundError("session", input.sessionId);
    if (session.campaignId !== input.campaignId) {
      throw new BadRequestError(
        "La sessione non appartiene alla campagna indicata.",
      );
    }

    const accepted = selectAcceptedPieces(input.output, input.selected);

    // Validazione cross-reference: plot thread delle briciole devono
    // essere della stessa campagna; idem PG/target degli hook.
    const plotThreadIds = Array.from(
      new Set(
        accepted.suggestedClues
          .map((c) => c.relatedPlotThreadId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const validPlotThreadIds = plotThreadIds.length
      ? new Set(
          (
            await db
              .select({ id: plotThreads.id })
              .from(plotThreads)
              .where(
                inArray(plotThreads.id, plotThreadIds),
              )
              .then((rows) =>
                rows.filter((r) => r.id !== null),
              )
          ).map((r) => r.id),
        )
      : new Set<string>();

    const hookEntityIds = Array.from(
      new Set(
        accepted.hooks.flatMap((h) =>
          [h.pcEntityId, h.targetEntityId].filter(
            (id): id is string => Boolean(id),
          ),
        ),
      ),
    );
    const validEntityIds = hookEntityIds.length
      ? new Set(
          (
            await db
              .select({ id: entities.id })
              .from(entities)
              .where(inArray(entities.id, hookEntityIds))
          ).map((r) => r.id),
        )
      : new Set<string>();

    const result: SessionPrepAcceptResult["created"] = {
      clues: [],
      npcs: [],
      encounters: [],
      pcHooks: [],
    };
    const skipped = { hookInvalid: 0, cluePlotThreadInvalid: 0 };

    await db.transaction(async (tx) => {
      // ─── Truth clues ───────────────────────────────────────────────
      for (const clue of accepted.suggestedClues) {
        const relatedPlotThreadId =
          clue.relatedPlotThreadId &&
          validPlotThreadIds.has(clue.relatedPlotThreadId)
            ? clue.relatedPlotThreadId
            : null;
        if (clue.relatedPlotThreadId && !relatedPlotThreadId) {
          skipped.cluePlotThreadInvalid += 1;
        }
        const [row] = await tx
          .insert(truthClues)
          .values({
            campaignId: input.campaignId,
            description: clue.description,
            truthRevealed: clue.truthRevealed,
            relatedPlotThreadId,
            plantedInSession: input.sessionId,
            status: "planted",
          })
          .returning({
            id: truthClues.id,
            description: truthClues.description,
          });
        if (row) result.clues.push(row);
      }

      // ─── NPC entity stubs ──────────────────────────────────────────
      for (const npc of accepted.npcSeeds) {
        // Skip se l'agent ha indicato un NPC gia' esistente: niente da
        // creare. Lo riportiamo comunque nel prep_notes Markdown.
        if (npc.existingEntityId) continue;
        const [row] = await tx
          .insert(entities)
          .values({
            campaignId: input.campaignId,
            type: "npc",
            name: npc.name,
            description: `Session prep seed (${npc.narrativeRole}). Tono: ${npc.tone}. ${npc.rationale}`,
            visibility: "dm_only",
            tags: [DRAFT_TAG],
            properties: {
              race: "da definire",
              appearance_summary: npc.narrativeRole,
              voice: { tone: npc.tone, speech_patterns: [] },
              extra: { session_prep_seed: true, tone: npc.tone },
            },
          })
          .returning({ id: entities.id, name: entities.name });
        if (row) result.npcs.push(row);
      }

      // ─── Encounter drafts ──────────────────────────────────────────
      for (const enc of accepted.encounterSeeds) {
        const [row] = await tx
          .insert(encounters)
          .values({
            campaignId: input.campaignId,
            title: enc.title,
            description: enc.concept,
            difficulty: enc.difficultyHint,
            tacticalNotes: [
              `Session prep seed (${enc.difficultyHint}).`,
              `Creature ipotizzate: ${enc.creatureHints.join(", ")}`,
              `Perche': ${enc.rationale}`,
            ].join("\n"),
            usedInSession: null,
          })
          .returning({ id: encounters.id, title: encounters.title });
        if (row) result.encounters.push(row);
      }

      // ─── PC hooks ──────────────────────────────────────────────────
      for (const hook of accepted.hooks) {
        const validPc =
          hook.pcEntityId && validEntityIds.has(hook.pcEntityId);
        const validTarget =
          hook.targetEntityId && validEntityIds.has(hook.targetEntityId);
        if (!validPc || !validTarget) {
          skipped.hookInvalid += 1;
          continue;
        }
        const [row] = await tx
          .insert(pcHooks)
          .values({
            campaignId: input.campaignId,
            pcEntityId: hook.pcEntityId!,
            targetEntityId: hook.targetEntityId!,
            hookDescription: hook.hookDescription,
            potentialArc: hook.potentialArc,
            status: "available",
          })
          .returning({
            id: pcHooks.id,
            pcEntityId: pcHooks.pcEntityId,
            targetEntityId: pcHooks.targetEntityId,
          });
        if (row) {
          result.pcHooks.push({
            id: row.id,
            pcName: hook.pcName,
            targetName: hook.targetName,
          });
        }
      }

      // ─── Markdown append a prep_notes ─────────────────────────────
      const markdown = formatSessionPrepAsMarkdown(accepted, {
        generatedAt: new Date(),
        vibe: input.vibe,
        focus: input.focus,
      });
      const existing = session.prepNotes?.trim();
      const next = existing ? `${existing}\n\n---\n\n${markdown}` : markdown;
      await tx
        .update(sessions)
        .set({ prepNotes: next })
        .where(eq(sessions.id, input.sessionId));
    });

    // Re-leggi la sessione fuori dalla transazione per evitare di
    // rispedire una rappresentazione "sporca".
    const [refreshed] = await db
      .select({
        id: sessions.id,
        number: sessions.number,
        prepNotes: sessions.prepNotes,
      })
      .from(sessions)
      .where(eq(sessions.id, input.sessionId))
      .limit(1);

    const markdownPreview = formatSessionPrepAsMarkdown(accepted, {
      generatedAt: new Date(),
      vibe: input.vibe,
      focus: input.focus,
    });

    const response: SessionPrepAcceptResult = {
      session: refreshed!,
      created: result,
      skipped,
      markdown: markdownPreview,
    };
    return created(response);
  } catch (err) {
    return fail(err);
  }
}
