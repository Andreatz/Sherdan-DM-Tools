import {
  deityPropertiesSchema,
  type DeityProperties,
} from "@/lib/validation/deity";
import {
  locationPropertiesSchema,
  type LocationProperties,
} from "@/lib/validation/location";
import {
  organizationPropertiesSchema,
  type OrganizationProperties,
} from "@/lib/validation/organization";

type LoreEntityType = "deity" | "location" | "organization";
type Visibility = "dm_only" | "discovered" | "public";

interface SourceRef {
  file: string;
  heading: string;
  line: number;
  index: number | null;
}

interface LoreSection {
  heading: string;
  content: string;
  line: number;
}

interface SplitLoreText {
  publicMarkdown: string;
  gmMarkdown: string;
  lockedBlocks: number;
  fullGmOnly: boolean;
}

interface BaseLoreEntity {
  source: SourceRef;
  name: string;
  description: string;
  publicDescription: string;
  tags: string[];
  visibility: Visibility;
  lockedBlocks: number;
  warnings: string[];
}

export type ParsedLoreEntity =
  | (BaseLoreEntity & {
      type: "deity";
      properties: DeityProperties;
    })
  | (BaseLoreEntity & {
      type: "location";
      properties: LocationProperties;
    })
  | (BaseLoreEntity & {
      type: "organization";
      properties: OrganizationProperties;
    });

const LOCK_MARKER = "\u{1F512}";
const GM_NOTE_MARKER = "\u{1F4A1}";
const PRIVATE_MARKERS = [LOCK_MARKER, GM_NOTE_MARKER];

const LOCATION_NAMES = new Set([
  "domus nova",
  "tharros",
  "arborea",
  "eshterzyli",
  "urash",
  "y'tshal",
  "mineralia",
  "luxia",
  "solitaria",
  "bonorxili",
  "ultima dimora",
  "la madre",
  "il grande vuoto",
  "mare dei sussurri",
  "mare senza tempo",
  "baia dei corsari",
  "zona vulcanica",
  "il cuore verde",
  "le pianure verdi",
  "montagne di urash",
  "tabella riassuntiva dei santuari per citta",
]);

export function parseSherdanLoreMarkdown(
  markdown: string,
  options: { sourceFile?: string } = {},
): ParsedLoreEntity[] {
  const sourceFile = options.sourceFile ?? "Lore.md";
  return splitLoreSections(markdown).map((section) =>
    parseLoreSection(section, sourceFile),
  );
}

function splitLoreSections(markdown: string): LoreSection[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: LoreSection[] = [];
  let current: { heading: string; line: number; lines: string[] } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = /^#\s+(.+?)\s*$/.exec(line);
    if (heading?.[1]) {
      if (current) {
        sections.push({
          heading: current.heading,
          content: current.lines.join("\n").trim(),
          line: current.line,
        });
      }
      current = { heading: heading[1], line: index + 1, lines: [] };
      continue;
    }

    current?.lines.push(line);
  }

  if (current) {
    sections.push({
      heading: current.heading,
      content: current.lines.join("\n").trim(),
      line: current.line,
    });
  }

  return sections;
}

function parseLoreSection(
  section: LoreSection,
  sourceFile: string,
): ParsedLoreEntity {
  const headingParts = parseLoreHeading(section.heading);
  const split = splitPublicAndGmText(section.content);
  const type = classifyLoreSection(headingParts.name, headingParts.index);
  const base = {
    source: {
      file: sourceFile,
      heading: section.heading,
      line: section.line,
      index: headingParts.index,
    },
    name: headingParts.name,
    description: split.gmMarkdown,
    publicDescription: split.publicMarkdown,
    tags: buildTags(type, headingParts.name, split),
    visibility: "dm_only" as const,
    lockedBlocks: split.lockedBlocks,
    warnings: buildWarnings(section, split),
  };

  if (type === "deity") {
    return {
      ...base,
      type,
      properties: buildDeityProperties(section, split),
    };
  }

  if (type === "location") {
    return {
      ...base,
      type,
      properties: buildLocationProperties(headingParts.name, split),
    };
  }

  return {
    ...base,
    type,
    properties: buildOrganizationProperties(headingParts.name, split),
  };
}

