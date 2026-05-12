ALTER TABLE "loot_bundles" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "loot_bundles" ADD CONSTRAINT "loot_bundles_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_loot_bundles_session" ON "loot_bundles" USING btree ("session_id");