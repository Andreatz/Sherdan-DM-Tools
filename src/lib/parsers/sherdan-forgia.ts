import {
  collectSectionDrafts,
  compactMarkdown,
  countWords,
  normalizedLabel,
  stripHomebreweryDirectives,
  type SectionDraft,
} from "./_homebrewery";

export interface ParsedForgiaDocument {
  source: "sherdan-custom";
  title: string;
  section: string;
  content: string;
  chunkIndex: number;
  metadata: {
    source_file: string;
    source_kind: "forgia";
    heading_level: number;
    heading_line: number;
    chapter: string | null;
    path: string[];
    category: string;
    word_count: number;
  };
}

const MIN_CONTENT_CHARS = 40;

export function parseSherdanForgiaMarkdown(
  markdown: string,
  options: { sourceFile?: string } = {},
): ParsedForgiaDocument[] {
  const sourceFile =
    options.sourceFile ?? "La Forgia di Sherdan - Sistema di Crafting.md";
  const cleanedLines = stripHomebreweryDirectives(markdown);
  const drafts = collectSectionDrafts(cleanedLines, {
    isChapterHeading,
    isDocumentChromeHeading,
  });

  return drafts
    .map((draft, index) => buildForgiaDocument(draft, index, sourceFile))
    .filter((document): document is ParsedForgiaDocument => document !== null)
    .map((document, chunkIndex) => ({
      ...document,
      chunkIndex,
    }));
}

function buildForgiaDocument(
  draft: SectionDraft,
  initialChunkIndex: number,
  sourceFile: string,
): ParsedForgiaDocument | null {
  const content = compactMarkdown(draft.lines.join("\n"));
  if (content.length < MIN_CONTENT_CHARS) return null;

  const path = draft.path.map((heading) => heading.title);
  const section = path.join(" > ");

  return {
    source: "sherdan-custom",
    title: "La Forgia di Sherdan",
    section,
    content,
    chunkIndex: initialChunkIndex,
    metadata: {
      source_file: sourceFile,
      source_kind: "forgia",
      heading_level: draft.heading.level,
      heading_line: draft.heading.line,
      chapter: draft.chapter,
      path,
      category: inferCategory(section, path),
      word_count: countWords(content),
    },
  };
}

// Chapters: divisori narrativi senza contenuto proprio. "PARTE I/II/III"
// e "Regole" sono tag di sezione, non sezioni-foglia.
function isChapterHeading(title: string): boolean {
  const normalized = normalizedLabel(title);
  return (
    /^parte\s+[ivxlcdm]+$/.test(normalized) ||
    normalized === "regole"
  );
}

// Chrome di documento: titolo, sottotitolo, indice. Saltati.
function isDocumentChromeHeading(title: string): boolean {
  const normalized = normalizedLabel(title);
  return (
    normalized === "la forgia di sherdan" ||
    normalized === "sistema di crafting" ||
    normalized === "indice" ||
    // "Oggetti Comuni" e' un re-statement della parte II, niente contenuto
    // proprio: le sotto-sezioni "Pozioni e Consumabili"/"Veleni"/... le
    // catturano gia'. Stesso per future "Oggetti Non Comuni" ecc.
    /^oggetti\s+/.test(normalized)
  );
}

// Categoria deducibile dal path della sezione. Usata in metadata per
// futuri filtri di ricerca (es. solo veleni, solo armi).
function inferCategory(_section: string, path: string[]): string {
  const flat = path.map((segment) => normalizedLabel(segment)).join(" > ");

  if (
    flat.includes("pozioni") ||
    flat.includes("consumabili") ||
    flat.includes("potion")
  ) {
    return "potions";
  }
  if (flat.includes("veleni") || flat.includes("poison")) return "poisons";
  if (flat.includes("munizioni") || flat.includes("ammunition")) return "ammunition";
  if (flat.includes("armi") || flat.includes("armature")) return "weapons-armor";
  if (flat.includes("oggetti meravigliosi") || flat.includes("wondrous")) {
    return "wondrous";
  }
  if (flat.includes("pergamene") || flat.includes("scroll")) return "scrolls";
  if (
    flat.includes("regole") ||
    flat.includes("legenda") ||
    flat.includes("rapide") ||
    flat.includes("modificatori") ||
    flat.includes("esiti") ||
    flat.includes("cd e tempo")
  ) {
    return "rules";
  }
  if (flat.includes("obsidium")) return "obsidium";
  return "crafting";
}
