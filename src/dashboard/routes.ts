import type { FastifyInstance, FastifyReply } from 'fastify';
import { authenticate, type AuthenticatedRequest } from '../auth/routes.js';
import { getDashboardOverview } from './service.js';

const ok = (reply: FastifyReply, data: unknown) => reply.send({ data, meta: { requestId: reply.request.id } });
export const registerDashboardRoutes = async (app: FastifyInstance) => {
  app.get('/api/dashboard/overview', { preHandler: authenticate }, async (request, reply) => ok(reply, await getDashboardOverview((request as AuthenticatedRequest).user.id)));
};
