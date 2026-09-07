import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { alerts, events, integrationDeliveries, liveSessions, streams } from '../db/schema.js';

export const buildDeliveryPayload = async (delivery: typeof integrationDeliveries.$inferSelect) => {
  const rows = await db.select({ delivery: integrationDeliveries, alert: alerts, stream: streams, event: events, session: liveSessions })
    .from(integrationDeliveries).leftJoin(alerts, eq(alerts.id, integrationDeliveries.alertId))
    .leftJoin(streams, eq(streams.id, alerts.streamId))
    .leftJoin(events, eq(events.id, integrationDeliveries.eventId))
    .leftJoin(liveSessions, eq(liveSessions.id, integrationDeliveries.liveSessionId))
    .where(and(eq(integrationDeliveries.id, delivery.id), eq(integrationDeliveries.destination, 'N8N'))).limit(1);
  const row = rows[0];
  if (!row?.alert || !row.stream) throw new Error('delivery payload context unavailable');
  return {
    deliveryId: delivery.id, eventId: delivery.eventId, eventType: delivery.deliveryType, schemaVersion: 1,
    occurredAt: (row.event?.occurredAt ?? row.alert.updatedAt).toISOString(),
    idempotencyKey: delivery.idempotencyKey,
    stream: { id: row.stream.id, name: row.stream.name, identifier: row.stream.externalIdentifier },
    liveSessionId: row.session?.id ?? row.alert.liveSessionId,
    alert: {
      id: row.alert.id, type: row.alert.type, severity: row.alert.severity, status: row.alert.status,
      description: row.alert.description,
      recommendedAction: row.alert.recommendedAction, firstDetectedAt: row.alert.firstDetectedAt.toISOString(),
      lastDetectedAt: row.alert.lastDetectedAt.toISOString(), resolvedAt: row.alert.resolvedAt?.toISOString() ?? null
    }
  };
};
