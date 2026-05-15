export type ContradictionSeverity = "high" | "medium" | "low";

export interface ContradictionIssue {
  id: string;
  severity: ContradictionSeverity;
  category:
    | "duplicate_name"
    | "alias_collision"
    | "identity_conflict"
    | "relationship_conflict"
    | "visibility_gap"
    | "plot_state"
    | "clue_state";
  title: string;
  detail: string;
  targets: Array<{
    type:
      | "entity"
      | "identity"
      | "link"
      | "plot_thread"
      | "truth_clue";
    id: string;
    label: string;
    entityId?: string;
  }>;
  suggestedAction: string;
  ignored?: boolean;
}

export interface ContradictionSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  ignored?: number;
}

export interface ContradictionReport {
  issues: ContradictionIssue[];
  summary: ContradictionSummary;
}

interface EntityRow {
  id: string;
  type: string;
  name: string;
  visibility: string;
  publicDescription: string | null;
}

interface IdentityRow {
  id: string;
  entityId: string;
  entityName: string;
  name: string;
  isTrueIdentity: boolean;
}

interface LinkRow {
  id: string;
  sourceEntityId: string;
  sourceName: string;
  targetEntityId: string;
  targetName: string;
  relationType: string;
  publicRelationType: string | null;
}

interface PlotThreadRow {
  id: string;
  title: string;
  status: string;
  visibility: string;
  publicDescription: string | null;
}

interface TruthClueRow {
  id: string;
  description: string;
  truthRevealed: string;
  status: string;
  relatedPlotThreadId: string | null;
  plotThreadTitle: string | null;
  plotThreadStatus: string | null;
  plantedInSession: string | null;
}

export function detectCampaignContradictions(input: {
  entities: EntityRow[];
  identities: IdentityRow[];
  links: LinkRow[];
  plotThreads: PlotThreadRow[];
  truthClues: TruthClueRow[];
}): ContradictionReport {
  const issues: ContradictionIssue[] = [
    ...detectDuplicateEntityNames(input.entities),
    ...detectAliasCollisions(input.entities, input.identities),
    ...detectTrueIdentityConflicts(input.identities),
    ...detectRelationshipConflicts(input.links),
    ...detectVisibilityGaps(input.entities, input.plotThreads),
    ...detectPlotStateConflicts(input.truthClues),
    ...detectClueStateGaps(input.truthClues),
  ].sort(compareIssues);

  return {
    issues,
    summary: {
      total: issues.length,
      high: issues.filter((issue) => issue.severity === "high").length,
      medium: issues.filter((issue) => issue.severity === "medium").length,
      low: issues.filter((issue) => issue.severity === "low").length,
    },
  };
}

function detectDuplicateEntityNames(entities: EntityRow[]) {
  return grouped(entities, (entity) => normalizeKey(entity.name))
    .filter((group) => group.rows.length > 1 && group.key !== "")
    .map<ContradictionIssue>((group) => ({
      id: `duplicate-name:${group.key}`,
      severity: "high",
      category: "duplicate_name",
      title: `Nome entity duplicato: ${group.rows[0]?.name ?? group.key}`,
      detail: "Piu entity della stessa campagna condividono lo stesso nome normalizzato.",
      targets: group.rows.map((entity) => ({
        type: "entity",
        id: entity.id,
        label: `${entity.name} (${entity.type})`,
      })),
      suggestedAction:
        "Unifica le entity duplicate o differenzia il nome canonico con un alias/qualificatore.",
    }));
}

