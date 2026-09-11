import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { alerts, events, integrationDeliveries, liveSessions, streams } from '../db/schema.js';

export const buildDeliveryPayload = async (delivery: typeof integrationDeliveries.$inferSelect) => {
  const rows = await db.select({ delivery: integrationDeliveries, alert: alerts, stream: streams, event: events, session: liveSessions })
     .from(integrationDeliveries).leftJoin(alerts, eq(alerts.id, integrationDeliveries.alertId))
     .leftJoin(events, eq(events.id, integrationDeliveries.eventId))
     .leftJoin(liveSessions, eq(liveSessions.id, integrationDeliveries.liveSessionId))
     .leftJoin(streams, sql`${streams.id} = coalesce(${alerts.streamId}, ${liveSessions.streamId})`)
    .where(and(eq(integrationDeliveries.id, delivery.id), eq(integrationDeliveries.destination, 'N8N'))).limit(1);
  const row = rows[0];
   if (!row?.stream || (!row.alert && !row.session)) throw new Error('delivery payload context unavailable');
  return {
    deliveryId: delivery.id, eventId: delivery.eventId, eventType: delivery.deliveryType, schemaVersion: 1,
     occurredAt: (row.event?.occurredAt ?? row.alert?.updatedAt ?? row.session?.endedAt ?? row.session?.updatedAt ?? row.delivery.createdAt).toISOString(),
    idempotencyKey: delivery.idempotencyKey,
    stream: { id: row.stream.id, name: row.stream.name, identifier: row.stream.externalIdentifier },
     liveSessionId: row.session?.id ?? row.alert?.liveSessionId ?? null,
     alert: row.alert ? {
      id: row.alert.id, type: row.alert.type, severity: row.alert.severity, status: row.alert.status,
      description: row.alert.description,
      recommendedAction: row.alert.recommendedAction, firstDetectedAt: row.alert.firstDetectedAt.toISOString(),
      lastDetectedAt: row.alert.lastDetectedAt.toISOString(), resolvedAt: row.alert.resolvedAt?.toISOString() ?? null
     } : null,
     session: row.session ? { id: row.session.id, startedAt: row.session.startedAt.toISOString(), endedAt: row.session.endedAt?.toISOString() ?? null, durationSeconds: row.session.durationSeconds, peakViewers: row.session.peakViewers, averageViewers: row.session.averageViewers, totalComments: row.session.totalComments, totalLikeActivity: row.session.totalLikeActivity, totalGifts: row.session.totalGifts, totalGiftQuantity: row.session.totalGiftQuantity, totalGiftCoins: row.session.totalGiftCoins } : null
  };
};
