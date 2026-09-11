import { sql } from 'drizzle-orm';
import { db } from './client.js';

export const MONITORING_SNAPSHOT_RETENTION_DAYS = 30;

export const pruneMonitoringSnapshots = async (now = new Date()) => {
  const result = await db.execute(sql`
    delete from monitoring_snapshots
    where checked_at < ${now.toISOString()}::timestamptz - interval '30 days'
  `);
  return result.rowCount ?? 0;
};
