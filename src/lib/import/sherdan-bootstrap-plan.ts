import { parseSherdanCampaignMarkdown } from "@/lib/parsers/sherdan-campaign";
import { parseSherdanFactionsMarkdown } from "@/lib/parsers/sherdan-factions";
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

export interface SherdanBootstrapSources {
  npc: string;
  factions: string;
  lore: string;
  campaign: string;
  backgrounds: string;
  playerManual: string;
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
  sessions: BootstrapSession[];
  plotThreads: BootstrapPlotThread[];
  ruleDocuments: BootstrapRuleDocument[];
}

export function buildSherdanBootstrapPlan(
  sources: SherdanBootstrapSources,
): SherdanBootstrapPlan {
  const pcEntities = parseSherdanPcMarkdown(sources.backgrounds).map((pc) => ({
    key: entityKey("pc", pc.name),
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
  }));

  const npcRows = parseSherdanNpcMarkdown(sources.npc);
  const npcEntities = npcRows.map((npc) => ({
    key: entityKey("npc", npc.name),
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
  }));

  const factionRows = parseSherdanFactionsMarkdown(sources.factions);
  const factionEntities = factionRows.flatMap((faction) => {
    const factionKey = entityKey("faction", faction.name);
    const parent: BootstrapEntity = {
      key: factionKey,
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
    };

    const lieutenants = faction.lieutenantEntities.map((lieutenant) => ({
      key: entityKey("npc", lieutenant.name),
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
    }));

    return [parent, ...lieutenants];
  });

  const loreEntities = parseSherdanLoreMarkdown(sources.lore).map((entity) => ({
    key: entityKey(entity.type, entity.name),
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
  }));

  const campaign = parseSherdanCampaignMarkdown(sources.campaign);
  const playerManual = parseSherdanPlayerManualMarkdown(sources.playerManual);

  return {
    entities: [
      ...pcEntities,
      ...npcEntities,
      ...factionEntities,
      ...loreEntities,
    ],
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
    deferredLinks: [
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
    ],
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
    ruleDocuments: playerManual.map((document) => ({
      source: document.source,
      title: document.title,
      section: document.section,
      content: document.content,
      chunkIndex: document.chunkIndex,
      metadata: document.metadata,
    })),
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
