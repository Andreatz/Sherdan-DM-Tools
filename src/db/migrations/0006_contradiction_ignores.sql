CREATE TABLE "contradiction_ignores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"issue_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_contradiction_ignores_campaign_issue" UNIQUE("campaign_id","issue_id")
);
--> statement-breakpoint
ALTER TABLE "contradiction_ignores" ADD CONSTRAINT "contradiction_ignores_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_contradiction_ignores_campaign" ON "contradiction_ignores" USING btree ("campaign_id");
