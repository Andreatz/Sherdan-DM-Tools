import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  entities,
  entityLinks,
  chatgptBridgeImports,
  entityIdentities,
  entitySecrets,
  pcHooks,
  plotThreadEvents,
  plotThreads,
  sessions,
  truthClues,
} from "@/db/schema";

import { reviewChangeSchema, updatePackSchema } from "./schemas";
import type { ChatGptBridgeUpdatePack } from "./schemas";
import type { ReviewChange, ReviewMatchInfo } from "./types";

type PlotThreadStatus = "hot" | "warm" | "cold" | "resolved" | "abandoned";
type TruthClueStatus =
  | "planted"
  | "noticed"
  | "misinterpreted"
  | "understood"
  | "lost";
type Visibility = "dm_only" | "discovered" | "public";
type SecretLayer = "surface" | "intermediate" | "deep";

const FUZZY_MATCH_MIN_SCORE = 0.72;
const FUZZY_AMBIGUITY_MARGIN = 0.06;

type LookupCandidate<T> = {
  item: T;
  label: string;
  aliases?: string[];
};

type LookupResult<T> =
  | { item: T; match: ReviewMatchInfo; warning?: string }
  | { item: null; match: ReviewMatchInfo; warning: string };

interface EntityLookupRow {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

export async function reviewUpdatePack(input: {
  campaignId: string;
  sessionNumber?: number;
  updatePack: unknown;
}): Promise<{ ok: true; changes: ReviewChange[]; warnings: string[] }> {
  const parsed = updatePackSchema.safeParse(input.updatePack);
  if (!parsed.success) {
    return {
      ok: true,
      changes: [],
      warnings: ["UPDATE PACK non valido: nessuna modifica candidate generata."],
    };
  }

  const pack = parsed.data;
  const changes: ReviewChange[] = [];
  const warnings: string[] = [];
  await appendSessionChange(
    changes,
    warnings,
    input.campaignId,
    input.sessionNumber,
    pack,
  );
  await appendPlotThreadChanges(changes, warnings, input.campaignId, pack);
  appendTruthClueChanges(changes, input.campaignId, pack);
  await appendNpcChanges(changes, warnings, input.campaignId, pack);
  await appendHookChanges(changes, warnings, input.campaignId, pack);
  await appendIdentityChanges(changes, warnings, input.campaignId, pack);
  await appendSecretChanges(changes, warnings, input.campaignId, pack);
  await appendLinkChanges(changes, warnings, input.campaignId, pack);
  return { ok: true, changes, warnings };
}

export async function applyReviewChanges(input: {
  campaignId: string;
  importId?: string;
  selectedChanges: ReviewChange[];
}) {
  const applied: Array<{ kind: ReviewChange["kind"]; label: string; id?: string }> = [];

  await db.transaction(async (tx) => {
    for (const rawChange of input.selectedChanges) {
      const change = reviewChangeSchema.parse(rawChange);
      switch (change.kind) {
        case "session_update": {
          const payload = sessionUpdatePayload(change.applyPayload);
          const [row] = await tx
            .update(sessions)
            .set({
              title: payload.title ?? undefined,
              recap: payload.recap ?? undefined,
              dmNotes: payload.dmNotes ?? undefined,
            })
            .where(
              and(
                eq(sessions.campaignId, input.campaignId),
                eq(sessions.number, payload.number),
              ),
            )
            .returning({ id: sessions.id });
          if (row) applied.push({ kind: change.kind, label: change.label, id: row.id });
          break;
        }
        case "plot_thread_event_create": {
          const payload = plotThreadEventPayload(change.applyPayload);
          const [row] = await tx
            .insert(plotThreadEvents)
            .values({
              plotThreadId: payload.plotThreadId,
              eventType: "chatgpt_bridge_update",
              description: payload.description,
              visibility: "dm_only",
            })
            .returning({ id: plotThreadEvents.id });
          if (payload.suggestedStatus) {
            await tx
              .update(plotThreads)
              .set({ status: payload.suggestedStatus })
              .where(eq(plotThreads.id, payload.plotThreadId));
          }
          applied.push({ kind: change.kind, label: change.label, id: row?.id });
          break;
        }
        case "truth_clue_create": {
          const payload = truthCluePayload(input.campaignId, change.applyPayload);
          const [row] = await tx
            .insert(truthClues)
            .values(payload)
            .returning({ id: truthClues.id });
          applied.push({ kind: change.kind, label: change.label, id: row?.id });
          break;
        }
        case "entity_update": {
          const payload = entityUpdatePayload(change.applyPayload);
          const [row] = await tx
            .update(entities)
            .set({ description: payload.description })
            .where(and(eq(entities.id, payload.entityId), eq(entities.campaignId, input.campaignId)))
            .returning({ id: entities.id });
          if (row) applied.push({ kind: change.kind, label: change.label, id: row.id });
          break;
        }
        case "pc_hook_create": {
          const payload = pcHookPayload(input.campaignId, change.applyPayload);
          const [row] = await tx.insert(pcHooks).values(payload).returning({ id: pcHooks.id });
          applied.push({ kind: change.kind, label: change.label, id: row?.id });
          break;
        }
        case "entity_identity_create": {
          const payload = entityIdentityPayload(change.applyPayload);
          const [row] = await tx
            .insert(entityIdentities)
            .values(payload)
            .returning({ id: entityIdentities.id });
          applied.push({ kind: change.kind, label: change.label, id: row?.id });
          break;
        }
        case "entity_secret_create": {
          const payload = entitySecretPayload(input.campaignId, change.applyPayload);
          const [row] = await tx
            .insert(entitySecrets)
            .values(payload)
            .returning({ id: entitySecrets.id });
          applied.push({ kind: change.kind, label: change.label, id: row?.id });
          break;
        }
        case "entity_link_create": {
          const payload = entityLinkPayload(input.campaignId, change.applyPayload);
          const [row] = await tx
            .insert(entityLinks)
            .values(payload)
            .returning({ id: entityLinks.id });
          applied.push({ kind: change.kind, label: change.label, id: row?.id });
          break;
        }
      }
    }

    if (input.importId) {
      await tx
        .update(chatgptBridgeImports)
        .set({
          appliedChanges: applied,
          metadata: {
            lastAppliedAt: new Date().toISOString(),
            appliedCount: applied.length,
          },
        })
        .where(
          and(
            eq(chatgptBridgeImports.id, input.importId),
            eq(chatgptBridgeImports.campaignId, input.campaignId),
          ),
        );
    }
  });

  return { ok: true, applied };
}

async function appendSessionChange(
  changes: ReviewChange[],
  warnings: string[],
  campaignId: string,
  fallbackSessionNumber: number | undefined,
  pack: ChatGptBridgeUpdatePack,
) {
  if (!pack.session) return;
  const number = pack.session.number ?? fallbackSessionNumber;
  if (!number && !pack.session.title) {
    warnings.push("Session update ignorato: manca il numero sessione.");
    return;
  }

  const match = await findSession(campaignId, number, pack.session.title);
  if (match.warning) warnings.push(match.warning);
  if (!match.item) {
    return;
  }
  const before = match.item;
  const after = {
    title: pack.session.title ?? before.title,
    recap: pack.session.recapCandidate ?? before.recap,
    dmNotes: pack.session.dmNotesCandidate ?? before.dmNotes,
  };
  changes.push({
    kind: "session_update",
    label: `Aggiorna sessione ${before.number}`,
    before,
    after,
    applyPayload: { number: before.number, ...after },
    match: match.match,
  });
}

async function appendPlotThreadChanges(
  changes: ReviewChange[],
  warnings: string[],
  campaignId: string,
  pack: ChatGptBridgeUpdatePack,
) {
  for (const update of pack.plotThreadUpdates) {
    const match = await findPlotThread(campaignId, update.title);
    if (match.warning) warnings.push(match.warning);
    if (!match.item) {
      continue;
    }
    const thread = match.item;
    if (update.event) {
      changes.push({
        kind: "plot_thread_event_create",
        label: `Aggiungi evento a ${thread.title}`,
        applyPayload: {
          plotThreadId: thread.id,
          description: update.event,
          suggestedStatus: update.suggestedStatus,
        },
        match: match.match,
      });
    }
  }
}

function appendTruthClueChanges(
  changes: ReviewChange[],
  campaignId: string,
  pack: ChatGptBridgeUpdatePack,
) {
  for (const clue of pack.truthClueUpdates) {
    changes.push({
      kind: "truth_clue_create",
      label: `Crea briciola: ${clue.description.slice(0, 80)}`,
      applyPayload: {
        campaignId,
        description: clue.description,
        truthRevealed: clue.truthRevealed ?? "Da definire",
        status: clue.status ?? "planted",
      },
    });
  }
}

async function appendNpcChanges(
  changes: ReviewChange[],
  warnings: string[],
  campaignId: string,
  pack: ChatGptBridgeUpdatePack,
) {
  for (const npc of pack.npcUpdates) {
    const match = await findEntity(campaignId, npc.name, "NPC");
    if (match.warning) warnings.push(match.warning);
    if (!match.item) continue;
    const entity = match.item;
    const after = [entity.description, npc.state, npc.nextMove]
      .filter(Boolean)
      .join("\n\n");
    changes.push({
      kind: "entity_update",
      label: `Aggiorna entita: ${entity.name}`,
      before: entity,
      after: { description: after },
      applyPayload: { entityId: entity.id, description: after },
      match: match.match,
    });
  }
}

async function appendHookChanges(
  changes: ReviewChange[],
  warnings: string[],
  campaignId: string,
  pack: ChatGptBridgeUpdatePack,
) {
  for (const hook of pack.newHooks) {
    const pcMatch = await findEntity(campaignId, hook.pc, "PC", ["pc"]);
    if (pcMatch.warning) warnings.push(pcMatch.warning);
    if (!pcMatch.item) {
      continue;
    }
    const pc = pcMatch.item;
    const targetMatch = hook.target
      ? await findEntity(campaignId, hook.target, "target hook")
      : {
          item: null as EntityLookupRow | null,
          match: {
            status: "none" as const,
            subject: "target hook",
            requested: "",
          },
        };
    if ("warning" in targetMatch && targetMatch.warning) {
      warnings.push(targetMatch.warning);
    }
    if (!targetMatch.item) {
      warnings.push(`Target mancante/non trovato per hook di ${hook.pc}.`);
      continue;
    }
    const target = targetMatch.item;
    changes.push({
      kind: "pc_hook_create",
      label: `Crea hook: ${pc.name} -> ${target.name}`,
      applyPayload: {
        campaignId,
        pcEntityId: pc.id,
        targetEntityId: target.id,
        hookDescription: hook.hookDescription,
        status: "available",
      },
      match: combineMatchInfo("Hook", `${hook.pc} -> ${hook.target ?? ""}`, [
        pcMatch.match,
        targetMatch.match,
      ]),
    });
  }
}

async function appendIdentityChanges(
  changes: ReviewChange[],
  warnings: string[],
  campaignId: string,
  pack: ChatGptBridgeUpdatePack,
) {
  for (const identity of pack.newIdentities) {
    const entityMatch = await findEntity(campaignId, identity.entity, "identita entity");
    if (entityMatch.warning) warnings.push(entityMatch.warning);
    if (!entityMatch.item) continue;
    changes.push({
      kind: "entity_identity_create",
      label: `Crea identita: ${entityMatch.item.name} -> ${identity.name}`,
      applyPayload: {
        entityId: entityMatch.item.id,
        name: identity.name,
        isTrueIdentity: identity.isTrueIdentity ?? false,
        appearance: identity.appearance,
        voice: identity.voice,
        mannerisms: identity.mannerisms ?? [],
        visibility: toVisibility(identity.visibility),
        notes: identity.notes,
      },
      match: entityMatch.match,
    });
  }
}

async function appendSecretChanges(
  changes: ReviewChange[],
  warnings: string[],
  campaignId: string,
  pack: ChatGptBridgeUpdatePack,
) {
  for (const secret of pack.newSecrets) {
    const entityMatch = secret.entity
      ? await findEntity(campaignId, secret.entity, "segreto entity")
      : {
          item: null as EntityLookupRow | null,
          match: {
            status: "none" as const,
            subject: "segreto entity",
            requested: "",
          },
        };
    if ("warning" in entityMatch && entityMatch.warning) warnings.push(entityMatch.warning);

    const plotMatch = secret.plotThread
      ? await findPlotThread(campaignId, secret.plotThread)
      : {
          item: null as { id: string; title: string } | null,
          match: {
            status: "none" as const,
            subject: "Plot thread",
            requested: "",
          },
        };
    if ("warning" in plotMatch && plotMatch.warning) warnings.push(plotMatch.warning);

    if (!entityMatch.item && !plotMatch.item) {
      warnings.push(`Segreto ignorato: target non trovato per "${secret.content.slice(0, 60)}".`);
      continue;
    }

    const target = entityMatch.item?.name ?? plotMatch.item?.title ?? "target";
    changes.push({
      kind: "entity_secret_create",
      label: `Crea segreto: ${target}`,
      applyPayload: {
        campaignId,
        entityId: entityMatch.item?.id,
        plotThreadId: plotMatch.item?.id,
        layer: toSecretLayer(secret.layer),
        content: secret.content,
        exploitHint: secret.exploitHint,
      },
      match: combineMatchInfo(
        "Segreto",
        [secret.entity, secret.plotThread].filter(Boolean).join(" / "),
        [entityMatch.match, plotMatch.match],
      ),
    });
  }
}

async function appendLinkChanges(
  changes: ReviewChange[],
  warnings: string[],
  campaignId: string,
  pack: ChatGptBridgeUpdatePack,
) {
  for (const link of pack.newLinks) {
    const sourceMatch = await findEntity(campaignId, link.source, "link source");
    if (sourceMatch.warning) warnings.push(sourceMatch.warning);
    const targetMatch = await findEntity(campaignId, link.target, "link target");
    if (targetMatch.warning) warnings.push(targetMatch.warning);
    if (!sourceMatch.item || !targetMatch.item) continue;

    changes.push({
      kind: "entity_link_create",
      label: `Crea link: ${sourceMatch.item.name} -> ${targetMatch.item.name}`,
      applyPayload: {
        campaignId,
        sourceEntityId: sourceMatch.item.id,
        targetEntityId: targetMatch.item.id,
        relationType: link.relationType,
        publicRelationType: link.publicRelationType,
        strength: link.strength,
        description: link.description,
        visibility: toVisibility(link.visibility),
      },
      match: combineMatchInfo("Link", `${link.source} -> ${link.target}`, [
        sourceMatch.match,
        targetMatch.match,
      ]),
    });
  }
}

function asRecord(value: unknown) {
  if (typeof value !== "object" || value === null) throw new Error("Payload non valido");
  return value as Record<string, unknown>;
}

function sessionUpdatePayload(value: unknown) {
  const record = asRecord(value);
  return {
    number: Number(record.number),
    title: stringOrUndefined(record.title),
    recap: stringOrUndefined(record.recap),
    dmNotes: stringOrUndefined(record.dmNotes),
  };
}

async function findSession(
  campaignId: string,
  number: number | undefined,
  title: string | undefined,
) {
  const selection = {
    id: sessions.id,
    number: sessions.number,
    title: sessions.title,
    recap: sessions.recap,
    dmNotes: sessions.dmNotes,
  };

  if (number) {
    const [session] = await db
      .select(selection)
      .from(sessions)
      .where(and(eq(sessions.campaignId, campaignId), eq(sessions.number, number)))
      .limit(1);
    if (session) {
      return {
        item: session,
        match: {
          status: "exact" as const,
          subject: "Sessione",
          requested: String(number),
          matched: `Sessione ${session.number}`,
          score: 1,
        },
      };
    }
    if (!title) {
      return {
        item: null,
        match: {
          status: "none",
          subject: "Sessione",
          requested: String(number),
        },
        warning: `Sessione ${number} non trovata: update sessione non candidate.`,
      };
    }
  }

  const rows = await db
    .select(selection)
    .from(sessions)
    .where(eq(sessions.campaignId, campaignId));
  return pickBestMatch(
    title ?? "",
    rows.map((row) => ({
      item: row,
      label: row.title ?? `Sessione ${row.number}`,
    })),
    {
      subject: "Sessione",
      requested: title ?? String(number),
    },
  );
}

async function findPlotThread(
  campaignId: string,
  title: string,
): Promise<LookupResult<{ id: string; title: string }>> {
  const rows = await db
    .select({ id: plotThreads.id, title: plotThreads.title })
    .from(plotThreads)
    .where(eq(plotThreads.campaignId, campaignId));

  return pickBestMatch(title, rows.map((row) => ({ item: row, label: row.title })), {
    subject: "Plot thread",
    requested: title,
  });
}

async function findEntity(
  campaignId: string,
  name: string,
  subject: string,
  preferredTypes: string[] = [],
): Promise<LookupResult<EntityLookupRow>> {
  const rows = await db
    .select({
      id: entities.id,
      name: entities.name,
      type: entities.type,
      description: entities.description,
    })
    .from(entities)
    .where(eq(entities.campaignId, campaignId));

  const identityRows = await db
    .select({
      entityId: entityIdentities.entityId,
      name: entityIdentities.name,
    })
    .from(entityIdentities)
    .innerJoin(entities, eq(entities.id, entityIdentities.entityId))
    .where(eq(entities.campaignId, campaignId));

  const aliasesByEntity = new Map<string, string[]>();
  for (const identity of identityRows) {
    const aliases = aliasesByEntity.get(identity.entityId) ?? [];
    aliases.push(identity.name);
    aliasesByEntity.set(identity.entityId, aliases);
  }

  const preferredRows = preferredTypes.length
    ? rows.filter((row) => preferredTypes.includes(row.type))
    : rows;
  const candidates = (preferredRows.length > 0 ? preferredRows : rows).map(
    (row) => ({
      item: row,
      label: row.name,
      aliases: aliasesByEntity.get(row.id),
    }),
  );

  return pickBestMatch(name, candidates, {
    subject,
    requested: name,
  });
}

function pickBestMatch<T>(
  requested: string,
  candidates: LookupCandidate<T>[],
  options: { subject: string; requested: string },
): LookupResult<T> {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(requested, candidate),
      matchedLabel: bestMatchedLabel(requested, candidate),
    }))
    .filter((entry) => entry.score >= FUZZY_MATCH_MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  const [best, second] = ranked;
  if (!best) {
    return {
      item: null,
      match: {
        status: "none",
        subject: options.subject,
        requested: options.requested,
      },
      warning: `${options.subject} non trovato: ${options.requested}`,
    };
  }

  if (second && best.score - second.score < FUZZY_AMBIGUITY_MARGIN) {
    return {
      item: null,
      match: {
        status: "ambiguous",
        subject: options.subject,
        requested: options.requested,
        score: roundMatchScore(best.score),
        candidates: [best.candidate.label, second.candidate.label],
      },
      warning: `${options.subject} ambiguo per "${options.requested}": ${best.candidate.label}, ${second.candidate.label}`,
    };
  }

  return {
    item: best.candidate.item,
    match: {
      status: best.score >= 1 ? "exact" : "fuzzy",
      subject: options.subject,
      requested: options.requested,
      matched: best.candidate.label,
      matchedBy: best.matchedLabel,
      score: roundMatchScore(best.score),
    },
    warning:
      best.score >= 1
        ? undefined
        : `${options.subject} "${options.requested}" associato a "${best.candidate.label}" via match fuzzy (${best.matchedLabel}).`,
  };
}

