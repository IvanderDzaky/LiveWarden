ALTER TABLE "events" DROP CONSTRAINT "events_type_check";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
UPDATE "events" SET "idempotency_key" = 'legacy:' || "id"::text WHERE "idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "events_stream_idempotency_unique" ON "events" USING btree ("stream_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_idempotency_key_check" CHECK (length(trim("events"."idempotency_key")) > 0);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_type_check" CHECK ("events"."type" in ('STREAM_STARTED', 'STREAM_ENDED', 'COMMENT', 'LIKE', 'VIEWER_SPIKE', 'VIEWER_DROP', 'COMMENT_ACTIVITY_SPIKE', 'GIFT_ACTIVITY_SPIKE', 'MONITORING_FAILED', 'MONITORING_RECOVERED', 'CONNECTION_LOST', 'CONNECTION_RECOVERED'));
