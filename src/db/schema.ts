import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

const now = sql`now()`;
const streamStatuses = sql`('LIVE', 'OFFLINE', 'DEGRADED', 'UNKNOWN', 'DISCONNECTED')`;
const alertSeverities = sql`('INFO', 'WARNING', 'CRITICAL')`;
const alertStatuses = sql`('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')`;
const sessionStates = sql`('ACTIVE', 'COMPLETED')`;
const eventTypes = sql`('STREAM_STARTED', 'STREAM_ENDED', 'COMMENT', 'LIKE', 'VIEWER_SPIKE', 'VIEWER_DROP', 'COMMENT_ACTIVITY_SPIKE', 'GIFT_ACTIVITY_SPIKE', 'MONITORING_FAILED', 'MONITORING_RECOVERED', 'CONNECTION_LOST', 'CONNECTION_RECOVERED')`;
const collectorErrors = sql`('USER_NOT_FOUND', 'STREAM_OFFLINE', 'COLLECTOR_TIMEOUT', 'NETWORK_ERROR', 'PROVIDER_UNAVAILABLE', 'AUTHENTICATION_ERROR', 'RATE_LIMITED', 'CONNECTION_ERROR', 'COLLECTOR_ERROR', 'UNKNOWN_COLLECTOR_ERROR')`;
const deliveryStatuses = sql`('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'ABANDONED')`;
const aiStatuses = sql`('PENDING', 'COMPLETED', 'FAILED')`;

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(now).notNull()
}, (table) => [uniqueIndex('users_email_unique').on(table.email)]);

export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull()
}, (table) => [
  uniqueIndex('auth_sessions_token_hash_unique').on(table.tokenHash),
  index('auth_sessions_user_expiry_idx').on(table.userId, table.revokedAt, table.expiresAt),
  index('auth_sessions_expiry_idx').on(table.expiresAt)
]);

export const streams = pgTable('streams', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  platform: text('platform').notNull().default('TIKTOK_LIVE'),
  externalIdentifier: text('external_identifier').notNull(),
  monitoringEnabled: boolean('monitoring_enabled').notNull().default(false),
  status: text('status').notNull().default('UNKNOWN'),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  lastSuccessfulAt: timestamp('last_successful_at', { withTimezone: true }),
  lastObservedProviderAt: timestamp('last_observed_provider_at', { withTimezone: true }),
  lastRoomId: text('last_room_id'),
  lastObservationMetadata: jsonb('last_observation_metadata'),
  nextCheckAt: timestamp('next_check_at', { withTimezone: true }),
  checkLeaseUntil: timestamp('check_lease_until', { withTimezone: true }),
  checkLeaseToken: uuid('check_lease_token'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(now).notNull()
}, (table) => [
  check('streams_platform_check', sql`${table.platform} = 'TIKTOK_LIVE'`),
  check('streams_status_check', sql`${table.status} in ${streamStatuses}`),
  check('streams_name_check', sql`length(trim(${table.name})) > 0`),
  uniqueIndex('streams_active_identity_unique').on(table.userId, table.platform, table.externalIdentifier).where(sql`${table.deletedAt} is null`),
  index('streams_worker_selection_idx').on(table.monitoringEnabled, table.deletedAt, table.nextCheckAt),
  index('streams_status_idx').on(table.userId, table.status, table.deletedAt)
]);

