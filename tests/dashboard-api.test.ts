import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test, { after, before } from 'node:test';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { buildApp } from '../src/server.js';

loadEnv({ path: '.env', override: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = await buildApp();
let owner: string;
let other: string;
let stream: string;
let alert: string;
let token: string;
const cookieFrom = (response: { headers: Record<string, unknown> }) => String(response.headers['set-cookie'] ?? '').split(';')[0];
const request = async (method: 'POST' | 'GET', url: string, cookie: string, payload?: any): Promise<any> => app.inject({ method, url, headers: { cookie }, payload });

before(async () => {
  await pool.query('TRUNCATE integration_deliveries, ai_summaries, alert_acknowledgements, alerts, events, monitoring_snapshots, live_sessions, streams, users RESTART IDENTITY CASCADE');
  owner = (await pool.query("INSERT INTO users (email, password_hash) VALUES ('phase-a-owner@test', 'hash') RETURNING id")).rows[0].id;
  other = (await pool.query("INSERT INTO users (email, password_hash) VALUES ('phase-a-other@test', 'hash') RETURNING id")).rows[0].id;
  stream = (await pool.query("INSERT INTO streams (user_id, name, external_identifier, monitoring_enabled, status) VALUES ($1, 'Owned', 'owner', true, 'LIVE') RETURNING id", [owner])).rows[0].id;
  await pool.query("INSERT INTO streams (user_id, name, external_identifier, status) VALUES ($1, 'Other', 'other', 'UNKNOWN')", [other]);
  const session = (await pool.query("INSERT INTO live_sessions (stream_id, started_at, peak_viewers, average_viewers) VALUES ($1, now(), 12, '8.5') RETURNING id", [stream])).rows[0].id;
  await pool.query("INSERT INTO monitoring_snapshots (stream_id, live_session_id, attempt_key, checked_at, collection_succeeded, status_observed, current_viewers, provider_metadata) VALUES ($1, $2, 'phase-a', now(), true, 'LIVE', 9, '{\"secret\":\"hidden\"}')", [stream, session]);
  await pool.query("INSERT INTO events (stream_id, live_session_id, type, source, occurred_at, received_at, payload, idempotency_key) VALUES ($1, $2, 'COMMENT', 'tiktok', now(), now(), '{\"count\":2,\"comments\":[{\"username\":\"viewer\",\"displayName\":\"Viewer\",\"text\":\"hello from viewer\"}]}', 'phase-a')", [stream, session]);
  alert = (await pool.query("INSERT INTO alerts (stream_id, live_session_id, type, severity, status, deduplication_key, first_detected_at, last_detected_at, description, trigger_value, recommended_action) VALUES ($1, $2, 'CONNECTION_FAILURE', 'CRITICAL', 'ACTIVE', 'phase-a', now(), now(), 'Provider unavailable', '{\"attempts\":3}', 'Check provider') RETURNING id", [stream, session])).rows[0].id;
  token = 'phase-a-session-token-abcdefghijklmnopqrstuvwxyz';
  await pool.query('INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval \'1 hour\')', [owner, createHash('sha256').update(token).digest('base64url')]);
});
after(async () => { await app.close(); await pool.end(); });

test('protected read APIs reject unauthenticated access', async () => {
  for (const url of ['/api/dashboard/overview', '/api/alerts', `/api/streams/${stream}`, `/api/streams/${stream}/events`, `/api/streams/${stream}/sessions`]) assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: `/api/alerts/${alert}/acknowledgements`, payload: {} })).statusCode, 401);
});

test('dashboard and detail return bounded DTOs with canonical KPI semantics', async () => {
  const overview = await request('GET', '/api/dashboard/overview', `livewarden_session=${token}`);
  assert.equal(overview.statusCode, 200);
});

test('ownership and endpoint DTO contract are enforced with a real session', async () => {
  const cookie = `livewarden_session=${token}`;
  const overview = await request('GET', '/api/dashboard/overview', cookie);
  assert.equal(overview.statusCode, 200);
  assert.deepEqual(overview.json().data.kpis, { monitoredStreams: 1, liveStreams: 1, problemStreams: 0, activeAlerts: 1 });
  assert.equal(overview.json().data.streams.length, 1);
  assert.equal(overview.json().data.streams[0].userId, undefined);
  assert.equal(overview.json().data.streams[0].checkLeaseToken, undefined);
  assert.equal(overview.json().data.streams[0].identifier, 'owner');
  assert.equal(overview.json().data.streams[0].latestViewers, 9);
  assert.ok(overview.json().data.streams[0].latestSnapshotAt);
  assert.equal(overview.json().data.streams[0].activeSession.peakViewers, 12);
  assert.equal(overview.json().data.streams[0].checkLeaseToken, undefined);
  const detail = await request('GET', `/api/streams/${stream}`, cookie);
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().data.stream.identifier, 'owner');
  assert.equal(detail.json().data.recentComments.length, 1);
  assert.deepEqual(detail.json().data.recentComments[0], { text: 'hello from viewer', displayName: 'Viewer', username: 'viewer', occurredAt: detail.json().data.recentComments[0].occurredAt });
  assert.equal(detail.json().data.stream.userId, undefined);
  assert.equal('providerMetadata' in detail.json().data.latestSnapshot, false);
  assert.equal(detail.json().data.activeSession.peakViewers, 12);
  assert.equal((await request('GET', `/api/streams/${crypto.randomUUID()}`, cookie)).statusCode, 404);
  const foreign = (await pool.query('SELECT id FROM streams WHERE user_id = $1', [other])).rows[0].id;
  assert.equal((await request('GET', `/api/streams/${foreign}`, cookie)).statusCode, 404);
  assert.equal((await request('GET', `/api/streams/${stream}/events`, cookie)).json().data.events.length, 1);
  assert.equal((await request('GET', `/api/streams/${stream}/sessions`, cookie)).json().data.sessions.length, 1);
  const alerts = await request('GET', '/api/alerts?severity=CRITICAL&limit=1', cookie);
  assert.equal(alerts.statusCode, 200);
  assert.equal(alerts.json().data.alerts[0].severity, 'CRITICAL');
  const ack = await request('POST', `/api/alerts/${alert}/acknowledgements`, cookie, { note: 'checked' });
  assert.equal(ack.statusCode, 200);
  assert.equal(ack.json().data.alert.status, 'ACKNOWLEDGED');
  assert.equal(ack.json().data.alert.acknowledgements[0].note, 'checked');
  assert.equal((await request('GET', `/api/alerts/${alert}`, cookie)).json().data.alert.sourceEventId, null);
});

test('malformed paths, filters, and acknowledgement bodies return validation errors', async () => {
  const cookie = `livewarden_session=${token}`;
  assert.equal((await request('GET', '/api/streams/not-uuid/events', cookie)).statusCode, 400);
  assert.equal((await request('GET', '/api/alerts?limit=0', cookie)).statusCode, 400);
  assert.equal((await request('POST', `/api/alerts/${alert}/acknowledgements`, cookie, { unexpected: true })).statusCode, 400);
});
