import { parseSherdanCampaignMarkdown } from "@/lib/parsers/sherdan-campaign";
import { parseSherdanFactionsMarkdown } from "@/lib/parsers/sherdan-factions";
import { parseSherdanForgiaMarkdown } from "@/lib/parsers/sherdan-forgia";
import { parseSherdanLoreMarkdown } from "@/lib/parsers/sherdan-lore";
import { parseSherdanNpcMarkdown } from "@/lib/parsers/sherdan-npc";
import { parseSherdanPcMarkdown } from "@/lib/parsers/sherdan-pc";
import { parseSherdanPlayerManualMarkdown } from "@/lib/parsers/sherdan-player-manual";

type EntityType =
  | "npc"
  | "pc"
  | "location"
  | "faction"
  | "item"
  | "monster"
  | "deity"
  | "organization";

type Visibility = "dm_only" | "discovered" | "public";
type SecretLayer = "surface" | "intermediate" | "deep";
type PlotThreadStatus = "hot" | "warm" | "cold" | "resolved" | "abandoned";

interface BootstrapSourceRef {
  file: string;
  heading: string;
  line: number;
  index: number | null;
}

export interface SherdanBootstrapSources {
  npc: string;
  factions: string;
  lore: string;
  campaign: string;
  backgrounds: string;
  playerManual: string;
  // Manuale crafting homebrew. Opzionale: se il file non esiste o e'
  // vuoto, l'import salta silenziosamente (bootstrap rimane idempotente
  // per dataset parziali).
  forgia?: string;
}

export interface BootstrapIdentity {
  name: string;
  isTrueIdentity: boolean;
  appearance: string | null;
  voice: string | null;
  mannerisms: string[];
  visibility: Visibility;
  notes: string | null;
}

export interface BootstrapSecret {
  layer: SecretLayer;
  content: string;
  exploitHint: string | null;
}

export interface BootstrapEntity {
  key: string;
  source: BootstrapSourceRef;
  parentKey: string | null;
  type: EntityType;
  name: string;
  description: string;
  publicDescription: string;
  properties: unknown;
  tags: string[];
  visibility: Visibility;
  identities: BootstrapIdentity[];
  secrets: BootstrapSecret[];
  aliases: string[];
}

export interface BootstrapPcHook {
  pcName: string;
  targetEntityKey: string;
  hookDescription: string;
  potentialArc: string | null;
  status: "available";
}

export interface BootstrapDeferredLink {
  sourceEntityKey: string;
  targetName: string;
  relationType: string;
  publicRelationType: string | null;
  description: string;
  visibility: Visibility;
}

export interface BootstrapEntityLink {
  sourceEntityKey: string;
  targetEntityKey: string;
  relationType: string;
  publicRelationType: string | null;
  strength: number | null;
  description: string;
  visibility: Visibility;
  source: "parser-table" | "wikilink" | "section-ref";
}

export interface BootstrapUnresolvedLink {
  sourceEntityKey: string;
  targetName: string;
  relationType: string;
  description: string;
  reason: "unknown-target" | "self-reference";
  source: "parser-table" | "wikilink" | "section-ref";
}

export interface BootstrapSession {
  number: number;
  title: string;
  date: string;
  recap: string;
  prepNotes: string;
}

export interface BootstrapPlotThread {
  title: string;
  description: string;
  publicDescription: string;
  status: PlotThreadStatus;
  priority: number;
  visibility: Visibility;
}