function combineMatchInfo(
  subject: string,
  requested: string,
  matches: ReviewMatchInfo[],
): ReviewMatchInfo {
  const meaningful = matches.filter((match) => match.status !== "none");
  if (meaningful.length === 0) {
    return { status: "none", subject, requested };
  }
  const status = meaningful.some((match) => match.status === "ambiguous")
    ? "ambiguous"
    : meaningful.some((match) => match.status === "fuzzy")
      ? "fuzzy"
      : "exact";
  return {
    status,
    subject,
    requested,
    matched: meaningful.map((match) => match.matched).filter(Boolean).join(" -> "),
    matchedBy: meaningful.map((match) => match.matchedBy).filter(Boolean).join(" -> "),
    score: roundMatchScore(
      Math.min(...meaningful.map((match) => match.score ?? 1)),
    ),
    candidates: meaningful.flatMap((match) => match.candidates ?? []),
  };
}

function roundMatchScore(score: number) {
  return Math.round(score * 100) / 100;
}

function scoreCandidate<T>(requested: string, candidate: LookupCandidate<T>) {
  return Math.max(
    scoreUpdatePackMatch(requested, candidate.label),
    ...(candidate.aliases ?? []).map((alias) =>
      scoreUpdatePackMatch(requested, alias),
    ),
  );
}

