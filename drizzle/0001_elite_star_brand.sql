DROP INDEX "streams_worker_selection_idx";--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN "next_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN "check_lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN "check_lease_token" uuid;--> statement-breakpoint
CREATE INDEX "streams_worker_selection_idx" ON "streams" USING btree ("monitoring_enabled","deleted_at","next_check_at");