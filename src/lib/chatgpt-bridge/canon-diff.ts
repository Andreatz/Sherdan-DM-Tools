export interface CanonDiffSection {
  label: string;
  similarity: number;
  added: string[];
  removed: string[];
}

export interface CanonDiffField {
  field: "title" | "recap" | "dmNotes" | "prepNotes";
  label: string;
  source: "update_pack" | "markdown_heading" | "markdown_title" | "missing";
  similarity: number;
  changed: boolean;
  imported: string | null;
  canon: string | null;
  added: string[];
  removed: string[];
}

export interface CanonDiffResult {
  comparedTo: string;
  sections: CanonDiffSection[];
  fields?: CanonDiffField[];
  fieldSummary?: {
    total: number;
    changed: number;
    missing: number;
    averageSimilarity: number;
  };
}

export function buildCanonDiff(input: {
  importedMarkdown: string;
  comparedTo: string;
  canonSections: Array<{ label: string; markdown: string | null | undefined }>;
  fieldSections?: Array<{
    field: CanonDiffField["field"];
    label: string;
    canon: string | null | undefined;
    imported: string | null | undefined;
    source: CanonDiffField["source"];
  }>;
}): CanonDiffResult {
  const importedLines = meaningfulLines(input.importedMarkdown);
  const fields = input.fieldSections?.map((field) =>
    buildFieldDiff({
      ...field,
      canon: field.canon ?? null,
      imported: field.imported ?? null,
    }),
  );
  return {
    comparedTo: input.comparedTo,
    sections: input.canonSections.map((section) => {
      const canonLines = meaningfulLines(section.markdown ?? "");
      return {
        label: section.label,
        similarity: jaccardSimilarity(importedLines, canonLines),
        added: diffLines(importedLines, canonLines).slice(0, 12),
        removed: diffLines(canonLines, importedLines).slice(0, 12),
      };
    }),
    ...(fields
      ? {
          fields,
          fieldSummary: summarizeFields(fields),
        }
      : {}),
  };
}

export function buildSessionCanonDiff(input: {
  importedMarkdown: string;
  comparedTo: string;
  session: {
    title: string | null;
    recap: string | null;
    dmNotes: string | null;
    prepNotes: string | null;
  };
  updatePack?: unknown;
}) {
  const candidates = extractSessionFieldCandidates({
    markdown: input.importedMarkdown,
    updatePack: input.updatePack,
  });

  return buildCanonDiff({
    importedMarkdown: input.importedMarkdown,
    comparedTo: input.comparedTo,
    canonSections: [
      { label: "Recap", markdown: input.session.recap },
      { label: "DM notes", markdown: input.session.dmNotes },
      { label: "Prep notes", markdown: input.session.prepNotes },
    ],
    fieldSections: [
      {
        field: "title",
        label: "Titolo",
        canon: input.session.title,
        imported: candidates.title.value,
        source: candidates.title.source,
      },
      {
        field: "recap",
        label: "Recap",
        canon: input.session.recap,
        imported: candidates.recap.value,
        source: candidates.recap.source,
      },
      {
        field: "dmNotes",
        label: "DM notes",
        canon: input.session.dmNotes,
        imported: candidates.dmNotes.value,
        source: candidates.dmNotes.source,
      },
      {
        field: "prepNotes",
        label: "Prep notes",
        canon: input.session.prepNotes,
        imported: candidates.prepNotes.value,
        source: candidates.prepNotes.source,
      },
    ],
  });
}

function buildFieldDiff(input: {
  field: CanonDiffField["field"];
  label: string;
  source: CanonDiffField["source"];
  canon: string | null;
  imported: string | null;
}): CanonDiffField {
  const canonLines = meaningfulLines(input.canon ?? "");
  const importedLines = meaningfulLines(input.imported ?? "");
  const similarity =
    input.imported === null ? 0 : jaccardSimilarity(importedLines, canonLines);
  return {
    field: input.field,
    label: input.label,
    source: input.imported === null ? "missing" : input.source,
    similarity,
    changed:
      input.imported !== null &&
      normalizeComparable(input.imported) !== normalizeComparable(input.canon ?? ""),
    imported: input.imported,
    canon: input.canon,
    added: diffLines(importedLines, canonLines).slice(0, 8),
    removed: diffLines(canonLines, importedLines).slice(0, 8),
  };
}

