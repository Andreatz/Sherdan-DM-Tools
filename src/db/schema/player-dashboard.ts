import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";
import { entities } from "./entities";

export const playerEntityExposureMode = pgEnum("player_entity_exposure_mode", [
  "name_only",
  "public_description",
  "discovered_description",
]);

export const playerDashboardStates = pgTable(
  "player_dashboard_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    sceneTitle: text("scene_title"),
    sceneText: text("scene_text"),
    imageUrl: text("image_url"),
    mapImageUrl: text("map_image_url"),
    // Shape V1:
    // { reveals: [{ id, label, x, y, width, height }] }
    // Coordinates are percentages (0-100), so they survive responsive maps.
    mapFogData: jsonb("map_fog_data")
      .$type<{ reveals: Array<Record<string, unknown>> }>()
      .default({ reveals: [] })
      .notNull(),
    // Shape V1:
    // [{ id, title, body, imageUrl, kind, createdAt }]
    handouts: jsonb("handouts")
      .$type<Array<Record<string, unknown>>>()
      .default([])
      .notNull(),
    activeEntityIds: uuid("active_entity_ids").array().default([]).notNull(),
    // Shape V1:
    // { active: boolean, round?: number, turns: [{ name, initiative, hp, note }] }
    initiative: jsonb("initiative").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("uq_player_dashboard_states_campaign").on(t.campaignId),
    index("idx_player_dashboard_states_campaign").on(t.campaignId),
  ],
);

export const playerEntityExposures = pgTable(
  "player_entity_exposures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    mode: playerEntityExposureMode("mode")
      .default("public_description")
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_player_entity_exposures_campaign").on(t.campaignId),
    unique("uq_player_entity_exposures_entity").on(t.entityId),
  ],
);
