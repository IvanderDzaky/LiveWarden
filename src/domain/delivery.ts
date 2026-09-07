export type AlertDeliveryEvent = 'ALERT_CREATED' | 'ALERT_RESOLVED';

export const validateAlertDeliveryPayload = (input: unknown): input is {
  deliveryId: string; idempotencyKey: string; eventType: AlertDeliveryEvent;
  stream: { id: string; name: string; identifier: string };
  alert: { id: string; type: string; severity: 'WARNING' | 'CRITICAL'; status: 'ACTIVE' | 'RESOLVED'; resolvedAt: string | null };
} => {
  if (!input || typeof input !== 'object') return false;
  const value = input as any;
  if (value.schemaVersion !== 1 || typeof value.deliveryId !== 'string' || typeof value.idempotencyKey !== 'string') return false;
  if (value.eventType !== 'ALERT_CREATED' && value.eventType !== 'ALERT_RESOLVED') return false;
  if (!value.stream || typeof value.stream.id !== 'string' || typeof value.stream.name !== 'string' || typeof value.stream.identifier !== 'string') return false;
  const alert = value.alert;
  if (!alert || typeof alert.id !== 'string' || !['WARNING', 'CRITICAL'].includes(alert.severity)) return false;
  if (Object.keys(alert).some((key) => !['id', 'type', 'severity', 'status', 'description', 'recommendedAction', 'firstDetectedAt', 'lastDetectedAt', 'resolvedAt'].includes(key))) return false;
  if (value.eventType === 'ALERT_CREATED') return alert.status === 'ACTIVE' && alert.resolvedAt === null;
  return alert.status === 'RESOLVED' && typeof alert.resolvedAt === 'string' && !Number.isNaN(Date.parse(alert.resolvedAt));
};
