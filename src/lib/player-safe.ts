type JsonRecord = Record<string, unknown>;
type PlayerVisibility = "player_visible" | "public";

const BLOCKED_PROPERTY_KEYS = new Set([
  "secret",
  "secrets",
  "gm",
  "gm_only",
  "gmOnly",
  "truth",
  "truth_revealed",
  "truthRevealed",
  "exploit",
  "exploit_hint",
  "exploitHint",
  "private",
  "dm",
  "dm_only",
  "dmOnly",
]);

export interface PlayerSafeEntityInput {
  id: string;
  campaignId?: string;
  type: string;
  name: string;
  publicDescription?: string | null;
  description?: string | null;
  properties?: unknown;
  tags?: string[] | null;
  parentId?: string | null;
  visibility?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  embedding?: unknown;
}

export interface PlayerSafeEntity {
  id: string;
  campaignId?: string;
  type: string;
  name: string;
  description: string | null;
  properties: JsonRecord;
  tags: string[];
  parentId: string | null;
  visibility: PlayerVisibility;
}

export interface PlayerSafeEntityLinkInput {
  id: string;
  campaignId?: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType?: string | null;
  publicRelationType?: string | null;
  strength?: number | null;
  description?: string | null;
  visibility?: string;
  createdAt?: unknown;
}

export interface PlayerSafeEntityLink {
  id: string;
  campaignId?: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string | null;
  strength: number | null;
  description: string | null;
  visibility: PlayerVisibility;
}

export interface PlayerSafeTruthClueInput {
  id: string;
  campaignId?: string;
  description: string;
  status?: string;
  statusNotes?: string | null;
  plantedInSession?: string | null;
  relatedPlotThreadId?: string | null;
  relatedEntities?: string[] | null;
  truthRevealed?: string;
  visibility?: string;
}

export interface PlayerSafeTruthClue {
  id: string;
  campaignId?: string;
  description: string;
  status: string | null;
  statusNotes: string | null;
  plantedInSession: string | null;
  relatedPlotThreadId: string | null;
  relatedEntities: string[];
  visibility: PlayerVisibility;
}

export function isPlayerVisible(value: { visibility?: string | null }): boolean {
  return toPlayerVisibility(value.visibility) !== null;
}

export function toPlayerSafeEntity(
  entity: PlayerSafeEntityInput,
): PlayerSafeEntity | null {
  const visibility = toPlayerVisibility(entity.visibility);
  if (!visibility) return null;

  return {
    id: entity.id,
    ...(entity.campaignId ? { campaignId: entity.campaignId } : {}),
    type: entity.type,
    name: entity.name,
    description: entity.publicDescription ?? null,
    properties: sanitizePlayerProperties(entity.properties),
    tags: entity.tags ?? [],
    parentId: entity.parentId ?? null,
    visibility,
  };
}

export function toPlayerSafeEntityLink(
  link: PlayerSafeEntityLinkInput,
): PlayerSafeEntityLink | null {
  const visibility = toPlayerVisibility(link.visibility);
  if (!visibility) return null;

  return {
    id: link.id,
    ...(link.campaignId ? { campaignId: link.campaignId } : {}),
    sourceEntityId: link.sourceEntityId,
    targetEntityId: link.targetEntityId,
    relationType: link.publicRelationType ?? null,
    strength: link.strength ?? null,
    description: link.description ?? null,
    visibility,
  };
}

export function toPlayerSafeTruthClue(
  clue: PlayerSafeTruthClueInput,
): PlayerSafeTruthClue | null {
  const visibility = toPlayerVisibility(clue.visibility);
  if (!visibility) return null;

  return {
    id: clue.id,
    ...(clue.campaignId ? { campaignId: clue.campaignId } : {}),
    description: clue.description,
    status: clue.status ?? null,
    statusNotes: clue.statusNotes ?? null,
    plantedInSession: clue.plantedInSession ?? null,
    relatedPlotThreadId: clue.relatedPlotThreadId ?? null,
    relatedEntities: clue.relatedEntities ?? [],
    visibility,
  };
}

export function sanitizePlayerProperties(value: unknown): JsonRecord {
  if (!isRecord(value)) return {};

  const safe: JsonRecord = {};
  for (const [key, child] of Object.entries(value)) {
    if (isBlockedPropertyKey(key)) continue;
    const sanitized = sanitizeUnknown(child);
    if (sanitized !== undefined) safe[key] = sanitized;
  }
  return safe;
}

function sanitizeUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeUnknown(item))
      .filter((item) => item !== undefined);
  }

  if (isRecord(value)) {
    const safe: JsonRecord = {};
    for (const [key, child] of Object.entries(value)) {
      if (isBlockedPropertyKey(key)) continue;
      const sanitized = sanitizeUnknown(child);
      if (sanitized !== undefined) safe[key] = sanitized;
    }
    return safe;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  return undefined;
}

function toPlayerVisibility(value: string | null | undefined): PlayerVisibility | null {
  if (value === "player_visible" || value === "public") return value;
  return null;
}

function isBlockedPropertyKey(key: string): boolean {
  if (BLOCKED_PROPERTY_KEYS.has(key)) return true;
  const normalized = key.toLowerCase();
  return (
    normalized.includes("secret") ||
    normalized.includes("gm") ||
    normalized.includes("truth") ||
    normalized.includes("exploit") ||
    normalized.includes("private") ||
    normalized.includes("dm_only")
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
