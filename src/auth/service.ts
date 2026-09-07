import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { authSessions, users } from '../db/schema.js';
import { hashPassword, verifyPassword } from './password.js';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const publicUser = (user: typeof users.$inferSelect) => ({ id: user.id, email: user.email, createdAt: user.createdAt });
const tokenHash = (token: string) => createHash('sha256').update(token).digest('base64url');

export const findUserByEmail = async (email: string) =>
  (await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1))[0] ?? null;

export const createUser = async (email: string, password: string) => {
  const rows = await db.insert(users).values({ email: normalizeEmail(email), passwordHash: await hashPassword(password) }).returning();
  return rows[0];
};

export const verifyCredentials = async (email: string, password: string) => {
  const user = await findUserByEmail(email);
  const valid = await verifyPassword(password, user?.passwordHash ?? 'scrypt$16384$8$1$invalid$invalid');
  return user && valid ? user : null;
};

export const createSession = async (userId: string, lifetimeMs: number) => {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + lifetimeMs);
  const rows = await db.insert(authSessions).values({ userId, tokenHash: tokenHash(token), expiresAt }).returning({ id: authSessions.id, expiresAt: authSessions.expiresAt });
  return { token, ...rows[0] };
};

export const resolveSession = async (token: string) => {
  const row = (await db.select({ session: authSessions, user: users }).from(authSessions).innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.tokenHash, tokenHash(token)), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date()))).limit(1))[0];
  return row ?? null;
};

export const isSessionActive = async (sessionId: string) => Boolean((await db.select({ id: authSessions.id }).from(authSessions)
  .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date()))).limit(1))[0]);

export const revokeSession = async (token: string) => {
  await db.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.tokenHash, tokenHash(token)), isNull(authSessions.revokedAt)));
};
