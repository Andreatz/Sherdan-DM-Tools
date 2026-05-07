import {
  factionPropertiesSchema,
  type FactionProperties,
} from "@/lib/validation/faction";
import { npcPropertiesSchema, type NpcProperties } from "@/lib/validation/npc";

type SecretLayer = "surface" | "intermediate" | "deep";
type Visibility = "dm_only" | "discovered" | "public";

interface SourceRef {
  file: string;
  heading: string;
  line: number;
  index: number | null;
}

interface MarkdownSection {
  title: string;
  content: string;
}

interface MarkdownTable {
  headers: string[];
  rows: string[][];
}

export interface ParsedFactionSecret {
  layer: SecretLayer;
  content: string;
}

export interface ParsedFactionLink {
  targetName: string;
  relationType: "related_to";
  publicRelationType: string | null;
  description: string;
  visibility: Visibility;
}

export interface ParsedFactionPcHook {
  pcName: string;
  hookDescription: string;
  status: "available";
}

export interface ParsedFactionLieutenantEntity {
  type: "npc";
  name: string;
  description: string;
  publicDescription: string;
  properties: NpcProperties;
  tags: string[];
  visibility: Visibility;
  parentFactionName: string;
  source: SourceRef;
  warnings: string[];
}

export interface ParsedFactionEntity {
  source: SourceRef;
  type: "faction";
  name: string;
  description: string;
  publicDescription: string;
  properties: FactionProperties;
  tags: string[];
  visibility: Visibility;
  secrets: ParsedFactionSecret[];
  entityLinks: ParsedFactionLink[];
  pcHooks: ParsedFactionPcHook[];
  lieutenantEntities: ParsedFactionLieutenantEntity[];
  warnings: string[];
}

const SECRET_LAYER_BY_NUMBER: Record<string, SecretLayer> = {
  "1": "surface",
  "2": "intermediate",
  "3": "deep",
};

const GOAL_KEY_BY_PREFIX = [
  ["breve", "short_term"],
  ["medio", "medium_term"],
  ["lungo", "long_term"],
] as const;

export function parseSherdanFactionsMarkdown(
  markdown: string,
  options: { sourceFile?: string } = {},
): ParsedFactionEntity[] {
  const sourceFile = options.sourceFile ?? "Fazioni.md";
  return splitFactionEntries(markdown).map((entry) =>
    parseFactionEntry(entry.heading, entry.content, {
      sourceFile,
      line: entry.line,
    }),
  );
}

function splitFactionEntries(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const entries: Array<{ heading: string; content: string; line: number }> = [];
  let current: { heading: string; startLine: number; lines: string[] } | null =
    null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading?.[1]) {
      if (current) {
        entries.push({
          heading: current.heading,
          content: current.lines.join("\n").trim(),
          line: current.startLine,
        });
      }
      current = { heading: heading[1], startLine: index + 1, lines: [] };
      continue;
    }

    current?.lines.push(line);
  }

  if (current) {
    entries.push({
      heading: current.heading,
      content: current.lines.join("\n").trim(),
      line: current.startLine,
    });
  }

  return entries;
}

function parseFactionEntry(
  heading: string,
  content: string,
  context: { sourceFile: string; line: number },
): ParsedFactionEntity {
  const headingParts = parseFactionHeading(heading);
  const sections = splitH3Sections(content);
  const structureSection = findSection(sections, ["struttura"]);
  const goalsSection = sections.find((section) =>
    normalizedLabel(section.title).includes("obiettiv"),
  );
  const secretSections = sections.filter((section) =>
    normalizedLabel(section.title).includes("segret"),
  );
  const relationSections = sections.filter(isRelationSection);
  const hookSection = findSection(sections, ["agganci pg"]);
  const lieutenantSections = sections.filter(isLieutenantSection);
  const structureContent = structureSection?.content ?? "";
  const methods = parseMethods(structureContent);
  const membersEstimate = extractMembersEstimate(structureContent || content);

  const properties = factionPropertiesSchema.parse({
    structure: structureContent || undefined,
    methods,
    goals: parseGoals(goalsSection?.content ?? ""),
    territory_ids: [],
    member_ids: [],
    members_count_estimate: membersEstimate,
    size: membersEstimate ? inferFactionSize(membersEstimate) : undefined,
    extra: {
      source_file: context.sourceFile,
      source_heading: heading,
      raw_index: headingParts.index,
    },
  });

  const secrets = [
    ...secretSections.flatMap((section) => parseSecrets(section.content)),
    ...parseLockedBlocks(content),
  ];
  const entityLinks = relationSections.flatMap((section) =>
    parseEntityLinks(section.content),
  );
  const pcHooks = hookSection ? parsePcHooks(hookSection.content) : [];
  const lieutenantEntities = lieutenantSections.flatMap((section) =>
    parseLieutenants(section, headingParts.name, context),
  );
  const warnings = buildWarnings({
    properties,
    secrets,
    entityLinks,
    lieutenantEntities,
    content,
  });

  return {
    source: {
      file: context.sourceFile,
      heading,
      line: context.line,
      index: headingParts.index,
    },
    type: "faction",
    name: headingParts.name,
    description: content.trim(),
    publicDescription: buildPublicDescription(content),
    properties,
    tags: buildTags(headingParts.name, content),
    visibility: "dm_only",
    secrets,
    entityLinks,
    pcHooks,
    lieutenantEntities,
    warnings,
  };
}

