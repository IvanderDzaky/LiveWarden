import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate, type AuthenticatedRequest } from '../auth/routes.js';
import { isSessionActive } from '../auth/service.js';
import { listEvents, listUserEvents, requireOwnedStream } from './service.js';
import { ResourceNotFoundError } from '../streams/service.js';
import type { RealtimeHub } from '../realtime/hub.js';

const id = z.string().uuid();
const query = z.object({ type: z.string().min(1).max(80).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();
const userEventsQuery = z.object({
  streamId: z.string().uuid().optional(),
  type: z.string().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
}).strict();

const error = (reply: FastifyReply, code: number, type: string, message: string) => reply.code(code).send({ error: { code: type, message, details: {}, requestId: reply.request.id } });

export const registerEventRoutes = async (app: FastifyInstance, realtimeHub?: RealtimeHub) => {
  app.get('/api/streams/:streamId/events', { preHandler: authenticate }, async (request, reply) => {
    const streamId = id.safeParse((request.params as { streamId?: unknown })?.streamId);
    const filters = query.safeParse(request.query);
    if (!streamId.success || !filters.success) return error(reply, 400, 'VALIDATION_ERROR', 'Invalid request');
    try {
      return reply.send({
        data: { events: await listEvents((request as AuthenticatedRequest).user.id, streamId.data, filters.data.limit, filters.data.type) },
        meta: { requestId: reply.request.id }
      });
    } catch (cause) {
      if (cause instanceof ResourceNotFoundError) return error(reply, 404, 'RESOURCE_NOT_FOUND', 'Resource not found');
      return error(reply, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });

  app.get('/api/events', { preHandler: authenticate }, async (request, reply) => {
    const filters = userEventsQuery.safeParse(request.query);
    if (!filters.success) return error(reply, 400, 'VALIDATION_ERROR', 'Invalid request');
    try {
      return reply.send({
        data: { events: await listUserEvents((request as AuthenticatedRequest).user.id, filters.data) },
        meta: { requestId: reply.request.id }
      });
    } catch (cause) {
      return error(reply, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });

  if (realtimeHub) app.get('/api/streams/:streamId/live', { preHandler: authenticate }, async (request, reply) => {
    const streamId = id.safeParse((request.params as { streamId?: unknown })?.streamId);
    if (!streamId.success) return error(reply, 400, 'VALIDATION_ERROR', 'Invalid request');
    const authenticated = request as AuthenticatedRequest;
    try { await requireOwnedStream(authenticated.user.id, streamId.data); }
    catch (cause) { return cause instanceof ResourceNotFoundError ? error(reply, 404, 'RESOURCE_NOT_FOUND', 'Resource not found') : error(reply, 500, 'INTERNAL_ERROR', 'Internal server error'); }

    let unsubscribe = () => {};
    try { unsubscribe = realtimeHub.subscribe({ userId: authenticated.user.id, streamId: streamId.data, send: () => true, resync: () => true, close: () => {} }); unsubscribe(); }
    catch { return error(reply, 429, 'RATE_LIMITED', 'Too many realtime connections'); }
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    let closed = false;
    let heartbeat: NodeJS.Timeout | undefined;
    const write = (frame: string) => !closed && !reply.raw.destroyed && !reply.raw.writableEnded && reply.raw.write(frame);
    const close = () => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
      if (!reply.raw.writableEnded) reply.raw.end();
      request.log.info({ event: 'sse_disconnected', streamId: streamId.data }, 'SSE client disconnected');
    };
    unsubscribe = realtimeHub.subscribe({
      userId: authenticated.user.id,
      streamId: streamId.data,
      send: (event) => write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
      resync: () => write(`event: stream.resync\ndata: ${JSON.stringify({ reason: 'listener_reconnected' })}\n\n`),
      close
    });
    request.raw.once('close', close);
    request.raw.once('aborted', close);
    reply.raw.once('error', close);
    heartbeat = setInterval(() => void isSessionActive(authenticated.sessionId).then((active) => active ? write(': heartbeat\n\n') : close()).catch(close), 20_000);
    heartbeat.unref();
    write('retry: 3000\nevent: stream.ready\ndata: {"schemaVersion":1}\n\n');
    request.log.info({ event: 'sse_connected', streamId: streamId.data }, 'SSE client connected');
  });

  if (realtimeHub) app.get('/api/live', { preHandler: authenticate }, async (request, reply) => {
    const authenticated = request as AuthenticatedRequest;
    let capacityCheck = () => {};
    try { capacityCheck = realtimeHub.subscribe({ userId: authenticated.user.id, streamId: null, send: () => true, resync: () => true, close: () => {} }); capacityCheck(); }
    catch { return error(reply, 429, 'RATE_LIMITED', 'Too many realtime connections'); }
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    let closed = false;
    let heartbeat: NodeJS.Timeout | undefined;
    let unsubscribe = () => {};
    const write = (frame: string) => !closed && !reply.raw.destroyed && !reply.raw.writableEnded && reply.raw.write(frame);
    const close = () => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
      if (!reply.raw.writableEnded) reply.raw.end();
      request.log.info({ event: 'sse_disconnected' }, 'SSE client disconnected');
    };
    unsubscribe = realtimeHub.subscribe({
      userId: authenticated.user.id,
      streamId: null,
      send: (event) => write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
      resync: () => write(`event: stream.resync\ndata: ${JSON.stringify({ reason: 'listener_reconnected' })}\n\n`),
      close
    });
    request.raw.once('close', close);
    request.raw.once('aborted', close);
    reply.raw.once('error', close);
    heartbeat = setInterval(() => void isSessionActive(authenticated.sessionId).then((active) => active ? write(': heartbeat\n\n') : close()).catch(close), 20_000);
    heartbeat.unref();
    write('retry: 3000\nevent: stream.ready\ndata: {"schemaVersion":1}\n\n');
    request.log.info({ event: 'sse_connected' }, 'SSE client connected');
  });
};
