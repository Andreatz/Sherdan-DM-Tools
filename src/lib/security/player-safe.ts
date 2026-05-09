type Audience = "dm" | "player" | "public";

type JsonRecord = Record<string, unknown>;

const GM_ONLY_KEYS = new Set([
  "description",
  "dmNotes",
  "dm_notes",
  "prepNotes",
  "prep_notes",
  "entitySecrets",
  "entity_secrets",
  "truthRevealed",
  "truth_revealed",
  "exploitHint",
  "exploit_hint",
  "discoveryNotes",
  "discovery_notes",
  "isTrueIdentity",
  "is_true_identity",
  "embedding",
]);

const PUBLIC_DESCRIPTION_KEYS = new Set(["publicDescription", "public_description"]);

export interface ProjectionOptions {
  audience: Audience;
}

/**
 * Returns a defensive copy for player/public surfaces.
 *
 * This helper is intentionally conservative: anything explicitly GM-only is
 * removed unless the caller asks for `audience: "dm"`. It is not a replacement
 * for route-level authorization, but it is the shared last-mile sanitizer that
 * Player Dashboard and handout exports must use before serializing data.
 */
export function projectForAudience<T>(value: T, options: ProjectionOptions): T {
  if (options.audience === "dm") return value;
  return projectUnknown(value) as T;
}

export function isPlayerSafeKey(key: string): boolean {
  return !GM_ONLY_KEYS.has(key);
}

function projectUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => projectUnknown(item));
  }

  if (!isPlainRecord(value)) return value;

  const projected: JsonRecord = {};

  for (const [key, nested] of Object.entries(value)) {
    if (!isPlayerSafeKey(key)) continue;

    // Normalize publicDescription/public_description to description on player
    // surfaces, so components can render a single safe field without knowing
    // about the GM/private split.
    if (PUBLIC_DESCRIPTION_KEYS.has(key)) {
      if (typeof nested === "string" && nested.trim().length > 0) {
        projected.description = nested;
      }
      continue;
    }

    projected[key] = projectUnknown(nested);
  }

  return projected;
}

function isPlainRecord(value: unknown): value is JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.getPrototypeOf(value) === Object.prototype;
}
