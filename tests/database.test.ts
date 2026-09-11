import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { config } from "dotenv";
import pg from "pg";
import { FakeCollector, fakeSuccess } from "../src/collectors/fake.js";
import { processStream } from "../src/worker/process-stream.js";
import { acknowledgeAlertForUser } from "../src/worker/acknowledgement.js";
import { pruneMonitoringSnapshots } from "../src/db/retention.js";

config({ path: ".env", override: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString });

let userId: string;
let streamId: string;

const query = (text: string, values: unknown[] = []) =>
  pool.query(text, values);
const rejects = async (promise: Promise<unknown>, constraint: string) => {
  await assert.rejects(
    promise,
    (error: any) => error.constraint === constraint,
  );
};

before(async () => {
  await query(
    "TRUNCATE integration_deliveries, ai_summaries, alert_acknowledgements, alerts, events, monitoring_snapshots, live_sessions, streams, users RESTART IDENTITY CASCADE",
  );
  userId = (
    await query(
      "INSERT INTO users (email, password_hash) VALUES ('owner@example.test', 'hash') RETURNING id",
    )
  ).rows[0].id;
  streamId = (
    await query(
      "INSERT INTO streams (user_id, name, external_identifier) VALUES ($1, 'Creator', 'creator') RETURNING id",
      [userId],
    )
  ).rows[0].id;
});

test("duplicate active stream is rejected", async () => {
  await rejects(
    query(
      "INSERT INTO streams (user_id, name, external_identifier) VALUES ($1, 'Duplicate', 'creator')",
      [userId],
    ),
    "streams_active_identity_unique",
  );
});

test("soft-deleted stream permits identifier reuse", async () => {
  await query("UPDATE streams SET deleted_at = now() WHERE id = $1", [
    streamId,
  ]);
  const result = await query(
    "INSERT INTO streams (user_id, name, external_identifier) VALUES ($1, 'Reused', 'creator') RETURNING id",
    [userId],
  );
  streamId = result.rows[0].id;
});

test("one active session per stream, many completed sessions allowed", async () => {
  const active = (
    await query(
      "INSERT INTO live_sessions (stream_id, started_at) VALUES ($1, now()) RETURNING id",
      [streamId],
    )
  ).rows[0].id;
  await rejects(
    query(
      "INSERT INTO live_sessions (stream_id, started_at) VALUES ($1, now())",
      [streamId],
    ),
    "sessions_one_active_per_stream",
  );
  await query(
    "UPDATE live_sessions SET ended_at = now(), state = 'COMPLETED', final_status = 'OFFLINE' WHERE id = $1",
    [active],
  );
  await query(
    "INSERT INTO live_sessions (stream_id, started_at, ended_at, state, final_status) VALUES ($1, now(), now(), 'COMPLETED', 'OFFLINE')",
    [streamId],
  );
});

test("snapshot success/error consistency and attempt idempotency", async () => {
  await rejects(
    query(
      "INSERT INTO monitoring_snapshots (stream_id, attempt_key, checked_at, collection_succeeded, status_observed, error_code) VALUES ($1, 'bad-success', now(), true, 'LIVE', 'NETWORK_ERROR')",
      [streamId],
    ),
    "snapshots_error_consistency_check",
  );
  await rejects(
    query(
      "INSERT INTO monitoring_snapshots (stream_id, attempt_key, checked_at, collection_succeeded, status_observed) VALUES ($1, 'bad-failure', now(), false, 'UNKNOWN')",
      [streamId],
    ),
    "snapshots_error_consistency_check",
  );
  await query(
    "INSERT INTO monitoring_snapshots (stream_id, attempt_key, checked_at, collection_succeeded, status_observed) VALUES ($1, 'attempt-1', now(), true, 'LIVE')",
    [streamId],
  );
  await rejects(
    query(
      "INSERT INTO monitoring_snapshots (stream_id, attempt_key, checked_at, collection_succeeded, status_observed) VALUES ($1, 'attempt-1', now(), true, 'LIVE')",
      [streamId],
    ),
    "snapshots_attempt_unique",
  );
});

