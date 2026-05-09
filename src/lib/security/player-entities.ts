export interface PlayerEntitySource {
  id: string;
  campaignId: string;
  type: string;
  name: string;
  publicDescription: string | null;
  parentId: string | null;
  visibility: "public" | "discovered" | "dm_only";
  updatedAt: Date | string | null;
}

export interface PlayerSafeEntity {
  id: string;
  campaignId: string;
  type: string;
  name: string;
  description: string;
  parentId: string | null;
  visibility: "public" | "discovered";
  updatedAt: Date | string | null;
}

/**
 * Player-facing entity contract.
 *
 * This intentionally does NOT expose:
 * - GM `description`
 * - `properties` JSONB, because it may contain weaknesses, motivations or notes
 * - `tags`, because internal tags can reveal hidden structure
 * - embeddings
 * - secrets, truth clues, identities or GM notes
 */
export function projectEntityForPlayer(entity: PlayerEntitySource): PlayerSafeEntity | null {
  if (entity.visibility !== "public" && entity.visibility !== "discovered") {
    return null;
  }

  return {
    id: entity.id,
    campaignId: entity.campaignId,
    type: entity.type,
    name: entity.name,
    description: entity.publicDescription?.trim() ?? "",
    parentId: entity.parentId,
    visibility: entity.visibility,
    updatedAt: entity.updatedAt,
  };
}

export function projectEntitiesForPlayer(
  entities: readonly PlayerEntitySource[],
): PlayerSafeEntity[] {
  return entities.flatMap((entity) => {
    const projected = projectEntityForPlayer(entity);
    return projected ? [projected] : [];
  });
}
