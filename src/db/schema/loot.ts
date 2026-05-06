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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_loot_bundles_campaign").on(t.campaignId),
    index("idx_loot_bundles_encounter").on(t.encounterId),
  ],
);