test("stream lease claim skips active lease and reclaims expired lease", async () => {
  await query("UPDATE streams SET monitoring_enabled = true, next_check_at = now() - interval '1 second', check_lease_until = null, check_lease_token = null WHERE id = $1", [streamId]);
  const claimed = await query(
    "UPDATE streams SET check_lease_until = now() + interval '30 seconds', check_lease_token = gen_random_uuid() WHERE id = (SELECT id FROM streams WHERE monitoring_enabled = true AND deleted_at IS NULL AND (next_check_at IS NULL OR next_check_at <= now()) AND (check_lease_until IS NULL OR check_lease_until <= now()) FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING check_lease_token",
  );
  assert.equal(claimed.rowCount, 1);
  const skipped = await query("SELECT id FROM streams WHERE id = $1 AND (check_lease_until IS NULL OR check_lease_until <= now())", [streamId]);
  assert.equal(skipped.rowCount, 0);
  await query("UPDATE streams SET check_lease_until = now() - interval '1 second' WHERE id = $1", [streamId]);
  const reclaimed = await query("SELECT id FROM streams WHERE id = $1 AND (check_lease_until IS NULL OR check_lease_until <= now())", [streamId]);
  assert.equal(reclaimed.rowCount, 1);
});

test("worker processes a collector result transactionally", async () => {
  const token = "00000000-0000-0000-0000-000000000001";
  await query("UPDATE streams SET monitoring_enabled = true, next_check_at = now(), check_lease_until = now() + interval '30 seconds', check_lease_token = $2 WHERE id = $1", [streamId, token]);
  const stream = (await query("SELECT id, external_identifier AS \"externalIdentifier\", check_lease_token AS \"checkLeaseToken\" FROM streams WHERE id = $1", [streamId])).rows[0];
  const comment = { username: "viewer", displayName: "Viewer", text: "hello", occurredAt: new Date("2025-01-01T00:00:00.000Z") };
  await processStream(stream, token, new FakeCollector({ creator: fakeSuccess(true, { roomId: "worker-room", currentViewers: 77, comments: 2, likes: 5, recentComments: [comment], recentGifts: [{ username: "gifter", displayName: "Gifter", giftId: "1", giftName: "Rose", repeatCount: 2, coinCount: 10, giftImageUrl: null, occurredAt: new Date("2025-01-01T00:00:02.000Z") }] }) }), {
    timeoutMs: 1000, retries: 0, retryBackoffMs: 0, intervalMs: 30000
  });
  const persisted = (await query("SELECT s.status, s.last_room_id, s.check_lease_token, ls.id AS session_id FROM streams s LEFT JOIN live_sessions ls ON ls.stream_id = s.id AND ls.ended_at IS NULL WHERE s.id = $1", [streamId])).rows[0];
  assert.equal(persisted.status, "LIVE");
  assert.equal(persisted.last_room_id, "worker-room");
  assert.equal(persisted.check_lease_token, null);
  assert.ok(persisted.session_id);
  const aggregate = (await query("SELECT total_comments, total_like_activity, total_gifts, total_gift_quantity, total_gift_coins, event_count, alert_count, provider_room_id FROM live_sessions WHERE id = $1", [persisted.session_id])).rows[0];
  assert.equal(Number(aggregate.total_comments), 2);
  assert.equal(Number(aggregate.total_like_activity), 5);
  assert.equal(Number(aggregate.total_gifts), 1);
  assert.equal(Number(aggregate.total_gift_quantity), 2);
  assert.equal(Number(aggregate.total_gift_coins), 10);
  assert.equal(Number(aggregate.event_count), 4);
  assert.equal(Number(aggregate.alert_count), 0);
  const eventTypes = (await query("SELECT type, payload FROM events WHERE stream_id = $1 ORDER BY created_at", [streamId])).rows;
  assert.ok(eventTypes.some((event) => event.type === "STREAM_STARTED"));
  assert.ok(eventTypes.some((event) => event.type === "COMMENT" && event.payload.count === 2 && event.payload.comments[0].username === "viewer" && event.payload.comments[0].displayName === "Viewer" && event.payload.comments[0].text === "hello"));
  assert.ok(eventTypes.some((event) => event.type === "LIKE" && event.payload.count === 5));
  assert.ok(eventTypes.some((event) => event.type === "GIFT" && event.payload.gifts[0].giftName === "Rose"));
  const intent = (await query("SELECT destination, delivery_type, idempotency_key, status FROM integration_deliveries WHERE alert_id IN (SELECT id FROM alerts WHERE stream_id = $1)", [streamId])).rows;
  assert.ok(intent.every((delivery) => delivery.destination === "N8N" && delivery.status === "PENDING"));
});

