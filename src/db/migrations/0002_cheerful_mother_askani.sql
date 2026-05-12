CREATE TYPE "public"."player_visibility_mode" AS ENUM('hidden', 'revealed');--> statement-breakpoint
CREATE TYPE "public"."player_visibility_target" AS ENUM('entity', 'truth_clue', 'entity_secret');--> statement-breakpoint
CREATE TABLE "player_visibility_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"target_type" "player_visibility_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"mode" "player_visibility_mode" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pvo_player_target" UNIQUE("player_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_players_campaign_name" UNIQUE("campaign_id","name"),
	CONSTRAINT "uq_players_code_hash" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "player_visibility_overrides" ADD CONSTRAINT "player_visibility_overrides_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pvo_player" ON "player_visibility_overrides" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_pvo_target" ON "player_visibility_overrides" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_players_campaign" ON "players" USING btree ("campaign_id");