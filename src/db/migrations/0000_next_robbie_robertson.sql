CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."clue_status" AS ENUM('planted', 'noticed', 'misinterpreted', 'understood', 'lost');--> statement-breakpoint
CREATE TYPE "public"."encounter_difficulty" AS ENUM('easy', 'medium', 'hard', 'deadly');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('npc', 'pc', 'location', 'faction', 'item', 'monster', 'deity', 'organization');--> statement-breakpoint
CREATE TYPE "public"."plot_role" AS ENUM('instigator', 'victim', 'target', 'mcguffin', 'witness');--> statement-breakpoint
CREATE TYPE "public"."plot_thread_status" AS ENUM('hot', 'warm', 'cold', 'resolved', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."secret_layer" AS ENUM('surface', 'intermediate', 'deep');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('dm_only', 'discovered', 'public');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encounter_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"encounter_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"count" smallint DEFAULT 1 NOT NULL,
	"role" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "encounters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location_id" uuid,
	"plot_thread_id" uuid,
	"difficulty" "encounter_difficulty",
	"party_level" smallint,
	"xp_total" integer,
	"tactical_notes" text,
	"used_in_session" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"type" "entity_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"public_description" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"parent_id" uuid,
	"visibility" "visibility" DEFAULT 'dm_only' NOT NULL,
	"embedding" vector(1024),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_true_identity" boolean DEFAULT false NOT NULL,
	"appearance" text,
	"voice" text,
	"mannerisms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_from_session" uuid,
	"active_until_session" uuid,
	"visibility" "visibility" DEFAULT 'dm_only' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"target_entity_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"public_relation_type" text,
	"strength" smallint,
	"description" text,
	"visibility" "visibility" DEFAULT 'dm_only' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"entity_id" uuid,
	"plot_thread_id" uuid,
	"layer" "secret_layer" NOT NULL,
	"content" text NOT NULL,
	"exploit_hint" text,
	"discovered_at_session" uuid,
	"discovery_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_secrets_target_chk" CHECK ("entity_secrets"."entity_id" IS NOT NULL OR "entity_secrets"."plot_thread_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "pc_hooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"pc_entity_id" uuid NOT NULL,
	"target_entity_id" uuid NOT NULL,
	"hook_description" text NOT NULL,
	"potential_arc" text,
	"used_in_session" uuid,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loot_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" text,
	"description" text,
	"gold_amount" integer,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"encounter_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plot_thread_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plot_thread_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role" "plot_role" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_plot_thread_entities_role" UNIQUE("plot_thread_id","entity_id","role")
);
--> statement-breakpoint
CREATE TABLE "plot_thread_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plot_thread_id" uuid NOT NULL,
	"session_id" uuid,
	"event_type" text NOT NULL,
	"description" text NOT NULL,
	"public_description" text,
	"visibility" "visibility" DEFAULT 'dm_only' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plot_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"public_description" text,
	"status" "plot_thread_status" DEFAULT 'warm' NOT NULL,
	"priority" smallint,
	"visibility" "visibility" DEFAULT 'dm_only' NOT NULL,
	"last_advanced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "truth_clues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"description" text NOT NULL,
	"truth_revealed" text NOT NULL,
	"related_plot_thread_id" uuid,
	"related_entities" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"planted_in_session" uuid,
	"status" "clue_status" DEFAULT 'planted' NOT NULL,
	"status_notes" text,
	"status_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"title" text,
	"section" text,
	"content" text NOT NULL,
	"chunk_index" integer,
	"embedding" vector(1024),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_session_entities_pair" UNIQUE("session_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text,
	"date" date,
	"recap" text,
	"dm_notes" text,
	"prep_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_sessions_campaign_number" UNIQUE("campaign_id","number")
);
--> statement-breakpoint
CREATE TABLE "random_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"entries" jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "encounter_participants" ADD CONSTRAINT "encounter_participants_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounter_participants" ADD CONSTRAINT "encounter_participants_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_location_id_entities_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_plot_thread_id_plot_threads_id_fk" FOREIGN KEY ("plot_thread_id") REFERENCES "public"."plot_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_used_in_session_sessions_id_fk" FOREIGN KEY ("used_in_session") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_parent_id_entities_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_identities" ADD CONSTRAINT "entity_identities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_identities" ADD CONSTRAINT "entity_identities_active_from_session_sessions_id_fk" FOREIGN KEY ("active_from_session") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_identities" ADD CONSTRAINT "entity_identities_active_until_session_sessions_id_fk" FOREIGN KEY ("active_until_session") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_source_entity_id_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_target_entity_id_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_secrets" ADD CONSTRAINT "entity_secrets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_secrets" ADD CONSTRAINT "entity_secrets_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_secrets" ADD CONSTRAINT "entity_secrets_plot_thread_id_plot_threads_id_fk" FOREIGN KEY ("plot_thread_id") REFERENCES "public"."plot_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_secrets" ADD CONSTRAINT "entity_secrets_discovered_at_session_sessions_id_fk" FOREIGN KEY ("discovered_at_session") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_hooks" ADD CONSTRAINT "pc_hooks_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_hooks" ADD CONSTRAINT "pc_hooks_pc_entity_id_entities_id_fk" FOREIGN KEY ("pc_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_hooks" ADD CONSTRAINT "pc_hooks_target_entity_id_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_hooks" ADD CONSTRAINT "pc_hooks_used_in_session_sessions_id_fk" FOREIGN KEY ("used_in_session") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_bundles" ADD CONSTRAINT "loot_bundles_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_bundles" ADD CONSTRAINT "loot_bundles_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_thread_entities" ADD CONSTRAINT "plot_thread_entities_plot_thread_id_plot_threads_id_fk" FOREIGN KEY ("plot_thread_id") REFERENCES "public"."plot_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_thread_entities" ADD CONSTRAINT "plot_thread_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_thread_events" ADD CONSTRAINT "plot_thread_events_plot_thread_id_plot_threads_id_fk" FOREIGN KEY ("plot_thread_id") REFERENCES "public"."plot_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_thread_events" ADD CONSTRAINT "plot_thread_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_threads" ADD CONSTRAINT "plot_threads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truth_clues" ADD CONSTRAINT "truth_clues_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truth_clues" ADD CONSTRAINT "truth_clues_related_plot_thread_id_plot_threads_id_fk" FOREIGN KEY ("related_plot_thread_id") REFERENCES "public"."plot_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truth_clues" ADD CONSTRAINT "truth_clues_planted_in_session_sessions_id_fk" FOREIGN KEY ("planted_in_session") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_entities" ADD CONSTRAINT "session_entities_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_entities" ADD CONSTRAINT "session_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "random_tables" ADD CONSTRAINT "random_tables_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_encounter_participants_encounter" ON "encounter_participants" USING btree ("encounter_id");--> statement-breakpoint
CREATE INDEX "idx_encounter_participants_entity" ON "encounter_participants" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_encounters_campaign" ON "encounters" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_encounters_location" ON "encounters" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_encounters_plot_thread" ON "encounters" USING btree ("plot_thread_id");--> statement-breakpoint
CREATE INDEX "idx_entities_campaign" ON "entities" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_entities_type" ON "entities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_entities_parent" ON "entities" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_entities_tags_gin" ON "entities" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "idx_entities_properties_gin" ON "entities" USING gin ("properties");--> statement-breakpoint
CREATE INDEX "idx_entity_identities_entity" ON "entity_identities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_entity_links_campaign" ON "entity_links" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_entity_links_source" ON "entity_links" USING btree ("source_entity_id");--> statement-breakpoint
CREATE INDEX "idx_entity_links_target" ON "entity_links" USING btree ("target_entity_id");--> statement-breakpoint
CREATE INDEX "idx_entity_secrets_entity" ON "entity_secrets" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_entity_secrets_plot_thread" ON "entity_secrets" USING btree ("plot_thread_id");--> statement-breakpoint
CREATE INDEX "idx_entity_secrets_layer" ON "entity_secrets" USING btree ("layer");--> statement-breakpoint
CREATE INDEX "idx_pc_hooks_pc" ON "pc_hooks" USING btree ("pc_entity_id");--> statement-breakpoint
CREATE INDEX "idx_pc_hooks_target" ON "pc_hooks" USING btree ("target_entity_id");--> statement-breakpoint
CREATE INDEX "idx_loot_bundles_campaign" ON "loot_bundles" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_loot_bundles_encounter" ON "loot_bundles" USING btree ("encounter_id");--> statement-breakpoint
CREATE INDEX "idx_plot_thread_entities_thread" ON "plot_thread_entities" USING btree ("plot_thread_id");--> statement-breakpoint
CREATE INDEX "idx_plot_thread_entities_entity" ON "plot_thread_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_plot_thread_events_thread" ON "plot_thread_events" USING btree ("plot_thread_id");--> statement-breakpoint
CREATE INDEX "idx_plot_thread_events_session" ON "plot_thread_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_plot_thread_events_occurred" ON "plot_thread_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_plot_threads_campaign" ON "plot_threads" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_plot_threads_status" ON "plot_threads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_truth_clues_campaign_status" ON "truth_clues" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "idx_truth_clues_thread" ON "truth_clues" USING btree ("related_plot_thread_id");--> statement-breakpoint
CREATE INDEX "idx_truth_clues_related_gin" ON "truth_clues" USING gin ("related_entities");--> statement-breakpoint
CREATE INDEX "idx_rule_documents_source" ON "rule_documents" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_rule_documents_content_trgm" ON "rule_documents" USING gin ("content" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_session_entities_session" ON "session_entities" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_session_entities_entity" ON "session_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_campaign" ON "sessions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_random_tables_campaign" ON "random_tables" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_random_tables_tags_gin" ON "random_tables" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "idx_random_tables_name" ON "random_tables" USING btree ("name");