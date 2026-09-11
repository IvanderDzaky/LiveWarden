import assert from 'node:assert/strict';
import test from 'node:test';
import { alertDedupeKey, commentActivityCandidate, connectionFailureCandidate, giftActivityCandidate, monitoringFailureCandidate, staleDataCandidate, viewerDropCandidate } from '../src/domain/alerts.js';
import { statusFromResult } from '../src/domain/status.js';
import { fakeFailure, fakeSuccess } from '../src/collectors/fake.js';

test('alert rules use explicit MVP thresholds and severities', () => {
  assert.equal(monitoringFailureCandidate(2), null);
  assert.equal(monitoringFailureCandidate(3)?.severity, 'WARNING');
  assert.equal(connectionFailureCandidate('UNKNOWN'), null);
  assert.equal(connectionFailureCandidate('DISCONNECTED')?.severity, 'CRITICAL');
  assert.equal(alertDedupeKey('stream-1', 'MONITORING_FAILURE'), 'stream:stream-1:rule:MONITORING_FAILURE');
  assert.equal(viewerDropCandidate(100, 49)?.type, 'VIEWER_DROP');
  assert.equal(viewerDropCandidate(100, 50)?.triggerValue.dropRatio, 0.5);
  assert.equal(commentActivityCandidate(9), null);
  assert.equal(commentActivityCandidate(10)?.type, 'COMMENT_ACTIVITY_SPIKE');
});

test('alert boundaries avoid false positives and calculate stale age', () => {
  assert.equal(viewerDropCandidate(100, 51), null);
  assert.equal(viewerDropCandidate(null, 0), null);
  assert.equal(commentActivityCandidate(9), null);
  assert.equal(giftActivityCandidate(9), null);
  assert.equal(giftActivityCandidate(10)?.severity, 'INFO');
  const checkedAt = new Date('2026-09-11T00:05:00.000Z');
  assert.equal(staleDataCandidate(new Date('2026-09-11T00:00:00.001Z'), checkedAt), null);
  assert.deepEqual(staleDataCandidate(new Date('2026-09-10T23:59:59.999Z'), checkedAt, 5 * 60 * 1000)?.triggerValue, { ageSeconds: 300 });
});

test('status mapping requires verified observations', () => {
  assert.equal(statusFromResult({ ...fakeSuccess(true, { degraded: true }), checkedAt: new Date() }), 'DEGRADED');
  assert.equal(statusFromResult({ ...fakeSuccess(false), checkedAt: new Date() }), 'OFFLINE');
  assert.equal(statusFromResult({ ...fakeFailure('AUTHENTICATION_ERROR'), checkedAt: new Date() }), 'DISCONNECTED');
  assert.equal(statusFromResult({ ...fakeFailure('NETWORK_ERROR'), checkedAt: new Date() }), 'UNKNOWN');
});
