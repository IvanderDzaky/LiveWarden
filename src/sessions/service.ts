import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { alerts, events, aiSummaries, liveSessions, streams } from '../db/schema.js';
import { ResourceNotFoundError } from '../streams/service.js';

export const sessionDto = (row: typeof liveSessions.$inferSelect) => ({ id: row.id, streamId: row.streamId, providerRoomId: row.providerRoomId, startedAt: row.startedAt, endedAt: row.endedAt, state: row.state, finalStatus: row.finalStatus, durationSeconds: row.durationSeconds, peakViewers: row.peakViewers, averageViewers: row.averageViewers, totalComments: row.totalComments, totalLikeActivity: row.totalLikeActivity, totalGifts: row.totalGifts, totalGiftQuantity: row.totalGiftQuantity, totalGiftCoins: row.totalGiftCoins, eventCount: row.eventCount, alertCount: row.alertCount });
export const listSessions = async (userId: string, streamId: string, limit: number) => {
  const owned = (await db.select({ id: streams.id }).from(streams).where(and(eq(streams.id, streamId), eq(streams.userId, userId), isNull(streams.deletedAt))).limit(1))[0];
  if (!owned) throw new ResourceNotFoundError();
  return (await db.select().from(liveSessions).where(eq(liveSessions.streamId, streamId)).orderBy(desc(liveSessions.startedAt), desc(liveSessions.id)).limit(limit)).map(sessionDto);
};

export const getSessionReport = async (userId: string, sessionId: string) => {
  const row = (await db.select({ session: liveSessions, stream: streams })
    .from(liveSessions).innerJoin(streams, eq(streams.id, liveSessions.streamId))
    .where(and(eq(liveSessions.id, sessionId), eq(streams.userId, userId), isNull(streams.deletedAt))).limit(1))[0];
  if (!row) throw new ResourceNotFoundError();
  const sessionEvents = await db.select().from(events).where(eq(events.liveSessionId, sessionId)).orderBy(events.occurredAt).limit(200);
  const sessionAlerts = await db.select().from(alerts).where(eq(alerts.liveSessionId, sessionId)).orderBy(alerts.firstDetectedAt).limit(100);
  const ai = (await db.select().from(aiSummaries).where(eq(aiSummaries.liveSessionId, sessionId)).limit(1))[0] ?? null;
  const comments = sessionEvents.flatMap((event) => {
    const payload = event.payload as { comments?: unknown };
    return Array.isArray(payload.comments) ? payload.comments : [];
  }).filter((comment): comment is { username: string; displayName: string; text: string } => {
    if (!comment || typeof comment !== 'object') return false;
    const value = comment as Record<string, unknown>;
    return typeof value.username === 'string' && typeof value.displayName === 'string' && typeof value.text === 'string';
  }).slice(0, 100);
  return {
    session: sessionDto(row.session),
    stream: { id: row.stream.id, name: row.stream.name, identifier: row.stream.externalIdentifier },
    aggregates: { comments: row.session.totalComments, likes: row.session.totalLikeActivity, gifts: row.session.totalGifts, giftQuantity: row.session.totalGiftQuantity, giftCoins: row.session.totalGiftCoins, viewersPeak: row.session.peakViewers, viewersAverage: row.session.averageViewers },
    keyEvents: sessionEvents.filter((event) => ['STREAM_STARTED', 'STREAM_ENDED', 'VIEWER_DROP', 'COMMENT_ACTIVITY_SPIKE', 'GIFT_ACTIVITY_SPIKE', 'CONNECTION_LOST', 'CONNECTION_RECOVERED'].includes(event.type)).map((event) => ({ eventId: event.id, type: event.type, occurredAt: event.occurredAt, payload: event.payload })),
    alerts: sessionAlerts.map((alert) => ({ id: alert.id, type: alert.type, severity: alert.severity, status: alert.status, description: alert.description, firstDetectedAt: alert.firstDetectedAt, resolvedAt: alert.resolvedAt })),
    commentSamples: comments,
    limitations: ['Comment samples are bounded and do not represent a complete chat archive.', ...(row.session.totalGiftCoins === null ? ['Gift coin metadata was incomplete or unavailable.'] : [])],
    aiSummary: ai ? { status: ai.status, sessionSummary: ai.sessionSummary, keyMoments: ai.keyMoments, audienceChanges: ai.audienceChanges, problems: ai.problems, insights: ai.insights, recommendations: ai.recommendations, limitations: ai.limitations, model: ai.model, failureReason: ai.failureReason, generatedAt: ai.generatedAt } : null
  };
};

