import assert from 'node:assert/strict';
import test from 'node:test';
import { retryDecision } from '../src/delivery/retry.js';

test('delivery retry policy classifies HTTP and transport failures', () => {
  assert.equal(retryDecision(null, 200, 1, 3).retry, false);
  assert.equal(retryDecision(new Error('timeout'), null, 1, 3).retry, true);
  assert.equal(retryDecision(null, 500, 1, 3).delayMs, 1000);
  assert.equal(retryDecision(null, 400, 1, 3).retry, false);
  assert.equal(retryDecision(null, 500, 3, 3).retry, false);
});
