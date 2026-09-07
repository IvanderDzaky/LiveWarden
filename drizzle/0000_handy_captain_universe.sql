CREATE TABLE "ai_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"live_session_id" uuid NOT NULL,
	"status" text NOT NULL,
	"session_summary" text,
	"key_moments" jsonb,
	"audience_changes" text,
	"problems" jsonb,
	"insights" jsonb,
	"recommendations" jsonb,
	"limitations" jsonb,
	"model" text,
	"failure_reason" text,
	"requested_at" timestamp with time zone NOT NULL,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_summaries_status_check" CHECK ("ai_summaries"."status" in ('PENDING', 'COMPLETED', 'FAILED')),
	CONSTRAINT "ai_summaries_result_check" CHECK (("ai_summaries"."status" = 'COMPLETED' and "ai_summaries"."generated_at" is not null and "ai_summaries"."session_summary" is not null) or ("ai_summaries"."status" = 'FAILED' and "ai_summaries"."failure_reason" is not null) or "ai_summaries"."status" = 'PENDING')
);
--> statement-breakpoint
CREATE TABLE "alert_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"acknowledged_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" uuid NOT NULL,
	"live_session_id" uuid,
	"source_event_id" uuid,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"deduplication_key" text NOT NULL,
	"first_detected_at" timestamp with time zone NOT NULL,
	"last_detected_at" timestamp with time zone NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"description" text NOT NULL,
	"trigger_value" jsonb,
	"recommended_action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alerts_severity_check" CHECK ("alerts"."severity" in ('INFO', 'WARNING', 'CRITICAL')),
	CONSTRAINT "alerts_status_check" CHECK ("alerts"."status" in ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
	CONSTRAINT "alerts_detection_order_check" CHECK ("alerts"."last_detected_at" >= "alerts"."first_detected_at"),
	CONSTRAINT "alerts_resolution_check" CHECK (("alerts"."status" = 'RESOLVED' and "alerts"."resolved_at" is not null) or ("alerts"."status" <> 'RESOLVED' and "alerts"."resolved_at" is null))
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"type" text NOT NULL,
	"stream_id" uuid NOT NULL,
	"live_session_id" uuid,
	"source" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_schema_version_check" CHECK ("events"."schema_version" > 0),
	CONSTRAINT "events_type_check" CHECK ("events"."type" in ('STREAM_STARTED', 'STREAM_ENDED', 'VIEWER_SPIKE', 'VIEWER_DROP', 'COMMENT_ACTIVITY_SPIKE', 'GIFT_ACTIVITY_SPIKE', 'MONITORING_FAILED', 'MONITORING_RECOVERED', 'CONNECTION_LOST', 'CONNECTION_RECOVERED'))
);
--> statement-breakpoint
CREATE TABLE "integration_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"alert_id" uuid,
	"live_session_id" uuid,
	"destination" text NOT NULL,
	"delivery_type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"succeeded_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_destination_check" CHECK ("integration_deliveries"."destination" in ('N8N', 'DISCORD', 'GEMINI')),
	CONSTRAINT "deliveries_status_check" CHECK ("integration_deliveries"."status" in ('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'ABANDONED')),
	CONSTRAINT "deliveries_attempt_check" CHECK ("integration_deliveries"."attempt_count" >= 0),
	CONSTRAINT "deliveries_trigger_check" CHECK ("integration_deliveries"."event_id" is not null or "integration_deliveries"."alert_id" is not null or "integration_deliveries"."live_session_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "live_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" uuid NOT NULL,
	"provider_room_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"state" text DEFAULT 'ACTIVE' NOT NULL,
	"final_status" text,
	"duration_seconds" bigint,
	"peak_viewers" bigint,
	"average_viewers" numeric,
	"total_comments" bigint,
	"total_like_activity" bigint,
	"event_count" bigint,
	"alert_count" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_state_check" CHECK ("live_sessions"."state" in ('ACTIVE', 'COMPLETED')),
	CONSTRAINT "sessions_lifecycle_check" CHECK (("live_sessions"."state" = 'ACTIVE' and "live_sessions"."ended_at" is null and "live_sessions"."final_status" is null) or ("live_sessions"."state" = 'COMPLETED' and "live_sessions"."ended_at" is not null and "live_sessions"."final_status" = 'OFFLINE')),
	CONSTRAINT "sessions_nonnegative_check" CHECK (coalesce("live_sessions"."duration_seconds", 0) >= 0 and coalesce("live_sessions"."peak_viewers", 0) >= 0 and coalesce("live_sessions"."total_comments", 0) >= 0 and coalesce("live_sessions"."total_like_activity", 0) >= 0 and coalesce("live_sessions"."event_count", 0) >= 0 and coalesce("live_sessions"."alert_count", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "monitoring_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" uuid NOT NULL,
	"live_session_id" uuid,
	"attempt_key" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"provider_occurred_at" timestamp with time zone,
	"collection_succeeded" boolean NOT NULL,
	"status_observed" text NOT NULL,
	"provider_room_id" text,
	"current_viewers" bigint,
	"collector_latency_ms" integer,
	"error_code" text,
	"error_message" text,
	"provider_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshots_status_check" CHECK ("monitoring_snapshots"."status_observed" in ('LIVE', 'OFFLINE', 'DEGRADED', 'UNKNOWN', 'DISCONNECTED')),
	CONSTRAINT "snapshots_error_consistency_check" CHECK (("monitoring_snapshots"."collection_succeeded" = true and "monitoring_snapshots"."error_code" is null) or ("monitoring_snapshots"."collection_succeeded" = false and "monitoring_snapshots"."error_code" is not null and "monitoring_snapshots"."error_code" in ('USER_NOT_FOUND', 'STREAM_OFFLINE', 'COLLECTOR_TIMEOUT', 'NETWORK_ERROR', 'PROVIDER_UNAVAILABLE', 'AUTHENTICATION_ERROR', 'RATE_LIMITED', 'CONNECTION_ERROR', 'COLLECTOR_ERROR', 'UNKNOWN_COLLECTOR_ERROR'))),
	CONSTRAINT "snapshots_nonnegative_check" CHECK (coalesce("monitoring_snapshots"."current_viewers", 0) >= 0 and coalesce("monitoring_snapshots"."collector_latency_ms", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"platform" text DEFAULT 'TIKTOK_LIVE' NOT NULL,
	"external_identifier" text NOT NULL,
	"monitoring_enabled" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'UNKNOWN' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_successful_at" timestamp with time zone,
	"last_observed_provider_at" timestamp with time zone,
	"last_room_id" text,
	"last_observation_metadata" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "streams_platform_check" CHECK ("streams"."platform" = 'TIKTOK_LIVE'),
	CONSTRAINT "streams_status_check" CHECK ("streams"."status" in ('LIVE', 'OFFLINE', 'DEGRADED', 'UNKNOWN', 'DISCONNECTED')),
	CONSTRAINT "streams_name_check" CHECK (length(trim("streams"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_live_session_id_live_sessions_id_fk" FOREIGN KEY ("live_session_id") REFERENCES "public"."live_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_acknowledgements" ADD CONSTRAINT "alert_acknowledgements_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_acknowledgements" ADD CONSTRAINT "alert_acknowledgements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_live_session_id_live_sessions_id_fk" FOREIGN KEY ("live_session_id") REFERENCES "public"."live_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_live_session_id_live_sessions_id_fk" FOREIGN KEY ("live_session_id") REFERENCES "public"."live_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_deliveries" ADD CONSTRAINT "integration_deliveries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_deliveries" ADD CONSTRAINT "integration_deliveries_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_deliveries" ADD CONSTRAINT "integration_deliveries_live_session_id_live_sessions_id_fk" FOREIGN KEY ("live_session_id") REFERENCES "public"."live_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_snapshots" ADD CONSTRAINT "monitoring_snapshots_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_snapshots" ADD CONSTRAINT "monitoring_snapshots_live_session_id_live_sessions_id_fk" FOREIGN KEY ("live_session_id") REFERENCES "public"."live_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_summaries_session_unique" ON "ai_summaries" USING btree ("live_session_id");--> statement-breakpoint
CREATE INDEX "ai_summaries_processing_idx" ON "ai_summaries" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "acknowledgements_alert_idx" ON "alert_acknowledgements" USING btree ("alert_id","acknowledged_at");--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_unresolved_dedup_unique" ON "alerts" USING btree ("deduplication_key") WHERE "alerts"."status" in ('ACTIVE', 'ACKNOWLEDGED');--> statement-breakpoint
CREATE INDEX "alerts_stream_status_idx" ON "alerts" USING btree ("stream_id","status","first_detected_at");--> statement-breakpoint
CREATE INDEX "alerts_session_idx" ON "alerts" USING btree ("live_session_id","first_detected_at");--> statement-breakpoint
CREATE INDEX "alerts_severity_status_idx" ON "alerts" USING btree ("severity","status","first_detected_at");--> statement-breakpoint
CREATE INDEX "events_stream_occurred_idx" ON "events" USING btree ("stream_id","occurred_at");--> statement-breakpoint
CREATE INDEX "events_session_occurred_idx" ON "events" USING btree ("live_session_id","occurred_at");--> statement-breakpoint
CREATE INDEX "events_type_occurred_idx" ON "events" USING btree ("type","occurred_at");--> statement-breakpoint
CREATE INDEX "events_occurred_idx" ON "events" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_destination_idempotency_unique" ON "integration_deliveries" USING btree ("destination","idempotency_key");--> statement-breakpoint
CREATE INDEX "deliveries_retry_idx" ON "integration_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "deliveries_event_idx" ON "integration_deliveries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "deliveries_alert_idx" ON "integration_deliveries" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "deliveries_session_idx" ON "integration_deliveries" USING btree ("live_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_one_active_per_stream" ON "live_sessions" USING btree ("stream_id") WHERE "live_sessions"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "sessions_history_idx" ON "live_sessions" USING btree ("stream_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_attempt_unique" ON "monitoring_snapshots" USING btree ("stream_id","attempt_key");--> statement-breakpoint
CREATE INDEX "snapshots_stream_checked_idx" ON "monitoring_snapshots" USING btree ("stream_id","checked_at");--> statement-breakpoint
CREATE INDEX "snapshots_session_checked_idx" ON "monitoring_snapshots" USING btree ("live_session_id","checked_at");--> statement-breakpoint
CREATE INDEX "snapshots_retention_idx" ON "monitoring_snapshots" USING btree ("checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "streams_active_identity_unique" ON "streams" USING btree ("user_id","platform","external_identifier") WHERE "streams"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "streams_worker_selection_idx" ON "streams" USING btree ("user_id","monitoring_enabled","deleted_at");--> statement-breakpoint
CREATE INDEX "streams_status_idx" ON "streams" USING btree ("user_id","status","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");