export const getSessionReportForInternal = async (sessionId: string) => {
  const session = (await db.select({ streamId: liveSessions.streamId }).from(liveSessions).where(eq(liveSessions.id, sessionId)).limit(1))[0];
  if (!session) throw new ResourceNotFoundError();
  return getSessionReport('__internal__', sessionId).catch(() => getSessionReportData(sessionId));
};

const getSessionReportData = async (sessionId: string) => {
  const row = (await db.select({ session: liveSessions, stream: streams }).from(liveSessions).innerJoin(streams, eq(streams.id, liveSessions.streamId)).where(eq(liveSessions.id, sessionId)).limit(1))[0];
  if (!row) throw new ResourceNotFoundError();
  const sessionEvents = await db.select().from(events).where(eq(events.liveSessionId, sessionId)).orderBy(events.occurredAt).limit(200);
  const sessionAlerts = await db.select().from(alerts).where(eq(alerts.liveSessionId, sessionId)).orderBy(alerts.firstDetectedAt).limit(100);
  const ai = (await db.select().from(aiSummaries).where(eq(aiSummaries.liveSessionId, sessionId)).limit(1))[0] ?? null;
  const comments = sessionEvents.flatMap((event) => { const payload = event.payload as { comments?: unknown }; return Array.isArray(payload.comments) ? payload.comments : []; }).filter((comment): comment is { username: string; displayName: string; text: string } => { if (!comment || typeof comment !== 'object') return false; const value = comment as Record<string, unknown>; return typeof value.username === 'string' && typeof value.displayName === 'string' && typeof value.text === 'string'; }).slice(0, 100);
  return { session: sessionDto(row.session), stream: { id: row.stream.id, name: row.stream.name, identifier: row.stream.externalIdentifier }, aggregates: { comments: row.session.totalComments, likes: row.session.totalLikeActivity, gifts: row.session.totalGifts, giftQuantity: row.session.totalGiftQuantity, giftCoins: row.session.totalGiftCoins, viewersPeak: row.session.peakViewers, viewersAverage: row.session.averageViewers }, keyEvents: sessionEvents.filter((event) => ['STREAM_STARTED', 'STREAM_ENDED', 'VIEWER_DROP', 'COMMENT_ACTIVITY_SPIKE', 'GIFT_ACTIVITY_SPIKE', 'CONNECTION_LOST', 'CONNECTION_RECOVERED'].includes(event.type)).map((event) => ({ eventId: event.id, type: event.type, occurredAt: event.occurredAt, payload: event.payload })), alerts: sessionAlerts.map((alert) => ({ id: alert.id, type: alert.type, severity: alert.severity, status: alert.status, description: alert.description, firstDetectedAt: alert.firstDetectedAt, resolvedAt: alert.resolvedAt })), commentSamples: comments, limitations: ['Comment samples are bounded and do not represent a complete chat archive.', ...(row.session.totalGiftCoins === null ? ['Gift coin metadata was incomplete or unavailable.'] : [])], aiSummary: ai ? { status: ai.status, sessionSummary: ai.sessionSummary, keyMoments: ai.keyMoments, audienceChanges: ai.audienceChanges, problems: ai.problems, insights: ai.insights, recommendations: ai.recommendations, limitations: ai.limitations, model: ai.model, failureReason: ai.failureReason, generatedAt: ai.generatedAt } : null };
};
