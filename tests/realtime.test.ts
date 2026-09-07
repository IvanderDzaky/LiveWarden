import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test, { after, before } from 'node:test';
import pg from 'pg';
import { buildApp } from '../src/server.js';
import { publishRealtimeEvent, REALTIME_CHANNEL, realtimeEventSchema } from '../src/realtime/events.js';
import { db } from '../src/db/client.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = await buildApp();
let ownerToken: string;
let streamId: string;
let foreignStreamId: string;
let baseUrl: string;

before(async () => {
  await pool.query('TRUNCATE integration_deliveries, ai_summaries, alert_acknowledgements, alerts, events, monitoring_snapshots, live_sessions, streams, auth_sessions, users RESTART IDENTITY CASCADE');
  const owner = (await pool.query("INSERT INTO users (email, password_hash) VALUES ('realtime-owner@test', 'hash') RETURNING id")).rows[0].id;
  const foreign = (await pool.query("INSERT INTO users (email, password_hash) VALUES ('realtime-foreign@test', 'hash') RETURNING id")).rows[0].id;
  streamId = (await pool.query("INSERT INTO streams (user_id, name, external_identifier) VALUES ($1, 'Owned', 'owned') RETURNING id", [owner])).rows[0].id;
  foreignStreamId = (await pool.query("INSERT INTO streams (user_id, name, external_identifier) VALUES ($1, 'Foreign', 'foreign') RETURNING id", [foreign])).rows[0].id;
  ownerToken = 'realtime-session-token-abcdefghijklmnopqrstuvwxyz';
  await pool.query("INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [owner, createHash('sha256').update(ownerToken).digest('base64url')]);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('test server address unavailable');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => { await app.close(); await pool.end(); });

test('realtime publisher emits normalized PostgreSQL notification only after commit', async () => {
  const listener = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await listener.connect(); await listener.query(`LISTEN ${REALTIME_CHANNEL}`);
    const received = new Promise<string>((resolve) => listener.once('notification', (message) => resolve(message.payload ?? '')));
    await db.transaction(async (tx) => {
      await publishRealtimeEvent(tx, { type: 'stream.status', streamId, identifier: 'owned', occurredAt: new Date().toISOString(), payload: { status: 'LIVE' } });
      let delivered = false;
      void received.then(() => { delivered = true; });
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(delivered, false);
    });
    assert.equal(realtimeEventSchema.parse(JSON.parse(await received)).streamId, streamId);
  } finally { await listener.end(); }
});

test('realtime publisher rejects payloads unsafe for PostgreSQL NOTIFY', async () => {
  await assert.rejects(db.transaction((tx) => publishRealtimeEvent(tx, { type: 'stream.comment', streamId, identifier: 'owned', occurredAt: new Date().toISOString(), payload: { value: 'x'.repeat(8_000) } })), /payload limit/);
});

test('SSE requires authentication and enforces stream ownership', async () => {
  assert.equal((await app.inject({ method: 'GET', url: `/api/streams/${streamId}/live` })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: `/api/streams/${foreignStreamId}/live`, headers: { cookie: `livewarden_session=${ownerToken}` } })).statusCode, 404);
});

test('SSE formats events, isolates streams, and cleans up disconnected clients', async () => {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/api/streams/${streamId}/live`, { headers: { cookie: `livewarden_session=${ownerToken}` }, signal: controller.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/event-stream/);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  assert.match(decoder.decode((await reader.read()).value), /event: stream\.ready/);
  assert.equal((app as typeof app & { realtimeHub: { subscriberCount: number } }).realtimeHub.subscriberCount, 1);

  const pending = reader.read();
  await pool.query('SELECT pg_notify($1, $2)', [REALTIME_CHANNEL, JSON.stringify({ id: crypto.randomUUID(), schemaVersion: 1, type: 'stream.status', streamId: foreignStreamId, identifier: 'foreign', occurredAt: new Date().toISOString(), payload: { status: 'LIVE' } })]);
  assert.equal(await Promise.race([pending.then(() => 'event'), new Promise((resolve) => setTimeout(() => resolve('timeout'), 100))]), 'timeout');
  const eventId = crypto.randomUUID();
  await pool.query('SELECT pg_notify($1, $2)', [REALTIME_CHANNEL, JSON.stringify({ id: eventId, schemaVersion: 1, type: 'stream.viewer_count', streamId, identifier: 'owned', occurredAt: new Date().toISOString(), payload: { currentViewers: 12 } })]);
  const frame = decoder.decode((await pending).value);
  assert.match(frame, new RegExp(`id: ${eventId}`));
  assert.match(frame, /event: stream\.viewer_count/);
  controller.abort();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal((app as typeof app & { realtimeHub: { subscriberCount: number } }).realtimeHub.subscriberCount, 0);
});