function detectAliasCollisions(entities: EntityRow[], identities: IdentityRow[]) {
  const entityNameRows = entities.map((entity) => ({
    key: normalizeKey(entity.name),
    entityId: entity.id,
    id: entity.id,
    label: entity.name,
    type: "entity" as const,
  }));
  const identityRows = identities.map((identity) => ({
    key: normalizeKey(identity.name),
    entityId: identity.entityId,
    id: identity.id,
    label: `${identity.name} -> ${identity.entityName}`,
    type: "identity" as const,
  }));

  return grouped([...entityNameRows, ...identityRows], (row) => row.key)
    .filter((group) => new Set(group.rows.map((row) => row.entityId)).size > 1)
    .map<ContradictionIssue>((group) => ({
      id: `alias-collision:${group.key}`,
      severity: "high",
      category: "alias_collision",
      title: `Alias/nome conteso: ${group.rows[0]?.label ?? group.key}`,
      detail:
        "Lo stesso nome o alias punta a piu entity diverse; il matching del Bridge e la wiki possono diventare ambigui.",
      targets: group.rows.map((row) => ({
        type: row.type,
        id: row.id,
        label: row.label,
        entityId: row.entityId,
      })),
      suggestedAction:
        "Sposta l'alias sull'entity corretta o aggiungi un qualificatore nel nome esposto.",
    }));
}

function detectTrueIdentityConflicts(identities: IdentityRow[]) {
  return grouped(
    identities.filter((identity) => identity.isTrueIdentity),
    (identity) => identity.entityId,
  )
    .filter((group) => group.rows.length > 1)
    .map<ContradictionIssue>((group) => ({
      id: `true-identity:${group.key}`,
      severity: "medium",
      category: "identity_conflict",
      title: `Troppe identita vere per ${group.rows[0]?.entityName ?? "entity"}`,
      detail:
        "Una entity ha piu identita marcate come vera identita. Potrebbe essere voluto, ma va reso esplicito nelle note.",
      targets: group.rows.map((identity) => ({
        type: "identity",
        id: identity.id,
        label: identity.name,
        entityId: identity.entityId,
      })),
      suggestedAction:
        "Lascia una sola identita vera oppure sposta le altre a maschera/alias con note GM.",
    }));
}

function detectRelationshipConflicts(links: LinkRow[]) {
  const issues: ContradictionIssue[] = [];

  for (const group of grouped(
    links,
    (link) => `${link.sourceEntityId}:${link.targetEntityId}:${normalizeKey(link.relationType)}`,
  )) {
    if (group.rows.length <= 1) continue;
    const first = group.rows[0];
    issues.push({
      id: `duplicate-link:${group.key}`,
      severity: "medium",
      category: "relationship_conflict",
      title: `Link duplicato: ${first?.sourceName ?? "source"} -> ${first?.targetName ?? "target"}`,
      detail:
        "Stesso source, target e relation_type compaiono piu volte. Il grafo puo sovrapesare la relazione.",
      targets: group.rows.map(linkTarget),
      suggestedAction:
        "Fondi i link duplicati o differenzia relation_type/description se rappresentano fatti diversi.",
    });
  }

  for (const group of grouped(links, unorderedPairKey)) {
    const polarities = new Set(group.rows.map((link) => relationPolarity(link.relationType)));
    if (!polarities.has("positive") || !polarities.has("negative")) continue;
    const first = group.rows[0];
    issues.push({
      id: `relationship-polarity:${group.key}`,
      severity: "medium",
      category: "relationship_conflict",
      title: `Relazione ambivalente: ${first?.sourceName ?? "source"} / ${first?.targetName ?? "target"}`,
      detail:
        "La stessa coppia ha link con polarita positiva e negativa. In Sherdan puo essere intenzionale, ma va chiarito con relazione pubblica vs reale.",
      targets: group.rows.map(linkTarget),
      suggestedAction:
        "Se e propaganda vs verita, usa publicRelationType/description; altrimenti correggi il relation_type incoerente.",
    });
  }

  return issues;
}

