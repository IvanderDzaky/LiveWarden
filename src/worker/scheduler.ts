import type { Collector } from '../domain/collector.js';
import { db } from '../db/client.js';
import { streams } from '../db/schema.js';
import { and, eq, isNull } from 'drizzle-orm';
import { claimStream, releaseLease } from './claim.js';
import { processStream } from './process-stream.js';
import { pruneMonitoringSnapshots } from '../db/retention.js';

export type WorkerOptions = { intervalMs: number; concurrency: number; leaseMs: number; timeoutMs: number; retries: number; retryBackoffMs: number };

export const runWorker = (collector: Collector, options: WorkerOptions) => {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let lastRetentionAt = 0;
  const active = new Set<Promise<void>>();
  const tick = async () => {
    if (Date.now() - lastRetentionAt >= 60 * 60 * 1000) {
      lastRetentionAt = Date.now();
      await pruneMonitoringSnapshots().catch((error) => console.error(JSON.stringify({ event: 'snapshot_retention_failed', error: error instanceof Error ? error.message : String(error) })));
    }
    if (collector.prune) {
      const active = await db.select({ identifier: streams.externalIdentifier }).from(streams).where(and(eq(streams.monitoringEnabled, true), isNull(streams.deletedAt)));
      await collector.prune(new Set(active.map((row) => row.identifier.trim().replace(/^@/, ''))));
    }
    for (let i = active.size; i < options.concurrency && !stopped; i += 1) {
      const claim = await claimStream(options.leaseMs);
      if (!claim) break;
      const work = processStream(claim.stream, claim.token, collector, options)
        .catch((error) => console.error(JSON.stringify({ event: 'worker_check_failed', streamId: claim.stream.id, error: error instanceof Error ? error.message : String(error) })))
        .finally(() => { active.delete(work); });
      active.add(work);
    }
    if (!stopped) timer = setTimeout(() => void tick(), options.intervalMs);
  };
  void tick();
  return async () => { stopped = true; if (timer) clearTimeout(timer); await Promise.all(active); await collector.close?.(); };
};
