type Visibility = "dm_only" | "discovered" | "public";
type PlotThreadStatus = "hot" | "warm" | "cold" | "resolved" | "abandoned";

type CampaignPlotCategory =
  | "prophecy"
  | "campaign_truth"
  | "pc_arc"
  | "macro_arc";

interface SourceRef {
  file: string;
  heading: string;
  line: number;
}

interface MarkdownSection {
  title: string;
  content: string;
  line: number;
}

interface SplitCampaignText {
  publicMarkdown: string;
  gmMarkdown: string;
  gmNoteCount: number;
}

export interface ParsedCampaignPlotThread {
  source: SourceRef;
  title: string;
  category: CampaignPlotCategory;
  description: string;
  publicDescription: string;
  status: PlotThreadStatus;
  priority: number;
  visibility: Visibility;
  tags: string[];
  relatedPcNames: string[];
  chapterTitles: string[];
  gmNoteCount: number;
  warnings: string[];
}

export interface ParsedCampaignSession {
  source: SourceRef;
  number: number;
  title: string;
  date: string;
  recap: string;
  prepNotes: string;
  visibility: Visibility;
  tags: string[];
  gmNoteCount: number;
  warnings: string[];
}

export interface ParsedCampaignImportPlan {
  plotThreads: ParsedCampaignPlotThread[];
  sessions: ParsedCampaignSession[];
  warnings: string[];
}

const LOCK_MARKER = "\u{1F512}";
const GM_NOTE_MARKER = "\u{1F4A1}";
const PRIVATE_MARKERS = [LOCK_MARKER, GM_NOTE_MARKER];

const PERSONAL_ARC_NAMES: Record<string, string[]> = {
  azazel: ["Azazel", "Erevan"],
  axton: ["Axton", "Tony"],
  althea: ["Althea"],
  bellamy: ["Bellamy"],
  melir: ["Melir", "Melìr"],
  noel: ["Noel", "Yancarlos", "Lust", "Xuanji Shih"],
  andros: ["Andros"],
};

export function parseSherdanCampaignMarkdown(
  markdown: string,
  options: { sourceFile?: string } = {},
): ParsedCampaignImportPlan {
  const sourceFile = options.sourceFile ?? "Campagna.md";
  const topSections = splitMarkdownHeadings(markdown, 1);
  const prophecy = findSection(topSections, "la profezia");
  const players = findSection(topSections, "i giocatori");
  const macro = findSection(topSections, "macro-trama");
  const campaign = findSection(topSections, "campagna");

  const warnings: string[] = [];
  if (!prophecy) warnings.push("Sezione LA PROFEZIA non trovata.");
  if (!players) warnings.push("Sezione I GIOCATORI non trovata.");
  if (!macro) warnings.push("Sezione MACRO-TRAMA non trovata.");
  if (!campaign) warnings.push("Sezione CAMPAGNA non trovata.");

  return {
    plotThreads: [
      ...(prophecy ? [parseProphecyThread(prophecy, sourceFile)] : []),
      ...(players ? parsePlayerThreads(players, sourceFile) : []),
      ...(macro ? [parseMacroThread(macro, sourceFile)] : []),
    ],
    sessions: campaign ? parseSessions(campaign, sourceFile) : [],
    warnings,
  };
}

function parseProphecyThread(
  section: MarkdownSection,
  sourceFile: string,
): ParsedCampaignPlotThread {
  const split = splitPublicAndGmBlocks(section.content);
  return {
    source: buildSource(section, sourceFile),
    title: "La Profezia",
    category: "prophecy",
    description: split.gmMarkdown,
    publicDescription: split.publicMarkdown,
    status: "hot",
    priority: 1,
    visibility: "dm_only",
    tags: ["sherdan-import", "campagna-md", "plot:profezia"],
    relatedPcNames: [],
    chapterTitles: [],
    gmNoteCount: split.gmNoteCount,
    warnings: buildPlotWarnings(section, split),
  };
}

function parsePlayerThreads(
  section: MarkdownSection,
  sourceFile: string,
): ParsedCampaignPlotThread[] {
  const childSections = splitChildHeadings(section, 2);
  const preamble = contentBeforeFirstChildHeading(section, 2);
  const threads: ParsedCampaignPlotThread[] = [];

  if (preamble.trim()) {
    const split = splitPublicAndGmBlocks(preamble);
    threads.push({
      source: buildSource(section, sourceFile),
      title: "I Sigilli e i Vascelli",
      category: "campaign_truth",
      description: split.gmMarkdown,
      publicDescription: split.publicMarkdown,
      status: "hot",
      priority: 2,
      visibility: "dm_only",
      tags: ["sherdan-import", "campagna-md", "plot:vascelli"],
      relatedPcNames: [],
      chapterTitles: [],
      gmNoteCount: split.gmNoteCount,
      warnings: buildPlotWarnings(section, split),
    });
  }

  return [
    ...threads,
    ...childSections.map((child, index) =>
      parsePersonalArcThread(child, sourceFile, index + 1),
    ),
  ];
}

