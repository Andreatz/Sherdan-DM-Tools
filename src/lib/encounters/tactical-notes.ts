export interface TacticalNotesSource {
  title?: string;
  concept?: string;
  selectedCandidateIndex?: number;
  selectedCandidate?: {
    participants: Array<{
      monster: { name: string; challengeRating: string };
      count: number;
    }>;
  };
  constraintReport?: {
    targetDifficulty: string | null;
    selectedDifficulty: string;
    adjustedXp: number;
    baseXp: number;
    multiplier: number;
  };
  tacticalNotes: {
    terrain: string;
    opening: string;
    monster_tactics: string[];
    escalation: string;
    retreat_or_surrender: string;
  };
  narrativeHooks?: {
    truth_revelations: string[];
    plot_complications: string[];
    pc_hooks: string[];
  };
  variants?: string[];
  gmNotes?: string[];
}

export function formatEncounterTacticalNotes(
  source: TacticalNotesSource,
): string {
  const lines = [
    source.title ? `# ${source.title}` : "# Tactical Notes",
    "",
    source.concept ?? null,
    "",
    "## Composition",
    compositionLine(source),
    "",
    "## Difficulty",
    difficultyLine(source),
    "",
    "## Terrain",
    source.tacticalNotes.terrain,
    "",
    "## Opening",
    source.tacticalNotes.opening,
    "",
    "## Monster Tactics",
    ...bulletLines(source.tacticalNotes.monster_tactics),
    "",
    "## Escalation",
    source.tacticalNotes.escalation,
    "",
    "## Retreat or Surrender",
    source.tacticalNotes.retreat_or_surrender,
    "",
    optionalSection("Truth Revelations", source.narrativeHooks?.truth_revelations),
    optionalSection("Plot Complications", source.narrativeHooks?.plot_complications),
    optionalSection("PC Hooks", source.narrativeHooks?.pc_hooks),
    optionalSection("Variants", source.variants),
    optionalSection("GM Notes", source.gmNotes),
  ];

  return lines
    .flatMap((line) => (Array.isArray(line) ? line : [line]))
    .filter((line): line is string => line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compositionLine(source: TacticalNotesSource): string {
  const participants = source.selectedCandidate?.participants ?? [];
  if (participants.length === 0) return "_Da compilare._";
  return participants
    .map(
      (participant) =>
        `- ${participant.count}x ${participant.monster.name} (CR ${participant.monster.challengeRating})`,
    )
    .join("\n");
}

function difficultyLine(source: TacticalNotesSource): string {
  const report = source.constraintReport;
  if (!report) return "_Da calcolare._";
  return [
    `- target: ${report.targetDifficulty ?? "-"}`,
    `- selected: ${report.selectedDifficulty}`,
    `- base XP: ${report.baseXp}`,
    `- multiplier: x${report.multiplier}`,
    `- adjusted XP: ${report.adjustedXp}`,
  ].join("\n");
}

function optionalSection(title: string, items: string[] | undefined): string[] {
  if (!items || items.length === 0) return [];
  return ["", `## ${title}`, ...bulletLines(items)];
}

function bulletLines(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}
