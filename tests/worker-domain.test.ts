import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeCollector, fakeFailure, fakeSuccess } from '../src/collectors/fake.js';
import { statusFromResult } from '../src/domain/status.js';
import { sessionAction } from '../src/domain/session.js';
import { activityIdempotencyKey, activityPayload, lifecycleIdempotencyKey } from '../src/domain/events.js';

test('status mapping keeps failures distinct from offline', () => {
  const collector = new FakeCollector({ creator: fakeFailure('NETWORK_ERROR', true) });
  return collector.collect('@creator').then((result) => {
    assert.equal(statusFromResult(result), 'UNKNOWN');
    assert.equal(sessionAction('UNKNOWN'), 'NOOP');
  });
});

test('verified offline is the only closing action', () => {
  const live = new FakeCollector({ creator: fakeSuccess(true, { roomId: 'room-1', currentViewers: 10 }) });
  const offline = new FakeCollector({ creator: fakeSuccess(false) });
  return Promise.all([live.collect('creator'), offline.collect('creator')]).then(([liveResult, offlineResult]) => {
    assert.equal(statusFromResult(liveResult), 'LIVE');
    assert.equal(statusFromResult(offlineResult), 'OFFLINE');
    assert.equal(sessionAction('DEGRADED'), 'CREATE_OR_CONTINUE');
    assert.equal(sessionAction('DISCONNECTED'), 'NOOP');
    assert.equal(sessionAction('OFFLINE'), 'CLOSE');
  });
});

test('fake collector consumes scripted sequence', async () => {
  const collector = new FakeCollector({ creator: [fakeSuccess(true), fakeSuccess(false)] });
  assert.equal(statusFromResult(await collector.collect('@creator')), 'LIVE');
  assert.equal(statusFromResult(await collector.collect('@creator')), 'OFFLINE');
});

test('event keys and payloads are deterministic and bounded', () => {
  assert.equal(lifecycleIdempotencyKey('stream', 'session', 'started'), 'stream:stream:session:session:started');
  assert.equal(activityIdempotencyKey('stream', 'attempt', 'like'), 'stream:stream:attempt:attempt:like');
  assert.deepEqual(activityPayload(4), { count: 4 });
  assert.throws(() => activityPayload(0));
});