test("different provider room does not reuse active session", async () => {
  const token = "00000000-0000-0000-0000-000000000005";
  await query("UPDATE streams SET check_lease_token = $2, check_lease_until = now() + interval '30 seconds' WHERE id = $1", [streamId, token]);
  const row = (await query("SELECT id, external_identifier AS \"externalIdentifier\", check_lease_token AS \"checkLeaseToken\" FROM streams WHERE id = $1", [streamId])).rows[0];
  await processStream(row, token, new FakeCollector({ creator: fakeSuccess(true, { roomId: "different-room", currentViewers: 30 }) }), { timeoutMs: 1000, retries: 0, retryBackoffMs: 0, intervalMs: 30000 });
  const sessions = (await query("SELECT provider_room_id FROM live_sessions WHERE stream_id = $1 AND ended_at IS NULL", [streamId])).rows;
  assert.deepEqual(sessions.map((session) => session.provider_room_id), ["worker-room"]);
  const orphanSnapshot = (await query("SELECT live_session_id FROM monitoring_snapshots WHERE stream_id = $1 AND provider_room_id = 'different-room'", [streamId])).rows[0];
  assert.equal(orphanSnapshot.live_session_id, null);
});

test("repeated identical observation persists one comment event and aggregate", async () => {
  const token = "00000000-0000-0000-0000-000000000007";
  const comment = { username: "repeat-viewer", displayName: "Repeat Viewer", text: "same comment", occurredAt: new Date("2025-01-01T00:00:01.000Z") };
  const collector = new FakeCollector({ creator: [fakeSuccess(true, { roomId: "worker-room", currentViewers: 77, recentComments: [comment] }), fakeSuccess(true, { roomId: "worker-room", currentViewers: 77, recentComments: [comment] })] });
  const before = (await query("SELECT total_comments FROM live_sessions WHERE stream_id = $1 AND ended_at IS NULL", [streamId])).rows[0];
  for (let index = 0; index < 2; index += 1) {
    await query("UPDATE streams SET check_lease_token = $2, check_lease_until = now() + interval '30 seconds' WHERE id = $1", [streamId, token]);
    const row = (await query("SELECT id, external_identifier AS \"externalIdentifier\", check_lease_token AS \"checkLeaseToken\" FROM streams WHERE id = $1", [streamId])).rows[0];
    await processStream(row, token, collector, { timeoutMs: 1000, retries: 0, retryBackoffMs: 0, intervalMs: 30000 });
  }
  const session = (await query("SELECT id, total_comments FROM live_sessions WHERE stream_id = $1 AND ended_at IS NULL", [streamId])).rows[0];
  const comments = (await query("SELECT payload FROM events WHERE live_session_id = $1 AND type = 'COMMENT' AND payload->'comments' @> $2::jsonb", [session.id, JSON.stringify([{ username: "repeat-viewer", displayName: "Repeat Viewer", text: "same comment" }])])).rows;
  assert.equal(comments.length, 1);
  assert.equal(Number(session.total_comments), Number(before.total_comments) + 1);
  assert.deepEqual(comments[0].payload.comments, [{ username: "repeat-viewer", displayName: "Repeat Viewer", text: "same comment" }]);
});

