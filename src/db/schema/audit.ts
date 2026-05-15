import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";
import { players } from "./players";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: text("action").notNull(),
    actorType: text("actor_type").default("system").notNull(),
    playerId: uuid("player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    outcome: text("outcome").default("succeeded").notNull(),
    requestId: text("request_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_audit_logs_created").on(t.createdAt),
    index("idx_audit_logs_action").on(t.action),
    index("idx_audit_logs_campaign").on(t.campaignId),
    index("idx_audit_logs_player").on(t.playerId),
    index("idx_audit_logs_target").on(t.targetType, t.targetId),
    index("idx_audit_logs_request").on(t.requestId),
  ],
);
