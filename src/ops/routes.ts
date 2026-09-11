import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

export const registerOpsRoutes = async (app: FastifyInstance) => {
  app.get('/metrics', async (_request, reply) => {
    const result = await db.execute(sql`select (select count(*)::int from streams where deleted_at is null) as streams, (select count(*)::int from streams where monitoring_enabled = true and deleted_at is null) as monitored_streams, (select count(*)::int from live_sessions where ended_at is null) as active_sessions, (select count(*)::int from alerts where status in ('ACTIVE', 'ACKNOWLEDGED')) as active_alerts, (select count(*)::int from integration_deliveries where status in ('PENDING', 'FAILED')) as pending_deliveries`);
    const values = result.rows[0] as Record<string, number>;
    reply.type('text/plain; version=0.0.4').send(Object.entries(values).map(([key, value]) => `livewarden_${key} ${value}`).join('\n') + '\n');
  });
};
