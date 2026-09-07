import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { alerts, events, liveSessions, monitoringSnapshots, streams } from '../db/schema.js';
import type { z } from 'zod';
import { createStreamSchema, updateStreamSchema } from './validation.js';

export class ResourceNotFoundError extends Error { code = 'RESOURCE_NOT_FOUND'; }
const owned = (userId: string, streamId?: string) => and(streamId ? eq(streams.id, streamId) : undefined, eq(streams.userId, userId), isNull(streams.deletedAt));
export const streamDto = (row: typeof streams.$inferSelect) => ({ id: row.id, name: row.name, platform: row.platform, identifier: row.externalIdentifier, monitoringEnabled: row.monitoringEnabled, status: row.status, lastCheckedAt: row.lastCheckedAt, lastSuccessfulAt: row.lastSuccessfulAt, lastObservedProviderAt: row.lastObservedProviderAt, lastRoomId: row.lastRoomId, createdAt: row.createdAt, updatedAt: row.updatedAt });

export const createStream = async (userId: string, input: z.infer<typeof createStreamSchema>) =>
  (await db.insert(streams).values({ userId, name: input.name, platform: input.platform, externalIdentifier: input.identifier, monitoringEnabled: false, status: 'UNKNOWN' }).returning())[0];

export const listStreams = async (userId: string, filters: { status?: string; monitoringEnabled?: boolean }) =>
  db.select().from(streams).where(and(eq(streams.userId, userId), isNull(streams.deletedAt), filters.status ? eq(streams.status, filters.status) : undefined, filters.monitoringEnabled === undefined ? undefined : eq(streams.monitoringEnabled, filters.monitoringEnabled))).orderBy(desc(streams.createdAt), desc(streams.id)).limit(100);

export const getStream = async (userId: string, streamId: string) => {
  const row = (await db.select().from(streams).where(owned(userId, streamId)).limit(1))[0];
  if (!row) throw new ResourceNotFoundError();
  const activeSession = (await db.select().from(liveSessions).where(and(eq(liveSessions.streamId, streamId), isNull(liveSessions.endedAt))).limit(1))[0] ?? null;
  const latestSnapshot = (await db.select().from(monitoringSnapshots).where(eq(monitoringSnapshots.streamId, streamId)).orderBy(desc(monitoringSnapshots.checkedAt), desc(monitoringSnapshots.id)).limit(1))[0] ?? null;
  const recentEvents = await db.select().from(events).where(eq(events.streamId, streamId)).orderBy(desc(events.occurredAt), desc(events.id)).limit(20);
  const activeAlerts = await db.select().from(alerts).where(and(eq(alerts.streamId, streamId), inArray(alerts.status, ['ACTIVE', 'ACKNOWLEDGED']))).orderBy(desc(alerts.lastDetectedAt), desc(alerts.id)).limit(20);
  const commentEvents = await db.select().from(events).where(and(eq(events.streamId, streamId), eq(events.type, 'COMMENT'))).orderBy(desc(events.occurredAt), desc(events.id)).limit(50);
  const recentComments = commentEvents.flatMap((event) => {
    const payload = event.payload as { comments?: unknown };
    return Array.isArray(payload.comments) ? payload.comments.map((comment) => ({ comment, occurredAt: event.occurredAt.toISOString() })) : [];
  }).filter((item): item is { comment: { username: string; displayName: string; text: string }; occurredAt: string } => {
    if (!item.comment || typeof item.comment !== 'object') return false;
    const comment = item.comment as Record<string, unknown>;
    return typeof comment.username === 'string' && typeof comment.displayName === 'string' && typeof comment.text === 'string';
  }).map(({ comment, occurredAt }) => ({ ...comment, occurredAt })).slice(0, 50);
  return {
    stream: streamDto(row),
    activeSession: activeSession ? { id: activeSession.id, streamId: activeSession.streamId, startedAt: activeSession.startedAt, durationSeconds: activeSession.durationSeconds, peakViewers: activeSession.peakViewers, averageViewers: activeSession.averageViewers, totalComments: activeSession.totalComments, totalLikeActivity: activeSession.totalLikeActivity, eventCount: activeSession.eventCount, alertCount: activeSession.alertCount } : null,
    latestSnapshot: latestSnapshot ? { checkedAt: latestSnapshot.checkedAt, providerOccurredAt: latestSnapshot.providerOccurredAt, collectionSucceeded: latestSnapshot.collectionSucceeded, statusObserved: latestSnapshot.statusObserved, providerRoomId: latestSnapshot.providerRoomId, currentViewers: latestSnapshot.currentViewers, collectorLatencyMs: latestSnapshot.collectorLatencyMs, errorCode: latestSnapshot.errorCode } : null,
    recentEvents: recentEvents.map((event) => ({ eventId: event.id, schemaVersion: event.schemaVersion, type: event.type, streamId: event.streamId, liveSessionId: event.liveSessionId, source: event.source, occurredAt: event.occurredAt, receivedAt: event.receivedAt, payload: event.payload, metadata: event.metadata })),
    recentComments,
    activeAlerts: activeAlerts.map((alert) => ({ id: alert.id, streamId: alert.streamId, liveSessionId: alert.liveSessionId, type: alert.type, severity: alert.severity, status: alert.status, firstDetectedAt: alert.firstDetectedAt, lastDetectedAt: alert.lastDetectedAt, acknowledgedAt: alert.acknowledgedAt, description: alert.description, triggerValue: alert.triggerValue, recommendedAction: alert.recommendedAction }))
  };
};

export const updateStream = async (userId: string, streamId: string, patch: z.infer<typeof updateStreamSchema>) => {
  const rows = await db.update(streams).set({
    ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.platform === undefined ? {} : { platform: patch.platform }),
    ...(patch.identifier === undefined ? {} : { externalIdentifier: patch.identifier }),
    updatedAt: new Date()
  }).where(owned(userId, streamId)).returning();
  if (!rows[0]) throw new ResourceNotFoundError();
  return rows[0];
};

export const setMonitoring = async (userId: string, streamId: string, enabled: boolean) => {
  const rows = await db.update(streams).set({ monitoringEnabled: enabled, nextCheckAt: enabled ? new Date() : undefined, updatedAt: new Date() }).where(owned(userId, streamId)).returning();
  if (!rows[0]) throw new ResourceNotFoundError();
  return rows[0];
};

export const softDeleteStream = async (userId: string, streamId: string) => {
  const rows = await db.update(streams).set({ deletedAt: new Date(), monitoringEnabled: false, updatedAt: new Date() }).where(owned(userId, streamId)).returning();
  if (!rows[0]) throw new ResourceNotFoundError();
  return rows[0];
};
