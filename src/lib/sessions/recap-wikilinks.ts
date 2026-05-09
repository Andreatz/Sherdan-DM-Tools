export interface WikilinkEntityCandidate {
  id: string;
  name: string;
}

export interface SessionMentionEntity extends WikilinkEntityCandidate {
  wikilink: string;
}

const WIKILINK_RE = /\[\[([^\]|#\]\[\n]{1,200})(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;

export function parseRecapWikilinkNames(markdown: string | null | undefined) {
  if (!markdown) return [];

  const names: string[] = [];
  const seen = new Set<string>();

  for (const match of markdown.matchAll(WIKILINK_RE)) {
    const rawName = match[1]?.trim();
    if (!rawName) continue;

    const key = normalizeWikilinkName(rawName);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(rawName);
  }

  return names;
}

export function resolveRecapMentionEntities(
  wikilinkNames: string[],
  entities: WikilinkEntityCandidate[],
): SessionMentionEntity[] {
  const entityByName = new Map(
    entities.map((entity) => [normalizeWikilinkName(entity.name), entity]),
  );

  return wikilinkNames.flatMap((wikilink) => {
    const entity = entityByName.get(normalizeWikilinkName(wikilink));
    return entity ? [{ ...entity, wikilink }] : [];
  });
}

export function normalizeWikilinkName(name: string) {
  return name.trim().toLocaleLowerCase("it-IT");
}
