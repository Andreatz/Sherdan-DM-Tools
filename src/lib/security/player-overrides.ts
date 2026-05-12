import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  entities,
  playerVisibilityOverrides,
  type playerVisibilityMode,
  type playerVisibilityTarget,
} from "@/db/schema";

export type OverrideTarget = (typeof playerVisibilityTarget.enumValues)[number];
export type OverrideMode = (typeof playerVisibilityMode.enumValues)[number];

export interface PlayerOverridesByTarget {
  hidden: Set<string>;
  revealed: Set<string>;
}

// Carica gli override di un singolo giocatore raggruppati per `targetType`.
// Mappa pronta per il filtro: `hidden` esclude da output, `revealed` include
// anche se la visibilita' base lo nasconderebbe. Nessun side-effect.
export async function loadPlayerOverrides(
  playerId: string,
): Promise<Record<OverrideTarget, PlayerOverridesByTarget>> {
  const rows = await db
    .select({
      targetType: playerVisibilityOverrides.targetType,
      targetId: playerVisibilityOverrides.targetId,
      mode: playerVisibilityOverrides.mode,
    })
    .from(playerVisibilityOverrides)
    .where(eq(playerVisibilityOverrides.playerId, playerId));

  const init = (): PlayerOverridesByTarget => ({
    hidden: new Set(),
    revealed: new Set(),
  });
  const map: Record<OverrideTarget, PlayerOverridesByTarget> = {
    entity: init(),
    truth_clue: init(),
    entity_secret: init(),
  };
  for (const row of rows) {
    map[row.targetType][row.mode].add(row.targetId);
  }
  return map;
}

// Applica gli override `entity` su una lista di entita' gia' filtrate per
// visibilita' base. Logica:
// - se l'id e' in `hidden`, escludi la riga;
// - non aggiungiamo qui le `revealed`: la fetch base le ha gia' escluse
//   se erano dm_only. Per garantire che le `revealed` siano incluse, il
//   chiamante deve estendere la query base con un OR (vedi `revealedIds`).
//
// Il risultato non e' "proiettato" — il chiamante chiama poi il proiettore
// player-safe per zero leakage.
export function applyEntityHidden<T extends { id: string }>(
  rows: readonly T[],
  hidden: ReadonlySet<string>,
): T[] {
  if (hidden.size === 0) return [...rows];
  return rows.filter((row) => !hidden.has(row.id));
}

// Helper per estendere la SELECT base entities con le `revealed` di un
// player: l'idea e' che la query base seleziona visibility IN (public,
// discovered), poi noi UNIONiamo le entita' `dm_only` esplicitamente
// rivelate per quel giocatore. Ritorniamo gli id risolti che il route
// puo' poi OR-are al where iniziale.
//
// Implementato come secondo round-trip per non complicare il WHERE: dato
// che `revealed.size` e' tipicamente piccolo (decine), e' piu' chiaro e
// resta veloce. Il fetch base resta single-query.
export async function fetchRevealedEntities(
  campaignId: string,
  revealedIds: ReadonlySet<string>,
  columns: Parameters<typeof db.select>[0],
): Promise<Array<Record<string, unknown>>> {
  if (revealedIds.size === 0) return [];
  return db
    .select(columns)
    .from(entities)
    .where(
      and(
        eq(entities.campaignId, campaignId),
        inArray(entities.id, Array.from(revealedIds)),
      ),
    );
}

export interface ApplyOverrideOptions<T extends { id: string }> {
  /** Override gia' caricati per il player corrente. */
  overrides: PlayerOverridesByTarget;
  /** Righe gia' fetchate via visibility-base + (eventuale) revealed-include. */
  rows: readonly T[];
}

export function applyOverridesToList<T extends { id: string }>(
  options: ApplyOverrideOptions<T>,
): T[] {
  return applyEntityHidden(options.rows, options.overrides.hidden);
}
