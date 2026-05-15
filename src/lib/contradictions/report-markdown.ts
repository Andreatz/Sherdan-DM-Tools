import type { ContradictionIssue, ContradictionReport } from "./detector";

export function buildContradictionReportMarkdown(input: {
  campaignName: string;
  generatedAt?: Date;
  report: ContradictionReport;
}) {
  const generatedAt = input.generatedAt ?? new Date();
  const lines = [
    `# Contradiction Detector - ${input.campaignName}`,
    "",
    `Generato: ${generatedAt.toLocaleString("it-IT")}`,
    "",
    "## Summary",
    "",
    `- Totale: ${input.report.summary.total}`,
    `- Alta: ${input.report.summary.high}`,
    `- Media: ${input.report.summary.medium}`,
    `- Bassa: ${input.report.summary.low}`,
    "",
    "## Issue",
    "",
  ];

  if (input.report.issues.length === 0) {
    lines.push("_Nessuna contraddizione rilevata._");
    return lines.join("\n");
  }

  for (const issue of input.report.issues) {
    lines.push(...issueMarkdown(issue), "");
  }

  return lines.join("\n").trimEnd();
}

function issueMarkdown(issue: ContradictionIssue) {
  return [
    `### [${issue.severity.toUpperCase()}] ${issue.title}`,
    "",
    `Categoria: ${issue.category}`,
    "",
    issue.detail,
    "",
    "Target:",
    ...issue.targets.map(
      (target) => `- ${target.label} (${target.type}: ${target.id})`,
    ),
    "",
    "Azione consigliata:",
    issue.suggestedAction,
    "",
    "Checklist:",
    ...resolutionChecklist(issue).map((step) => `- [ ] ${step}`),
  ];
}

export function resolutionChecklist(issue: ContradictionIssue) {
  switch (issue.category) {
    case "duplicate_name":
      return [
        "Apri Campaign Wiki e confronta le entity coinvolte.",
        "Decidi se sono duplicati reali o omonimi in fiction.",
        "Unifica/correggi il nome canonico oppure aggiungi un qualificatore chiaro.",
      ];
    case "alias_collision":
      return [
        "Apri Campaign Wiki e controlla identita e alias coinvolti.",
        "Sposta l'alias sull'entity corretta o rinominalo.",
        "Rilancia il Detector per verificare che il matching non sia piu ambiguo.",
      ];
    case "identity_conflict":
      return [
        "Apri il pannello Identita dell'entity.",
        "Lascia una sola identita vera oppure documenta esplicitamente il caso eccezionale nelle note GM.",
        "Verifica che le maschere restanti non siano marcate come vera identita.",
      ];
    case "relationship_conflict":
      return [
        "Apri i link entity coinvolti nel Campaign Wiki.",
        "Fondi i duplicati o separa relazione reale e relazione pubblica.",
        "Se il conflitto e intenzionale, compila publicRelationType/description.",
      ];
    case "visibility_gap":
      return [
        "Apri il record nel suo editor canonico.",
        "Aggiungi una publicDescription player-safe oppure riporta la visibility a dm_only.",
        "Controlla Player Dashboard/Bridge player-facing prima del prossimo reveal.",
      ];
    case "plot_state":
      return [
        "Apri Plot Threads e Truth Clue Tracker.",
        "Chiudi la briciola come understood/lost oppure riapri il thread.",
        "Aggiungi un evento di timeline se il payoff e avvenuto in sessione.",
      ];
    case "clue_state":
      return [
        "Apri Truth Clue Tracker.",
        "Collega la briciola alla sessione in cui e stata piantata.",
        "Aggiorna le note status con come il party l'ha interpretata.",
      ];
  }
}
