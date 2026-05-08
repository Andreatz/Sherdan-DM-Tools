interface HeadingRef {
  level: number;
  title: string;
  line: number;
}

interface SectionDraft {
  heading: HeadingRef;
  path: HeadingRef[];
  chapter: string | null;
  lines: string[];
}

interface CleanLine {
  text: string;
  line: number;
}

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
  const drafts = collectSectionDrafts(cleanedLines);

  return drafts
    .map((draft, index) => buildRuleDocument(draft, index, sourceFile))
    .filter((document): document is ParsedRuleDocument => document !== null)
    .map((document, chunkIndex) => ({
      ...document,
      chunkIndex,
    }));
}

function stripHomebreweryDirectives(markdown: string): CleanLine[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const cleaned: CleanLine[] = [];
  let inTemplateBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const sourceLine = index + 1;
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (inTemplateBlock) {
      if (trimmed.includes("}}")) {
        inTemplateBlock = false;
      }
      continue;
    }

    if (!trimmed) {
      cleaned.push({ text: "", line: sourceLine });
      continue;
    }

    if (trimmed.startsWith("{{")) {
      if (!trimmed.includes("}}")) {
        inTemplateBlock = true;
      }
      continue;
    }

    if (isLayoutDirective(trimmed) || isMediaDirective(trimmed)) {
      continue;
    }

    const text = cleanInlineMarkup(line);
    if (text.trim()) {
      cleaned.push({ text, line: sourceLine });
    } else {
      cleaned.push({ text: "", line: sourceLine });
    }
  }

  return cleaned;
}

function collectSectionDrafts(lines: CleanLine[]): SectionDraft[] {
  const drafts: SectionDraft[] = [];
  const headingStack: HeadingRef[] = [];
  let current: SectionDraft | null = null;
  let currentChapter: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const cleanLine = lines[index];
    if (!cleanLine) continue;
    const line = cleanLine.text;
    const heading = /^(#{1,6})\s*(.*?)\s*$/.exec(line.trim());

    if (heading?.[1]) {
      if (current) {
        drafts.push(current);
        current = null;
      }

      const level = heading[1].length;
      const title = stripMarkdown(heading[2] ?? "");
      if (!title) continue;

      const headingRef = {
        level,
        title,
        line: cleanLine.line,
      };

      while (
        headingStack.length > 0 &&
        (headingStack.at(-1)?.level ?? 0) >= level
      ) {
        headingStack.pop();
      }
      headingStack.push(headingRef);

      if (isChapterHeading(title)) {
        currentChapter = title;
        continue;
      }

      if (isDocumentChromeHeading(title)) {
        continue;
      }

      current = {
        heading: headingRef,
        path: [...headingStack],
        chapter: currentChapter,
        lines: [],
      };
      continue;
    }

    if (!current) continue;
    if (!line.trim()) {
      current.lines.push("");
      continue;
    }
    current.lines.push(line);
  }

  if (current) {
    drafts.push(current);
  }

  return drafts;
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

function isLayoutDirective(trimmed: string): boolean {
  return (
    trimmed === "\\page" ||
    trimmed === "\\column" ||
    /^:{1,}$/.test(trimmed) ||
    trimmed === "___" ||
    trimmed === "}}"
  );
}

function isMediaDirective(trimmed: string): boolean {
  return (
    trimmed.startsWith("![") ||
    trimmed.startsWith("<img") ||
    trimmed.includes("](") && trimmed.includes("position:absolute") ||
    trimmed.startsWith("src=") ||
    trimmed.startsWith("style=")
  );
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

function cleanInlineMarkup(value: string): string {
  return value
    .replace(/\{\{\s*/g, "")
    .replace(/\s*\}\}/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)(?:\{[^}]+\})?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\\page|\\column/g, "")
    .trimEnd();
}

function stripMarkdown(value: string): string {
  return cleanInlineMarkup(value)
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*]\s+/, "")
    .trim();
}

function compactMarkdown(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function normalizedLabel(value: string): string {
  return stripMarkdown(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it-IT")
    .trim();
}