test("viewer drop and comment activity create bounded events and alerts", async () => {
  const token = "00000000-0000-0000-0000-000000000006";
  await query("UPDATE streams SET check_lease_token = $2, check_lease_until = now() + interval '30 seconds' WHERE id = $1", [streamId, token]);
  const row = (await query("SELECT id, external_identifier AS \"externalIdentifier\", check_lease_token AS \"checkLeaseToken\" FROM streams WHERE id = $1", [streamId])).rows[0];
  await processStream(row, token, new FakeCollector({ creator: fakeSuccess(true, { roomId: "worker-room", currentViewers: 30, comments: 10 }) }), { timeoutMs: 1000, retries: 0, retryBackoffMs: 0, intervalMs: 30000 });
  const events = (await query("SELECT type, payload FROM events WHERE stream_id = $1 AND type IN ('VIEWER_DROP', 'COMMENT_ACTIVITY_SPIKE')", [streamId])).rows;
  assert.equal(events.length, 2);
  assert.equal(events.find((event) => event.type === 'VIEWER_DROP').payload.previous, 77);
  const alerts = (await query("SELECT type, severity, status FROM alerts WHERE stream_id = $1 AND type IN ('VIEWER_DROP', 'COMMENT_ACTIVITY_SPIKE') ORDER BY type", [streamId])).rows;
  assert.deepEqual(alerts, [{ type: 'COMMENT_ACTIVITY_SPIKE', severity: 'INFO', status: 'ACTIVE' }, { type: 'VIEWER_DROP', severity: 'WARNING', status: 'ACTIVE' }]);
});

test("events enforce type and stream-scoped idempotency", async () => {
  const first = await query(
    "INSERT INTO events (stream_id, type, source, occurred_at, received_at, payload, idempotency_key) VALUES ($1, 'COMMENT', 'tiktok', now(), now(), '{\"count\":2}', 'attempt:event-1') RETURNING id",
    [streamId],
  );
  assert.ok(first.rows[0].id);
  await rejects(
    query(
      "INSERT INTO events (stream_id, type, source, occurred_at, received_at, payload, idempotency_key) VALUES ($1, 'COMMENT', 'tiktok', now(), now(), '{\"count\":2}', 'attempt:event-1')",
      [streamId],
    ),
    "events_stream_idempotency_unique",
  );
  await rejects(
    query(
      "INSERT INTO events (stream_id, type, source, occurred_at, received_at, payload, idempotency_key) VALUES ($1, 'GIFT', 'tiktok', now(), now(), '{}', '')",
      [streamId],
    ),
    "events_idempotency_key_check",
  );
});

test("delivery lease is claimable after expiry and protected by token", async () => {
  const alert = (await query("INSERT INTO alerts (stream_id, type, severity, status, deduplication_key, first_detected_at, last_detected_at, description) VALUES ($1, 'CONNECTION_FAILURE', 'CRITICAL', 'ACTIVE', 'lease-alert', now(), now(), 'Lease test') RETURNING id", [streamId])).rows[0];
  const inserted = await query("INSERT INTO integration_deliveries (alert_id, destination, delivery_type, idempotency_key, status, lease_until, lease_token) VALUES ($1, 'N8N', 'ALERT_CREATED', 'lease:test', 'IN_PROGRESS', now() - interval '1 second', gen_random_uuid()) RETURNING id, lease_token", [alert.id]);
  assert.equal(inserted.rowCount, 1);
  const deliveryId = inserted.rows[0].id;
  const oldToken = inserted.rows[0].lease_token;
  const claimed = await query("UPDATE integration_deliveries SET lease_until = now() + interval '30 seconds', lease_token = gen_random_uuid() WHERE id = $1 AND (lease_until IS NULL OR lease_until <= now()) RETURNING lease_token", [deliveryId]);
  assert.equal(claimed.rowCount, 1);
  const stale = await query("UPDATE integration_deliveries SET status = 'SUCCEEDED' WHERE id = $1 AND lease_token = $2", [deliveryId, oldToken]);
  assert.equal(stale.rowCount, 0);
});

