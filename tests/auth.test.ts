import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { buildApp } from '../src/server.js';

loadEnv({ path: '.env', override: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = await buildApp();

before(async () => {
  await pool.query('TRUNCATE auth_sessions, users RESTART IDENTITY CASCADE');
});
after(async () => {
  await app.close();
  await pool.end();
});

const cookieFrom = (response: { headers: Record<string, unknown> }) => {
  const value = response.headers['set-cookie'];
  return Array.isArray(value) ? String(value[0]).split(';')[0] : typeof value === 'string' ? value.split(';')[0] : undefined;
};

test('register creates session and sanitized user', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'Owner@Example.test', password: 'correct horse battery staple' } });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.user.email, 'owner@example.test');
  assert.equal(response.json().data.user.passwordHash, undefined);
  assert.match(cookieFrom(response) ?? '', /^livewarden_session=[A-Za-z0-9_-]{40,}$/);
  assert.equal((await pool.query('SELECT count(*) FROM auth_sessions')).rows[0].count, '1');
});

test('register rejects case-normalized duplicate and invalid input', async () => {
  const duplicate = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'OWNER@example.TEST', password: 'correct horse battery staple' } });
  assert.equal(duplicate.statusCode, 409);
  const invalid = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'invalid', password: 'short' } });
  assert.equal(invalid.statusCode, 400);
});

test('login has identical public failure for unknown email and wrong password', async () => {
  const wrong = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'owner@example.test', password: 'wrong password' } });
  const unknown = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'missing@example.test', password: 'wrong password' } });
  assert.equal(wrong.statusCode, 401);
  assert.equal(wrong.json().error.code, unknown.json().error.code);
  assert.equal(wrong.json().error.message, unknown.json().error.message);
  const success = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'OWNER@EXAMPLE.TEST', password: 'correct horse battery staple' } });
  assert.equal(success.statusCode, 200);
  assert.ok(cookieFrom(success));
});

test('me rejects missing and malformed cookies, valid cookie authenticates', async () => {
  assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: 'livewarden_session=bad' } })).statusCode, 401);
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'owner@example.test', password: 'correct horse battery staple' } });
  const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieFrom(login)! } });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().data.user.email, 'owner@example.test');
});

test('logout revokes session, clears cookie, and is idempotent', async () => {
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'owner@example.test', password: 'correct horse battery staple' } });
  const cookie = cookieFrom(login)!;
  const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
  assert.equal(logout.statusCode, 200);
  assert.match(logout.headers['set-cookie'] as string, /Max-Age=0/);
  assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } })).statusCode, 200);
  assert.equal((await pool.query('SELECT revoked_at FROM auth_sessions WHERE token_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1')).rows[0].revoked_at !== null, true);
});

test('expired session is rejected', async () => {
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'owner@example.test', password: 'correct horse battery staple' } });
  const cookie = cookieFrom(login)!;
  await pool.query("UPDATE auth_sessions SET expires_at = now() - interval '1 second'");
  assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).statusCode, 401);
});
