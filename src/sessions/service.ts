import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { liveSessions, streams } from '../db/schema.js';
import { ResourceNotFoundError } from '../streams/service.js';

export const sessionDto = (row: typeof liveSessions.$inferSelect) => ({ id: row.id, streamId: row.streamId, providerRoomId: row.providerRoomId, startedAt: row.startedAt, endedAt: row.endedAt, state: row.state, finalStatus: row.finalStatus, durationSeconds: row.durationSeconds, peakViewers: row.peakViewers, averageViewers: row.averageViewers, totalComments: row.totalComments, totalLikeActivity: row.totalLikeActivity, eventCount: row.eventCount, alertCount: row.alertCount });
export const listSessions = async (userId: string, streamId: string, limit: number) => {
  const owned = (await db.select({ id: streams.id }).from(streams).where(and(eq(streams.id, streamId), eq(streams.userId, userId), isNull(streams.deletedAt))).limit(1))[0];
  if (!owned) throw new ResourceNotFoundError();
  return (await db.select().from(liveSessions).where(eq(liveSessions.streamId, streamId)).orderBy(desc(liveSessions.startedAt), desc(liveSessions.id)).limit(limit)).map(sessionDto);
};
