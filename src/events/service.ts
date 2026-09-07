import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { events, streams } from '../db/schema.js';
import { ResourceNotFoundError } from '../streams/service.js';

export const eventDto = (row: typeof events.$inferSelect) => ({
  eventId: row.id,
  schemaVersion: row.schemaVersion,
  type: row.type,
  streamId: row.streamId,
  liveSessionId: row.liveSessionId,
  source: row.source,
  occurredAt: row.occurredAt,
  receivedAt: row.receivedAt,
  payload: row.payload,
  metadata: row.metadata
});

export const listEvents = async (userId: string, streamId: string, limit: number, type?: string) => {
  const owned = (await db.select({ id: streams.id }).from(streams).where(and(eq(streams.id, streamId), eq(streams.userId, userId), isNull(streams.deletedAt))).limit(1))[0];
  if (!owned) throw new ResourceNotFoundError();
  return (await db.select().from(events).where(and(eq(events.streamId, streamId), type ? eq(events.type, type) : undefined)).orderBy(desc(events.occurredAt), desc(events.id)).limit(limit)).map(eventDto);
};

export const requireOwnedStream = async (userId: string, streamId: string) => {
  const row = (await db.select({ id: streams.id }).from(streams).where(and(eq(streams.id, streamId), eq(streams.userId, userId), isNull(streams.deletedAt))).limit(1))[0];
  if (!row) throw new ResourceNotFoundError();
};

export const listUserEvents = async (userId: string, filters: { streamId?: string; type?: string; limit?: number }) => {
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const userStreamRows = await db.select({ id: streams.id, name: streams.name, identifier: streams.externalIdentifier })
    .from(streams)
    .where(and(eq(streams.userId, userId), isNull(streams.deletedAt)));
  
  if (userStreamRows.length === 0) return [];
  const userStreamIds = userStreamRows.map((s) => s.id);
  const targetIds = filters.streamId ? userStreamIds.filter((id) => id === filters.streamId) : userStreamIds;
  if (targetIds.length === 0) return [];

  const rows = await db.select().from(events)
    .where(and(inArray(events.streamId, targetIds), filters.type ? eq(events.type, filters.type) : undefined))
    .orderBy(desc(events.occurredAt), desc(events.id))
    .limit(limit);

  const streamMap = new Map(userStreamRows.map((s) => [s.id, s]));
  return rows.map((row) => ({
    ...eventDto(row),
    streamName: streamMap.get(row.streamId)?.name ?? row.streamId,
    streamIdentifier: streamMap.get(row.streamId)?.identifier ?? ''
  }));
};
