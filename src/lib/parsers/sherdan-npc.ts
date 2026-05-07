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

export interface ParsedNpcSecret {
  layer: SecretLayer;
  content: string;
}

export interface ParsedNpcHook {
  pcName: string;
  hookDescription: string;
  status: "available";
}

export interface ParsedNpcLink {
  targetName: string;
  relationType: "related_to";
  publicRelationType: string | null;
  description: string;
  visibility: Visibility;
}

export interface ParsedNpcIdentity {
  name: string;
  isTrueIdentity: boolean;
  appearance: string | null;
  voice: string | null;
  notes: string | null;
  visibility: Visibility;
}

export interface ParsedNpcEntity {
  source: SourceRef;
  type: "npc";
  name: string;
  description: string;
  publicDescription: string;
  properties: NpcProperties;
  tags: string[];
  visibility: Visibility;
  secrets: ParsedNpcSecret[];
  pcHooks: ParsedNpcHook[];
  entityLinks: ParsedNpcLink[];
  identities: ParsedNpcIdentity[];
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

export function parseSherdanNpcMarkdown(
  markdown: string,
  options: { sourceFile?: string } = {},
): ParsedNpcEntity[] {
  const sourceFile = options.sourceFile ?? "NPC.md";
  return splitNpcEntries(markdown).map((entry) =>
    parseNpcEntry(entry.heading, entry.content, {
      sourceFile,
      line: entry.line,
    }),
  );
}

function splitNpcEntries(markdown: string) {
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

function parseNpcEntry(
  heading: string,
  content: string,
  context: { sourceFile: string; line: number },
): ParsedNpcEntity {
  const headingParts = parseNpcHeading(heading);
  const sections = splitH3Sections(content);
  const identitySection =
    findSection(sections, ["identita"]) ?? findSection(sections, ["natura"]);
  const appearanceSection = findSection(sections, ["aspetto"]);
  const ticSection = findSection(sections, ["tic", "abitudini"]);
  const goalsSection = findSection(sections, ["obiettivi"]);
  const weaknessSection = findSection(sections, ["punti deboli", "sfruttarli"]);
  const secretSections = sections.filter((section) =>
    normalizedLabel(section.title).includes("segret"),
  );
  const hookSection = findSection(sections, ["agganci pg"]);
  const relationSections = sections.filter(isRelationSection);

  const identityFields = parseBoldBulletFields(identitySection?.content ?? "");
  const appearanceText =
    identityFields.get("aspetto") ??
    firstMeaningfulParagraph(appearanceSection?.content ?? "") ??
    firstMeaningfulParagraph(content) ??
    headingParts.name;
  const sensoryDetails = parseSensoryDetails(
    identityFields,
    appearanceSection?.content ?? "",
  );
  const goals = parseGoals(goalsSection?.content ?? "");
  const weaknesses = parseWeaknesses(weaknessSection?.content ?? "");
  const tics = parseBulletList(ticSection?.content ?? "");
  const secrets = secretSections.flatMap((section) =>
    parseSecrets(section.content),
  );
  const pcHooks = hookSection ? parsePcHooks(hookSection.content) : [];
  const entityLinks = relationSections.flatMap((section) =>
    parseEntityLinks(section.content),
  );
  const identities = parseIdentities({
    headingName: headingParts.name,
    identityFields,
    appearance: appearanceText,
    appearanceSection: appearanceSection?.content ?? null,
    content,
  });

  const properties = npcPropertiesSchema.parse({
    race: identityFields.get("razza") ?? headingParts.race ?? "Da definire",
    class: identityFields.get("classe") ?? headingParts.characterClass,
    level: parseInteger(identityFields.get("livello")),
    age: identityFields.get("eta"),
    appearance_summary: stripMarkdown(appearanceText),
    sensory_details: sensoryDetails,
    voice: {
      tone: sensoryDetails.sound,
      speech_patterns: [],
    },
    tics,
    mannerisms: [],
    motivations: [],
    goals,
    weaknesses,
    extra: {
      source_file: context.sourceFile,
      source_heading: heading,
      title_suffix: headingParts.subtitle,
      raw_identity_fields: Object.fromEntries(identityFields),
    },
  });

  const warnings = buildWarnings({
    heading,
    properties,
    secrets,
    pcHooks,
  });

  return {
    source: {
      file: context.sourceFile,
      heading,
      line: context.line,
      index: headingParts.index,
    },
    type: "npc",
    name: headingParts.name,
    description: content.trim(),
    publicDescription: buildPublicDescription(content),
    properties,
    tags: buildTags(headingParts, content),
    visibility: "dm_only",
    secrets,
    pcHooks,
    entityLinks,
    identities,
    warnings,
  };
}

function parseNpcHeading(heading: string) {
  const withoutRange = heading.replace(
    /^(\d+)(?:[\u2013-]\d+)?\.\s+/,
    "",
  );
  const indexMatch = /^(\d+)/.exec(heading);
  const index = indexMatch?.[1] ? Number.parseInt(indexMatch[1], 10) : null;
  const parts = withoutRange.split(/\s+(?:-|\u2014)\s+/);
  const rawName = parts[0]?.trim() || withoutRange.trim();
  const subtitle = parts.slice(1).join(" - ").trim() || null;
  const subtitleBits = subtitle?.split(",").map((part) => stripMarkdown(part));

  return {
    index,
    name: stripMarkdown(rawName),
    subtitle,
    race: subtitleBits?.[0]?.trim() || undefined,
    characterClass: subtitleBits?.[1]?.trim() || undefined,
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
  return (
    (title.includes("relazion") || title.includes("rapport")) &&
    !title.includes("pg")
  );
}

function parseBoldBulletFields(content: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of content.split("\n")) {
    const match = /^\s*[-*]\s+\*\*([^*:]+):\*\*\s*(.+?)\s*$/.exec(line);
    if (!match?.[1] || !match[2]) continue;
    fields.set(normalizedLabel(match[1]), stripMarkdown(match[2]));
  }
  return fields;
}

function parseSensoryDetails(
  identityFields: Map<string, string>,
  appearanceContent: string,
) {
  const details = [
    identityFields.get("dettaglio sensoriale 1"),
    identityFields.get("dettaglio sensoriale 2"),
    ...parseBoldBulletFields(appearanceContent).values(),
  ].filter(isNonEmpty);
  const sight = identityFields.get("aspetto") ?? firstMeaningfulParagraph(appearanceContent);
  const sound = details.find((detail) => hasAny(detail, ["voce", "parla", "suono"]));
  const smell = details.find((detail) => hasAny(detail, ["odore", "odora", "puzza"]));
  const touch = details.find((detail) => hasAny(detail, ["tatto", "pelle fredda"]));

  return {
    sight: sight ? stripMarkdown(sight) : undefined,
    smell: smell ? stripMarkdown(smell) : undefined,
    sound: sound ? stripMarkdown(sound) : undefined,
    touch: touch ? stripMarkdown(touch) : undefined,
  };
}

function parseGoals(content: string): NpcProperties["goals"] {
  const goals: NpcProperties["goals"] = {};
  for (const row of parseMarkdownTable(content)?.rows ?? []) {
    const level = normalizedLabel(row[0] ?? "");
    const objective = stripMarkdown(row[1] ?? "");
    const detail = stripMarkdown(row[2] ?? "");
    setGoal(goals, level, [objective, detail].filter(isNonEmpty).join(": "));
  }

  for (const line of content.split("\n")) {
    const match = /^\s*[-*]\s+\*\*([^*:]+):\*\*\s*(.+?)\s*$/.exec(line);
    if (!match?.[1] || !match[2]) continue;
    setGoal(goals, normalizedLabel(match[1]), stripMarkdown(match[2]));
  }

  return goals;
}

function setGoal(
  goals: NpcProperties["goals"],
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

function parseSecrets(content: string): ParsedNpcSecret[] {
  const secrets: ParsedNpcSecret[] = [];
  for (const line of content.split("\n")) {
    const match = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    if (!match?.[1] || !match[2]) continue;
    const layer = SECRET_LAYER_BY_NUMBER[match[1]];
    if (!layer) continue;
    secrets.push({
      layer,
      content: stripMarkdown(match[2]),
    });
  }
  return secrets;
}

function parseWeaknesses(content: string): NpcProperties["weaknesses"] {
  return (parseMarkdownTable(content)?.rows ?? [])
    .map((row) => {
      const vulnerability = stripMarkdown(row[0] ?? "");
      const detail = stripMarkdown(row[1] ?? "");
      const who = stripMarkdown(row[2] ?? "");
      if (!vulnerability || !who) return null;
      return {
        description: [vulnerability, detail].filter(isNonEmpty).join(": "),
        who_could_exploit: who,
      };
    })
    .filter((value): value is NpcProperties["weaknesses"][number] =>
      Boolean(value),
    );
}

function parsePcHooks(content: string): ParsedNpcHook[] {
  return (parseMarkdownTable(content)?.rows ?? [])
    .map((row) => ({
      pcName: stripMarkdown(row[0] ?? ""),
      hookDescription: stripMarkdown(row[1] ?? ""),
      status: "available" as const,
    }))
    .filter((hook) => hook.pcName && hook.hookDescription);
}

function parseEntityLinks(content: string): ParsedNpcLink[] {
  return (parseMarkdownTable(content)?.rows ?? [])
    .map((row) => ({
      targetName: stripMarkdown(row[0] ?? ""),
      relationType: "related_to" as const,
      publicRelationType: null,
      description: stripMarkdown(row[1] ?? ""),
      visibility: "dm_only" as const,
    }))
    .filter((link) => link.targetName && link.description);
}

function parseIdentities({
  headingName,
  identityFields,
  appearance,
  appearanceSection,
  content,
}: {
  headingName: string;
  identityFields: Map<string, string>;
  appearance: string;
  appearanceSection: string | null;
  content: string;
}): ParsedNpcIdentity[] {
  const trueName =
    identityFields.get("nome vero") ??
    identityFields.get("nome completo") ??
    headingName;
  const identities: ParsedNpcIdentity[] = [
    {
      name: trueName,
      isTrueIdentity: true,
      appearance: appearance ? stripMarkdown(appearance) : null,
      voice: extractVoice(appearanceSection ?? content),
      notes: null,
      visibility: "dm_only",
    },
  ];

  if (normalizedLabel(headingName).includes("malakor")) {
    identities.push({
      name: "Dante Il Fortunato",
      isTrueIdentity: false,
      appearance: null,
      voice: null,
      notes: "Identita' rubata al vero Dante prima della Sessione 1.",
      visibility: "public",
    });
  }

  return identities;
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

function parseBulletList(content: string): string[] {
  return content
    .split("\n")
    .map((line) => /^\s*[-*]\s+(.+?)\s*$/.exec(line)?.[1])
    .filter(isNonEmpty)
    .map(stripMarkdown);
}

function firstMeaningfulParagraph(content: string): string | null {
  const paragraph = content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith("|") && !part.startsWith("---"));
  return paragraph ? stripMarkdown(paragraph) : null;
}

function buildPublicDescription(content: string): string {
  const intro = firstMeaningfulParagraph(
    content.replace(/###\s+Segret[\s\S]*$/i, ""),
  );
  return truncate(intro ?? firstMeaningfulParagraph(content) ?? "", 500);
}

function buildTags(
  headingParts: ReturnType<typeof parseNpcHeading>,
  content: string,
): string[] {
  const tags = new Set(["sherdan-import", "npc-md"]);
  if (headingParts.race) tags.add(`razza:${normalizedLabel(headingParts.race)}`);
  if (headingParts.characterClass) {
    tags.add(`classe:${normalizedLabel(headingParts.characterClass)}`);
  }
  if (normalizedLabel(content).includes("domus nova")) tags.add("domus-nova");
  return Array.from(tags);
}

function buildWarnings({
  heading,
  properties,
  secrets,
  pcHooks,
}: {
  heading: string;
  properties: NpcProperties;
  secrets: ParsedNpcSecret[];
  pcHooks: ParsedNpcHook[];
}) {
  const warnings: string[] = [];
  if (properties.race === "Da definire") {
    warnings.push("Razza non riconosciuta dal blocco Identita' o dal titolo.");
  }
  if (secrets.length > 0 && secrets.length !== 3) {
    warnings.push(`Segreti stratificati incompleti: ${secrets.length}/3.`);
  }
  if (pcHooks.length === 0 && Number.isInteger(parseNpcHeading(heading).index)) {
    warnings.push("Nessun Aggancio PG tabellare riconosciuto.");
  }
  return warnings;
}

function extractVoice(content: string): string | null {
  const line = content
    .split("\n")
    .map(stripMarkdown)
    .find((candidate) => hasAny(candidate, ["voce", "parla"]));
  return line ?? null;
}

function parseInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /\d+/.exec(value);
  return match?.[0] ? Number.parseInt(match[0], 10) : undefined;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/^\s*[-*]\s+/, "")
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
