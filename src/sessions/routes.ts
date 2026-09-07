import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate, type AuthenticatedRequest } from '../auth/routes.js';
import { listSessions } from './service.js';
import { ResourceNotFoundError } from '../streams/service.js';

const id = z.string().uuid();
const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();
const error = (reply: FastifyReply, code: number, type: string, message: string) => reply.code(code).send({ error: { code: type, message, details: {}, requestId: reply.request.id } });
export const registerSessionRoutes = async (app: FastifyInstance) => app.get('/api/streams/:streamId/sessions', { preHandler: authenticate }, async (request, reply) => { const streamId = id.safeParse((request.params as { streamId?: unknown })?.streamId); const filters = query.safeParse(request.query); if (!streamId.success || !filters.success) return error(reply, 400, 'VALIDATION_ERROR', 'Invalid request'); try { return reply.send({ data: { sessions: await listSessions((request as AuthenticatedRequest).user.id, streamId.data, filters.data.limit) }, meta: { requestId: reply.request.id } }); } catch (cause) { if (cause instanceof ResourceNotFoundError) return error(reply, 404, 'RESOURCE_NOT_FOUND', 'Resource not found'); return error(reply, 500, 'INTERNAL_ERROR', 'Internal server error'); } });
