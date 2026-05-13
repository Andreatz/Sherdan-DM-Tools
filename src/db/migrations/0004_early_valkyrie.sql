CREATE TYPE "public"."player_entity_exposure_mode" AS ENUM('name_only', 'public_description', 'discovered_description');--> statement-breakpoint
CREATE TABLE "player_dashboard_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"scene_title" text,
	"scene_text" text,
	"image_url" text,
	"map_image_url" text,
	"map_fog_data" jsonb DEFAULT '{"reveals":[]}'::jsonb NOT NULL,
	"handouts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_entity_ids" uuid[] DEFAULT '{}' NOT NULL,
	"initiative" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_player_dashboard_states_campaign" UNIQUE("campaign_id")
);
--> statement-breakpoint
CREATE TABLE "player_entity_exposures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"mode" "player_entity_exposure_mode" DEFAULT 'public_description' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_player_entity_exposures_entity" UNIQUE("entity_id")
);
--> statement-breakpoint
ALTER TABLE "player_dashboard_states" ADD CONSTRAINT "player_dashboard_states_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_entity_exposures" ADD CONSTRAINT "player_entity_exposures_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_entity_exposures" ADD CONSTRAINT "player_entity_exposures_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_player_dashboard_states_campaign" ON "player_dashboard_states" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_player_entity_exposures_campaign" ON "player_entity_exposures" USING btree ("campaign_id");