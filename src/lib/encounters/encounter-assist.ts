import { z } from "zod";

import { callStructuredOutput, type GeneratorPrompt } from "@/lib/generators";
import type { GeneratorRunOptions } from "@/lib/generators";

import {
  encounterSuggesterDifficultyOptions,
  type EncounterCompositionSuggestion,
  type EncounterSuggesterDifficulty,
} from "./encounter-suggester";

export const encounterAssistInputSchema = z
  .object({
    campaignId: z.uuid(),
    brief: z.string().trim().min(5).max(500),
    partyLevel: z.coerce.number().int().min(1).max(20),
    partySize: z.coerce.number().int().min(1).max(8),
    difficulty: z.enum(encounterSuggesterDifficultyOptions),
    creatureType: z.string().trim().min(1).optional(),
    environment: z.string().trim().min(1).optional(),
    size: z.string().trim().min(1).optional(),
  })
  .strict();

export const encounterAssistLLMOutputSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    concept: z.string().trim().min(1),
    selected_candidate_index: z.number().int().min(0),
    tactical_notes: z
      .object({
        terrain: z.string().trim().min(1),
        opening: z.string().trim().min(1),
        monster_tactics: z.array(z.string().trim().min(1)).min(1),
        escalation: z.string().trim().min(1),
        retreat_or_surrender: z.string().trim().min(1),
      })
      .strict(),
    variants: z.array(z.string().trim().min(1)).default([]),
    gm_notes: z.array(z.string().trim().min(1)).default([]),
    narrative_hooks: z
      .object({
        truth_revelations: z.array(z.string().trim().min(1)).default([]),
        plot_complications: z.array(z.string().trim().min(1)).default([]),
        pc_hooks: z.array(z.string().trim().min(1)).default([]),
      })
      .strict()
      .default({
        truth_revelations: [],
        plot_complications: [],
        pc_hooks: [],
      }),
  })
  .strict();

export type EncounterAssistInput = z.infer<typeof encounterAssistInputSchema>;
export type EncounterAssistLLMOutput = z.infer<
  typeof encounterAssistLLMOutputSchema
>;

export interface EncounterAssistOutput {
  title: string;
  concept: string;
  selectedCandidateIndex: number;
  selectedCandidate: EncounterCompositionSuggestion;
  constraintReport: {
    targetDifficulty: EncounterSuggesterDifficulty | null;
    selectedDifficulty: string;
    adjustedXp: number;
    baseXp: number;
    multiplier: number;
    respectsTarget: boolean;
  };
  tacticalNotes: EncounterAssistLLMOutput["tactical_notes"];
  variants: string[];
  gmNotes: string[];
  narrativeHooks: EncounterAssistLLMOutput["narrative_hooks"];
  candidates: EncounterCompositionSuggestion[];
}

export interface EncounterNarrativeContext {
  plotThreads: Array<{
    id: string;
    title: string;
    status: string;
    publicDescription: string | null;
    description: string | null;
  }>;
  truthClues: Array<{
    id: string;
    description: string;
    truthRevealed: string;
    status: string;
    relatedPlotThreadId: string | null;
  }>;
  pcHooks: Array<{
    id: string;
    pcEntityId: string;
    targetEntityId: string;
    hookDescription: string;
    potentialArc: string | null;
    status: string;
  }>;
}

export function buildEncounterAssistPrompt(input: {
  request: EncounterAssistInput;
  candidates: EncounterCompositionSuggestion[];
  narrativeContext?: EncounterNarrativeContext;
}): GeneratorPrompt {
  return {
    input: [
      {
        role: "system",
        content: [
          "Sei un encounter designer per una campagna D&D 5e.",
          "Devi scegliere una composizione SOLO tra le candidate fornite.",
          "Non inventare mostri, statblock o XP: la matematica DMG e' gia' stata calcolata.",
          "Scrivi tactical notes concrete, giocabili al tavolo, in italiano.",
          "La risposta finale deve essere un JSON object valido, senza markdown esterno.",
        ].join("\n"),
      },
      {
        role: "user",
        content: renderEncounterAssistUserPrompt(
          input.request,
          input.candidates,
          input.narrativeContext,
        ),
      },
    ],
    options: {
      temperature: 0.45,
      maxTokens: 1800,
      thinking: false,
    },
  };
}

export async function generateEncounterAssist(
  request: EncounterAssistInput,
  candidates: EncounterCompositionSuggestion[],
  narrativeContext?: EncounterNarrativeContext,
  options: GeneratorRunOptions = {},
): Promise<EncounterAssistOutput> {
  const prompt = buildEncounterAssistPrompt({
    request,
    candidates,
    narrativeContext,
  });
  const llmOutput = await callStructuredOutput(
    prompt,
    encounterAssistLLMOutputSchema,
    options,
  );
  return composeEncounterAssistOutput(llmOutput, candidates, request.difficulty);
}

export function composeEncounterAssistOutput(
  llmOutput: EncounterAssistLLMOutput,
  candidates: EncounterCompositionSuggestion[],
  targetDifficulty: EncounterSuggesterDifficulty | null = null,
): EncounterAssistOutput {
  const selectedCandidate = selectConstrainedCandidate(
    llmOutput.selected_candidate_index,
    candidates,
    targetDifficulty,
  );
  if (!selectedCandidate) {
    throw new Error("Nessuna candidate encounter disponibile");
  }
  const selectedCandidateIndex = candidates.indexOf(selectedCandidate);

  return {
    title: llmOutput.title,
    concept: llmOutput.concept,
    selectedCandidateIndex,
    selectedCandidate,
    constraintReport: {
      targetDifficulty,
      selectedDifficulty: selectedCandidate.difficulty.difficulty,
      adjustedXp: selectedCandidate.difficulty.adjustedXp,
      baseXp: selectedCandidate.difficulty.baseXp,
      multiplier: selectedCandidate.difficulty.multiplier,
      respectsTarget:
        targetDifficulty === null ||
        selectedCandidate.difficulty.difficulty === targetDifficulty,
    },
    tacticalNotes: llmOutput.tactical_notes,
    variants: llmOutput.variants,
    gmNotes: llmOutput.gm_notes,
    narrativeHooks: llmOutput.narrative_hooks,
    candidates,
  };
}

