import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { buildApp } from '../src/server.js';
import { createStreamSchema, monitoringSchema, updateStreamSchema } from '../src/streams/validation.js';

const app = await buildApp();
after(() => app.close());

test('stream endpoints require authentication', async () => {
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE'] as const) {
    const url = method === 'GET' ? '/api/streams' : method === 'POST' ? '/api/streams' : '/api/streams/not-a-uuid';
    assert.equal((await app.inject({ method, url, payload: method === 'POST' ? {} : undefined })).statusCode, 401);
  }
});

test('stream create validation canonicalizes one leading @ and rejects unsafe input', () => {
  const parsed = createStreamSchema.parse({ name: ' Creator ', platform: 'TIKTOK_LIVE', identifier: ' @creator ' });
  assert.deepEqual(parsed, { name: 'Creator', platform: 'TIKTOK_LIVE', identifier: 'creator' });
  assert.equal(createStreamSchema.safeParse({ name: 'Creator', platform: 'YOUTUBE', identifier: 'creator' }).success, false);
  assert.equal(createStreamSchema.safeParse({ name: 'Creator', platform: 'TIKTOK_LIVE', identifier: '@@creator' }).success, false);
  assert.equal(createStreamSchema.safeParse({ name: ' ', platform: 'TIKTOK_LIVE', identifier: 'creator' }).success, false);
  assert.equal(createStreamSchema.safeParse({ name: 'Creator', platform: 'TIKTOK_LIVE', identifier: 'https://tiktok.com/@creator' }).success, false);
});

test('stream update and monitoring bodies are strict', () => {
  assert.equal(updateStreamSchema.safeParse({}).success, false);
  assert.equal(updateStreamSchema.safeParse({ status: 'LIVE' }).success, false);
  assert.equal(updateStreamSchema.safeParse({ name: 'Renamed' }).success, true);
  assert.equal(monitoringSchema.safeParse({ enabled: true, status: 'LIVE' }).success, false);
});
