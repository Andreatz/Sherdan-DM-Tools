import {
  collectSectionDrafts,
  compactMarkdown,
  countWords,
  normalizedLabel,
  stripHomebreweryDirectives,
  type SectionDraft,
} from "./_homebrewery";

export interface ParsedRuleDocument {
  source: "sherdan-custom";
  title: string;
  section: string;
  content: string;
  chunkIndex: number;
  metadata: {
    source_file: string;
    source_kind: "player_manual";
    heading_level: number;
    heading_line: number;
    chapter: string | null;
    path: string[];
    category: string;
    word_count: number;
  };
}

const MIN_CONTENT_CHARS = 40;

export function parseSherdanPlayerManualMarkdown(
  markdown: string,
  options: { sourceFile?: string } = {},
): ParsedRuleDocument[] {
  const sourceFile = options.sourceFile ?? "Manuale del Giocatore.md";
  const cleanedLines = stripHomebreweryDirectives(markdown);
  const drafts = collectSectionDrafts(cleanedLines, {
    isChapterHeading,
    isDocumentChromeHeading,
  });

  return drafts
    .map((draft, index) => buildRuleDocument(draft, index, sourceFile))
    .filter((document): document is ParsedRuleDocument => document !== null)
    .map((document, chunkIndex) => ({
      ...document,
      chunkIndex,
    }));
}

function buildRuleDocument(
  draft: SectionDraft,
  initialChunkIndex: number,
  sourceFile: string,
): ParsedRuleDocument | null {
  const content = compactMarkdown(draft.lines.join("\n"));
  if (content.length < MIN_CONTENT_CHARS) return null;

  const path = draft.path.map((heading) => heading.title);
  const section = path.join(" > ");

  return {
    source: "sherdan-custom",
    title: "Manuale del Giocatore",
    section,
    content,
    chunkIndex: initialChunkIndex,
    metadata: {
      source_file: sourceFile,
      source_kind: "player_manual",
      heading_level: draft.heading.level,
      heading_line: draft.heading.line,
      chapter: draft.chapter,
      path,
      category: inferCategory(section),
      word_count: countWords(content),
    },
  };
}

function isChapterHeading(title: string): boolean {
  return /^Cap\.\s+[IVXLCDM]+$/i.test(title);
}

function isDocumentChromeHeading(title: string): boolean {
  const normalized = normalizedLabel(title);
  return (
    normalized === "sherdan" ||
    normalized === "manuale del giocatore" ||
    normalized === "indice" ||
    /^cap\.\s+[ivxlcdm]+$/.test(normalized)
  );
}

function inferCategory(section: string): string {
  const normalized = normalizedLabel(section);
  if (normalized.includes("storia") || normalized.includes("rivoluzione")) {
    return "history";
  }
  if (normalized.includes("terre") || normalized.includes("continente")) {
    return "geography";
  }
  if (
    normalized.includes("abissi") ||
    normalized.includes("mare") ||
    normalized.includes("baia")
  ) {
    return "seas";
  }
  if (
    normalized.includes("tharros") ||
    normalized.includes("arborea") ||
    normalized.includes("eshterzyli") ||
    normalized.includes("urash") ||
    normalized.includes("domus nova")
  ) {
    return "cities";
  }
  if (
    normalized.includes("pantheon") ||
    normalized.includes("divinita") ||
    normalized.includes("mitra")
  ) {
    return "pantheon";
  }
  if (normalized.includes("mappa")) return "map";
  return "setting";
}
