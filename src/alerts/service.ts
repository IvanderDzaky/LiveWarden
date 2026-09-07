import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { alertAcknowledgements, alerts, streams } from '../db/schema.js';
import { ResourceNotFoundError } from '../streams/service.js';
import { publishRealtimeEvent } from '../realtime/events.js';

export const alertDto = (row: typeof alerts.$inferSelect, acknowledgements: Array<typeof alertAcknowledgements.$inferSelect> = []) => ({ id: row.id, streamId: row.streamId, liveSessionId: row.liveSessionId, sourceEventId: row.sourceEventId, type: row.type, severity: row.severity, status: row.status, firstDetectedAt: row.firstDetectedAt, lastDetectedAt: row.lastDetectedAt, acknowledgedAt: row.acknowledgedAt, resolvedAt: row.resolvedAt, description: row.description, triggerValue: row.triggerValue, recommendedAction: row.recommendedAction, acknowledgements: acknowledgements.map((item) => ({ id: item.id, acknowledgedAt: item.acknowledgedAt, note: item.note })) });

export const listAlerts = async (userId: string, filters: { status?: string; severity?: string; streamId?: string; limit: number }) => {
  const rows = await db.select({ alert: alerts }).from(alerts).innerJoin(streams, eq(streams.id, alerts.streamId)).where(and(eq(streams.userId, userId), isNull(streams.deletedAt), filters.status ? eq(alerts.status, filters.status) : undefined, filters.severity ? eq(alerts.severity, filters.severity) : undefined, filters.streamId ? eq(alerts.streamId, filters.streamId) : undefined)).orderBy(desc(alerts.lastDetectedAt), desc(alerts.id)).limit(filters.limit);
  return rows.map(({ alert }) => alertDto(alert));
};

export const getAlert = async (userId: string, alertId: string) => {
  const row = (await db.select({ alert: alerts }).from(alerts).innerJoin(streams, eq(streams.id, alerts.streamId)).where(and(eq(alerts.id, alertId), eq(streams.userId, userId), isNull(streams.deletedAt))).limit(1))[0]?.alert;
  if (!row) throw new ResourceNotFoundError();
  const history = await db.select().from(alertAcknowledgements).where(eq(alertAcknowledgements.alertId, alertId)).orderBy(desc(alertAcknowledgements.acknowledgedAt)).limit(50);
  return alertDto(row, history);
};

export const acknowledge = async (userId: string, alertId: string, note: string | null) => {
  const row = (await db.select({ alert: alerts }).from(alerts).innerJoin(streams, eq(streams.id, alerts.streamId)).where(and(eq(alerts.id, alertId), eq(streams.userId, userId), isNull(streams.deletedAt))).limit(1))[0]?.alert;
  if (!row) throw new ResourceNotFoundError();
  if (row.status === 'RESOLVED') throw new Error('ALERT_RESOLVED');
  const now = new Date();
  return db.transaction(async (tx) => {
    await tx.update(alerts).set({ status: 'ACKNOWLEDGED', acknowledgedAt: now, updatedAt: now }).where(eq(alerts.id, alertId));
    await tx.insert(alertAcknowledgements).values({ alertId, userId, acknowledgedAt: now, note });
    const updated = (await tx.select().from(alerts).where(eq(alerts.id, alertId)).limit(1))[0];
    const stream = (await tx.select({ identifier: streams.externalIdentifier }).from(streams).where(eq(streams.id, row.streamId)).limit(1))[0];
    await publishRealtimeEvent(tx, { type: 'stream.alert', streamId: row.streamId, identifier: stream.identifier, occurredAt: now.toISOString(), payload: { alertId, status: 'ACKNOWLEDGED' } });
    return alertDto(updated, await tx.select().from(alertAcknowledgements).where(eq(alertAcknowledgements.alertId, alertId)).orderBy(desc(alertAcknowledgements.acknowledgedAt)).limit(50));
  });
};
