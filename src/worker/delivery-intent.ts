import { and, eq } from 'drizzle-orm';
import { integrationDeliveries } from '../db/schema.js';

type Tx = any;

export const createAlertDeliveryIntent = async (tx: Tx, input: {
  alertId: string; eventId: string | null; sessionId: string | null; deliveryType: 'ALERT_CREATED' | 'ALERT_RESOLVED';
}) => {
  const phase = input.deliveryType === 'ALERT_CREATED' ? 'ACTIVE' : 'RESOLVED';
  const inserted = await tx.insert(integrationDeliveries).values({
    alertId: input.alertId,
    eventId: input.eventId,
    liveSessionId: input.sessionId,
    destination: 'N8N',
    deliveryType: input.deliveryType,
    idempotencyKey: `alert:${input.alertId}:${phase}`,
    status: 'PENDING'
  }).onConflictDoNothing().returning({ id: integrationDeliveries.id });
  return inserted[0]?.id ?? null;
};