export const liveSessions = pgTable('live_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  streamId: uuid('stream_id').notNull().references(() => streams.id),
  providerRoomId: text('provider_room_id'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  state: text('state').notNull().default('ACTIVE'),
  finalStatus: text('final_status'),
  durationSeconds: bigint('duration_seconds', { mode: 'number' }),
  peakViewers: bigint('peak_viewers', { mode: 'number' }),
  averageViewers: numeric('average_viewers'),
  totalComments: bigint('total_comments', { mode: 'number' }),
  totalLikeActivity: bigint('total_like_activity', { mode: 'number' }),
  eventCount: bigint('event_count', { mode: 'number' }),
  alertCount: bigint('alert_count', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(now).notNull()
}, (table) => [
  check('sessions_state_check', sql`${table.state} in ${sessionStates}`),
  check('sessions_lifecycle_check', sql`(${table.state} = 'ACTIVE' and ${table.endedAt} is null and ${table.finalStatus} is null) or (${table.state} = 'COMPLETED' and ${table.endedAt} is not null and ${table.finalStatus} = 'OFFLINE')`),
  check('sessions_nonnegative_check', sql`coalesce(${table.durationSeconds}, 0) >= 0 and coalesce(${table.peakViewers}, 0) >= 0 and coalesce(${table.totalComments}, 0) >= 0 and coalesce(${table.totalLikeActivity}, 0) >= 0 and coalesce(${table.eventCount}, 0) >= 0 and coalesce(${table.alertCount}, 0) >= 0`),
  uniqueIndex('sessions_one_active_per_stream').on(table.streamId).where(sql`${table.endedAt} is null`),
  index('sessions_history_idx').on(table.streamId, table.startedAt)
]);

export const monitoringSnapshots = pgTable('monitoring_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  streamId: uuid('stream_id').notNull().references(() => streams.id),
  liveSessionId: uuid('live_session_id').references(() => liveSessions.id),
  attemptKey: text('attempt_key').notNull(),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull(),
  providerOccurredAt: timestamp('provider_occurred_at', { withTimezone: true }),
  collectionSucceeded: boolean('collection_succeeded').notNull(),
  statusObserved: text('status_observed').notNull(),
  providerRoomId: text('provider_room_id'),
  currentViewers: bigint('current_viewers', { mode: 'number' }),
  collectorLatencyMs: integer('collector_latency_ms'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  providerMetadata: jsonb('provider_metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull()
}, (table) => [
  check('snapshots_status_check', sql`${table.statusObserved} in ${streamStatuses}`),
  check('snapshots_error_consistency_check', sql`(${table.collectionSucceeded} = true and ${table.errorCode} is null) or (${table.collectionSucceeded} = false and ${table.errorCode} is not null and ${table.errorCode} in ${collectorErrors})`),
  check('snapshots_nonnegative_check', sql`coalesce(${table.currentViewers}, 0) >= 0 and coalesce(${table.collectorLatencyMs}, 0) >= 0`),
  uniqueIndex('snapshots_attempt_unique').on(table.streamId, table.attemptKey),
  index('snapshots_stream_checked_idx').on(table.streamId, table.checkedAt),
  index('snapshots_session_checked_idx').on(table.liveSessionId, table.checkedAt),
  index('snapshots_retention_idx').on(table.checkedAt)
]);

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemaVersion: integer('schema_version').notNull().default(1),
  type: text('type').notNull(),
  streamId: uuid('stream_id').notNull().references(() => streams.id),
  liveSessionId: uuid('live_session_id').references(() => liveSessions.id),
  source: text('source').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  payload: jsonb('payload').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull()
}, (table) => [
  check('events_schema_version_check', sql`${table.schemaVersion} > 0`),
  check('events_type_check', sql`${table.type} in ${eventTypes}`),
  check('events_idempotency_key_check', sql`length(trim(${table.idempotencyKey})) > 0`),
  uniqueIndex('events_stream_idempotency_unique').on(table.streamId, table.idempotencyKey),
  index('events_stream_occurred_idx').on(table.streamId, table.occurredAt),
  index('events_session_occurred_idx').on(table.liveSessionId, table.occurredAt),
  index('events_type_occurred_idx').on(table.type, table.occurredAt),
  index('events_occurred_idx').on(table.occurredAt)
]);

