import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { validateAlertDeliveryPayload } from '../src/domain/delivery.js';

const fixture = (eventType: 'ALERT_CREATED' | 'ALERT_RESOLVED', status: 'ACTIVE' | 'RESOLVED', resolvedAt: string | null, severity: 'WARNING' | 'CRITICAL') => ({
  deliveryId: `delivery-${eventType}`, idempotencyKey: `alert:alert-1:${status}`, schemaVersion: 1, eventType,
  occurredAt: '2026-09-04T00:00:00.000Z', stream: { id: 'stream-1', name: 'Creator', identifier: 'creator' }, liveSessionId: 'session-1',
  alert: { id: 'alert-1', type: 'MONITORING_FAILURE', severity, status, description: 'Bounded description', recommendedAction: 'Check monitoring', firstDetectedAt: '2026-09-04T00:00:00.000Z', lastDetectedAt: '2026-09-04T00:00:00.000Z', resolvedAt }
});

test('redacted workflow fixtures cover warning, critical, and resolved', async () => {
  assert.equal(validateAlertDeliveryPayload(fixture('ALERT_CREATED', 'ACTIVE', null, 'WARNING')), true);
  assert.equal(validateAlertDeliveryPayload(fixture('ALERT_CREATED', 'ACTIVE', null, 'CRITICAL')), true);
  assert.equal(validateAlertDeliveryPayload(fixture('ALERT_RESOLVED', 'RESOLVED', '2026-09-04T00:01:00.000Z', 'CRITICAL')), true);
  const workflow = JSON.parse(await readFile(new URL('../workflows/livewarden-alert-discord.json', import.meta.url), 'utf8'));
  assert.equal(JSON.stringify(workflow).includes('N8N_WEBHOOK_SECRET'), false);
  assert.equal(JSON.stringify(workflow).includes('DISCORD_WEBHOOK_URL'), true);
});
