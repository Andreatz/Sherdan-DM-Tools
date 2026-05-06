import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";

export const randomTables = pgTable(
  "random_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: tabelle SRD/public-domain non sono legate a una campagna.
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    description: text("description"),
    // Array di entries: [{ weight?, value, sub_table_id?, template_vars? }, ...].
    // Validazione lato app via Zod (Roller library, Fase 2).
    entries: jsonb("entries").notNull(),
    tags: text("tags").array().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_random_tables_campaign").on(t.campaignId),
    index("idx_random_tables_tags_gin").using("gin", t.tags),
    index("idx_random_tables_name").on(t.name),
  ],
);
