import {
  commandForTask,
  densityDescriptions,
} from "./prompt-templates";
import { loadArchitectPrompt } from "./prompt-loader";
import { chatGptBridgeExportInputSchema } from "./schemas";
import type {
  ChatGptBridgeContext,
  ChatGptBridgeExportResult,
} from "./types";
import { collectChatGptBridgeContext } from "./context-queries";

import type { ChatGptBridgeExportInput } from "./schemas";

export async function buildChatGptBridgeExport(
  rawInput: ChatGptBridgeExportInput,
  contextOverride?: ChatGptBridgeContext,
): Promise<ChatGptBridgeExportResult> {
  const input = chatGptBridgeExportInputSchema.parse(rawInput);
  const context =
    contextOverride ??
    (await collectChatGptBridgeContext({
      campaignId: input.campaignId,
      audience: input.audience,
      locationId: input.locationId,
      includeCampaignSnapshot: input.includeCampaignSnapshot,
      includeRecentSessions: input.includeRecentSessions,
      recentSessionsLimit: input.recentSessionsLimit,
      includePlotThreads: input.includePlotThreads,
      includeTruthClues: input.includeTruthClues,
      includeSecrets: input.includeSecrets,
      includePcHooks: input.includePcHooks,
      includeFactions: input.includeFactions,
      includePlayerFacingState: input.includePlayerFacingState,
    }));

  const warnings = collectWarnings(input, context);
  const budgetedContext = applyRelevanceBudget(input, context, warnings);
  const prompt = loadArchitectPrompt();
  if (prompt.warning) warnings.push(prompt.warning);
  const markdown = renderMarkdown(input, budgetedContext, warnings, prompt);
  const estimatedCharacters = markdown.length;
  if (estimatedCharacters > 80_000) {
    warnings.push(
      "Il pacchetto supera 80.000 caratteri: valuta Light/Standard o meno sezioni.",
    );
  }

  return {
    ok: true,
    filename: filenameFor(input, budgetedContext.campaign?.name),
    markdown,
    estimatedCharacters,
    warnings,
  };
}

type ContextArrayKey =
  | "recentSessions"
  | "plotThreads"
  | "truthClues"
  | "secrets"
  | "pcHooks"
  | "factions";

type RelevanceBudget = Record<ContextArrayKey, number>;

const relevanceBudgets: Record<ChatGptBridgeExportInput["density"], RelevanceBudget> = {
  Light: {
    recentSessions: 2,
    plotThreads: 8,
    truthClues: 12,
    secrets: 10,
    pcHooks: 10,
    factions: 8,
  },
  Standard: {
    recentSessions: 5,
    plotThreads: 16,
    truthClues: 28,
    secrets: 24,
    pcHooks: 24,
    factions: 20,
  },
  Full: {
    recentSessions: 10,
    plotThreads: 50,
    truthClues: 80,
    secrets: 80,
    pcHooks: 80,
    factions: 60,
  },
  "Table-Ready": {
    recentSessions: 4,
    plotThreads: 12,
    truthClues: 20,
    secrets: 18,
    pcHooks: 20,
    factions: 14,
  },
  "Design-Only": {
    recentSessions: 2,
    plotThreads: 20,
    truthClues: 30,
    secrets: 30,
    pcHooks: 12,
    factions: 24,
  },
};

const sectionLabels: Record<ContextArrayKey, string> = {
  recentSessions: "sessioni recenti",
  plotThreads: "plot thread",
  truthClues: "truth clues",
  secrets: "segreti",
  pcHooks: "PC hook",
  factions: "PNG/fazioni",
};

