import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";

// Player identity per-campagna. Ogni giocatore reale (Alice, Bob, ...) ha
// un suo record con codice individuale hashato. La login API confronta
// l'hash, mai il codice in chiaro. `active=false` revoca l'accesso senza
// cancellare lo storico (audit log riferisce al playerId).
export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // HMAC-SHA256(SHERDAN_PLAYER_ACCESS_CODE, plainCode). Indicizzato per
    // lookup O(1) sul login.
    codeHash: text("code_hash").notNull(),
    active: boolean("active").default(true).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_players_campaign").on(t.campaignId),
    unique("uq_players_campaign_name").on(t.campaignId, t.name),
    // Hash globalmente unico: l'index serve a evitare collisioni e a
    // garantire lookup deterministico.
    unique("uq_players_code_hash").on(t.codeHash),
  ],
);

// Target di un override di visibilita': decidiamo per ogni entita',
// briciola di verita' o segreto stratificato se forzarne la visibilita'
// (`revealed`) o nasconderlo (`hidden`) per uno specifico giocatore.
export const playerVisibilityTarget = pgEnum("player_visibility_target", [
  "entity",
  "truth_clue",
  "entity_secret",
]);

export const playerVisibilityMode = pgEnum("player_visibility_mode", [
  "hidden",
  "revealed",
]);

export const playerVisibilityOverrides = pgTable(
  "player_visibility_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    targetType: playerVisibilityTarget("target_type").notNull(),
    // Volutamente non FK: la stessa colonna punta a tabelle diverse a
    // seconda di `targetType` (entities/truthClues/entitySecrets). La
    // pulizia su delete e' gestita lato applicazione.
    targetId: uuid("target_id").notNull(),
    mode: playerVisibilityMode("mode").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_pvo_player").on(t.playerId),
    index("idx_pvo_target").on(t.targetType, t.targetId),
    unique("uq_pvo_player_target").on(t.playerId, t.targetType, t.targetId),
  ],
);
