import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";
import { entities } from "./entities";
import {
  clueStatus,
  plotRole,
  plotThreadStatus,
  visibility,
} from "./enums";
import { sessions } from "./sessions";

export const plotThreads = pgTable(
  "plot_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Verita' GM (cosa sta realmente accadendo, chi tira le fila).
    description: text("description"),
    // Versione percepita dal party (cosa credono stia succedendo).
    publicDescription: text("public_description"),
    status: plotThreadStatus("status").default("warm").notNull(),
    priority: smallint("priority"),
    visibility: visibility("visibility").default("dm_only").notNull(),
    // Timestamp dell'ultimo evento, per detectare thread "stale" e suggerire demote.
    lastAdvancedAt: timestamp("last_advanced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_plot_threads_campaign").on(t.campaignId),
    index("idx_plot_threads_status").on(t.status),
  ],
);

export const plotThreadEntities = pgTable(
  "plot_thread_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plotThreadId: uuid("plot_thread_id")
      .notNull()
      .references(() => plotThreads.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    role: plotRole("role").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_plot_thread_entities_thread").on(t.plotThreadId),
    index("idx_plot_thread_entities_entity").on(t.entityId),
    unique("uq_plot_thread_entities_role").on(
      t.plotThreadId,
      t.entityId,
      t.role,
    ),
  ],
);

export const plotThreadEvents = pgTable(
  "plot_thread_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plotThreadId: uuid("plot_thread_id")
      .notNull()
      .references(() => plotThreads.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    // Vocabolario aperto: 'introduced' | 'advanced' | 'twist' | 'resolved' |
    // 'public_reveal' | 'private_reveal'.
    eventType: text("event_type").notNull(),
    description: text("description").notNull(),
    publicDescription: text("public_description"),
    visibility: visibility("visibility").default("dm_only").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_plot_thread_events_thread").on(t.plotThreadId),
    index("idx_plot_thread_events_session").on(t.sessionId),
    index("idx_plot_thread_events_occurred").on(t.occurredAt),
  ],
);

export const truthClues = pgTable(
  "truth_clues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    // La briciola, come e' apparsa in scena.
    description: text("description").notNull(),
    // A quale verita' GM punta. Chi capisce questo, capisce X.
    truthRevealed: text("truth_revealed").notNull(),
    relatedPlotThreadId: uuid("related_plot_thread_id").references(
      () => plotThreads.id,
      { onDelete: "set null" },
    ),
    // Array di entity_id coinvolte. Volutamente non normalizzato: la
    // briciola e' una unita' atomica, non vale una join table dedicata.
    relatedEntities: uuid("related_entities")
      .array()
      .default(sql`ARRAY[]::uuid[]`)
      .notNull(),
    plantedInSession: uuid("planted_in_session").references(
      () => sessions.id,
      { onDelete: "set null" },
    ),
    status: clueStatus("status").default("planted").notNull(),
    statusNotes: text("status_notes"),
    statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_truth_clues_campaign_status").on(t.campaignId, t.status),
    index("idx_truth_clues_thread").on(t.relatedPlotThreadId),
    index("idx_truth_clues_related_gin").using("gin", t.relatedEntities),
  ],
);
