import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { integrationDeliveries } from '../db/schema.js';

export type ClaimedDelivery = typeof integrationDeliveries.$inferSelect;

export const claimDelivery = async (leaseMs: number): Promise<ClaimedDelivery | null> => {
  const token = crypto.randomUUID();
  const result = await db.execute(sql`
    WITH candidate AS (
      SELECT id FROM integration_deliveries
      WHERE status IN ('PENDING', 'FAILED')
        AND (next_attempt_at IS NULL OR next_attempt_at <= now())
        AND (lease_until IS NULL OR lease_until <= now())
      ORDER BY next_attempt_at NULLS FIRST, created_at, id
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE integration_deliveries
    SET status = 'IN_PROGRESS', lease_until = now() + ${leaseMs} * interval '1 millisecond',
        lease_token = ${token}::uuid, attempt_count = attempt_count + 1,
        last_attempt_at = now(), updated_at = now()
    FROM candidate WHERE integration_deliveries.id = candidate.id
      RETURNING integration_deliveries.id,
        integration_deliveries.event_id AS "eventId",
        integration_deliveries.alert_id AS "alertId",
        integration_deliveries.live_session_id AS "liveSessionId",
        integration_deliveries.destination,
        integration_deliveries.delivery_type AS "deliveryType",
        integration_deliveries.status,
        integration_deliveries.idempotency_key AS "idempotencyKey",
        integration_deliveries.attempt_count AS "attemptCount",
        integration_deliveries.last_attempt_at AS "lastAttemptAt",
        integration_deliveries.next_attempt_at AS "nextAttemptAt",
        integration_deliveries.lease_until AS "leaseUntil",
        integration_deliveries.lease_token AS "leaseToken",
        integration_deliveries.succeeded_at AS "succeededAt",
        integration_deliveries.last_error AS "lastError",
        integration_deliveries.created_at AS "createdAt",
        integration_deliveries.updated_at AS "updatedAt"
  `);
  return (result.rows[0] as ClaimedDelivery | undefined) ?? null;
};

export const finishDelivery = async (id: string, token: string, update: {
  status: 'SUCCEEDED' | 'FAILED' | 'ABANDONED'; nextAttemptAt?: Date | null; error?: string | null; succeededAt?: Date | null;
}) => {
  const result = await db.update(integrationDeliveries).set({
    status: update.status, nextAttemptAt: update.nextAttemptAt ?? null,
    lastError: update.error ?? null, succeededAt: update.succeededAt ?? null,
    leaseUntil: null, leaseToken: null, updatedAt: new Date()
  }).where(sql`${integrationDeliveries.id} = ${id} AND ${integrationDeliveries.leaseToken} = ${token}::uuid`).returning({ id: integrationDeliveries.id });
  return result.length === 1;
};