function bestMatchedLabel<T>(requested: string, candidate: LookupCandidate<T>) {
  const labels = [candidate.label, ...(candidate.aliases ?? [])];
  return labels
    .map((label) => ({ label, score: scoreUpdatePackMatch(requested, label) }))
    .sort((a, b) => b.score - a.score)[0]?.label ?? candidate.label;
}

export function normalizeUpdatePackLookupKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .split(/\s+/)
    .filter((part) => part && !isWeakLookupToken(part))
    .join(" ");
}

export function scoreUpdatePackMatch(left: string, right: string) {
  const a = normalizeUpdatePackLookupKey(left);
  const b = normalizeUpdatePackLookupKey(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return 0.86 + 0.1 * (Math.min(a.length, b.length) / Math.max(a.length, b.length));
  }
  return diceCoefficient(a, b);
}

function diceCoefficient(left: string, right: string) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (a.length === 0 || b.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const gram of a) counts.set(gram, (counts.get(gram) ?? 0) + 1);
  let overlap = 0;
  for (const gram of b) {
    const count = counts.get(gram) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  }
  return (2 * overlap) / (a.length + b.length);
}

function bigrams(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= 1) return compact ? [compact] : [];
  const grams: string[] = [];
  for (let index = 0; index < compact.length - 1; index += 1) {
    grams.push(compact.slice(index, index + 2));
  }
  return grams;
}