function parseFactionHeading(heading: string) {
  const indexMatch = /^(\d+)/.exec(heading);
  return {
    index: indexMatch?.[1] ? Number.parseInt(indexMatch[1], 10) : null,
    name: stripMarkdown(heading.replace(/^\d+\.\s+/, "")),
  };
}

function splitH3Sections(content: string): MarkdownSection[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sections: MarkdownSection[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const heading = /^###\s+(.+?)\s*$/.exec(line);
    if (heading?.[1]) {
      if (current) {
        sections.push({
          title: current.title,
          content: current.lines.join("\n").trim(),
        });
      }
      current = { title: heading[1], lines: [] };
      continue;
    }

    current?.lines.push(line);
  }

  if (current) {
    sections.push({
      title: current.title,
      content: current.lines.join("\n").trim(),
    });
  }

  return sections;
}

function findSection(
  sections: MarkdownSection[],
  titleNeedles: string[],
): MarkdownSection | undefined {
  return sections.find((section) => {
    const title = normalizedLabel(section.title);
    return titleNeedles.every((needle) => title.includes(needle));
  });
}

function isRelationSection(section: MarkdownSection) {
  const title = normalizedLabel(section.title);
  return title.includes("rapport") && !title.includes("pg");
}

function isLieutenantSection(section: MarkdownSection) {
  const title = normalizedLabel(section.title);
  return (
    title.includes("luogotenent") ||
    title.includes("membri del cerchio interno") ||
    title.includes("leader")
  );
}

function parseGoals(content: string): FactionProperties["goals"] {
  const goals: FactionProperties["goals"] = {};
  for (const row of parseMarkdownTable(content)?.rows ?? []) {
    const level = normalizedLabel(row[0] ?? "");
    const rest = row.slice(1).map(stripMarkdown).filter(isNonEmpty).join(": ");
    setGoal(goals, level, rest);
  }
  return goals;
}

function setGoal(
  goals: FactionProperties["goals"],
  label: string,
  value: string,
) {
  if (!value) return;
  for (const [prefix, key] of GOAL_KEY_BY_PREFIX) {
    if (label.startsWith(prefix)) {
      goals[key] = value;
    }
  }
}

function parseSecrets(content: string): ParsedFactionSecret[] {
  const numbered: ParsedFactionSecret[] = [];
  for (const line of content.split("\n")) {
    const match = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    if (!match?.[1] || !match[2]) continue;
    numbered.push({
      layer: SECRET_LAYER_BY_NUMBER[match[1]] ?? "deep",
      content: stripMarkdown(match[2]),
    });
  }

  if (numbered.length > 0) return numbered;

  const fallback = stripMarkdown(content);
  return fallback ? [{ layer: "deep", content: fallback }] : [];
}

function parseLockedBlocks(content: string): ParsedFactionSecret[] {
  const blocks: ParsedFactionSecret[] = [];
  let current: string[] = [];

  for (const line of content.split("\n")) {
    const cleaned = stripMarkdown(line.replace(/^>\s?/, ""));
    if (line.includes("🔒") || (current.length > 0 && line.startsWith(">"))) {
      current.push(cleaned);
      continue;
    }
    flushLockedBlock();
  }

  flushLockedBlock();
  return blocks;

  function flushLockedBlock() {
    const content = current.filter(isNonEmpty).join("\n");
    if (content) {
      blocks.push({ layer: "deep", content });
    }
    current = [];
  }
}

