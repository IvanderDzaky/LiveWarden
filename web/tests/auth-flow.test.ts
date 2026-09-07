import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthApiError } from '../lib/api/auth';
import { getSafeNextPath } from '../lib/auth/redirect';

test('auth API errors preserve backend code and request ID', () => {
  const error = new AuthApiError({ code: 'UNAUTHENTICATED', message: 'Invalid credentials', details: {}, requestId: 'request-1' });
  assert.equal(error.code, 'UNAUTHENTICATED');
  assert.equal(error.requestId, 'request-1');
});

test('auth redirect accepts internal next path', () => {
  assert.equal(getSafeNextPath('/streams/stream-1?tab=sessions#history'), '/streams/stream-1?tab=sessions#history');
});

test('auth redirect falls back when next is missing or unsafe', () => {
  assert.equal(getSafeNextPath(null), '/dashboard');
  assert.equal(getSafeNextPath('https://evil.example/phish'), '/dashboard');
  assert.equal(getSafeNextPath('//evil.example/phish'), '/dashboard');
  assert.equal(getSafeNextPath('/\\evil.example'), '/dashboard');
});
