import assert from 'node:assert/strict';
import test from 'node:test';
import { retryDecision } from '../src/delivery/retry.js';
import { postWebhook } from '../src/delivery/http-client.js';

test('delivery retry policy uses bounded backoff and permanent failures stop', () => {
  assert.deepEqual(retryDecision(new Error('socket closed'), null, 1, 3), { retry: true, delayMs: 1000, error: 'socket closed' });
  assert.equal(retryDecision(null, 429, 2, 3).delayMs, 5000);
  assert.equal(retryDecision(null, 503, 3, 3).retry, false);
  assert.equal(retryDecision(null, 422, 1, 3).retry, false);
});

test('webhook client sends authenticated JSON without a real request', async () => {
  const originalFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init);
    return new Response(null, { status: 204 });
  };
  try {
    assert.deepEqual(await postWebhook('https://n8n.example.test/webhook', 'secret', { event: 'ALERT_CREATED' }, 1000), { status: 204 });
    assert.equal(request?.method, 'POST');
    assert.equal(request?.headers.get('authorization'), 'Bearer secret');
    assert.equal(request?.headers.get('content-type'), 'application/json');
    assert.deepEqual(await request?.json(), { event: 'ALERT_CREATED' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('webhook client aborts requests that exceed timeout', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });
  try {
    await assert.rejects(postWebhook('https://n8n.example.test/webhook', 'secret', {}, 5), /Aborted/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retry errors are bounded and non-retryable statuses stop immediately', () => {
  assert.equal(retryDecision(new Error('x'.repeat(600)), null, 1, 3).error.length, 500);
  assert.equal(retryDecision(null, 400, 1, 3).retry, false);
});
