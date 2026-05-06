import {
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";
import { entities } from "./entities";
import { encounterDifficulty } from "./enums";
import { plotThreads } from "./plot";
import { sessions } from "./sessions";

export const encounters = pgTable(
  "encounters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    // Location come riferimento a entity (type=location). Non vincoliamo qui;
    // validazione del tipo lato app.
    locationId: uuid("location_id").references(() => entities.id, {
      onDelete: "set null",
    }),
    plotThreadId: uuid("plot_thread_id").references(() => plotThreads.id, {
      onDelete: "set null",
    }),
    difficulty: encounterDifficulty("difficulty"),
    partyLevel: smallint("party_level"),
    xpTotal: integer("xp_total"),
    tacticalNotes: text("tactical_notes"),
    usedInSession: uuid("used_in_session").references(() => sessions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_encounters_campaign").on(t.campaignId),
    index("idx_encounters_location").on(t.locationId),
    index("idx_encounters_plot_thread").on(t.plotThreadId),
  ],
);

export const encounterParticipants = pgTable(
  "encounter_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    encounterId: uuid("encounter_id")
      .notNull()
      .references(() => encounters.id, { onDelete: "cascade" }),
    // Tipicamente entity di type=monster, ma teniamo aperto per NPC/PC.
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    count: smallint("count").default(1).notNull(),
    // Ruolo tattico: 'minion' | 'lieutenant' | 'boss' | ... (vocabolario aperto).
    role: text("role"),
    notes: text("notes"),
  },
  (t) => [
    index("idx_encounter_participants_encounter").on(t.encounterId),
    index("idx_encounter_participants_entity").on(t.entityId),
  ],
);
