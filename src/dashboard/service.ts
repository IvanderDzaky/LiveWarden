import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { alerts, events, liveSessions, monitoringSnapshots, streams } from '../db/schema.js';
import { streamDto } from '../streams/service.js';

const activeStream = (userId: string) => and(eq(streams.userId, userId), isNull(streams.deletedAt));
const alertDto = (row: typeof alerts.$inferSelect) => ({ id: row.id, streamId: row.streamId, liveSessionId: row.liveSessionId, type: row.type, severity: row.severity, status: row.status, firstDetectedAt: row.firstDetectedAt, lastDetectedAt: row.lastDetectedAt, acknowledgedAt: row.acknowledgedAt, resolvedAt: row.resolvedAt, description: row.description, triggerValue: row.triggerValue, recommendedAction: row.recommendedAction });
const eventDto = (row: typeof events.$inferSelect) => ({ eventId: row.id, schemaVersion: row.schemaVersion, type: row.type, streamId: row.streamId, liveSessionId: row.liveSessionId, source: row.source, occurredAt: row.occurredAt, receivedAt: row.receivedAt, payload: row.payload, metadata: row.metadata });

export const getDashboardOverview = async (userId: string) => {
  const ownedStreams = await db.select().from(streams).where(activeStream(userId)).orderBy(desc(streams.createdAt), desc(streams.id)).limit(100);
  const ids = ownedStreams.map((stream) => stream.id);
  const ownedAlerts = ids.length ? await db.select().from(alerts).where(and(inArray(alerts.streamId, ids), inArray(alerts.status, ['ACTIVE', 'ACKNOWLEDGED']))).orderBy(sql`case when ${alerts.severity} = 'CRITICAL' then 0 when ${alerts.severity} = 'WARNING' then 1 else 2 end`, desc(alerts.lastDetectedAt)).limit(50) : [];
  const recentEvents = ids.length ? await db.select().from(events).where(inArray(events.streamId, ids)).orderBy(desc(events.occurredAt), desc(events.id)).limit(50) : [];
  const latestSnapshots = ids.length ? await db.select().from(monitoringSnapshots).where(inArray(monitoringSnapshots.streamId, ids)).orderBy(desc(monitoringSnapshots.checkedAt), desc(monitoringSnapshots.id)).limit(Math.min(100, ids.length * 20)) : [];
  const latestByStream = new Map<string, typeof latestSnapshots[number]>();
  for (const snapshot of latestSnapshots) if (!latestByStream.has(snapshot.streamId)) latestByStream.set(snapshot.streamId, snapshot);
  const activeSessions = ids.length ? await db.select().from(liveSessions).where(and(inArray(liveSessions.streamId, ids), isNull(liveSessions.endedAt))).orderBy(desc(liveSessions.startedAt), desc(liveSessions.id)).limit(100) : [];
  const activeByStream = new Map<string, typeof activeSessions[number]>();
  for (const session of activeSessions) if (!activeByStream.has(session.streamId)) activeByStream.set(session.streamId, session);
  const streamOverview = ownedStreams.map((stream) => {
    const snapshot = latestByStream.get(stream.id);
    const session = activeByStream.get(stream.id);
    return { ...streamDto(stream), latestViewers: snapshot?.currentViewers ?? null, latestSnapshotAt: snapshot?.checkedAt ?? null, activeSession: session ? { id: session.id, startedAt: session.startedAt, peakViewers: session.peakViewers, averageViewers: session.averageViewers } : null };
  });
  return {
    kpis: {
      monitoredStreams: ownedStreams.filter((stream) => stream.monitoringEnabled).length,
      liveStreams: ownedStreams.filter((stream) => stream.status === 'LIVE').length,
      problemStreams: ownedStreams.filter((stream) => ['DEGRADED', 'UNKNOWN', 'DISCONNECTED'].includes(stream.status)).length,
      activeAlerts: ownedAlerts.length
    },
    streams: streamOverview,
    activeAlerts: ownedAlerts.map(alertDto),
    recentEvents: recentEvents.map(eventDto)
  };
};
