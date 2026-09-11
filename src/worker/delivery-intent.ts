import { and, eq } from 'drizzle-orm';
import { aiSummaries, integrationDeliveries } from '../db/schema.js';

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

export const createSessionDeliveryIntent = async (tx: Tx, input: { sessionId: string; eventId: string | null; deliveryType: 'SESSION_ENDED' }) => {
  const inserted = await tx.insert(integrationDeliveries).values({
    liveSessionId: input.sessionId, eventId: input.eventId, destination: 'N8N', deliveryType: input.deliveryType,
    idempotencyKey: `session:${input.sessionId}:${input.deliveryType}`, status: 'PENDING'
  }).onConflictDoNothing().returning({ id: integrationDeliveries.id });
  return inserted[0]?.id ?? null;
};

export const createGeminiDeliveryIntent = async (tx: Tx, sessionId: string) => {
  await tx.insert(aiSummaries).values({ liveSessionId: sessionId, status: 'PENDING', requestedAt: new Date() }).onConflictDoNothing();
  const inserted = await tx.insert(integrationDeliveries).values({
    liveSessionId: sessionId, destination: 'GEMINI', deliveryType: 'SESSION_SUMMARY',
    idempotencyKey: `session:${sessionId}:GEMINI_SUMMARY`, status: 'PENDING'
  }).onConflictDoNothing().returning({ id: integrationDeliveries.id });
  return inserted[0]?.id ?? null;
};