function parsePersonalArcThread(
  section: MarkdownSection,
  sourceFile: string,
  index: number,
): ParsedCampaignPlotThread {
  const split = splitPublicAndGmBlocks(section.content);
  const gmDescription = compactMarkdown(
    [split.publicMarkdown, split.gmMarkdown].filter(Boolean).join("\n\n"),
  );

  return {
    source: buildSource(section, sourceFile),
    title: section.title,
    category: "pc_arc",
    description: gmDescription,
    publicDescription: "",
    status: "warm",
    priority: 10 + index,
    visibility: "dm_only",
    tags: [
      "sherdan-import",
      "campagna-md",
      "plot:pc-arc",
      `pc:${normalizedLabel(section.title).split(" ")[0] ?? "unknown"}`,
    ],
    relatedPcNames: relatedPcNamesForTitle(section.title),
    chapterTitles: [],
    gmNoteCount: split.gmNoteCount,
    warnings: buildPlotWarnings(section, {
      ...split,
      gmMarkdown: gmDescription,
    }),
  };
}

function parseMacroThread(
  section: MarkdownSection,
  sourceFile: string,
): ParsedCampaignPlotThread {
  const split = splitPublicAndGmBlocks(section.content);
  const chapterTitles = splitChildHeadings(section, 3).map(
    (child) => child.title,
  );
  const description = compactMarkdown(
    [split.publicMarkdown, split.gmMarkdown].filter(Boolean).join("\n\n"),
  );

  return {
    source: buildSource(section, sourceFile),
    title: "Macro-Trama",
    category: "macro_arc",
    description,
    publicDescription: "",
    status: "warm",
    priority: 3,
    visibility: "dm_only",
    tags: ["sherdan-import", "campagna-md", "plot:macro-trama"],
    relatedPcNames: [],
    chapterTitles,
    gmNoteCount: split.gmNoteCount,
    warnings: buildPlotWarnings(section, {
      ...split,
      gmMarkdown: description,
    }),
  };
}

function parseSessions(
  section: MarkdownSection,
  sourceFile: string,
): ParsedCampaignSession[] {
  return splitChildHeadings(section, 2)
    .filter((child) => normalizedLabel(child.title).startsWith("sessione"))
    .map((child) => parseSession(child, sourceFile));
}

function parseSession(
  section: MarkdownSection,
  sourceFile: string,
): ParsedCampaignSession {
  const heading = parseSessionHeading(section.title);
  const split = splitPublicAndGmBlocks(section.content);
  const warnings: string[] = [];

  if (!heading) {
    warnings.push(`Heading sessione non riconosciuto: ${section.title}`);
  }
  if (!split.publicMarkdown) {
    warnings.push("Sessione senza recap pubblico.");
  }

  const number = heading?.number ?? 0;
  return {
    source: buildSource(section, sourceFile),
    number,
    title: `Sessione ${number}`,
    date: heading?.date ?? "",
    recap: split.publicMarkdown,
    prepNotes: split.gmMarkdown,
    visibility: "dm_only",
    tags: [
      "sherdan-import",
      "campagna-md",
      "sessione",
      `session:${number}`,
    ],
    gmNoteCount: split.gmNoteCount,
    warnings,
  };
}

function splitMarkdownHeadings(
  markdown: string,
  level: number,
): MarkdownSection[] {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  return splitHeadingLines(lines, level, 0);
}

function splitChildHeadings(
  section: MarkdownSection,
  level: number,
): MarkdownSection[] {
  const lines = section.content.split("\n");
  return splitHeadingLines(lines, level, section.line);
}

function splitHeadingLines(
  lines: string[],
  level: number,
  lineOffset: number,
): MarkdownSection[] {
  const headingPrefix = "#".repeat(level);
  const headingRegex = new RegExp(`^${headingPrefix}\\s+(.+?)\\s*$`);
  const sections: MarkdownSection[] = [];
  let current: { title: string; line: number; lines: string[] } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = headingRegex.exec(line);
    if (heading?.[1]) {
      if (current) {
        sections.push({
          title: stripMarkdown(current.title),
          content: current.lines.join("\n").trim(),
          line: current.line,
        });
      }
      current = {
        title: heading[1],
        line: lineOffset + index + 1,
        lines: [],
      };
      continue;
    }

    current?.lines.push(line);
  }

  if (current) {
    sections.push({
      title: stripMarkdown(current.title),
      content: current.lines.join("\n").trim(),
      line: current.line,
    });
  }

  return sections;
}

