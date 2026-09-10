import assert from 'node:assert/strict';
import test from 'node:test';
import { acknowledgeAlert, listAlerts } from '../lib/api/alerts';
import { listStreams, createStream, updateStream, setMonitoring, deleteStream, getStream, StreamApiError } from '../lib/api/streams';
import { realtimeEventNames, realtimeStreamUrl, realtimeUserUrl } from '../lib/realtime';

const originalFetch = globalThis.fetch;
function mockFetch(body: unknown, ok = true, status = ok ? 200 : 400) {
  let request: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => { request = { url: String(input), init }; return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); };
  return { request: () => request };
}
function restoreFetch() { globalThis.fetch = originalFetch; }

test.afterEach(restoreFetch);

test('stream list sends GET and parses data', async () => {
  const mock = mockFetch({ data: { streams: [] } });
  assert.deepEqual(await listStreams(), { streams: [] });
  assert.equal(mock.request()?.url, '/api/streams');
  assert.equal(mock.request()?.init?.method, undefined);
});

test('stream mutations send expected methods and bodies', async () => {
  const mock = mockFetch({ data: { stream: {} } });
  await createStream({ name: 'Main', platform: 'TIKTOK_LIVE', identifier: 'creator' });
  assert.equal(mock.request()?.init?.method, 'POST');
  assert.equal(mock.request()?.init?.body, JSON.stringify({ name: 'Main', platform: 'TIKTOK_LIVE', identifier: 'creator' }));
  await updateStream('s1', { name: 'Updated' });
  assert.equal(mock.request()?.url, '/api/streams/s1');
  assert.equal(mock.request()?.init?.method, 'PATCH');
  await setMonitoring('s1', true);
  assert.equal(mock.request()?.init?.body, JSON.stringify({ enabled: true }));
  await deleteStream('s1');
  assert.equal(mock.request()?.init?.method, 'DELETE');
  assert.equal(new Headers(mock.request()?.init?.headers).has('Content-Type'), false);
});

test('alert filtering and acknowledgement preserve request contract', async () => {
  const mock = mockFetch({ data: { alerts: [] } });
  await listAlerts({ severity: 'CRITICAL', status: 'ACTIVE' });
  assert.equal(mock.request()?.url, '/api/alerts?limit=100&severity=CRITICAL&status=ACTIVE');
  await acknowledgeAlert('a1', 'Investigating');
  assert.equal(mock.request()?.url, '/api/alerts/a1/acknowledgements');
  assert.equal(mock.request()?.init?.method, 'POST');
  assert.equal(mock.request()?.init?.body, JSON.stringify({ note: 'Investigating' }));
});

test('stream API preserves backend error envelope', async () => {
  mockFetch({ error: { code: 'CONFLICT', message: 'Already monitored', requestId: 'req-1' } }, false, 409);
  await assert.rejects(listStreams(), (error: unknown) => error instanceof StreamApiError && error.code === 'CONFLICT' && error.requestId === 'req-1');
});

test('stream detail parses canonical response shape', async () => {
  const mock = mockFetch({ data: { stream: { id: 's1' }, activeSession: null, latestSnapshot: null, recentEvents: [], recentComments: [], recentLikes: [], recentGifts: [], activeAlerts: [] } });
  const detail = await getStream('s1');
  assert.equal(mock.request()?.url, '/api/streams/s1');
  assert.equal(detail.stream.id, 's1');
});

test('realtime contract uses stream-scoped SSE URL and canonical event names', () => {
  assert.equal(realtimeStreamUrl('stream/id'), '/api/streams/stream%2Fid/live');
  assert.equal(realtimeUserUrl, '/api/live');
  assert.deepEqual(realtimeEventNames, ['stream.status', 'stream.viewer_count', 'stream.comment', 'stream.like', 'stream.gift', 'stream.alert']);
});
