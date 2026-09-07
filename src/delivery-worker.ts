import { config } from './config.js';
import { pool } from './db/client.js';
import { claimDelivery } from './delivery/claim.js';
import { processDelivery } from './delivery/process.js';

const webhookUrl = config.N8N_WEBHOOK_URL;
const webhookSecret = config.N8N_WEBHOOK_SECRET;
if (!webhookUrl || !webhookSecret) throw new Error('N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET are required');
let stopped = false;
const active = new Set<Promise<unknown>>();
const tick = async () => {
  while (!stopped) {
    while (!stopped && active.size < config.DELIVERY_CONCURRENCY) {
      const delivery = await claimDelivery(config.DELIVERY_LEASE_MS);
      if (!delivery) break;
      const work = processDelivery(delivery, { url: webhookUrl, secret: webhookSecret, timeoutMs: config.DELIVERY_TIMEOUT_MS, maxAttempts: config.DELIVERY_MAX_ATTEMPTS })
        .catch((error) => console.error(JSON.stringify({ event: 'delivery_failed', deliveryId: delivery.id, error: error instanceof Error ? error.message : String(error) })))
        .finally(() => active.delete(work));
      active.add(work);
    }
    if (active.size) await Promise.race(active); else await new Promise((resolve) => setTimeout(resolve, config.DELIVERY_POLL_INTERVAL_MS));
  }
  await Promise.all(active);
};
const shutdown = async () => { stopped = true; await Promise.all(active); await pool.end(); };
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
void tick();