function parseLoreHeading(heading: string) {
  const indexMatch = /^(\d+)/.exec(heading);
  return {
    index: indexMatch?.[1] ? Number.parseInt(indexMatch[1], 10) : null,
    name: stripMarkdown(heading.replace(/^\d+\.\s+/, "")),
  };
}

function splitPublicAndGmText(content: string): SplitLoreText {
  if (isEntirelyGmOnly(content)) {
    return {
      publicMarkdown: "",
      gmMarkdown: cleanMarkdown(content),
      lockedBlocks: countLockMarkers(content),
      fullGmOnly: true,
    };
  }

  const publicLines: string[] = [];
  const gmLines: string[] = [];
  let lockedBlock = false;
  let lockedParagraph = false;
  let lockedBlocks = 0;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed && lockedParagraph) {
      gmLines.push("");
      lockedParagraph = false;
      continue;
    }
    if (lockedParagraph) {
      gmLines.push(cleanMarkdown(line));
      continue;
    }
    if (trimmed === ">") {
      if (lockedBlock || lockedParagraph) {
        gmLines.push("");
      }
      continue;
    }
    if (trimmed.startsWith(">") && lockedBlock) {
      gmLines.push(cleanMarkdown(line));
      continue;
    }

    lockedBlock = false;
    const privateMarkerIndex = firstPrivateMarkerIndex(line);
    if (privateMarkerIndex === -1) {
      publicLines.push(line);
      continue;
    }

    lockedBlocks += 1;
    const beforeLock = line.slice(0, privateMarkerIndex);
    const afterLock = line.slice(privateMarkerIndex + privateMarkerLength(line, privateMarkerIndex));
    const publicPrefix = stripMarkdown(beforeLock);
    if (publicPrefix) {
      publicLines.push(beforeLock.trimEnd());
    }
    if (afterLock.trim()) {
      gmLines.push(cleanMarkdown(afterLock));
    }
    if (trimmed.startsWith(">")) {
      lockedBlock = true;
    }
    if (!publicPrefix && !trimmed.startsWith(">")) {
      lockedParagraph = true;
    }
  }

  return {
    publicMarkdown: compactMarkdown(publicLines.join("\n")),
    gmMarkdown: compactMarkdown(gmLines.join("\n")),
    lockedBlocks,
    fullGmOnly: false,
  };
}

function isEntirelyGmOnly(content: string): boolean {
  const firstMeaningful = content
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return Boolean(
    firstMeaningful !== undefined &&
      hasPrivateMarker(firstMeaningful) &&
      normalizedLabel(firstMeaningful).includes("interamente gm-only"),
  );
}

function classifyLoreSection(name: string, index: number | null): LoreEntityType {
  const normalized = normalizedLabel(name);
  if (normalized.includes("divinita") || normalized.includes("pantheon")) {
    return "deity";
  }
  if (LOCATION_NAMES.has(normalized) || (index !== null && index >= 17)) {
    return "location";
  }
  return "organization";
}

function buildDeityProperties(
  section: LoreSection,
  split: SplitLoreText,
): DeityProperties {
  return deityPropertiesSchema.parse({
    domains: extractPantheonDomains(section.content),
    holy_days: [],
    portfolio: firstMeaningfulParagraph(split.publicMarkdown),
    pantheon: "Sette di Sherdan",
    status: split.gmMarkdown ? "propaganda pubblica, verita' GM separata" : undefined,
    extra: {
      source_file: "Lore.md",
      source_heading: section.heading,
      locked_blocks: split.lockedBlocks,
    },
  });
}

function buildLocationProperties(
  name: string,
  split: SplitLoreText,
): LocationProperties {
  return locationPropertiesSchema.parse({
    kind: inferLocationKind(name),
    atmosphere: {
      layout: firstMeaningfulParagraph(split.publicMarkdown) ?? undefined,
      atmosphere: extractAtmosphere(split.publicMarkdown),
    },
    notable_features: extractH2Headings(split.publicMarkdown),
    services: [],
    extra: {
      source_file: "Lore.md",
      source_kind: "lore_location",
      locked_blocks: split.lockedBlocks,
    },
  });
}