function selectConstrainedCandidate(
  selectedIndex: number,
  candidates: EncounterCompositionSuggestion[],
  targetDifficulty: EncounterSuggesterDifficulty | null,
): EncounterCompositionSuggestion | undefined {
  const selected = candidates[selectedIndex];
  if (
    selected &&
    (targetDifficulty === null ||
      selected.difficulty.difficulty === targetDifficulty)
  ) {
    return selected;
  }

  if (targetDifficulty !== null) {
    const matching = candidates.find(
      (candidate) => candidate.difficulty.difficulty === targetDifficulty,
    );
    if (matching) return matching;
  }

  return candidates[0];
}

function renderEncounterAssistUserPrompt(
  request: EncounterAssistInput,
  candidates: EncounterCompositionSuggestion[],
  narrativeContext: EncounterNarrativeContext | undefined,
): string {
  return [
    "# Encounter Assist Request",
    "",
    "## DM Brief",
    request.brief,
    "",
    "## Constraints",
    `- party level: ${request.partyLevel}`,
    `- party size: ${request.partySize}`,
    `- target difficulty: ${request.difficulty}`,
    request.environment ? `- environment filter: ${request.environment}` : null,
    request.creatureType ? `- creature type filter: ${request.creatureType}` : null,
    request.size ? `- size filter: ${request.size}` : null,
    "",
    "## Candidate Compositions",
    candidates.length > 0
      ? candidates.map(renderCandidate).join("\n\n")
      : "_Nessuna candidate disponibile._",
    "",
    "## Narrative Context",
    renderNarrativeContext(narrativeContext),
    "",
    "## Output Contract",
    `Return exactly this JSON shape:
{
  "title": "string",
  "concept": "string",
  "selected_candidate_index": 0,
  "tactical_notes": {
    "terrain": "string",
    "opening": "string",
    "monster_tactics": ["string"],
    "escalation": "string",
    "retreat_or_surrender": "string"
  },
  "variants": ["string"],
  "gm_notes": ["string"],
  "narrative_hooks": {
    "truth_revelations": ["string"],
    "plot_complications": ["string"],
    "pc_hooks": ["string"]
  }
}`,
    "",
    "## Quality Bar",
    "- `selected_candidate_index` deve essere l'indice di una candidate sopra.",
    "- Le tactical notes devono usare le creature scelte e il tema del brief.",
    "- Evita prosa generica: includi posizione iniziale, priorita' tattiche, escalation e fallback.",
    "- Se il contesto narrativo e' presente, proponi hook usabili come rivelazione di briciole di verita', complicazione di plot thread o aggancio per un PG.",
    "- Non rivelare direttamente una verita' deep ai giocatori: trasformala in segno osservabile o complicazione graduata.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function renderNarrativeContext(
  narrativeContext: EncounterNarrativeContext | undefined,
): string {
  if (!narrativeContext) {
    return "_Nessun contesto narrativo recuperato._";
  }

  const sections = [
    renderPlotThreads(narrativeContext.plotThreads),
    renderTruthClues(narrativeContext.truthClues),
    renderPcHooks(narrativeContext.pcHooks),
  ].filter(Boolean);

  return sections.length > 0
    ? sections.join("\n\n")
    : "_Nessun contesto narrativo rilevante disponibile._";
}

function renderPlotThreads(
  threads: EncounterNarrativeContext["plotThreads"],
): string {
  if (threads.length === 0) return "";
  return [
    "### Plot Threads",
    ...threads.map((thread) =>
      [
        `- ${thread.title} (${thread.status})`,
        thread.publicDescription
          ? `  - party view: ${thread.publicDescription}`
          : null,
        thread.description ? `  - GM truth: ${thread.description}` : null,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    ),
  ].join("\n");
}

function renderTruthClues(
  clues: EncounterNarrativeContext["truthClues"],
): string {
  if (clues.length === 0) return "";
  return [
    "### Truth Clues",
    ...clues.map(
      (clue) =>
        `- ${clue.description} [${clue.status}] -> ${clue.truthRevealed}`,
    ),
  ].join("\n");
}

function renderPcHooks(hooks: EncounterNarrativeContext["pcHooks"]): string {
  if (hooks.length === 0) return "";
  return [
    "### PC Hooks",
    ...hooks.map((hook) =>
      [
        `- ${hook.hookDescription} [${hook.status}]`,
        hook.potentialArc ? `  - arc: ${hook.potentialArc}` : null,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    ),
  ].join("\n");
}

function renderCandidate(
  candidate: EncounterCompositionSuggestion,
  index: number,
): string {
  return [
    `### Candidate ${index}`,
    `- difficulty: ${candidate.difficulty.difficulty}`,
    `- base XP: ${candidate.difficulty.baseXp}`,
    `- adjusted XP: ${candidate.difficulty.adjustedXp}`,
    `- multiplier: ${candidate.difficulty.multiplier}`,
    "- monsters:",
    ...candidate.participants.map(
      (participant) =>
        `  - ${participant.count}x ${participant.monster.name} (CR ${participant.monster.challengeRating}, ${participant.monster.xp} XP, ${participant.monster.creatureType}, ${participant.monster.size})`,
    ),
  ].join("\n");
}
