// Helper condivisi per parser di documenti Sherdan in formato
// Homebrewery/NaturalCrit. Estratto da `sherdan-player-manual.ts` per
// permettere il riuso dal parser de "La Forgia di Sherdan" e da future
// pubblicazioni nello stesso formato (Fase 9 slice 1).
//
// Convenzioni Homebrewery che vanno pulite/scartate prima del chunking:
// - `{{ ... }}` direttive di layout (banner, footnote, toc, ...)
// - `\page` / `\column` separatori grafici
// - `![alt](url){position:absolute,...}` immagini con styling
// - `<img>` / `<style>` / altri tag HTML
// - `___` separatori grafici

export interface HeadingRef {
  level: number;
  title: string;
  line: number;
}

export interface CleanLine {
  text: string;
  line: number;
}

export interface SectionDraft {
  heading: HeadingRef;
  path: HeadingRef[];
  chapter: string | null;
  lines: string[];
}

export function stripHomebreweryDirectives(markdown: string): CleanLine[] {
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

export interface CollectSectionDraftsOptions {
  // Test che identifica un titolo come "capitolo" (gerarchico, non sezione vera).
  isChapterHeading: (title: string) => boolean;
  // Test che identifica un titolo come "chrome" di documento da saltare.
  isDocumentChromeHeading: (title: string) => boolean;
}

export function collectSectionDrafts(
  lines: CleanLine[],
  options: CollectSectionDraftsOptions,
): SectionDraft[] {
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

      const headingRef: HeadingRef = { level, title, line: cleanLine.line };

      while (
        headingStack.length > 0 &&
        (headingStack.at(-1)?.level ?? 0) >= level
      ) {
        headingStack.pop();
      }
      headingStack.push(headingRef);

      if (options.isChapterHeading(title)) {
        currentChapter = title;
        continue;
      }

      if (options.isDocumentChromeHeading(title)) {
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

export function isLayoutDirective(trimmed: string): boolean {
  return (
    trimmed === "\\page" ||
    trimmed === "\\column" ||
    /^:{1,}$/.test(trimmed) ||
    trimmed === "___" ||
    trimmed === "}}"
  );
}

export function isMediaDirective(trimmed: string): boolean {
  return (
    trimmed.startsWith("![") ||
    trimmed.startsWith("<img") ||
    (trimmed.includes("](") && trimmed.includes("position:absolute")) ||
    trimmed.startsWith("src=") ||
    trimmed.startsWith("style=")
  );
}

export function cleanInlineMarkup(value: string): string {
  return value
    .replace(/\{\{\s*/g, "")
    .replace(/\s*\}\}/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)(?:\{[^}]+\})?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\\page|\\column/g, "")
    .trimEnd();
}

export function stripMarkdown(value: string): string {
  return cleanInlineMarkup(value)
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*]\s+/, "")
    .trim();
}

export function compactMarkdown(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

export function normalizedLabel(value: string): string {
  return stripMarkdown(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it-IT")
    .trim();
}