function applyRelevanceBudget(
  input: ChatGptBridgeExportInput,
  context: ChatGptBridgeContext,
  warnings: string[],
): ChatGptBridgeContext {
  const budget = relevanceBudgets[input.density];
  const signals = relevanceSignals(input, context);

  return {
    ...context,
    recentSessions: limitSection(
      context.recentSessions,
      budget.recentSessions,
      (row) => scoreSession(row, input, signals),
      "recentSessions",
      warnings,
      (rows) => rows.sort((a, b) => a.number - b.number),
    ),
    plotThreads: limitSection(
      context.plotThreads,
      budget.plotThreads,
      (row) =>
        scoreTextMatch(signals, row.title, row.description, row.publicDescription) +
        statusScore(row.status) +
        priorityScore(row.priority),
      "plotThreads",
      warnings,
    ),
    truthClues: limitSection(
      context.truthClues,
      budget.truthClues,
      (row) =>
        scoreTextMatch(signals, row.description, row.truthRevealed, row.statusNotes) +
        clueStatusScore(row.status),
      "truthClues",
      warnings,
    ),
    secrets: limitSection(
      context.secrets,
      budget.secrets,
      (row) =>
        scoreTextMatch(
          signals,
          row.content,
          row.exploitHint,
          row.entityName,
          row.plotThreadTitle,
        ) + secretLayerScore(row.layer),
      "secrets",
      warnings,
    ),
    pcHooks: limitSection(
      context.pcHooks,
      budget.pcHooks,
      (row) =>
        scoreTextMatch(
          signals,
          row.pcName,
          row.targetName,
          row.hookDescription,
          row.potentialArc,
        ) + statusScore(row.status),
      "pcHooks",
      warnings,
    ),
    factions: limitSection(
      context.factions,
      budget.factions,
      (row) =>
        scoreTextMatch(
          signals,
          row.name,
          row.description,
          row.publicDescription,
          row.tags.join(" "),
        ) + visibilityScore(row.visibility),
      "factions",
      warnings,
    ),
  };
}

