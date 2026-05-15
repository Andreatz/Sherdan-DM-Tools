import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";
import { entityType, secretLayer, visibility } from "./enums";
import { plotThreads } from "./plot";
import { sessions } from "./sessions";

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    type: entityType("type").notNull(),
    name: text("name").notNull(),
    // Verita' GM (markdown). Mai esposta direttamente al Player Dashboard.
    description: text("description"),
    // Versione percepita dal mondo (propaganda, voce comune).
    publicDescription: text("public_description"),
    // Campi tipo-specifici, validati lato app via Zod (vedi src/lib/validation/).
    properties: jsonb("properties").default({}).notNull(),
    tags: text("tags").array().default([]).notNull(),
    // Self-reference per gerarchie (location -> sub-location, faction -> luogotenente).
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => entities.id,
      { onDelete: "set null" },
    ),
    visibility: visibility("visibility").default("dm_only").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_entities_campaign").on(t.campaignId),
    index("idx_entities_campaign_name").on(t.campaignId, t.name),
    index("idx_entities_campaign_updated").on(t.campaignId, t.updatedAt),
    index("idx_entities_type").on(t.type),
    index("idx_entities_parent").on(t.parentId),
    index("idx_entities_tags_gin").using("gin", t.tags),
    index("idx_entities_properties_gin").using("gin", t.properties),
  ],
);

export const entityLinks = pgTable(
  "entity_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    sourceEntityId: uuid("source_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    targetEntityId: uuid("target_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    // Vocabolario aperto (ally, enemy, knows, lieutenant_of, ...).
    // Validazione Zod lato app secondo CLAUDE.md sec 8.6.
    relationType: text("relation_type").notNull(),
    // Versione propaganda della relazione (es. "alleato" pubblico ma "burattino" reale).
    publicRelationType: text("public_relation_type"),
    strength: smallint("strength"),
    description: text("description"),
    visibility: visibility("visibility").default("dm_only").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_entity_links_campaign").on(t.campaignId),
    index("idx_entity_links_source").on(t.sourceEntityId),
    index("idx_entity_links_target").on(t.targetEntityId),
  ],
);

export const entityIdentities = pgTable(
  "entity_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isTrueIdentity: boolean("is_true_identity").default(false).notNull(),
    appearance: text("appearance"),
    voice: text("voice"),
    mannerisms: jsonb("mannerisms").default([]).notNull(),
    activeFromSession: uuid("active_from_session").references(
      () => sessions.id,
      { onDelete: "set null" },
    ),
    activeUntilSession: uuid("active_until_session").references(
      () => sessions.id,
      { onDelete: "set null" },
    ),
    visibility: visibility("visibility").default("dm_only").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_entity_identities_entity").on(t.entityId)],
);

export const entitySecrets = pgTable(
  "entity_secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").references(() => entities.id, {
      onDelete: "cascade",
    }),
    plotThreadId: uuid("plot_thread_id").references(() => plotThreads.id, {
      onDelete: "cascade",
    }),
    layer: secretLayer("layer").notNull(),
    content: text("content").notNull(),
    exploitHint: text("exploit_hint"),
    discoveredAtSession: uuid("discovered_at_session").references(
      () => sessions.id,
      { onDelete: "set null" },
    ),
    discoveryNotes: text("discovery_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_entity_secrets_entity").on(t.entityId),
    index("idx_entity_secrets_campaign").on(t.campaignId),
    index("idx_entity_secrets_plot_thread").on(t.plotThreadId),
    index("idx_entity_secrets_layer").on(t.layer),
    check(
      "entity_secrets_target_chk",
      sql`${t.entityId} IS NOT NULL OR ${t.plotThreadId} IS NOT NULL`,
    ),
  ],
);

export const pcHooks = pgTable(
  "pc_hooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    pcEntityId: uuid("pc_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    targetEntityId: uuid("target_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    hookDescription: text("hook_description").notNull(),
    potentialArc: text("potential_arc"),
    usedInSession: uuid("used_in_session").references(() => sessions.id, {
      onDelete: "set null",
    }),
    // Vocabolario aperto: 'available' | 'in_progress' | 'resolved'.
    // Default 'available'. Validazione Zod lato app.
    status: text("status").default("available").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_pc_hooks_pc").on(t.pcEntityId),
    index("idx_pc_hooks_target").on(t.targetEntityId),
  ],
);