function summarizeFields(fields: CanonDiffField[]) {
  const comparable = fields.filter((field) => field.source !== "missing");
  const average =
    comparable.length === 0
      ? 0
      : comparable.reduce((sum, field) => sum + field.similarity, 0) /
        comparable.length;
  return {
    total: fields.length,
    changed: fields.filter((field) => field.changed).length,
    missing: fields.filter((field) => field.source === "missing").length,
    averageSimilarity: Math.round(average * 100) / 100,
  };
}

function extractSessionFieldCandidates(input: {
  markdown: string;
  updatePack?: unknown;
}): Record<
  CanonDiffField["field"],
  { value: string | null; source: CanonDiffField["source"] }
> {
  const session = asRecord(asRecord(input.updatePack).session);
  const headings = extractHeadingSections(input.markdown);
  return {
    title: candidate(
      textValue(session.title),
      "update_pack",
      extractMarkdownTitle(input.markdown),
      "markdown_title",
    ),
    recap: candidate(
      textValue(session.recapCandidate),
      "update_pack",
      findHeadingSection(headings, ["recap", "riepilogo", "riassunto"]),
      "markdown_heading",
    ),
    dmNotes: candidate(
      textValue(session.dmNotesCandidate),
      "update_pack",
      findHeadingSection(headings, [
        "dm notes",
        "note dm",
        "appunti dm",
        "debrief",
      ]),
      "markdown_heading",
    ),
    prepNotes: candidate(
      textValue(session.prepNotesCandidate),
      "update_pack",
      findHeadingSection(headings, [
        "prep notes",
        "note prep",
        "appunti prep",
        "preparazione",
      ]),
      "markdown_heading",
    ),
  };
}

function candidate(
  primary: string | null,
  primarySource: CanonDiffField["source"],
  fallback: string | null,
  fallbackSource: CanonDiffField["source"],
) {
  if (primary) return { value: primary, source: primarySource };
  if (fallback) return { value: fallback, source: fallbackSource };
  return { value: null, source: "missing" as const };
}

function extractMarkdownTitle(markdown: string) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || null;
}

function extractHeadingSections(markdown: string) {
  const sections: Array<{ heading: string; body: string }> = [];
  const lines = markdown.split(/\r?\n/);
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (match) {
      if (current) {
        sections.push({
          heading: current.heading,
          body: current.body.join("\n").trim(),
        });
      }
      current = { heading: match[2] ?? "", body: [] };
      continue;
    }
    current?.body.push(line);
  }

  if (current) {
    sections.push({
      heading: current.heading,
      body: current.body.join("\n").trim(),
    });
  }

  return sections;
}

function findHeadingSection(
  sections: Array<{ heading: string; body: string }>,
  aliases: string[],
) {
  const aliasKeys = aliases.map(normalizeLine);
  const section = sections.find((item) => {
    const key = normalizeLine(item.heading);
    return aliasKeys.some((alias) => key === alias || key.includes(alias));
  });
  return section?.body || null;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function meaningfulLines(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("# UPDATE PACK"))
    .map((line) => line.replace(/\s+/g, " "));
}

function diffLines(left: string[], right: string[]) {
  const rightKeys = new Set(right.map(normalizeLine));
  return left.filter((line) => !rightKeys.has(normalizeLine(line)));
}

function jaccardSimilarity(left: string[], right: string[]) {
  const a = new Set(left.map(normalizeLine));
  const b = new Set(right.map(normalizeLine));
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  return Math.round((intersection / union) * 100) / 100;
}

function normalizeLine(line: string) {
  return line
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function normalizeComparable(value: string) {
  return meaningfulLines(value).map(normalizeLine).join("\n");
}
