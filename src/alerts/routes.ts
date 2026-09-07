import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate, type AuthenticatedRequest } from '../auth/routes.js';
import { acknowledge, getAlert, listAlerts } from './service.js';
import { ResourceNotFoundError } from '../streams/service.js';

const id = z.string().uuid();
const query = z.object({ status: z.enum(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']).optional(), severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(), streamId: id.optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();
const acknowledgement = z.object({ note: z.string().trim().max(1000).optional() }).strict();
const error = (reply: FastifyReply, statusCode: number, code: string, message: string) => reply.code(statusCode).send({ error: { code, message, details: {}, requestId: reply.request.id } });
const ok = (reply: FastifyReply, data: unknown) => reply.send({ data, meta: { requestId: reply.request.id } });
const parseId = (request: { params: unknown }, reply: FastifyReply) => { const parsed = id.safeParse((request.params as { alertId?: unknown })?.alertId); if (!parsed.success) { error(reply, 400, 'VALIDATION_ERROR', 'Invalid request'); return null; } return parsed.data; };
const notFound = (reply: FastifyReply, cause: unknown) => cause instanceof ResourceNotFoundError ? error(reply, 404, 'RESOURCE_NOT_FOUND', 'Resource not found') : undefined;

export const registerAlertRoutes = async (app: FastifyInstance) => {
  app.get('/api/alerts', { preHandler: authenticate }, async (request, reply) => { const parsed = query.safeParse(request.query); if (!parsed.success) return error(reply, 400, 'VALIDATION_ERROR', 'Invalid request'); return ok(reply, { alerts: await listAlerts((request as AuthenticatedRequest).user.id, parsed.data) }); });
  app.get('/api/alerts/:alertId', { preHandler: authenticate }, async (request, reply) => { const alertId = parseId(request, reply); if (!alertId) return; try { return ok(reply, { alert: await getAlert((request as AuthenticatedRequest).user.id, alertId) }); } catch (cause) { return notFound(reply, cause) ?? error(reply, 500, 'INTERNAL_ERROR', 'Internal server error'); } });
  app.post('/api/alerts/:alertId/acknowledgements', { preHandler: authenticate }, async (request, reply) => { const alertId = parseId(request, reply); if (!alertId) return; const parsed = acknowledgement.safeParse(request.body); if (!parsed.success) return error(reply, 400, 'VALIDATION_ERROR', 'Invalid request'); try { return ok(reply, { alert: await acknowledge((request as AuthenticatedRequest).user.id, alertId, parsed.data.note ?? null) }); } catch (cause) { if (cause instanceof Error && cause.message === 'ALERT_RESOLVED') return error(reply, 409, 'CONFLICT', 'Alert already resolved'); return notFound(reply, cause) ?? error(reply, 500, 'INTERNAL_ERROR', 'Internal server error'); } });
};
