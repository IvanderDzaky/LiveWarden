import { buildDeliveryPayload } from './payload.js';
import { finishDelivery, type ClaimedDelivery } from './claim.js';
import { postWebhook } from './http-client.js';
import { retryDecision } from './retry.js';

export const processDelivery = async (delivery: ClaimedDelivery, options: { url: string; secret: string; timeoutMs: number; maxAttempts: number }) => {
  try {
    const payload = await buildDeliveryPayload(delivery);
    const response = await postWebhook(options.url, options.secret, payload, options.timeoutMs);
    if (response.status >= 200 && response.status < 300) return finishDelivery(delivery.id, delivery.leaseToken!, { status: 'SUCCEEDED', succeededAt: new Date() });
    const decision = retryDecision(new Error(`n8n HTTP ${response.status}`), response.status, delivery.attemptCount, options.maxAttempts);
    return finishDelivery(delivery.id, delivery.leaseToken!, decision.retry ? { status: 'FAILED', nextAttemptAt: new Date(Date.now() + decision.delayMs), error: decision.error } : { status: 'ABANDONED', error: decision.error });
  } catch (error) {
    const decision = retryDecision(error, null, delivery.attemptCount, options.maxAttempts);
    return finishDelivery(delivery.id, delivery.leaseToken!, decision.retry ? { status: 'FAILED', nextAttemptAt: new Date(Date.now() + decision.delayMs), error: decision.error } : { status: 'ABANDONED', error: decision.error });
  }
};
