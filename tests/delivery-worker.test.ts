import assert from 'node:assert/strict';
import test from 'node:test';
import { retryDecision } from '../src/delivery/retry.js';

test('delivery retry policy uses bounded backoff and permanent failures stop', () => {
  assert.deepEqual(retryDecision(new Error('socket closed'), null, 1, 3), { retry: true, delayMs: 1000, error: 'socket closed' });
  assert.equal(retryDecision(null, 429, 2, 3).delayMs, 5000);
  assert.equal(retryDecision(null, 503, 3, 3).retry, false);
  assert.equal(retryDecision(null, 422, 1, 3).retry, false);
});
