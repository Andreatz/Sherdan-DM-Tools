export interface PlayerSessionSource {
  id: string;
  campaignId: string;
  number: number;
  title: string | null;
  date: string | null;
  recap: string | null;
  updatedAt: Date | string | null;
}

export interface PlayerSafeSessionRecap {
  id: string;
  campaignId: string;
  number: number;
  title: string;
  date: string | null;
  recap: string;
  updatedAt: Date | string | null;
}

/**
 * Player-facing session recap contract.
 *
 * Intentionally exposes only `recap`; never `dmNotes` or `prepNotes`.
 */
export function projectSessionRecapForPlayer(
  session: PlayerSessionSource,
): PlayerSafeSessionRecap | null {
  const recap = session.recap?.trim();
  if (!recap) return null;

  return {
    id: session.id,
    campaignId: session.campaignId,
    number: session.number,
    title: session.title?.trim() || `Sessione ${session.number}`,
    date: session.date,
    recap,
    updatedAt: session.updatedAt,
  };
}

export function projectSessionRecapsForPlayer(
  sessions: readonly PlayerSessionSource[],
): PlayerSafeSessionRecap[] {
  return sessions.flatMap((session) => {
    const projected = projectSessionRecapForPlayer(session);
    return projected ? [projected] : [];
  });
}
