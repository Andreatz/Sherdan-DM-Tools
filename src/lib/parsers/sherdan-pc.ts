import { pcPropertiesSchema, type PcProperties } from "@/lib/validation/pc";

type Visibility = "dm_only" | "discovered" | "public";

interface SourceRef {
  file: string;
  heading: string;
  line: number;
}

interface PcEntry {
  heading: string;
  content: string;
  line: number;
}

interface MarkdownSection {
  title: string;
  content: string;
}

interface PcHeadingParts {
  name: string;
  rawName: string;
  race: string | null;
  characterClass: string | null;
  subclass: string | null;
  nicknames: string[];
}

export interface ParsedPcIdentity {
  name: string;
  isTrueIdentity: boolean;
  appearance: string | null;
  notes: string | null;
  visibility: Visibility;
}

export interface ParsedPcEntity {
  source: SourceRef;
  type: "pc";
  name: string;
  description: string;
  publicDescription: string;
  properties: PcProperties;
  tags: string[];
  visibility: Visibility;
  identities: ParsedPcIdentity[];
  warnings: string[];
}

const DEFAULT_PC_LEVEL = 1;

export function parseSherdanPcMarkdown(
  markdown: string,
  options: { sourceFile?: string } = {},
): ParsedPcEntity[] {
  const sourceFile = options.sourceFile ?? "Background Personaggi.md";
  return splitPcEntries(markdown).map((entry) =>
    parsePcEntry(entry, sourceFile),
  );
}

function splitPcEntries(markdown: string): PcEntry[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const entries: PcEntry[] = [];
  let current: { heading: string; line: number; lines: string[] } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = /^#\s+(.+?)\s*$/.exec(line);
    if (heading?.[1]) {
      if (current) {
        entries.push({
          heading: current.heading,
          content: trimEntrySeparators(current.lines.join("\n")),
          line: current.line,
        });
      }
      current = { heading: heading[1], line: index + 1, lines: [] };
      continue;
    }

    current?.lines.push(line);
  }

  if (current) {
    entries.push({
      heading: current.heading,
      content: trimEntrySeparators(current.lines.join("\n")),
      line: current.line,
    });
  }

  return entries;
}

function parsePcEntry(entry: PcEntry, sourceFile: string): ParsedPcEntity {
  const headingParts = parsePcHeading(entry.heading);
  const sections = splitH3Sections(entry.content);
  const preamble = contentBeforeFirstH3(entry.content);
  const personalitySection = findSection(sections, ["personalita"]);
  const traitsSection = findSection(sections, ["tratti di personalita"]);
  const flawsSection = findSection(sections, ["difetti"]);
  const bondsSection = findSection(sections, ["legami", "relazioni"]);
  const motivationsSection = findSection(sections, ["motivazioni", "obiettivi"]);
  const physicalTraitsSection = findSection(sections, ["tratti del personaggio"]);
  const phrasesSection = findSection(sections, ["frasi tipiche"]);
  const identitiesSection = findSection(sections, ["identita preferite"]);
  const additionalInfoSection = findSection(sections, ["info aggiuntive"]);
  const classDetails = splitClassAndSubclass(headingParts.characterClass);
  const personalityBullets = parseBulletList(personalitySection?.content ?? "");
  const traitBullets = parseBulletList(traitsSection?.content ?? "");
  const flawBullets = parseBulletList(flawsSection?.content ?? "");
  const bondBullets = parseBulletList(bondsSection?.content ?? "");
  const motivationBullets = parseBulletList(motivationsSection?.content ?? "");
  const additionalInfo = parseBulletList(additionalInfoSection?.content ?? "");
  const physicalTraits = parseKeyValueBullets(
    physicalTraitsSection?.content ?? "",
  );
  const age = extractAge(physicalTraits, entry.content);
  const appearance = buildAppearanceSummary(physicalTraits, preamble);
  const speechPatterns = parseQuoteLines(phrasesSection?.content ?? "");
  const identities = buildIdentities({
    headingParts,
    identitiesSection: identitiesSection?.content ?? "",
    content: entry.content,
  });

  const properties = pcPropertiesSchema.parse({
    race: headingParts.race ?? "Da definire",
    class: classDetails.characterClass ?? headingParts.characterClass ?? "Da definire",
    subclass: classDetails.subclass ?? headingParts.subclass ?? undefined,
    level: DEFAULT_PC_LEVEL,
    age: age ?? undefined,
    appearance_summary: appearance,
    sensory_details: {
      sight: appearance,
    },
    voice: {
      speech_patterns: speechPatterns,
    },
    tics: [],
    mannerisms: personalityBullets,
    backstory: entry.content,
    arc_personale: buildPersonalArc(entry.content, motivationBullets),
    personality_traits: traitBullets.length > 0 ? traitBullets : personalityBullets,
    ideals: parseIdeals(personalityBullets),
    bonds: bondBullets,
    flaws: flawBullets,
    motivations: motivationBullets,
    goals: buildGoals(motivationBullets, entry.content),
    weaknesses: flawBullets.map((flaw) => ({
      description: flaw,
      who_could_exploit: "Antagonisti e pressioni narrative",
    })),
    extra: {
      source_file: sourceFile,
      source_heading: entry.heading,
      raw_name: headingParts.rawName,
      level_inferred: true,
      nicknames: headingParts.nicknames,
      additional_info: additionalInfo,
      identity_names: identities.map((identity) => identity.name),
    },
  });

  return {
    source: {
      file: sourceFile,
      heading: entry.heading,
      line: entry.line,
    },
    type: "pc",
    name: headingParts.name,
    description: entry.content,
    publicDescription: buildPublicDescription(entry.content),
    properties,
    tags: buildTags(headingParts, entry.content),
    visibility: "discovered",
    identities,
    warnings: buildWarnings(headingParts, properties),
  };
}