export interface BootstrapRuleDocument {
  source: "sherdan-custom";
  title: string;
  section: string;
  content: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

export interface SherdanBootstrapPlan {
  entities: BootstrapEntity[];
  pcHooks: BootstrapPcHook[];
  deferredLinks: BootstrapDeferredLink[];
  entityLinks: BootstrapEntityLink[];
  unresolvedLinks: BootstrapUnresolvedLink[];
  sessions: BootstrapSession[];
  plotThreads: BootstrapPlotThread[];
  ruleDocuments: BootstrapRuleDocument[];
}

export function buildSherdanBootstrapPlan(
  sources: SherdanBootstrapSources,
): SherdanBootstrapPlan {
  const pcEntities = parseSherdanPcMarkdown(sources.backgrounds).map((pc) => ({
    key: entityKey("pc", pc.name),
    source: toBootstrapSource(pc.source),
    parentKey: null,
    type: "pc" as const,
    name: pc.name,
    description: pc.description,
    publicDescription: pc.publicDescription,
    properties: pc.properties,
    tags: pc.tags,
    visibility: pc.visibility,
    identities: pc.identities.map((identity) => ({
      ...identity,
      voice: null,
      mannerisms: [],
    })),
    secrets: [],
    aliases: pc.identities.map((identity) => identity.name),
  }));

  const npcRows = parseSherdanNpcMarkdown(sources.npc);
  const npcEntities = npcRows.map((npc) => ({
    key: entityKey("npc", npc.name),
    source: toBootstrapSource(npc.source),
    parentKey: null,
    type: "npc" as const,
    name: npc.name,
    description: npc.description,
    publicDescription: npc.publicDescription,
    properties: npc.properties,
    tags: npc.tags,
    visibility: npc.visibility,
    identities: npc.identities.map((identity) => ({
      ...identity,
      mannerisms: [],
    })),
    secrets: npc.secrets.map((secret) => ({
      ...secret,
      exploitHint: null,
    })),
    aliases: npc.identities.map((identity) => identity.name),
  }));

  const factionRows = parseSherdanFactionsMarkdown(sources.factions);
  const factionEntities = factionRows.flatMap((faction) => {
    const factionKey = entityKey("faction", faction.name);
    const parent: BootstrapEntity = {
      key: factionKey,
      source: toBootstrapSource(faction.source),
      parentKey: null,
      type: "faction",
      name: faction.name,
      description: faction.description,
      publicDescription: faction.publicDescription,
      properties: faction.properties,
      tags: faction.tags,
      visibility: faction.visibility,
      identities: [],
      secrets: faction.secrets.map((secret) => ({
        ...secret,
        exploitHint: null,
      })),
      aliases: [],
    };

    const lieutenants = faction.lieutenantEntities.map((lieutenant) => ({
      key: entityKey("npc", lieutenant.name),
      source: toBootstrapSource(lieutenant.source),
      parentKey: factionKey,
      type: "npc" as const,
      name: lieutenant.name,
      description: lieutenant.description,
      publicDescription: lieutenant.publicDescription,
      properties: lieutenant.properties,
      tags: lieutenant.tags,
      visibility: lieutenant.visibility,
      identities: [],
      secrets: [],
      aliases: [],
    }));

    return [parent, ...lieutenants];
  });

  const loreEntities = parseSherdanLoreMarkdown(sources.lore).map((entity) => ({
    key: entityKey(entity.type, entity.name),
    source: toBootstrapSource(entity.source),
    parentKey: null,
    type: entity.type,
    name: entity.name,
    description: entity.description,
    publicDescription: entity.publicDescription,
    properties: entity.properties,
    tags: entity.tags,
    visibility: entity.visibility,
    identities: [],
    secrets: [],
    aliases: [],
  }));

  const campaign = parseSherdanCampaignMarkdown(sources.campaign);
  const playerManual = parseSherdanPlayerManualMarkdown(sources.playerManual);
  const forgia = sources.forgia
    ? parseSherdanForgiaMarkdown(sources.forgia)
    : [];
  const entities = [
    ...pcEntities,
    ...npcEntities,
    ...factionEntities,
    ...loreEntities,
  ];
  const deferredLinks = [
    ...npcRows.flatMap((npc) =>
      npc.entityLinks.map((link) => ({
        sourceEntityKey: entityKey("npc", npc.name),
        targetName: link.targetName,
        relationType: link.relationType,
        publicRelationType: link.publicRelationType,
        description: link.description,
        visibility: link.visibility,
      })),
    ),
    ...factionRows.flatMap((faction) =>
      faction.entityLinks.map((link) => ({
        sourceEntityKey: entityKey("faction", faction.name),
        targetName: link.targetName,
        relationType: link.relationType,
        publicRelationType: link.publicRelationType,
        description: link.description,
        visibility: link.visibility,
      })),
    ),
  ];
  const crossReferences = buildCrossReferenceLinks(entities, deferredLinks);

  return {
    entities,
    pcHooks: [
      ...npcRows.flatMap((npc) =>
        npc.pcHooks.map((hook) => ({
          pcName: hook.pcName,
          targetEntityKey: entityKey("npc", npc.name),
          hookDescription: hook.hookDescription,
          potentialArc: null,
          status: hook.status,
        })),
      ),
      ...factionRows.flatMap((faction) =>
        faction.pcHooks.map((hook) => ({
          pcName: hook.pcName,
          targetEntityKey: entityKey("faction", faction.name),
          hookDescription: hook.hookDescription,
          potentialArc: null,
          status: hook.status,
        })),
      ),
    ],
    deferredLinks,
    entityLinks: crossReferences.entityLinks,
    unresolvedLinks: crossReferences.unresolvedLinks,
    sessions: campaign.sessions.map((session) => ({
      number: session.number,
      title: session.title,
      date: session.date,
      recap: session.recap,
      prepNotes: session.prepNotes,
    })),
    plotThreads: campaign.plotThreads.map((thread) => ({
      title: thread.title,
      description: thread.description,
      publicDescription: thread.publicDescription,
      status: thread.status,
      priority: thread.priority,
      visibility: thread.visibility,
    })),
    ruleDocuments: [
      ...playerManual.map((document) => ({
        source: document.source,
        title: document.title,
        section: document.section,
        content: document.content,
        chunkIndex: document.chunkIndex,
        metadata: document.metadata as Record<string, unknown>,
      })),
      ...forgia.map((document) => ({
        source: document.source,
        title: document.title,
        section: document.section,
        content: document.content,
        chunkIndex: document.chunkIndex,
        metadata: document.metadata as Record<string, unknown>,
      })),
    ],
  };
}

export function entityKey(type: EntityType, name: string): string {
  return `${type}:${normalizedLabel(name)}`;
}

export function normalizedLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it-IT")
    .trim();
}