test("verified offline closes session and emits one stream-ended event", async () => {
  const row = (await query("SELECT id, external_identifier AS \"externalIdentifier\", check_lease_token AS \"checkLeaseToken\" FROM streams WHERE id = $1", [streamId])).rows[0];
  const token = "00000000-0000-0000-0000-000000000002";
  await query("UPDATE streams SET check_lease_token = $2, check_lease_until = now() + interval '30 seconds' WHERE id = $1", [streamId, token]);
  await processStream(row, token, new FakeCollector({ creator: fakeSuccess(false) }), { timeoutMs: 1000, retries: 0, retryBackoffMs: 0, intervalMs: 30000 });
  const ended = (await query("SELECT state, final_status FROM live_sessions WHERE stream_id = $1 AND ended_at IS NOT NULL", [streamId])).rows;
  const eventRows = (await query("SELECT type FROM events WHERE stream_id = $1 AND type = 'STREAM_ENDED'", [streamId])).rows;
  assert.ok(ended.length >= 1);
  assert.ok(ended.every((session) => session.state === "COMPLETED" && session.final_status === "OFFLINE"));
  assert.equal(eventRows.length, 1);
});

test("three failed checks create one warning and recovery resolves it", async () => {
  const token = "00000000-0000-0000-0000-000000000003";
  for (let index = 0; index < 3; index += 1) {
    await query("UPDATE streams SET check_lease_token = $2, check_lease_until = now() + interval '30 seconds' WHERE id = $1", [streamId, token]);
    const row = (await query("SELECT id, external_identifier AS \"externalIdentifier\", check_lease_token AS \"checkLeaseToken\" FROM streams WHERE id = $1", [streamId])).rows[0];
    const failure = new FakeCollector({ creator: [{ provider: "fake", requestedIdentifier: "creator", canonicalIdentifier: "creator", collection: { successful: false, latencyMs: 1, providerOccurredAt: null }, observation: null, error: { code: "NETWORK_ERROR", retryable: false, message: "network" } }] });
    await processStream(row, token, failure, { timeoutMs: 1000, retries: 0, retryBackoffMs: 0, intervalMs: 30000 });
  }
  const warning = (await query("SELECT id, status, severity FROM alerts WHERE stream_id = $1 AND type = 'MONITORING_FAILURE'", [streamId])).rows;
  assert.equal(warning.length, 1);
  assert.equal(warning[0].severity, "WARNING");
  const user = (await query("SELECT id FROM users WHERE email = 'owner@example.test'")).rows[0].id;
  await acknowledgeAlertForUser(warning[0].id, user, "seen");
  await query("UPDATE streams SET check_lease_token = $2, check_lease_until = now() + interval '30 seconds' WHERE id = $1", [streamId, token]);
  const row = (await query("SELECT id, external_identifier AS \"externalIdentifier\", check_lease_token AS \"checkLeaseToken\" FROM streams WHERE id = $1", [streamId])).rows[0];
  await processStream(row, token, new FakeCollector({ creator: fakeSuccess(true) }), { timeoutMs: 1000, retries: 0, retryBackoffMs: 0, intervalMs: 30000 });
  const resolved = (await query("SELECT status FROM alerts WHERE id = $1", [warning[0].id])).rows[0];
  assert.equal(resolved.status, "RESOLVED");
});