function parseEntityLinks(content: string): ParsedFactionLink[] {
  return (parseMarkdownTable(content)?.rows ?? [])
    .map((row) => ({
      targetName: stripMarkdown(row[0] ?? ""),
      relationType: "related_to" as const,
      publicRelationType: null,
      description: row.slice(1).map(stripMarkdown).filter(isNonEmpty).join(": "),
      visibility: "dm_only" as const,
    }))
    .filter((link) => link.targetName && link.description);
}

function parsePcHooks(content: string): ParsedFactionPcHook[] {
  return (parseMarkdownTable(content)?.rows ?? [])
    .map((row) => ({
      pcName: stripMarkdown(row[0] ?? ""),
      hookDescription: stripMarkdown(row[1] ?? ""),
      status: "available" as const,
    }))
    .filter((hook) => hook.pcName && hook.hookDescription);
}

function parseLieutenants(
  section: MarkdownSection,
  factionName: string,
  context: { sourceFile: string; line: number },
): ParsedFactionLieutenantEntity[] {
  const fromBullets = parseLieutenantBullets(section.content, factionName, context);
  if (fromBullets.length > 0) return fromBullets;
  return parseLieutenantTable(section.content, factionName, context);
}

function parseLieutenantBullets(
  content: string,
  factionName: string,
  context: { sourceFile: string; line: number },
): ParsedFactionLieutenantEntity[] {
  return content
    .split("\n")
    .map((line) => /^\s*[-*]\s+\*\*([^*]+)\*\*\s*(?:[-\u2014]\s*)?(.+)?$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match?.[1]))
    .map((match) =>
      buildLieutenantEntity({
        name: stripMarkdown(match[1] ?? ""),
        detail: stripMarkdown(match[2] ?? ""),
        factionName,
        context,
      }),
    );
}

function parseLieutenantTable(
  content: string,
  factionName: string,
  context: { sourceFile: string; line: number },
): ParsedFactionLieutenantEntity[] {
  return (parseMarkdownTable(content)?.rows ?? [])
    .map((row) =>
      buildLieutenantEntity({
        name: stripMarkdown(row[1] ?? row[0] ?? ""),
        detail: row.slice(2).map(stripMarkdown).filter(isNonEmpty).join(": "),
        factionName,
        context,
      }),
    )
    .filter((entity) => entity.name);
}

function buildLieutenantEntity({
  name,
  detail,
  factionName,
  context,
}: {
  name: string;
  detail: string;
  factionName: string;
  context: { sourceFile: string; line: number };
}): ParsedFactionLieutenantEntity {
  const firstSentence = detail.split(/(?<=\.)\s+/)[0] ?? detail;
  const properties = npcPropertiesSchema.parse({
    race: inferRace(detail) ?? "Da definire",
    appearance_summary: firstSentence || `${name} (${factionName})`,
    sensory_details: { sight: firstSentence || undefined },
    voice: { speech_patterns: [] },
    tics: [],
    mannerisms: [],
    motivations: [],
    goals: {
      short_term: extractObjective(detail),
    },
    weaknesses: [],
    extra: {
      source_file: context.sourceFile,
      parent_faction_name: factionName,
      raw_detail: detail,
    },
  });

  return {
    type: "npc",
    name,
    description: detail,
    publicDescription: truncate(detail, 300),
    properties,
    tags: ["sherdan-import", "fazioni-md", "luogotenente"],
    visibility: "dm_only",
    parentFactionName: factionName,
    source: {
      file: context.sourceFile,
      heading: `${factionName} / ${name}`,
      line: context.line,
      index: null,
    },
    warnings: detail ? [] : ["Luogotenente senza dettaglio testuale."],
  };
}

function parseMethods(structureContent: string): string[] {
  const methodLabels = [
    "specializzazione",
    "armamento",
    "codice",
    "pagamento",
    "reclutamento",
    "specialita",
  ];
  return parseBoldBulletFields(structureContent)
    .filter(({ label }) => methodLabels.some((needle) => label.includes(needle)))
    .map(({ value }) => value);
}