export const alerts = pgTable('alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  streamId: uuid('stream_id').notNull().references(() => streams.id),
  liveSessionId: uuid('live_session_id').references(() => liveSessions.id),
  sourceEventId: uuid('source_event_id').references(() => events.id),
  type: text('type').notNull(),
  severity: text('severity').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  deduplicationKey: text('deduplication_key').notNull(),
  firstDetectedAt: timestamp('first_detected_at', { withTimezone: true }).notNull(),
  lastDetectedAt: timestamp('last_detected_at', { withTimezone: true }).notNull(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  description: text('description').notNull(),
  triggerValue: jsonb('trigger_value'),
  recommendedAction: text('recommended_action'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(now).notNull()
}, (table) => [
  check('alerts_severity_check', sql`${table.severity} in ${alertSeverities}`),
  check('alerts_status_check', sql`${table.status} in ${alertStatuses}`),
  check('alerts_detection_order_check', sql`${table.lastDetectedAt} >= ${table.firstDetectedAt}`),
  check('alerts_resolution_check', sql`(${table.status} = 'RESOLVED' and ${table.resolvedAt} is not null) or (${table.status} <> 'RESOLVED' and ${table.resolvedAt} is null)`),
  uniqueIndex('alerts_unresolved_dedup_unique').on(table.deduplicationKey).where(sql`${table.status} in ('ACTIVE', 'ACKNOWLEDGED')`),
  index('alerts_stream_status_idx').on(table.streamId, table.status, table.firstDetectedAt),
  index('alerts_session_idx').on(table.liveSessionId, table.firstDetectedAt),
  index('alerts_severity_status_idx').on(table.severity, table.status, table.firstDetectedAt)
]);

export const alertAcknowledgements = pgTable('alert_acknowledgements', {
  id: uuid('id').defaultRandom().primaryKey(),
  alertId: uuid('alert_id').notNull().references(() => alerts.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull()
}, (table) => [index('acknowledgements_alert_idx').on(table.alertId, table.acknowledgedAt)]);

export const aiSummaries = pgTable('ai_summaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  liveSessionId: uuid('live_session_id').notNull().references(() => liveSessions.id),
  status: text('status').notNull(),
  sessionSummary: text('session_summary'),
  keyMoments: jsonb('key_moments'),
  audienceChanges: text('audience_changes'),
  problems: jsonb('problems'),
  insights: jsonb('insights'),
  recommendations: jsonb('recommendations'),
  limitations: jsonb('limitations'),
  model: text('model'),
  failureReason: text('failure_reason'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(now).notNull()
}, (table) => [
  check('ai_summaries_status_check', sql`${table.status} in ${aiStatuses}`),
  check('ai_summaries_result_check', sql`(${table.status} = 'COMPLETED' and ${table.generatedAt} is not null and ${table.sessionSummary} is not null) or (${table.status} = 'FAILED' and ${table.failureReason} is not null) or ${table.status} = 'PENDING'`),
  uniqueIndex('ai_summaries_session_unique').on(table.liveSessionId),
  index('ai_summaries_processing_idx').on(table.status, table.updatedAt)
]);

export const integrationDeliveries = pgTable('integration_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id),
  alertId: uuid('alert_id').references(() => alerts.id),
  liveSessionId: uuid('live_session_id').references(() => liveSessions.id),
  destination: text('destination').notNull(),
  deliveryType: text('delivery_type').notNull(),
  status: text('status').notNull().default('PENDING'),
  idempotencyKey: text('idempotency_key').notNull(),
  attemptCount: integer('attempt_count').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  leaseUntil: timestamp('lease_until', { withTimezone: true }),
  leaseToken: uuid('lease_token'),
  succeededAt: timestamp('succeeded_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(now).notNull()
}, (table) => [
  check('deliveries_destination_check', sql`${table.destination} in ('N8N', 'DISCORD', 'GEMINI')`),
  check('deliveries_status_check', sql`${table.status} in ${deliveryStatuses}`),
  check('deliveries_attempt_check', sql`${table.attemptCount} >= 0`),
  check('deliveries_trigger_check', sql`${table.eventId} is not null or ${table.alertId} is not null or ${table.liveSessionId} is not null`),
  uniqueIndex('deliveries_destination_idempotency_unique').on(table.destination, table.idempotencyKey),
  index('deliveries_retry_idx').on(table.status, table.nextAttemptAt, table.leaseUntil),
  index('deliveries_event_idx').on(table.eventId),
  index('deliveries_alert_idx').on(table.alertId),
  index('deliveries_session_idx').on(table.liveSessionId)
]);
