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
  candidates: EncounterCompositionSuggestion[];
}

export function buildEncounterAssistPrompt(input: {
  request: EncounterAssistInput;
  candidates: EncounterCompositionSuggestion[];
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
        content: renderEncounterAssistUserPrompt(input.request, input.candidates),
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
  options: GeneratorRunOptions = {},
): Promise<EncounterAssistOutput> {
  const prompt = buildEncounterAssistPrompt({ request, candidates });
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
  "gm_notes": ["string"]
}`,
    "",
    "## Quality Bar",
    "- `selected_candidate_index` deve essere l'indice di una candidate sopra.",
    "- Le tactical notes devono usare le creature scelte e il tema del brief.",
    "- Evita prosa generica: includi posizione iniziale, priorita' tattiche, escalation e fallback.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
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
