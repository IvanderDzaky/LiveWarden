import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { streams } from '../db/schema.js';

export type ClaimedStream = typeof streams.$inferSelect;

export const claimStream = async (leaseMs: number): Promise<{ stream: ClaimedStream; token: string } | null> => {
  const token = crypto.randomUUID();
  const leaseUntil = new Date(Date.now() + leaseMs);
  const id = await db.transaction(async (tx) => {
    const result = await tx.execute(sql`
    WITH candidate AS (
      SELECT id FROM streams
      WHERE monitoring_enabled = true AND deleted_at IS NULL
        AND (next_check_at IS NULL OR next_check_at <= now())
        AND (check_lease_until IS NULL OR check_lease_until <= now())
      ORDER BY next_check_at NULLS FIRST, id
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE streams
    SET check_lease_until = ${leaseUntil}, check_lease_token = ${token}::uuid
    FROM candidate WHERE streams.id = candidate.id
    RETURNING streams.*
    `);
    return (result.rows[0] as { id?: string } | undefined)?.id ?? null;
  });
  if (!id) return null;
  const stream = (await db.select().from(streams).where(eq(streams.id, id)).limit(1))[0];
  return stream ? { stream, token } : null;
};

export const releaseLease = async (streamId: string, token: string, nextCheckAt: Date) => {
  await db.update(streams).set({ nextCheckAt, checkLeaseUntil: null, checkLeaseToken: null })
    .where(and(eq(streams.id, streamId), eq(streams.checkLeaseToken, token)));
};