function parseBoldBulletFields(content: string) {
  return content
    .split("\n")
    .map((line) => /^\s*[-*]\s+\*\*([^*:]+):\*\*\s*(.+?)\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match?.[1] && match[2]))
    .map((match) => ({
      label: normalizedLabel(match[1] ?? ""),
      value: stripMarkdown(match[2] ?? ""),
    }));
}

function extractMembersEstimate(content: string): string | undefined {
  const composition = parseBoldBulletFields(content).find(
    (field) => field.label === "composizione",
  )?.value;
  const source = composition ?? content;
  const match = /\b(?:circa\s+)?(\d+[.,]?\d*|decine|centinaia|migliaia)\b[^.\n]*/i.exec(
    source,
  );
  return match?.[0] ? stripMarkdown(match[0]) : undefined;
}

function inferFactionSize(estimate: string): FactionProperties["size"] {
  const normalized = normalizedLabel(estimate);
  const firstNumber = /\d+/.exec(normalized)?.[0];
  const number = firstNumber ? Number.parseInt(firstNumber, 10) : 0;
  if (normalized.includes("migliaia") || number >= 1000) return "massive";
  if (normalized.includes("centinaia") || number >= 300) return "large";
  if (number >= 80) return "medium";
  if (number >= 20 || normalized.includes("decine")) return "small";
  return "tiny";
}

function inferRace(detail: string): string | undefined {
  const match = /^([^,.;]+),/.exec(detail);
  return match?.[1] ? stripMarkdown(match[1]) : undefined;
}

function extractObjective(detail: string): string | undefined {
  const match = /\bObiettivo:\s*(.+)$/i.exec(detail);
  return match?.[1] ? stripMarkdown(match[1]) : undefined;
}

function parseMarkdownTable(content: string): MarkdownTable | null {
  const rows = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)));

  const headers = rows[0];
  if (!headers || rows.length < 2) return null;

  return {
    headers: headers.map(stripMarkdown),
    rows: rows.slice(1),
  };
}

function buildPublicDescription(content: string): string {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(
      (paragraph) =>
        paragraph &&
        !paragraph.startsWith("|") &&
        !paragraph.startsWith(">") &&
        !paragraph.includes("🔒") &&
        !/^###\s+Segret/i.test(paragraph),
    );
  return truncate(stripMarkdown(paragraphs[0] ?? ""), 500);
}

function buildTags(name: string, content: string): string[] {
  const tags = new Set(["sherdan-import", "fazioni-md"]);
  const normalized = normalizedLabel(`${name}\n${content}`);
  if (hasAny(normalized, ["domus nova", "pirat", "ciurma"])) {
    tags.add("domus-nova");
  }
  if (hasAny(normalized, ["tharros", "synapse", "progresso"])) {
    tags.add("tharros");
  }
  if (hasAny(normalized, ["arborea", "custodi", "spine"])) {
    tags.add("arborea");
  }
  if (hasAny(normalized, ["eshterzyli", "guerra", "legione"])) {
    tags.add("eshterzyli");
  }
  if (hasAny(normalized, ["urash", "zenith"])) {
    tags.add("urash");
  }
  return Array.from(tags);
}

function buildWarnings({
  properties,
  secrets,
  entityLinks,
  lieutenantEntities,
  content,
}: {
  properties: FactionProperties;
  secrets: ParsedFactionSecret[];
  entityLinks: ParsedFactionLink[];
  lieutenantEntities: ParsedFactionLieutenantEntity[];
  content: string;
}) {
  const warnings: string[] = [];
  if (!properties.structure) warnings.push("Sezione Struttura non riconosciuta.");
  if (secrets.length === 0 && normalizedLabel(content).includes("segret")) {
    warnings.push("Sezione segreti presente ma nessun segreto estratto.");
  }
  if (entityLinks.length === 0 && normalizedLabel(content).includes("rapport")) {
    warnings.push("Sezione rapporti presente ma nessun link estratto.");
  }
  if (
    lieutenantEntities.length === 0 &&
    normalizedLabel(content).includes("luogotenent")
  ) {
    warnings.push("Sezione luogotenenti presente ma nessuna sotto-entita' estratta.");
  }
  return warnings;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^>\s?/, "")
    .trim();
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function normalizedLabel(value: string): string {
  return stripMarkdown(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it-IT")
    .trim();
}

function hasAny(value: string, needles: string[]): boolean {
  const normalized = normalizedLabel(value);
  return needles.some((needle) => normalized.includes(needle));
}

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