function isWeakLookupToken(token: string) {
  return [
    "a",
    "ad",
    "al",
    "alla",
    "d",
    "da",
    "de",
    "dei",
    "del",
    "della",
    "di",
    "e",
    "il",
    "l",
    "la",
    "le",
    "lo",
    "the",
  ].includes(token);
}

function plotThreadEventPayload(value: unknown) {
  const record = asRecord(value);
  return {
    plotThreadId: String(record.plotThreadId),
    description: String(record.description),
    suggestedStatus: toPlotThreadStatus(record.suggestedStatus),
  };
}

function truthCluePayload(campaignId: string, value: unknown) {
  const record = asRecord(value);
  return {
    campaignId,
    description: String(record.description),
    truthRevealed: String(record.truthRevealed ?? "Da definire"),
    status: toTruthClueStatus(record.status),
  };
}

function entityUpdatePayload(value: unknown) {
  const record = asRecord(value);
  return {
    entityId: String(record.entityId),
    description: String(record.description ?? ""),
  };
}

function pcHookPayload(campaignId: string, value: unknown) {
  const record = asRecord(value);
  return {
    campaignId,
    pcEntityId: String(record.pcEntityId),
    targetEntityId: String(record.targetEntityId),
    hookDescription: String(record.hookDescription),
    status: String(record.status ?? "available"),
  };
}

