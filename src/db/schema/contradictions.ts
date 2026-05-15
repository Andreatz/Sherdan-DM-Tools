import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";

export const contradictionIgnores = pgTable(
  "contradiction_ignores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    issueId: text("issue_id").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_contradiction_ignores_campaign").on(t.campaignId),
    unique("uq_contradiction_ignores_campaign_issue").on(
      t.campaignId,
      t.issueId,
    ),
  ],
);
