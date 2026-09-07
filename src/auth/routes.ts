import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { createSession, createUser, findUserByEmail, normalizeEmail, publicUser, revokeSession, resolveSession, verifyCredentials } from './service.js';

const credentials = z.object({ email: z.string().email().max(320), password: z.string().min(8).max(256) }).strict();
export const sessionCookie = 'livewarden_session';
const cookieOptions = `Path=/; HttpOnly; SameSite=Lax${config.NODE_ENV === 'production' ? '; Secure' : ''}`;
const error = (reply: FastifyReply, statusCode: number, code: string, message: string) => reply.code(statusCode).send({ error: { code, message, details: {}, requestId: reply.request.id } });
const setSessionCookie = (reply: FastifyReply, token: string, expiresAt: Date) => reply.header('set-cookie', `${sessionCookie}=${token}; Max-Age=${Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))}; Expires=${expiresAt.toUTCString()}; ${cookieOptions}`);
const clearSessionCookie = (reply: FastifyReply) => reply.header('set-cookie', `${sessionCookie}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${cookieOptions}`);
const readCookie = (request: FastifyRequest) => request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1) ?? null;
const ok = (reply: FastifyReply, data: unknown, statusCode = 200) => reply.code(statusCode).send({ data, meta: { requestId: reply.request.id } });

export type AuthenticatedRequest = FastifyRequest & { user: typeof import('../db/schema.js').users.$inferSelect; sessionId: string };

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const token = readCookie(request);
  if (!token || !/^[A-Za-z0-9_-]{40,}$/.test(token)) return error(reply, 401, 'UNAUTHENTICATED', 'Authentication required');
  const resolved = await resolveSession(token);
  if (!resolved) return error(reply, 401, 'UNAUTHENTICATED', 'Authentication required');
  (request as AuthenticatedRequest).user = resolved.user;
  (request as AuthenticatedRequest).sessionId = resolved.session.id;
};

export const registerAuthRoutes = async (app: FastifyInstance) => {
  app.post('/api/auth/register', async (request, reply) => {
    const parsed = credentials.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, 'VALIDATION_ERROR', 'Invalid request');
    const email = normalizeEmail(parsed.data.email);
    if (await findUserByEmail(email)) return error(reply, 409, 'CONFLICT', 'Account already exists');
    try {
      const user = await createUser(email, parsed.data.password);
      const session = await createSession(user.id, config.SESSION_LIFETIME_MS);
      setSessionCookie(reply, session.token, session.expiresAt);
      return ok(reply, { user: publicUser(user) }, 201);
    } catch (cause: any) {
      if (cause?.code === '23505') return error(reply, 409, 'CONFLICT', 'Account already exists');
      request.log.error({ err: cause }, 'auth registration failed');
      return error(reply, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });
  app.post('/api/auth/login', async (request, reply) => {
    const parsed = credentials.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, 'VALIDATION_ERROR', 'Invalid request');
    const user = await verifyCredentials(parsed.data.email, parsed.data.password);
    if (!user) return error(reply, 401, 'UNAUTHENTICATED', 'Invalid credentials');
    const session = await createSession(user.id, config.SESSION_LIFETIME_MS);
    setSessionCookie(reply, session.token, session.expiresAt);
    return ok(reply, { user: publicUser(user) });
  });
  app.post('/api/auth/logout', async (request, reply) => {
    const token = readCookie(request);
    if (token && /^[A-Za-z0-9_-]{40,}$/.test(token)) await revokeSession(token);
    clearSessionCookie(reply);
    return ok(reply, { success: true });
  });
  app.get('/api/auth/me', { preHandler: authenticate }, async (request, reply) => ok(reply, { user: publicUser((request as AuthenticatedRequest).user) }));
};