function parsePcHeading(heading: string): PcHeadingParts {
  const colonIndex = heading.indexOf(":");
  if (colonIndex >= 0) {
    const rawName = stripMarkdown(heading.slice(0, colonIndex));
    const details = heading
      .slice(colonIndex + 1)
      .split(",")
      .map(stripMarkdown)
      .filter(Boolean);
    const nicknames = extractQuotedNicknames(rawName);
    return {
      rawName,
      name: canonicalPcName(rawName),
      race: details[0] ?? null,
      characterClass: details[1] ?? null,
      subclass: null,
      nicknames,
    };
  }

  const parts = heading.split(",").map(stripMarkdown).filter(Boolean);
  const rawName = parts.slice(0, Math.max(parts.length - 2, 1)).join(", ");
  const nicknames = extractQuotedNicknames(rawName);
  return {
    rawName,
    name: canonicalPcName(rawName),
    race: parts.length >= 3 ? parts[parts.length - 2] ?? null : null,
    characterClass: parts.length >= 2 ? parts[parts.length - 1] ?? null : null,
    subclass: null,
    nicknames,
  };
}

function splitClassAndSubclass(
  value: string | null,
): { characterClass: string | null; subclass: string | null } {
  if (!value) return { characterClass: null, subclass: null };
  const normalized = normalizedLabel(value);
  const knownClasses = [
    "artefice",
    "barbaro",
    "bardo",
    "chierico",
    "druido",
    "guerriero",
    "ladra",
    "ladro",
    "mago",
    "monaco",
    "paladino",
    "ranger",
    "stregone",
    "warlock",
  ];
  const knownClass = knownClasses.find((candidate) =>
    normalized.startsWith(candidate),
  );
  if (!knownClass) return { characterClass: value, subclass: null };
  const originalClass = value.slice(0, knownClass.length);
  const subclass = value.slice(knownClass.length).trim();
  return {
    characterClass: originalClass || value,
    subclass: subclass || null,
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

function contentBeforeFirstH3(content: string): string {
  const lines = content.split("\n");
  const firstH3Index = lines.findIndex((line) => /^###\s+/.test(line));
  return (firstH3Index >= 0 ? lines.slice(0, firstH3Index) : lines)
    .join("\n")
    .trim();
}

function findSection(
  sections: MarkdownSection[],
  needles: string[],
): MarkdownSection | undefined {
  return sections.find((section) => {
    const title = normalizedLabel(section.title);
    return needles.some((needle) => title.includes(needle));
  });
}

function parseBulletList(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => /^\s*[-*]\s+(.+?)\s*$/.exec(line)?.[1])
    .filter(isNonEmpty)
    .map(stripMarkdown);
}

function parseKeyValueBullets(markdown: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of markdown.split("\n")) {
    const bullet = /^\s*[-*]\s+\*\*(.+?):\*\*\s*(.+?)\s*$/.exec(line);
    if (bullet?.[1] && bullet[2]) {
      fields.set(normalizedLabel(bullet[1]), stripMarkdown(bullet[2]));
    }
  }
  return fields;
}

function parseQuoteLines(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => /^>\s*(.+?)\s*$/.exec(line)?.[1])
    .filter(isNonEmpty)
    .map(stripMarkdown);
}

function parseIdeals(personalityBullets: string[]): string[] {
  return personalityBullets
    .filter((bullet) => normalizedLabel(bullet).startsWith("visione del mondo"))
    .map((bullet) => bullet.replace(/^Visione del mondo:\s*/i, "").trim())
    .filter(Boolean);
}

function buildGoals(motivations: string[], content: string) {
  if (motivations.length > 0) {
    return {
      short_term: motivations[0],
      medium_term: motivations[1],
      long_term: motivations.join("\n"),
    };
  }

  const finalParagraph = lastMeaningfulParagraph(content);
  return finalParagraph
    ? {
        long_term: finalParagraph,
      }
    : {};
}

function buildPersonalArc(content: string, motivations: string[]): string {
  if (motivations.length > 0) return motivations.join("\n");
  return lastMeaningfulParagraph(content) ?? firstMeaningfulParagraph(content) ?? "";
}

function buildAppearanceSummary(
  physicalTraits: Map<string, string>,
  preamble: string,
): string {
  const visibleTraits = ["occhi", "capelli", "pelle", "altezza", "peso"]
    .map((key) => {
      const value = physicalTraits.get(key);
      return value ? `${titleCase(key)}: ${value}` : null;
    })
    .filter(isNonEmpty);

  if (visibleTraits.length > 0) return visibleTraits.join("; ");
  return firstMeaningfulParagraph(preamble) ?? "Aspetto non specificato.";
}

