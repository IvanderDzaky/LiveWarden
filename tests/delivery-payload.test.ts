import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAlertDeliveryPayload } from '../src/domain/delivery.js';

const base = {
  deliveryId: 'delivery-1', idempotencyKey: 'alert:alert-1:ACTIVE', schemaVersion: 1,
  eventType: 'ALERT_CREATED', stream: { id: 'stream-1', name: 'Creator', identifier: 'creator' },
  liveSessionId: null, alert: { id: 'alert-1', type: 'CONNECTION_FAILURE', severity: 'CRITICAL', status: 'ACTIVE', resolvedAt: null }
};

test('delivery payload accepts bounded active and resolved contracts', () => {
  assert.equal(validateAlertDeliveryPayload(base), true);
  assert.equal(validateAlertDeliveryPayload({ ...base, eventType: 'ALERT_RESOLVED', idempotencyKey: 'alert:alert-1:RESOLVED', alert: { ...base.alert, status: 'RESOLVED', resolvedAt: '2026-09-04T00:00:00.000Z' } }), true);
});

test('delivery payload rejects unsupported combinations', () => {
  assert.equal(validateAlertDeliveryPayload({ ...base, alert: { ...base.alert, severity: 'INFO' } }), false);
  assert.equal(validateAlertDeliveryPayload({ ...base, alert: { ...base.alert, status: 'RESOLVED' } }), false);
  assert.equal(validateAlertDeliveryPayload({ ...base, eventType: 'ALERT_RESOLVED', alert: { ...base.alert, status: 'RESOLVED', resolvedAt: null } }), false);
  assert.equal(validateAlertDeliveryPayload({ ...base, alert: { ...base.alert, rawProviderPayload: {} } }), false);
});