function limitSection<T>(
  rows: T[] | undefined,
  limit: number,
  score: (row: T) => number,
  key: ContextArrayKey,
  warnings: string[],
  finalSort?: (rows: T[]) => T[],
) {
  if (!rows || rows.length <= limit) return rows;
  const selected = rows
    .map((row, index) => ({ row, index, score: score(row) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.row);
  warnings.push(
    `Relevance budget: ${sectionLabels[key]} ridotti da ${rows.length} a ${limit} per densita ${key === "recentSessions" ? "e contesto" : "e focus"}.`,
  );
  return finalSort ? finalSort(selected) : selected;
}

function relevanceSignals(
  input: ChatGptBridgeExportInput,
  context: ChatGptBridgeContext,
) {
  return tokenize(
    [
      input.focus,
      input.constraints,
      input.taskType,
      context.location?.name,
      context.location?.publicDescription,
      context.location?.description,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function scoreSession(
  row: NonNullable<ChatGptBridgeContext["recentSessions"]>[number],
  input: ChatGptBridgeExportInput,
  signals: Set<string>,
) {
  const sessionBoost = input.sessionNumber
    ? Math.max(0, 8 - Math.abs(row.number - input.sessionNumber))
    : row.number / 100;
  return (
    sessionBoost +
    scoreTextMatch(signals, row.title, row.recap, row.dmNotes, row.prepNotes)
  );
}

function scoreTextMatch(signals: Set<string>, ...values: Array<string | null | undefined>) {
  if (signals.size === 0) return 0;
  const tokens = tokenize(values.filter(Boolean).join(" "));
  let score = 0;
  for (const signal of signals) {
    if (tokens.has(signal)) score += 2;
    else if ([...tokens].some((token) => token.includes(signal) || signal.includes(token))) {
      score += 0.5;
    }
  }
  return score;
}

function statusScore(status: string) {
  switch (status) {
    case "hot":
    case "available":
      return 3;
    case "warm":
    case "in_progress":
      return 2;
    case "cold":
      return 1;
    default:
      return 0;
  }
}

function clueStatusScore(status: string) {
  switch (status) {
    case "noticed":
    case "misinterpreted":
      return 3;
    case "planted":
      return 2;
    case "understood":
      return 1;
    default:
      return 0;
  }
}

function secretLayerScore(layer: string) {
  switch (layer) {
    case "deep":
    case "core":
      return 3;
    case "intermediate":
      return 2;
    case "surface":
      return 1;
    default:
      return 0;
  }
}

function priorityScore(priority: number | null) {
  return priority ? Math.max(0, 5 - priority) : 0;
}

function visibilityScore(visibility: string) {
  return visibility === "dm_only" ? 1 : 0;
}

function tokenize(value: string) {
  return new Set(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !weakRelevanceTokens.has(token)),
  );
}

const weakRelevanceTokens = new Set([
  "con",
  "dei",
  "del",
  "della",
  "gli",
  "nel",
  "per",
  "che",
  "una",
  "uno",
  "the",
  "and",
  "session",
  "sessione",
]);

function renderMarkdown(
  input: ChatGptBridgeExportInput,
  context: ChatGptBridgeContext,
  warnings: string[],
  prompt: ReturnType<typeof loadArchitectPrompt>,
) {
  const command = commandForTask(input.taskType, input.sessionNumber, input.focus);
  const lines: string[] = [];
  lines.push("# ChatGPT Bridge Export - Sherdan-DM-Tools", "");
  lines.push("## 1. Task per ChatGPT", "");
  lines.push("Comando:", `\`${command}\``, "");
  lines.push("Modalita:", `\`${input.density}\` - ${densityDescriptions[input.density]}`, "");
  lines.push("Audience:", `\`${input.audience}\``, "");
  lines.push("Obiettivo:", input.focus?.trim() || "Usa il comando e il contesto canonico per produrre il materiale richiesto.", "");
  lines.push(
    "Durata prevista:",
    input.expectedDurationHours ? `${input.expectedDurationHours} ore` : "Non specificata",
    "",
  );
  lines.push("Vincoli specifici del Master:", input.constraints?.trim() || "Nessun vincolo aggiuntivo.", "");
  lines.push("---", "");
  lines.push("## 2. Istruzioni operative", "");
  lines.push(
    "- Usa il prompt Architetto di Mondi.",
    "- Rispetta la gerarchia delle fonti: database Sherdan, prompt del Master, proposta creativa.",
    "- Non inventare canon senza marcarlo come `Lore non definita`.",
    "- Proteggi GM-Only e reveal futuri.",
    "- Non scrivere azioni, pensieri o emozioni dei PG.",
    "- Non rendere PNG onniscienti.",
    "- Produci output in italiano.",
  );
  if (input.audience === "player") {
    lines.push("- Questo export e player-facing: non includere segreti, note GM o verita non rivelate.");
  }
  lines.push("");
  lines.push("---", "");
  lines.push("## 3. System Prompt - Architetto di Mondi", "");
  lines.push(`Fonte: \`${prompt.source}\``, "");
  lines.push(input.includeSystemPrompt ? prompt.full : prompt.summary, "");
  lines.push("---", "");
  lines.push("## 4. Snapshot Campagna", "");
  if (context.campaign) {
    lines.push(`- Nome: ${context.campaign.name}`);
    if (context.campaign.description) lines.push(`- Descrizione: ${context.campaign.description}`);
  } else {
    lines.push("_Snapshot campagna non incluso o non disponibile._");
  }
  if (context.location) {
    lines.push("", "### Location focus", "");
    lines.push(`- ${context.location.name} (${context.location.type})`);
    appendMaybe(lines, "Descrizione pubblica", context.location.publicDescription);
    appendMaybe(lines, "Note GM", context.location.description);
  }
  lines.push("");
  lines.push("---", "");
  lines.push("## 5. Dati dal database", "");
  lines.push("### 5.1 Ultime sessioni", "");
  appendSessions(lines, context.recentSessions ?? []);
  lines.push("", "### 5.2 Plot thread attivi", "");
  appendPlotThreads(lines, context.plotThreads ?? []);
  lines.push("", "### 5.3 Truth clues", "");
  appendTruthClues(lines, context.truthClues ?? [], input.audience);
  lines.push("", "### 5.4 Entity secrets rilevanti", "");
  appendSecrets(lines, context.secrets ?? []);
  lines.push("", "### 5.5 PC hooks", "");
  appendPcHooks(lines, context.pcHooks ?? []);
  lines.push("", "### 5.6 PNG / fazioni rilevanti", "");
  appendEntities(lines, context.factions ?? []);
  lines.push("", "### 5.7 Player-facing state", "");
  appendPlayerFacingState(lines, context.playerFacingState);
  lines.push("", "---", "");
  lines.push("## 6. Off-limits e Reveal protetti", "");
  if (input.audience === "player") {
    lines.push("- Escludi segreti GM, `dmNotes`, `prepNotes`, identita vere non scoperte e `truthRevealed`.");
  } else if (input.includeSecrets) {
    lines.push("- Questo pacchetto contiene segreti GM: non trasformarli in testo player-facing senza esplicito reveal.");
  } else {
    lines.push("- I segreti GM non sono inclusi: se servono, rigenera con checkbox dedicata.");
  }
  if (warnings.length > 0) {
    lines.push("", "Warning:");
    for (const warning of warnings) lines.push(`- ${warning}`);
  }
  lines.push("", "---", "");
  lines.push("## 7. Output richiesto", "");
  lines.push("Produci markdown completo pronto da incollare in Sherdan-DM-Tools.");
  if (input.requestUpdatePack) {
    lines.push("", updatePackInstructions(input.sessionNumber));
  } else {
    lines.push("", "Non produrre UPDATE PACK finale.");
  }
  lines.push("");
  return lines.join("\n");
}

function collectWarnings(input: ChatGptBridgeExportInput, context: ChatGptBridgeContext) {
  const warnings: string[] = [];
  if (input.audience === "gm" && input.includeSecrets && (context.secrets?.length ?? 0) > 0) {
    warnings.push("Include segreti GM. Non condividere il pacchetto con i giocatori.");
  }
  if (input.audience === "player") {
    warnings.push("Modalita player-facing attiva: campi GM-only filtrati.");
  }
  if (input.locationId && !context.location) {
    warnings.push("Location richiesta non trovata o non esportabile con questa audience.");
  }
  return warnings;
}

function appendSessions(lines: string[], rows: NonNullable<ChatGptBridgeContext["recentSessions"]>) {
  if (rows.length === 0) {
    lines.push("_Nessuna sessione inclusa._");
    return;
  }
  for (const row of rows) {
    lines.push(`#### Sessione ${row.number}${row.title ? ` - ${row.title}` : ""}`);
    appendMaybe(lines, "Recap", row.recap);
    appendMaybe(lines, "Note GM", row.dmNotes);
    appendMaybe(lines, "Prep", row.prepNotes);
    lines.push("");
  }
}

function appendPlotThreads(lines: string[], rows: NonNullable<ChatGptBridgeContext["plotThreads"]>) {
  if (rows.length === 0) {
    lines.push("_Nessun plot thread incluso._");
    return;
  }
  for (const row of rows) {
    lines.push(`- **${row.title}** (${row.status}${row.priority ? `, P${row.priority}` : ""})`);
    appendMaybe(lines, "  Pubblico", row.publicDescription);
    appendMaybe(lines, "  GM", row.description);
  }
}

function appendTruthClues(
  lines: string[],
  rows: NonNullable<ChatGptBridgeContext["truthClues"]>,
  audience: "gm" | "player",
) {
  if (rows.length === 0) {
    lines.push("_Nessuna briciola inclusa._");
    return;
  }
  for (const row of rows) {
    lines.push(`- **${row.status}**: ${row.description}`);
    if (audience === "gm") appendMaybe(lines, "  Verita", row.truthRevealed);
    appendMaybe(lines, "  Note stato", row.statusNotes);
  }
}

function appendSecrets(lines: string[], rows: NonNullable<ChatGptBridgeContext["secrets"]>) {
  if (rows.length === 0) {
    lines.push("_Nessun segreto incluso._");
    return;
  }
  for (const row of rows) {
    const target = row.entityName ?? row.plotThreadTitle ?? "target non specificato";
    lines.push(`- **${target}** [${row.layer}]: ${row.content}`);
    appendMaybe(lines, "  Exploit", row.exploitHint);
  }
}

function appendPcHooks(lines: string[], rows: NonNullable<ChatGptBridgeContext["pcHooks"]>) {
  if (rows.length === 0) {
    lines.push("_Nessun PC hook incluso._");
    return;
  }
  for (const row of rows) {
    lines.push(`- **${row.pcName} -> ${row.targetName}** (${row.status}): ${row.hookDescription}`);
    appendMaybe(lines, "  Arco", row.potentialArc);
  }
}

function appendEntities(lines: string[], rows: NonNullable<ChatGptBridgeContext["factions"]>) {
  if (rows.length === 0) {
    lines.push("_Nessuna fazione inclusa._");
    return;
  }
  for (const row of rows) {
    lines.push(`- **${row.name}** (${row.type}, ${row.visibility})`);
    appendMaybe(lines, "  Pubblico", row.publicDescription);
    appendMaybe(lines, "  GM", row.description);
  }
}

function appendPlayerFacingState(
  lines: string[],
  state: ChatGptBridgeContext["playerFacingState"],
) {
  if (!state) {
    lines.push("_Player-facing state non incluso._");
    return;
  }
  appendMaybe(lines, "Scena", state.sceneTitle);
  appendMaybe(lines, "Testo scena", state.sceneText);
  if (state.activeEntities.length > 0) {
    lines.push("Entita attive:");
    for (const entity of state.activeEntities) {
      lines.push(`- ${entity.name}${entity.publicDescription ? `: ${entity.publicDescription}` : ""}`);
    }
  }
}

function appendMaybe(lines: string[], label: string, value: string | null | undefined) {
  const trimmed = value?.trim();
  if (trimmed) lines.push(`${label}: ${trimmed}`);
}

function updatePackInstructions(sessionNumber?: number) {
  const n = sessionNumber ?? 1;
  return [
    "Alla fine aggiungi anche questo blocco JSON dentro una sezione separata:",
    "",
    "# UPDATE PACK PER SHERDAN-DM-TOOLS",
    "",
    "```json",
    JSON.stringify(
      {
        session: {
          number: n,
          title: "...",
          recapCandidate: "...",
          dmNotesCandidate: "...",
        },
        plotThreadUpdates: [
          { title: "...", suggestedStatus: "hot", event: "..." },
        ],
        truthClueUpdates: [
          {
            description: "...",
            status: "planted",
            truthRevealed: "...",
          },
        ],
        npcUpdates: [{ name: "...", state: "...", nextMove: "..." }],
        newHooks: [{ pc: "...", target: "...", hookDescription: "..." }],
        newIdentities: [
          {
            entity: "...",
            name: "...",
            isTrueIdentity: false,
            appearance: "...",
            voice: "...",
            mannerisms: ["..."],
            visibility: "dm_only",
            notes: "...",
          },
        ],
        newSecrets: [
          {
            entity: "...",
            plotThread: "...",
            layer: "surface",
            content: "...",
            exploitHint: "...",
          },
        ],
        newLinks: [
          {
            source: "...",
            target: "...",
            relationType: "ally",
            publicRelationType: "...",
            strength: 3,
            description: "...",
            visibility: "dm_only",
          },
        ],
      },
      null,
      2,
    ),
    "```",
  ].join("\n");
}

function filenameFor(input: ChatGptBridgeExportInput, campaignName?: string) {
  const date = new Date().toISOString().slice(0, 10);
  const campaign = slug(campaignName ?? "sherdan");
  const session = input.sessionNumber ? `_sessione_${input.sessionNumber}` : "";
  return `chatgpt_${campaign}${session}_${slug(input.density)}_${date}.md`;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