function extractAge(
  physicalTraits: Map<string, string>,
  content: string,
): string | null {
  const explicitAge = physicalTraits.get("eta");
  if (explicitAge) return explicitAge;

  const directAge = /(?:ha|all'etÃ  di|all'età di)\s+(\d+)\s+anni/i.exec(content);
  if (directAge?.[1]) return `${directAge[1]} anni`;

  const bornAgo = /nacque\b[\s\S]{0,120}?(\d+)\s+anni fa/i.exec(content);
  if (bornAgo?.[1]) return `${bornAgo[1]} anni`;

  return null;
}

function buildIdentities(input: {
  headingParts: PcHeadingParts;
  identitiesSection: string;
  content: string;
}): ParsedPcIdentity[] {
  const identities = new Map<string, ParsedPcIdentity>();
  identities.set(normalizedLabel(input.headingParts.name), {
    name: input.headingParts.name,
    isTrueIdentity: true,
    appearance: null,
    notes: null,
    visibility: "discovered",
  });

  for (const nickname of input.headingParts.nicknames) {
    identities.set(normalizedLabel(nickname), {
      name: nickname,
      isTrueIdentity: false,
      appearance: null,
      notes: "Soprannome o epiteto nel background.",
      visibility: "discovered",
    });
  }

  for (const identity of parsePreferredIdentities(input.identitiesSection)) {
    const key = normalizedLabel(identity.name);
    if (key === normalizedLabel(input.headingParts.name)) continue;
    identities.set(key, identity);
  }

  const alyne = /\bpresentarsi come\s+([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'\-]+)/.exec(
    input.content,
  );
  if (alyne?.[1] && normalizedLabel(input.headingParts.name) === "althea") {
    identities.set(normalizedLabel(alyne[1]), {
      name: alyne[1],
      isTrueIdentity: false,
      appearance: "umana senza fissa dimora",
      notes: "Identita' di copertura costruita dopo l'esilio.",
      visibility: "dm_only",
    });
  }

  return Array.from(identities.values());
}

function parsePreferredIdentities(markdown: string): ParsedPcIdentity[] {
  return markdown
    .split("\n")
    .map((line) => /^\s*[-*]\s+\*\*(.+?)\*\*,\s*(.+?)\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match?.[1] && match[2]))
    .map((match) => ({
      name: stripMarkdown(match[1] ?? "").replace(/\s+stesso$/i, ""),
      isTrueIdentity: false,
      appearance: null,
      notes: stripMarkdown(match[2] ?? ""),
      visibility: "dm_only" as const,
    }));
}

function buildPublicDescription(content: string): string {
  const first = firstMeaningfulParagraph(content);
  if (!first) return "";
  return first.length > 700 ? `${first.slice(0, 699)}...` : first;
}

function buildTags(headingParts: PcHeadingParts, content: string): string[] {
  const tags = new Set(["sherdan-import", "background-personaggi-md", "type:pc"]);
  const normalized = normalizedLabel(`${headingParts.name}\n${content}`);
  if (normalized.includes("vascell") || normalized.includes("sigill")) {
    tags.add("vascelli");
  }
  if (headingParts.nicknames.length > 0 || normalized.includes("identita")) {
    tags.add("identita-multiple");
  }
  if (normalized.includes("obsidium")) tags.add("obsidium");
  if (normalized.includes("ombra")) tags.add("ombra");
  return Array.from(tags);
}

function buildWarnings(
  headingParts: PcHeadingParts,
  properties: PcProperties,
): string[] {
  const warnings: string[] = [];
  if (!headingParts.race) warnings.push("Razza non trovata nell'heading.");
  if (!headingParts.characterClass) warnings.push("Classe non trovata nell'heading.");
  if (properties.level === DEFAULT_PC_LEVEL) {
    warnings.push("Livello non presente nel sorgente: impostato a 1.");
  }
  return warnings;
}

function canonicalPcName(rawName: string): string {
  return rawName
    .replace(/[“"][^”"]+[”"]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractQuotedNicknames(value: string): string[] {
  return Array.from(value.matchAll(/[“"]([^”"]+)[”"]/g))
    .map((match) => stripMarkdown(match[1] ?? ""))
    .filter(Boolean);
}

function trimEntrySeparators(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/^\s*\*{3,}\s*$/gm, "")
    .trim();
}

function firstMeaningfulParagraph(markdown: string): string | null {
  return (
    markdown
      .split(/\n{2,}/)
      .map(stripMarkdown)
      .find((paragraph) => paragraph && !paragraph.startsWith("###")) ?? null
  );
}

function lastMeaningfulParagraph(markdown: string): string | null {
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map(stripMarkdown)
    .filter((paragraph) => paragraph && !paragraph.startsWith("###"));
  return paragraphs.at(-1) ?? null;
}

function titleCase(value: string): string {
  return value.charAt(0).toLocaleUpperCase("it-IT") + value.slice(1);
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
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

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
