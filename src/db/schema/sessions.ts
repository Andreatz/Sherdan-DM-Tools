import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";
import { entities } from "./entities";

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    // Numero progressivo all'interno della campagna (1, 2, 3, ...).
    number: integer("number").notNull(),
    title: text("title"),
    // Data reale della sessione di gioco (non in-fiction).
    date: date("date"),
    // Cosa e' successo in fiction. Visibile ai giocatori via "Previously on...".
    recap: text("recap"),
    // Note GM private: interpretazioni, retcon, intuizioni. MAI esposte ai giocatori.
    dmNotes: text("dm_notes"),
    // Appunti di prep pre-sessione, separati dal recap.
    prepNotes: text("prep_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_sessions_campaign").on(t.campaignId),
    unique("uq_sessions_campaign_number").on(t.campaignId, t.number),
  ],
);

export const sessionEntities = pgTable(
  "session_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    // Vocabolario aperto: 'mentioned' | 'present' | 'antagonist' | 'ally' | ...
    role: text("role"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_session_entities_session").on(t.sessionId),
    index("idx_session_entities_entity").on(t.entityId),
    unique("uq_session_entities_pair").on(t.sessionId, t.entityId),
  ],
);
