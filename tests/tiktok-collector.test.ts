import assert from 'node:assert/strict';
import test from 'node:test';
import { TikTokCollector } from '../src/collectors/tiktok.js';
import type { CollectorResult } from '../src/domain/collector.js';
import { classifyTikTokError } from '../src/collectors/tiktok-errors.js';

class MockConnection {
  private listeners = new Map<string, ((value?: unknown) => void)[]>();
  disconnected = false;
  removed = false;
  constructor(private readonly state: { roomId: string }, private readonly shouldConnect = true) {}
  on(event: string, listener: (...args: any[]) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }
  emit(event: string, value: unknown) { for (const listener of this.listeners.get(event) ?? []) listener(value); }
  async connect() {
    if (!this.shouldConnect) throw new Error('Failed to retrieve Room ID from all sources.');
    this.emit('connected', this.state);
    setTimeout(() => { this.emit('roomUser', { total: 321, totalUser: 999_999, common: { createTime: '1700000000' } }); this.emit('chat', { content: 'hello', user: { uniqueId: 'viewer', nickname: 'Viewer' }, common: { createTime: '1700000001' } }); }, 0);
    return this.state;
  }
  async disconnect() { this.disconnected = true; }
  removeAllListeners() { this.removed = true; }
}

class OfflineConnection extends MockConnection {
  async connect(): Promise<{ roomId: string }> {
    const error = new Error('verified offline');
    error.name = 'UserOfflineError';
    throw error;
  }
}

class ReconnectingConnection extends MockConnection {
  connects = 0;
  async connect() { this.connects += 1; return super.connect(); }
}

const result = (value: CollectorResult) => value;

test('TikTok adapter normalizes live observation and cleans up', async () => {
  let connection!: MockConnection;
  const collector = new TikTokCollector({ observationWindowMs: 5, connectionFactory: () => (connection = new MockConnection({ roomId: 'opaque-room' })) });
  const value = result(await collector.collect('@creator'));
  assert.equal(value.provider, 'tiktok');
  assert.equal(value.canonicalIdentifier, 'creator');
  assert.equal(value.collection.successful, true);
  if (value.collection.successful && value.observation) {
    assert.equal(value.observation.providerLive, true);
    assert.equal(value.observation.roomId, 'opaque-room');
    assert.equal(value.observation.currentViewers, 321);
    assert.deepEqual(value.observation.recentComments.map((comment) => ({ username: comment.username, displayName: comment.displayName, text: comment.text })), [{ username: 'viewer', displayName: 'Viewer', text: 'hello' }]);
    assert.deepEqual(value.observation.metadata, {});
  }
  assert.equal(connection.disconnected, false);
  await collector.close();
  assert.equal(connection.disconnected, true);
  assert.equal(connection.removed, true);
});

test('ambiguous offline and user lookup errors remain unknown', async () => {
  const collector = new TikTokCollector({ connectionFactory: () => new MockConnection({ roomId: '' }, false) });
  const value = await collector.collect('creator');
  assert.equal(value.collection.successful, false);
  if (!value.collection.successful && value.error) assert.equal(value.error.code, 'USER_NOT_FOUND');
});

test('only typed offline evidence maps to offline', () => {
  const typed = new Error('offline');
  typed.name = 'UserOfflineError';
  assert.equal(classifyTikTokError(typed).code, 'STREAM_OFFLINE');
  assert.equal(classifyTikTokError(new Error("The requested user isn't online :(")).code, 'UNKNOWN_COLLECTOR_ERROR');
});

test('typed offline becomes a successful offline observation', async () => {
  const collector = new TikTokCollector({ connectionFactory: () => new OfflineConnection({ roomId: '' }) });
  const value = await collector.collect('creator');
  assert.equal(value.collection.successful, true);
  if (value.collection.successful && value.observation) assert.equal(value.observation.providerLive, false);
});

test('empty identifier is rejected without provider call', async () => {
  let called = false;
  const collector = new TikTokCollector({ connectionFactory: () => { called = true; return new MockConnection({ roomId: '' }); } });
  const value = await collector.collect(' @ ');
  assert.equal(called, false);
  assert.equal(value.collection.successful, false);
  if (!value.collection.successful && value.error) assert.equal(value.error.code, 'USER_NOT_FOUND');
});

test('disconnect schedules one reconnect and close cancels lifecycle timers', async () => {
  let connection!: ReconnectingConnection;
  const collector = new TikTokCollector({ observationWindowMs: 1, connectionFactory: () => (connection = new ReconnectingConnection({ roomId: 'room' })) });
  await collector.collect('creator');
  connection.emit('disconnected', undefined);
  connection.emit('disconnected', undefined);
  await new Promise((resolve) => setTimeout(resolve, 1_050));
  assert.equal(connection.connects, 2);
  await collector.close();
  assert.equal(connection.disconnected, true);
});