function entityIdentityPayload(value: unknown) {
  const record = asRecord(value);
  return {
    entityId: String(record.entityId),
    name: String(record.name),
    isTrueIdentity: record.isTrueIdentity === true,
    appearance: stringOrUndefined(record.appearance),
    voice: stringOrUndefined(record.voice),
    mannerisms: Array.isArray(record.mannerisms)
      ? record.mannerisms.filter((item): item is string => typeof item === "string")
      : [],
    visibility: toVisibility(record.visibility),
    notes: stringOrUndefined(record.notes),
  };
}

function entitySecretPayload(campaignId: string, value: unknown) {
  const record = asRecord(value);
  return {
    campaignId,
    entityId: stringOrUndefined(record.entityId),
    plotThreadId: stringOrUndefined(record.plotThreadId),
    layer: toSecretLayer(record.layer),
    content: String(record.content),
    exploitHint: stringOrUndefined(record.exploitHint),
  };
}

function entityLinkPayload(campaignId: string, value: unknown) {
  const record = asRecord(value);
  return {
    campaignId,
    sourceEntityId: String(record.sourceEntityId),
    targetEntityId: String(record.targetEntityId),
    relationType: String(record.relationType),
    publicRelationType: stringOrUndefined(record.publicRelationType),
    strength: typeof record.strength === "number" ? record.strength : undefined,
    description: stringOrUndefined(record.description),
    visibility: toVisibility(record.visibility),
  };
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function toPlotThreadStatus(value: unknown): PlotThreadStatus | undefined {
  return value === "hot" ||
    value === "warm" ||
    value === "cold" ||
    value === "resolved" ||
    value === "abandoned"
    ? value
    : undefined;
}

function toTruthClueStatus(value: unknown): TruthClueStatus {
  return value === "noticed" ||
    value === "misinterpreted" ||
    value === "understood" ||
    value === "lost" ||
    value === "planted"
    ? value
    : "planted";
}

function toVisibility(value: unknown): Visibility {
  return value === "public" || value === "discovered" || value === "dm_only"
    ? value
    : "dm_only";
}

function toSecretLayer(value: unknown): SecretLayer {
  return value === "surface" || value === "intermediate" || value === "deep"
    ? value
    : "surface";
}