function buildCrossReferenceLinks(
  entities: BootstrapEntity[],
  deferredLinks: BootstrapDeferredLink[],
) {
  const resolver = buildEntityResolver(entities);
  const entityLinks: BootstrapEntityLink[] = [];
  const unresolvedLinks: BootstrapUnresolvedLink[] = [];
  const seen = new Set<string>();

  for (const link of deferredLinks) {
    addResolvedCandidate({
      sourceEntityKey: link.sourceEntityKey,
      targetName: link.targetName,
      relationType: link.relationType,
      publicRelationType: link.publicRelationType,
      strength: null,
      description: link.description,
      visibility: link.visibility,
      source: "parser-table",
    });
  }

  for (const entity of entities) {
    for (const reference of extractTextReferences(entity, entity.description, "dm_only")) {
      addResolvedCandidate(reference);
    }
    for (const reference of extractTextReferences(entity, entity.publicDescription, "public")) {
      addResolvedCandidate(reference);
    }
  }

  return { entityLinks, unresolvedLinks };

  function addResolvedCandidate(
    candidate: Omit<BootstrapEntityLink, "targetEntityKey"> & {
      targetName: string;
    },
  ) {
    const targetEntityKey = resolver.resolveName(candidate.targetName);
    if (!targetEntityKey) {
      unresolvedLinks.push({
        sourceEntityKey: candidate.sourceEntityKey,
        targetName: candidate.targetName,
        relationType: candidate.relationType,
        description: candidate.description,
        reason: "unknown-target",
        source: candidate.source,
      });
      return;
    }
    if (targetEntityKey === candidate.sourceEntityKey) {
      unresolvedLinks.push({
        sourceEntityKey: candidate.sourceEntityKey,
        targetName: candidate.targetName,
        relationType: candidate.relationType,
        description: candidate.description,
        reason: "self-reference",
        source: candidate.source,
      });
      return;
    }
    pushUnique({
      sourceEntityKey: candidate.sourceEntityKey,
      targetEntityKey,
      relationType: candidate.relationType,
      publicRelationType: candidate.publicRelationType,
      strength: candidate.strength,
      description: candidate.description,
      visibility: candidate.visibility,
      source: candidate.source,
    });
  }

  function pushUnique(link: BootstrapEntityLink) {
    const key = [
      link.sourceEntityKey,
      link.targetEntityKey,
      link.relationType,
      link.description,
    ].join("\0");
    if (seen.has(key)) return;
    seen.add(key);
    entityLinks.push(link);
  }

  function extractTextReferences(
    entity: BootstrapEntity,
    markdown: string,
    visibility: Visibility,
  ): Array<
    Omit<BootstrapEntityLink, "targetEntityKey"> & {
      targetName: string;
    }
  > {
    const references: Array<
      Omit<BootstrapEntityLink, "targetEntityKey"> & {
        targetName: string;
      }
    > = [];
    const wikilinkRegex = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
    for (const match of markdown.matchAll(wikilinkRegex)) {
      const targetName = match[1]?.trim();
      if (!targetName) continue;
      references.push({
        sourceEntityKey: entity.key,
        targetName,
        relationType: "references",
        publicRelationType: null,
        strength: null,
        description: `Wikilink importato da ${entity.source.file}: ${targetName}`,
        visibility,
        source: "wikilink",
      });
    }

    const sectionRefRegex = /\b(?:(NPC|Lore|Fazioni|Campagna)\s*)?§\s*(\d+)/gi;
    for (const match of markdown.matchAll(sectionRefRegex)) {
      const file = fileForSectionReference(match[1], entity.source.file);
      const index = parseRefIndex(match[2]);
      const targetName = index === null ? null : resolver.resolveSourceIndex(file, index);
      if (!targetName) {
        references.push({
          sourceEntityKey: entity.key,
          targetName: `${file} §${match[2] ?? ""}`,
          relationType: "references",
          publicRelationType: null,
          strength: null,
          description: `Riferimento di sezione importato da ${entity.source.file}`,
          visibility,
          source: "section-ref",
        });
        continue;
      }
      references.push({
        sourceEntityKey: entity.key,
        targetName,
        relationType: "references",
        publicRelationType: null,
        strength: null,
        description: `Riferimento di sezione importato da ${entity.source.file}: §${match[2] ?? ""}`,
        visibility,
        source: "section-ref",
      });
    }

    const localHashRefRegex = /\bvedi\s+#\s*(\d+)/gi;
    for (const match of markdown.matchAll(localHashRefRegex)) {
      const index = parseRefIndex(match[1]);
      const targetName =
        index === null ? null : resolver.resolveSourceIndex(entity.source.file, index);
      references.push({
        sourceEntityKey: entity.key,
        targetName: targetName ?? `${entity.source.file} #${match[1] ?? ""}`,
        relationType: "references",
        publicRelationType: null,
        strength: null,
        description: `Riferimento locale importato da ${entity.source.file}: #${match[1] ?? ""}`,
        visibility,
        source: "section-ref",
      });
    }

    return references;
  }
}