function buildOrganizationProperties(
  name: string,
  split: SplitLoreText,
): OrganizationProperties {
  return organizationPropertiesSchema.parse({
    kind: inferOrganizationKind(name),
    purpose: firstMeaningfulParagraph(split.publicMarkdown) ?? undefined,
    structure: split.publicMarkdown || undefined,
    methods: extractH2Headings(split.publicMarkdown),
    territory_ids: [],
    member_ids: [],
    benefits: [],
    extra: {
      source_file: "Lore.md",
      source_kind: "lore_organization",
      locked_blocks: split.lockedBlocks,
      full_gm_only: split.fullGmOnly,
    },
  });
}

function inferLocationKind(name: string): LocationProperties["kind"] {
  const normalized = normalizedLabel(name);
  if (hasAny(normalized, ["mare", "baia", "la madre", "grande vuoto"])) {
    return normalized.includes("grande vuoto") ? "plane" : "region";
  }
  if (hasAny(normalized, ["cuore verde", "pianure", "montagne", "zona"])) {
    return "region";
  }
  if (normalized.includes("santuari")) return "structure";
  return "city";
}

function inferOrganizationKind(name: string): OrganizationProperties["kind"] {
  const normalized = normalizedLabel(name);
  if (hasAny(normalized, ["vincolatori", "vascelli"])) return "cult";
  if (hasAny(normalized, ["era", "scoperta", "espansione", "guerra"])) {
    return "school";
  }
  return "order";
}

function extractPantheonDomains(content: string): string[] {
  const rows = parseMarkdownTable(content)?.rows ?? [];
  const domains = rows
    .map((row) => stripMarkdown(row[1] ?? ""))
    .flatMap((cell) => cell.split(",").map((part) => part.trim()))
    .filter(isNonEmpty);
  return Array.from(new Set(domains));
}

function extractH2Headings(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => /^##\s+(.+?)\s*$/.exec(line)?.[1])
    .filter(isNonEmpty)
    .map(stripMarkdown);
}

function extractAtmosphere(markdown: string): string | undefined {
  const paragraph = firstMeaningfulParagraph(markdown);
  if (!paragraph) return undefined;
  return paragraph.length > 500 ? `${paragraph.slice(0, 499)}...` : paragraph;
}

function parseMarkdownTable(content: string) {
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

  return { headers: headers.map(stripMarkdown), rows: rows.slice(1) };
}

function firstMeaningfulParagraph(markdown: string): string | null {
  const paragraph = markdown
    .split(/\n{2,}/)
    .map((part) => stripMarkdown(part))
    .find((part) => part && !part.startsWith("|") && !part.startsWith("---"));
  return paragraph ?? null;
}

function buildTags(
  type: LoreEntityType,
  name: string,
  split: SplitLoreText,
): string[] {
  const tags = new Set(["sherdan-import", "lore-md", `type:${type}`]);
  const normalized = normalizedLabel(`${name}\n${split.publicMarkdown}`);
  if (split.lockedBlocks > 0) tags.add("gm-truth");
  if (hasAny(normalized, ["santuario", "trono"])) tags.add("santuari");
  if (hasAny(normalized, ["obsidium", "tharros"])) tags.add("obsidium");
  if (hasAny(normalized, ["vascell", "sigill"])) tags.add("vascelli");
  return Array.from(tags);
}

function buildWarnings(section: LoreSection, split: SplitLoreText): string[] {
  const warnings: string[] = [];
  if (split.lockedBlocks === 0 && section.content.includes("Segreto")) {
    warnings.push("Possibile segreto non marcato con lock.");
  }
  if (!split.publicMarkdown && !split.gmMarkdown) {
    warnings.push("Sezione vuota dopo lo split pubblico/GM.");
  }
  return warnings;
}

function countLockMarkers(content: string): number {
  return content
    .split("\n")
    .filter(hasPrivateMarker).length;
}

function cleanMarkdown(value: string): string {
  return stripMarkdown(
    PRIVATE_MARKERS.reduce(
      (cleaned, marker) => cleaned.replace(new RegExp(marker, "gu"), ""),
      value,
    ),
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

function stripMarkdown(value: string): string {
  return value
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

function hasAny(value: string, needles: string[]): boolean {
  const normalized = normalizedLabel(value);
  return needles.some((needle) => normalized.includes(needle));
}

function hasPrivateMarker(value: string): boolean {
  return PRIVATE_MARKERS.some((marker) => value.includes(marker));
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

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
