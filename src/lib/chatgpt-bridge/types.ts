import type {
  ChatGptBridgeAudience,
  ChatGptBridgeDensity,
  ChatGptBridgeTaskType,
} from "./prompt-templates";
import type { ChatGptBridgeUpdatePack } from "./schemas";

export type { ChatGptBridgeAudience, ChatGptBridgeDensity, ChatGptBridgeTaskType };

export interface ChatGptBridgeExportResult {
  ok: true;
  filename: string;
  markdown: string;
  estimatedCharacters: number;
  warnings: string[];
}

export interface CampaignSnapshot {
  id: string;
  name: string;
  description: string | null;
  settings?: unknown;
}

export interface SessionContextRow {
  id: string;
  number: number;
  title: string | null;
  date: string | null;
  recap: string | null;
  dmNotes?: string | null;
  prepNotes?: string | null;
}

export interface PlotThreadContextRow {
  id: string;
  title: string;
  description?: string | null;
  publicDescription: string | null;
  status: string;
  priority: number | null;
  visibility: string;
}

export interface TruthClueContextRow {
  id: string;
  description: string;
  truthRevealed?: string | null;
  status: string;
  statusNotes: string | null;
}

export interface EntitySecretContextRow {
  id: string;
  layer: string;
  content: string;
  exploitHint: string | null;
  entityName: string | null;
  plotThreadTitle: string | null;
}

export interface PcHookContextRow {
  id: string;
  pcName: string;
  targetName: string;
  hookDescription: string;
  potentialArc: string | null;
  status: string;
}

export interface EntityContextRow {
  id: string;
  type: string;
  name: string;
  description?: string | null;
  publicDescription: string | null;
  tags: string[];
  visibility: string;
  properties?: unknown;
}

export interface PlayerFacingStateContext {
  sceneTitle: string | null;
  sceneText: string | null;
  handouts: unknown;
  activeEntities: Array<{ id: string; name: string; publicDescription: string | null }>;
}

export interface ChatGptBridgeContext {
  campaign?: CampaignSnapshot | null;
  recentSessions?: SessionContextRow[];
  plotThreads?: PlotThreadContextRow[];
  truthClues?: TruthClueContextRow[];
  secrets?: EntitySecretContextRow[];
  pcHooks?: PcHookContextRow[];
  factions?: EntityContextRow[];
  location?: EntityContextRow | null;
  playerFacingState?: PlayerFacingStateContext | null;
}

export interface ChatGptBridgeImportAnalyzeResponse {
  ok: true;
  detectedTitle?: string;
  detectedSessionNumber?: number;
  hasUpdatePack: boolean;
  updatePack?: ChatGptBridgeUpdatePack;
  markdownWithoutUpdatePack: string;
  warnings: string[];
}

export type ReviewChange =
  | {
      kind: "session_update";
      label: string;
      before: unknown;
      after: unknown;
      applyPayload: unknown;
    }
  | {
      kind: "plot_thread_event_create";
      label: string;
      applyPayload: unknown;
    }
  | {
      kind: "truth_clue_create";
      label: string;
      applyPayload: unknown;
    }
  | {
      kind: "entity_update";
      label: string;
      before: unknown;
      after: unknown;
      applyPayload: unknown;
    }
  | {
      kind: "pc_hook_create";
      label: string;
      applyPayload: unknown;
    }
  | {
      kind: "entity_identity_create";
      label: string;
      applyPayload: unknown;
    }
  | {
      kind: "entity_secret_create";
      label: string;
      applyPayload: unknown;
    }
  | {
      kind: "entity_link_create";
      label: string;
      applyPayload: unknown;
    };
