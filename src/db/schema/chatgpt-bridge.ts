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

export const chatgptBridgeExports = pgTable(
  "chatgpt_bridge_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    taskType: text("task_type").notNull(),
    density: text("density").notNull(),
    filename: text("filename").notNull(),
    markdown: text("markdown").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_chatgpt_bridge_exports_campaign_created").on(t.campaignId, t.createdAt)],
);

export const chatgptBridgeImports = pgTable(
  "chatgpt_bridge_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    taskType: text("task_type").notNull(),
    sessionNumber: integer("session_number"),
    markdown: text("markdown").notNull(),
    updatePack: jsonb("update_pack"),
    appliedChanges: jsonb("applied_changes").default([]).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_chatgpt_bridge_imports_campaign_created").on(t.campaignId, t.createdAt)],
);
