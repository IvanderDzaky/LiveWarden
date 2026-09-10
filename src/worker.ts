import { config } from './config.js';
import { pool } from './db/client.js';
import { createCollector } from './worker/collector.js';
import { runWorker } from './worker/scheduler.js';

const collector = createCollector(config.COLLECTOR_PROVIDER, {
  observationWindowMs: config.TIKTOK_OBSERVATION_WINDOW_MS,
  requestTimeoutMs: config.TIKTOK_REQUEST_TIMEOUT_MS,
  handshakeTimeoutMs: config.TIKTOK_HANDSHAKE_TIMEOUT_MS,
  signApiKey: config.TIKTOK_SIGN_API_KEY
});

const stop = runWorker(collector, {
  intervalMs: config.WORKER_INTERVAL_MS,
  concurrency: config.WORKER_CONCURRENCY,
  leaseMs: config.WORKER_LEASE_MS,
  timeoutMs: config.COLLECTOR_TIMEOUT_MS,
  retries: config.COLLECTOR_RETRIES,
  retryBackoffMs: config.COLLECTOR_RETRY_BACKOFF_MS
});

const shutdown = async () => { await stop(); await pool.end(); };
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
