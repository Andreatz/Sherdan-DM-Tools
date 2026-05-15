export interface CanonDiffSection {
  label: string;
  similarity: number;
  added: string[];
  removed: string[];
}

export interface CanonDiffResult {
  comparedTo: string;
  sections: CanonDiffSection[];
}

export function buildCanonDiff(input: {
  importedMarkdown: string;
  comparedTo: string;
  canonSections: Array<{ label: string; markdown: string | null | undefined }>;
}): CanonDiffResult {
  const importedLines = meaningfulLines(input.importedMarkdown);
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
  };
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
