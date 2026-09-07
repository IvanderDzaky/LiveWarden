import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeCollector, fakeSuccess } from '../src/collectors/fake.js';
import { statusFromResult } from '../src/domain/status.js';

test('worker collector contract accepts TikTok-shaped provider result', async () => {
  const collector = new FakeCollector({ creator: fakeSuccess(true, { roomId: 'room-1', currentViewers: 42 }) });
  const value = await collector.collect('@creator');
  assert.equal(value.provider, 'fake');
  assert.equal(statusFromResult(value), 'LIVE');
});
