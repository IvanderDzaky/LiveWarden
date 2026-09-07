import assert from 'node:assert/strict';
import test from 'node:test';
import { createCollector } from '../src/worker/collector.js';

test('collector selection defaults to fake and supports explicit tiktok', () => {
  assert.equal(createCollector('fake').provider, 'fake');
  assert.equal(createCollector('tiktok', { observationWindowMs: 1 }).provider, 'tiktok');
});
