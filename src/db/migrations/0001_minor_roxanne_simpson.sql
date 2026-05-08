CREATE TABLE "generation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid,
	"generator_name" text NOT NULL,
	"provider" text,
	"model" text NOT NULL,
	"input" jsonb NOT NULL,
	"prompt" jsonb NOT NULL,
	"output" jsonb,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"cost_usd" numeric(12, 6),
	"status" text DEFAULT 'succeeded' NOT NULL,
	"error" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_log" ADD CONSTRAINT "generation_log_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_generation_log_campaign" ON "generation_log" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_generation_log_generator" ON "generation_log" USING btree ("generator_name");--> statement-breakpoint
CREATE INDEX "idx_generation_log_created" ON "generation_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_generation_log_status" ON "generation_log" USING btree ("status");