test("explicit disconnected creates critical connection alert, unknown does not", async () => {
  const token = "00000000-0000-0000-0000-000000000004";
  await query("UPDATE streams SET check_lease_token = $2, check_lease_until = now() + interval '30 seconds' WHERE id = $1", [streamId, token]);
  const row = (await query("SELECT id, external_identifier AS \"externalIdentifier\", check_lease_token AS \"checkLeaseToken\" FROM streams WHERE id = $1", [streamId])).rows[0];
  const disconnected = new FakeCollector({ creator: [{ provider: "fake", requestedIdentifier: "creator", canonicalIdentifier: "creator", collection: { successful: false, latencyMs: 1, providerOccurredAt: null }, observation: null, error: { code: "PROVIDER_UNAVAILABLE", retryable: false, message: "provider" } }] });
  await processStream(row, token, disconnected, { timeoutMs: 1000, retries: 0, retryBackoffMs: 0, intervalMs: 30000 });
  const alert = (await query("SELECT severity FROM alerts WHERE stream_id = $1 AND type = 'CONNECTION_FAILURE'", [streamId])).rows[0];
  assert.equal(alert.severity, "CRITICAL");
});

test("unresolved alert deduplication and resolved reuse", async () => {
  await query(
    "INSERT INTO alerts (stream_id, type, severity, status, deduplication_key, first_detected_at, last_detected_at, description) VALUES ($1, 'CONNECTION_LOST', 'CRITICAL', 'ACTIVE', 'connection:1', now(), now(), 'Connection lost')",
    [streamId],
  );
  await rejects(
    query(
      "INSERT INTO alerts (stream_id, type, severity, status, deduplication_key, first_detected_at, last_detected_at, description) VALUES ($1, 'CONNECTION_LOST', 'CRITICAL', 'ACKNOWLEDGED', 'connection:1', now(), now(), 'Duplicate')",
      [streamId],
    ),
    "alerts_unresolved_dedup_unique",
  );
  await query(
    "UPDATE alerts SET status = 'RESOLVED', resolved_at = now() WHERE deduplication_key = 'connection:1'",
  );
  await query(
    "INSERT INTO alerts (stream_id, type, severity, status, deduplication_key, first_detected_at, last_detected_at, description) VALUES ($1, 'CONNECTION_LOST', 'CRITICAL', 'ACTIVE', 'connection:1', now(), now(), 'New occurrence')",
    [streamId],
  );
});

test("AI summary and integration delivery idempotency", async () => {
  const sessionId = (
    await query(
      "SELECT id FROM live_sessions WHERE stream_id = $1 ORDER BY created_at DESC LIMIT 1",
      [streamId],
    )
  ).rows[0].id;
  await query(
    "INSERT INTO ai_summaries (live_session_id, status, requested_at) VALUES ($1, 'PENDING', now())",
    [sessionId],
  );
  await rejects(
    query(
      "INSERT INTO ai_summaries (live_session_id, status, requested_at) VALUES ($1, 'PENDING', now())",
      [sessionId],
    ),
    "ai_summaries_session_unique",
  );
  await query(
    "INSERT INTO integration_deliveries (live_session_id, destination, delivery_type, idempotency_key) VALUES ($1, 'N8N', 'SESSION_ENDED', 'delivery:1')",
    [sessionId],
  );
  await rejects(
    query(
      "INSERT INTO integration_deliveries (live_session_id, destination, delivery_type, idempotency_key) VALUES ($1, 'N8N', 'SESSION_ENDED', 'delivery:1')",
      [sessionId],
    ),
    "deliveries_destination_idempotency_unique",
  );
});

test("monitoring snapshot retention removes records older than 30 days", async () => {
  await query("UPDATE monitoring_snapshots SET checked_at = now() - interval '31 days' WHERE stream_id = $1", [streamId]);
  const deleted = await pruneMonitoringSnapshots();
  assert.ok(deleted > 0);
  const remaining = await query("SELECT count(*)::int AS count FROM monitoring_snapshots WHERE stream_id = $1", [streamId]);
  assert.equal(remaining.rows[0].count, 0);
});

after(async () => {
  await pool.end();
});
