import assert from 'node:assert/strict';
import test from 'node:test';
import { alertDedupeKey, commentActivityCandidate, connectionFailureCandidate, monitoringFailureCandidate, viewerDropCandidate } from '../src/domain/alerts.js';

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
