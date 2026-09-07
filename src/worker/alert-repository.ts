import { and, eq, inArray, isNull } from 'drizzle-orm';
import { alertAcknowledgements, alerts, streams } from '../db/schema.js';
import type { AlertRuleType } from '../domain/alerts.js';

type Tx = any;

export const findUnresolvedAlert = (tx: Tx, deduplicationKey: string) =>
  tx.select().from(alerts).where(and(eq(alerts.deduplicationKey, deduplicationKey), inArray(alerts.status, ['ACTIVE', 'ACKNOWLEDGED']))).limit(1);

export const detectAlert = async (tx: Tx, input: {
  streamId: string; sessionId: string | null; sourceEventId: string | null; type: AlertRuleType;
  severity: 'INFO' | 'WARNING' | 'CRITICAL'; detectedAt: Date; description: string; recommendedAction: string; triggerValue: Record<string, unknown>;
}) => {
  const key = `stream:${input.streamId}:rule:${input.type}`;
  const existing = (await findUnresolvedAlert(tx, key))[0];
  if (existing) {
    await tx.update(alerts).set({ lastDetectedAt: input.detectedAt, triggerValue: input.triggerValue, updatedAt: input.detectedAt })
      .where(eq(alerts.id, existing.id));
    return { id: existing.id, created: false };
  }
  const created = await tx.insert(alerts).values({
    streamId: input.streamId, liveSessionId: input.sessionId, sourceEventId: input.sourceEventId,
    type: input.type, severity: input.severity, status: 'ACTIVE', deduplicationKey: key,
    firstDetectedAt: input.detectedAt, lastDetectedAt: input.detectedAt,
    description: input.description, recommendedAction: input.recommendedAction, triggerValue: input.triggerValue
  }).returning({ id: alerts.id });
  return { id: created[0].id, created: true };
};

export const resolveAlert = async (tx: Tx, streamId: string, type: AlertRuleType, resolvedAt: Date, triggerValue: Record<string, unknown>) => {
  const key = `stream:${streamId}:rule:${type}`;
  const existing = (await findUnresolvedAlert(tx, key))[0];
  if (!existing) return null;
  await tx.update(alerts).set({ status: 'RESOLVED', resolvedAt, triggerValue, updatedAt: resolvedAt }).where(eq(alerts.id, existing.id));
  return { id: existing.id, resolved: true };
};

export const acknowledgeAlert = async (tx: Tx, alertId: string, userId: string, acknowledgedAt: Date, note: string | null) => {
  const alert = (await tx.select({ alert: alerts }).from(alerts).innerJoin(streams, eq(streams.id, alerts.streamId))
    .where(and(eq(alerts.id, alertId), eq(streams.userId, userId))).limit(1))[0]?.alert;
  if (!alert) throw new Error('alert not found');
  if (alert.status === 'RESOLVED') throw new Error('alert already resolved');
  await tx.update(alerts).set({ status: 'ACKNOWLEDGED', acknowledgedAt, updatedAt: acknowledgedAt }).where(eq(alerts.id, alertId));
  await tx.insert(alertAcknowledgements).values({ alertId, userId, acknowledgedAt, note });
  return { ...alert, status: 'ACKNOWLEDGED' as const, acknowledgedAt };
};
