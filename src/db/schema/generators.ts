import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";

export const generationLogs = pgTable(
  "generation_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    generatorName: text("generator_name").notNull(),
    provider: text("provider"),
    model: text("model").notNull(),
    input: jsonb("input").notNull(),
    prompt: jsonb("prompt").notNull(),
    output: jsonb("output"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    status: text("status").default("succeeded").notNull(),
    error: jsonb("error"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_generation_log_campaign").on(table.campaignId),
    index("idx_generation_log_generator").on(table.generatorName),
    index("idx_generation_log_created").on(table.createdAt),
    index("idx_generation_log_status").on(table.status),
  ],
);