function buildEntityResolver(entities: BootstrapEntity[]) {
  const names = new Map<string, string>();
  const sourceIndexes = new Map<string, string>();

  for (const entity of entities) {
    for (const alias of buildEntityAliases(entity)) {
      addName(alias, entity.key);
    }
    if (entity.source.index !== null) {
      sourceIndexes.set(sourceIndexKey(entity.source.file, entity.source.index), entity.name);
    }
  }

  addManualAliases();

  return {
    resolveName,
    resolveSourceIndex(file: string, index: number): string | null {
      return sourceIndexes.get(sourceIndexKey(file, index)) ?? null;
    },
  };

  function resolveName(rawName: string): string | null {
    for (const candidate of targetNameCandidates(rawName)) {
      const resolved = names.get(normalizeAlias(candidate));
      if (resolved) return resolved;
    }
    return null;
  }

  function addName(alias: string, key: string) {
    const normalized = normalizeAlias(alias);
    if (!normalized || names.has(normalized)) return;
    names.set(normalized, key);
  }

  function addManualAliases() {
    const aliases: Array<[string, string]> = [
      ["Eclissi", "faction:l'eclissi"],
      ["L'Eclissi (Resistenza)", "faction:l'eclissi"],
      ["Eclissi (Resistenza)", "faction:l'eclissi"],
      ["Eclissi (la Resistenza)", "faction:l'eclissi"],
      ["La Resistenza", "faction:l'eclissi"],
      ["Resistenza", "faction:l'eclissi"],
      ["Signori della Ruggine", "faction:i signori della ruggine"],
      ["Figli del Kraken", "faction:i figli del kraken"],
      ["Valchirie della Burrasca", "faction:le valchirie della burrasca"],
      ["Loggia", "faction:la loggia degli archeologi"],
      ["La Loggia", "faction:la loggia degli archeologi"],
      ["Loggia degli Archeologi", "faction:la loggia degli archeologi"],
      ["Conservatori", "faction:circolo dei custodi (arborea)"],
      ["Conservatori di Arborea", "faction:circolo dei custodi (arborea)"],
      ["Conservatori (Arborea)", "faction:circolo dei custodi (arborea)"],
      ["Circolo dei Custodi", "faction:circolo dei custodi (arborea)"],
      ["Consiglio del Progresso", "faction:consiglio del progresso (tharros)"],
      ["Tharros (Synapse)", "faction:la synapse"],
      ["Synapse", "faction:la synapse"],
      ["Le sei false divinita", "deity:le sette divinita — i fratelli del primo giorno"],
      ["Sei false divinita", "deity:le sette divinita — i fratelli del primo giorno"],
      ["False divinita", "deity:le sette divinita — i fratelli del primo giorno"],
      ["Mitra", "deity:le sette divinita — i fratelli del primo giorno"],
      ["Mitra (il prigioniero)", "deity:le sette divinita — i fratelli del primo giorno"],
      ["Malakor", 'npc:malakor "lo sfregiato"'],
    ];

    for (const [alias, key] of aliases) {
      if (entities.some((entity) => entity.key === key)) {
        addName(alias, key);
      }
    }
  }
}

