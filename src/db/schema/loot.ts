import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";
import { encounters } from "./encounters";
import { sessions } from "./sessions";

export const lootBundles = pgTable(
  "loot_bundles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    title: text("title"),
    description: text("description"),
    goldAmount: integer("gold_amount"),
    // Array di item come JSONB: { entity_id?, name, description, qty, rarity? }.
    // Quando un item magico generato e' rilevante, viene promosso a entity
    // type=item e qui si salva solo il riferimento; altrimenti resta inline.
    items: jsonb("items").default([]).notNull(),
    encounterId: uuid("encounter_id").references(() => encounters.id, {
      onDelete: "set null",
    }),
    // Collegamento opzionale alla sessione in cui il bundle e' stato dato
    // al party. Permette di listare il loot per sessione e di mostrarlo
    // nel recap. ON DELETE SET NULL: se la sessione viene cancellata, il
    // bundle resta ma perde il collegamento.
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_loot_bundles_campaign").on(t.campaignId),
    index("idx_loot_bundles_encounter").on(t.encounterId),
    index("idx_loot_bundles_session").on(t.sessionId),
  ],
);
