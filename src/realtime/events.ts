import { sql } from 'drizzle-orm';
import { z } from 'zod';

export const REALTIME_CHANNEL = 'livewarden_realtime_v1';
export const realtimeEventTypes = ['stream.status', 'stream.viewer_count', 'stream.comment', 'stream.like', 'stream.gift', 'stream.alert'] as const;
export type RealtimeEventType = typeof realtimeEventTypes[number];

export const realtimeEventSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(1),
  type: z.enum(realtimeEventTypes),
  streamId: z.string().uuid(),
  identifier: z.string().min(1).max(200),
  occurredAt: z.string().datetime(),
  payload: z.record(z.unknown())
}).strict();

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
type Transaction = { execute(query: unknown): Promise<unknown> };

export const publishRealtimeEvent = async (tx: Transaction, input: Omit<RealtimeEvent, 'id' | 'schemaVersion'>) => {
  const event = realtimeEventSchema.parse({ id: crypto.randomUUID(), schemaVersion: 1, ...input });
  const serialized = JSON.stringify(event);
  if (Buffer.byteLength(serialized, 'utf8') > 7_500) throw new Error('realtime event exceeds PostgreSQL NOTIFY payload limit');
  await tx.execute(sql`select pg_notify(${REALTIME_CHANNEL}, ${serialized})`);
  return event;
};
