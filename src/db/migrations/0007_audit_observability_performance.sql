CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"actor_type" text DEFAULT 'system' NOT NULL,
	"player_id" uuid,
	"campaign_id" uuid,
	"target_type" text,
	"target_id" uuid,
	"outcome" text DEFAULT 'succeeded' NOT NULL,
	"request_id" text,
	"ip" text,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "audit_logs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_campaign" ON "audit_logs" USING btree ("campaign_id");
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_player" ON "audit_logs" USING btree ("player_id");
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_target" ON "audit_logs" USING btree ("target_type","target_id");
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_request" ON "audit_logs" USING btree ("request_id");
--> statement-breakpoint
CREATE INDEX "idx_entities_campaign_name" ON "entities" USING btree ("campaign_id","name");
--> statement-breakpoint
CREATE INDEX "idx_entities_campaign_updated" ON "entities" USING btree ("campaign_id","updated_at");
--> statement-breakpoint
CREATE INDEX "idx_plot_threads_campaign_status_priority" ON "plot_threads" USING btree ("campaign_id","status","priority");
--> statement-breakpoint
CREATE INDEX "idx_truth_clues_campaign_created" ON "truth_clues" USING btree ("campaign_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_entity_secrets_campaign" ON "entity_secrets" USING btree ("campaign_id");
--> statement-breakpoint
CREATE INDEX "idx_chatgpt_bridge_exports_campaign_created" ON "chatgpt_bridge_exports" USING btree ("campaign_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_chatgpt_bridge_imports_campaign_created" ON "chatgpt_bridge_imports" USING btree ("campaign_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_generation_log_provider_model" ON "generation_log" USING btree ("provider","model");
--> statement-breakpoint
CREATE INDEX "idx_generation_log_metadata_gin" ON "generation_log" USING gin ("metadata");