function detectVisibilityGaps(
  entities: EntityRow[],
  plotThreads: PlotThreadRow[],
) {
  const entityIssues = entities
    .filter(
      (entity) =>
        entity.visibility !== "dm_only" && !hasText(entity.publicDescription),
    )
    .map<ContradictionIssue>((entity) => ({
      id: `entity-public-gap:${entity.id}`,
      severity: "low",
      category: "visibility_gap",
      title: `Entity visibile senza descrizione pubblica: ${entity.name}`,
      detail:
        "Un target player-facing senza publicDescription rischia di mostrare contenuto vuoto o spingere il DM a usare description GM.",
      targets: [{ type: "entity", id: entity.id, label: entity.name }],
      suggestedAction:
        "Aggiungi una publicDescription breve e player-safe oppure riporta visibility a dm_only.",
    }));

  const plotIssues = plotThreads
    .filter(
      (thread) =>
        thread.visibility !== "dm_only" && !hasText(thread.publicDescription),
    )
    .map<ContradictionIssue>((thread) => ({
      id: `plot-public-gap:${thread.id}`,
      severity: "low",
      category: "visibility_gap",
      title: `Plot visibile senza descrizione pubblica: ${thread.title}`,
      detail:
        "Il thread e player-facing ma non ha una versione percepita/pubblica.",
      targets: [{ type: "plot_thread", id: thread.id, label: thread.title }],
      suggestedAction:
        "Compila publicDescription con la versione che il party conosce.",
    }));

  return [...entityIssues, ...plotIssues];
}

function detectPlotStateConflicts(clues: TruthClueRow[]) {
  return clues
    .filter(
      (clue) =>
        clue.plotThreadStatus === "resolved" &&
        ["planted", "noticed", "misinterpreted"].includes(clue.status),
    )
    .map<ContradictionIssue>((clue) => ({
      id: `resolved-thread-open-clue:${clue.id}`,
      severity: "medium",
      category: "plot_state",
      title: `Briciola aperta su thread risolto: ${clue.description}`,
      detail: `Il thread "${clue.plotThreadTitle ?? "sconosciuto"}" e risolto, ma la briciola e ancora ${clue.status}.`,
      targets: [
        { type: "truth_clue", id: clue.id, label: clue.description },
        ...(clue.relatedPlotThreadId && clue.plotThreadTitle
          ? [
              {
                type: "plot_thread" as const,
                id: clue.relatedPlotThreadId,
                label: clue.plotThreadTitle,
              },
            ]
          : []),
      ],
      suggestedAction:
        "Chiudi la briciola come understood/lost oppure riapri il thread se il payoff non e davvero risolto.",
    }));
}

function detectClueStateGaps(clues: TruthClueRow[]) {
  return clues
    .filter(
      (clue) =>
        ["noticed", "misinterpreted", "understood"].includes(clue.status) &&
        !clue.plantedInSession,
    )
    .map<ContradictionIssue>((clue) => ({
      id: `clue-no-session:${clue.id}`,
      severity: "low",
      category: "clue_state",
      title: `Briciola avanzata senza sessione: ${clue.description}`,
      detail:
        "La briciola risulta gia vista/capita, ma non e collegata alla sessione in cui e stata piantata.",
      targets: [{ type: "truth_clue", id: clue.id, label: clue.description }],
      suggestedAction:
        "Collega plantedInSession alla sessione corretta per mantenere audit e recap coerenti.",
    }));
}

function grouped<T>(rows: T[], keyFor: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return [...map.entries()].map(([key, groupedRows]) => ({
    key,
    rows: groupedRows,
  }));
}

function linkTarget(link: LinkRow) {
  return {
    type: "link" as const,
    id: link.id,
    label: `${link.sourceName} -> ${link.targetName}: ${link.relationType}`,
    entityId: link.sourceEntityId,
  };
}

function unorderedPairKey(link: LinkRow) {
  return [link.sourceEntityId, link.targetEntityId].sort().join(":");
}

function relationPolarity(relationType: string) {
  const key = normalizeKey(relationType);
  if (/(enemy|rival|hostile|hates|hunt|blackmail|manipulat|betray|threat|nemic|rivale|ostile)/.test(key)) {
    return "negative";
  }
  if (/(ally|friend|trust|love|protect|mentor|alleat|amic|fidat|proteg|mentore)/.test(key)) {
    return "positive";
  }
  return "neutral";
}

function compareIssues(a: ContradictionIssue, b: ContradictionIssue) {
  const severityOrder: Record<ContradictionSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title);
}

function hasText(value: string | null) {
  return Boolean(value?.trim());
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(il|lo|la|l|i|gli|le|un|uno|una|the|a|an)\b/g, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}
