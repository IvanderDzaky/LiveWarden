import assert from 'node:assert/strict';
import test from 'node:test';
import { isStale, statusDescription, statusLabel } from '../lib/presentation';

test('status presentation keeps UNKNOWN distinct from OFFLINE', () => {
  assert.notEqual(statusLabel.UNKNOWN, statusLabel.OFFLINE);
  assert.match(statusDescription('UNKNOWN'), /could not be determined/);
  assert.match(statusDescription('OFFLINE'), /confirmed.*offline/);
});

test('freshness marks missing and old observations stale', () => {
  assert.equal(isStale(null), true);
  assert.equal(isStale(new Date().toISOString()), false);
  assert.equal(isStale(new Date(Date.now() - 121_000).toISOString()), true);
});