function contentBeforeFirstChildHeading(
  section: MarkdownSection,
  level: number,
): string {
  const headingPrefix = "#".repeat(level);
  const headingRegex = new RegExp(`^${headingPrefix}\\s+`);
  const lines = section.content.split("\n");
  const firstChildIndex = lines.findIndex((line) => headingRegex.test(line));
  const preambleLines =
    firstChildIndex >= 0 ? lines.slice(0, firstChildIndex) : lines;
  return preambleLines.join("\n").trim();
}

function splitPublicAndGmBlocks(content: string): SplitCampaignText {
  const publicLines: string[] = [];
  const gmLines: string[] = [];
  let gmNoteCount = 0;
  let inGmBlock = false;

  for (const line of content.split("\n")) {
    const markerIndex = firstPrivateMarkerIndex(line);
    if (inGmBlock && markerIndex === -1 && isPublicBoundary(line)) {
      inGmBlock = false;
    }

    if (inGmBlock && markerIndex === -1) {
      gmLines.push(cleanPrivateMarkers(line));
      continue;
    }

    if (markerIndex === -1) {
      publicLines.push(line);
      continue;
    }

    gmNoteCount += 1;
    const markerLength = privateMarkerLength(line, markerIndex);
    const beforeMarker = line.slice(0, markerIndex);
    const afterMarker = line.slice(markerIndex + markerLength);

    if (stripMarkdown(beforeMarker)) {
      publicLines.push(beforeMarker.trimEnd());
    }
    if (afterMarker.trim()) {
      gmLines.push(cleanPrivateMarkers(afterMarker));
    }
    inGmBlock = true;
  }

  return {
    publicMarkdown: compactMarkdown(publicLines.join("\n")),
    gmMarkdown: compactMarkdown(gmLines.join("\n")),
    gmNoteCount,
  };
}

function parseSessionHeading(title: string) {
  const match = /^SESSIONE\s+(\d+)\s+\((\d{2})-(\d{2})-(\d{4})\)$/i.exec(
    title,
  );
  if (!match?.[1] || !match[2] || !match[3] || !match[4]) return null;
  return {
    number: Number.parseInt(match[1], 10),
    date: `${match[4]}-${match[3]}-${match[2]}`,
  };
}

function buildSource(section: MarkdownSection, sourceFile: string): SourceRef {
  return {
    file: sourceFile,
    heading: section.title,
    line: section.line,
  };
}

function buildPlotWarnings(
  section: MarkdownSection,
  split: SplitCampaignText,
): string[] {
  const warnings: string[] = [];
  if (!split.publicMarkdown && !split.gmMarkdown) {
    warnings.push(`Plot thread vuoto: ${section.title}`);
  }
  if (section.content.includes("Nota GM") && split.gmNoteCount === 0) {
    warnings.push("Possibile nota GM non marcata come privata.");
  }
  return warnings;
}

function relatedPcNamesForTitle(title: string): string[] {
  const normalized = normalizedLabel(title);
  const key = Object.keys(PERSONAL_ARC_NAMES).find((candidate) =>
    normalized.startsWith(candidate),
  );
  return key ? PERSONAL_ARC_NAMES[key] ?? [] : [];
}

function findSection(
  sections: MarkdownSection[],
  normalizedTitle: string,
): MarkdownSection | undefined {
  return sections.find(
    (section) => normalizedLabel(section.title) === normalizedTitle,
  );
}

function isPublicBoundary(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.length > 0 &&
    (/^#{1,6}\s+/.test(trimmed) ||
      /^[-*]\s+/.test(trimmed) ||
      /^-{3,}$/.test(trimmed))
  );
}

function compactMarkdown(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanPrivateMarkers(value: string): string {
  return PRIVATE_MARKERS.reduce(
    (cleaned, marker) => cleaned.replace(new RegExp(marker, "gu"), ""),
    value,
  ).trimEnd();
}

function stripMarkdown(value: string): string {
  return cleanPrivateMarkers(value)
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/^>\s?/, "")
    .replace(/^\s*[-*]\s+/, "")
    .trim();
}

function normalizedLabel(value: string): string {
  return stripMarkdown(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it-IT")
    .trim();
}

function firstPrivateMarkerIndex(value: string): number {
  const indexes = PRIVATE_MARKERS.map((marker) => value.indexOf(marker)).filter(
    (index) => index >= 0,
  );
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

function privateMarkerLength(value: string, index: number): number {
  const marker = PRIVATE_MARKERS.find((candidate) =>
    value.startsWith(candidate, index),
  );
  return marker?.length ?? 0;
}
