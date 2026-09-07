DROP INDEX "deliveries_retry_idx";--> statement-breakpoint
ALTER TABLE "integration_deliveries" ADD COLUMN "lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_deliveries" ADD COLUMN "lease_token" uuid;--> statement-breakpoint
CREATE INDEX "deliveries_retry_idx" ON "integration_deliveries" USING btree ("status","next_attempt_at","lease_until");