function buildEntityAliases(entity: BootstrapEntity): string[] {
  const aliases = new Set<string>([entity.name, ...entity.aliases]);
  for (const alias of Array.from(aliases)) {
    const withoutParenthetical = alias.replace(/\s*\([^)]*\)\s*/g, " ").trim();
    if (withoutParenthetical) aliases.add(withoutParenthetical);
    const withoutArticle = stripLeadingArticle(alias);
    if (withoutArticle) aliases.add(withoutArticle);
    const beforeDash = alias.split(/\s+[—-]\s+/)[0]?.trim();
    if (beforeDash) aliases.add(beforeDash);
    const beforeQuestion = alias.split(/\s+\?\s+/)[0]?.trim();
    if (beforeQuestion) aliases.add(beforeQuestion);
    for (const part of alias.split("/")) {
      const cleaned = part.trim();
      if (cleaned) aliases.add(cleaned);
    }
  }
  return Array.from(aliases);
}

function targetNameCandidates(rawName: string): string[] {
  const cleaned = rawName.replace(/"/g, "").trim();
  const candidates = new Set([rawName, cleaned]);
  const withoutParenthetical = cleaned.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  if (withoutParenthetical) candidates.add(withoutParenthetical);
  const beforeParenthetical = cleaned.split(/\s+\(/)[0]?.trim();
  if (beforeParenthetical) candidates.add(beforeParenthetical);
  for (const candidate of Array.from(candidates)) {
    const withoutArticle = stripLeadingArticle(candidate);
    if (withoutArticle) candidates.add(withoutArticle);
  }
  return Array.from(candidates);
}

function normalizeAlias(value: string): string {
  return normalizedLabel(value)
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingArticle(value: string): string {
  return value
    .trim()
    .replace(/^(?:il|lo|la|i|gli|le|l')\s+/i, "")
    .replace(/^l'/i, "")
    .trim();
}

function fileForSectionReference(
  qualifier: string | undefined,
  currentFile: string,
): string {
  const normalized = normalizedLabel(qualifier ?? "");
  if (normalized === "npc") return "NPC.md";
  if (normalized === "lore") return "Lore.md";
  if (normalized === "fazioni" || normalized === "fazione") return "Fazioni.md";
  if (normalized === "campagna") return "Campagna.md";
  return currentFile;
}

function parseRefIndex(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function sourceIndexKey(file: string, index: number): string {
  return `${normalizedLabel(file)}:${index}`;
}

function toBootstrapSource(source: {
  file: string;
  heading: string;
  line: number;
  index?: number | null;
}): BootstrapSourceRef {
  return {
    file: source.file,
    heading: source.heading,
    line: source.line,
    index: source.index ?? null,
  };
}
