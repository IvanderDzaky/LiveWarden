import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SESSION_LIFETIME_MS: z.coerce.number().int().positive().default(1000 * 60 * 60 * 24 * 7),
  WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
  WORKER_LEASE_MS: z.coerce.number().int().positive().default(30_000),
  COLLECTOR_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  COLLECTOR_RETRIES: z.coerce.number().int().min(0).max(1).default(1),
  COLLECTOR_RETRY_BACKOFF_MS: z.coerce.number().int().nonnegative().default(250),
  COLLECTOR_PROVIDER: z.enum(['fake', 'tiktok']).default('fake'),
  TIKTOK_OBSERVATION_WINDOW_MS: z.coerce.number().int().positive().default(1_000),
  TIKTOK_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
  TIKTOK_HANDSHAKE_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000)
  ,TIKTOK_SIGN_API_KEY: z.string().min(1).optional()
  ,N8N_WEBHOOK_URL: z.string().url().optional()
  ,N8N_WEBHOOK_SECRET: z.string().min(1).optional()
  ,DELIVERY_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1_000)
  ,DELIVERY_CONCURRENCY: z.coerce.number().int().positive().default(1)
  ,DELIVERY_LEASE_MS: z.coerce.number().int().positive().default(30_000)
  ,DELIVERY_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000)
  ,DELIVERY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3)
});

export const config = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  HOST: process.env.HOST,
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  SESSION_LIFETIME_MS: process.env.SESSION_LIFETIME_MS,
  WORKER_INTERVAL_MS: process.env.WORKER_INTERVAL_MS,
  WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY,
  WORKER_LEASE_MS: process.env.WORKER_LEASE_MS,
  COLLECTOR_TIMEOUT_MS: process.env.COLLECTOR_TIMEOUT_MS,
  COLLECTOR_RETRIES: process.env.COLLECTOR_RETRIES,
  COLLECTOR_RETRY_BACKOFF_MS: process.env.COLLECTOR_RETRY_BACKOFF_MS,
  COLLECTOR_PROVIDER: process.env.COLLECTOR_PROVIDER,
  TIKTOK_OBSERVATION_WINDOW_MS: process.env.TIKTOK_OBSERVATION_WINDOW_MS,
  TIKTOK_REQUEST_TIMEOUT_MS: process.env.TIKTOK_REQUEST_TIMEOUT_MS,
  TIKTOK_HANDSHAKE_TIMEOUT_MS: process.env.TIKTOK_HANDSHAKE_TIMEOUT_MS,
  TIKTOK_SIGN_API_KEY: process.env.TIKTOK_SIGN_API_KEY,
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
  N8N_WEBHOOK_SECRET: process.env.N8N_WEBHOOK_SECRET,
  DELIVERY_POLL_INTERVAL_MS: process.env.DELIVERY_POLL_INTERVAL_MS,
  DELIVERY_CONCURRENCY: process.env.DELIVERY_CONCURRENCY,
  DELIVERY_LEASE_MS: process.env.DELIVERY_LEASE_MS,
  DELIVERY_TIMEOUT_MS: process.env.DELIVERY_TIMEOUT_MS,
  DELIVERY_MAX_ATTEMPTS: process.env.DELIVERY_MAX_ATTEMPTS
});
