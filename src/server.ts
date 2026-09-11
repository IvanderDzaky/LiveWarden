import Fastify from 'fastify';
import { config } from './config.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerStreamRoutes } from './streams/routes.js';
import { registerDashboardRoutes } from './dashboard/routes.js';
import { registerAlertRoutes } from './alerts/routes.js';
import { registerEventRoutes } from './events/routes.js';
import { registerSessionAiRoutes, registerSessionReportRoutes, registerSessionRoutes } from './sessions/routes.js';
import { RealtimeHub } from './realtime/hub.js';
import { pool } from './db/client.js';
import { registerOpsRoutes } from './ops/routes.js';

export const buildApp = async () => {
  const app = Fastify({ logger: true, genReqId: () => crypto.randomUUID() });
  const realtimeHub = new RealtimeHub(app.log);
  await realtimeHub.start();
  app.addHook('preClose', async () => realtimeHub.close());
  app.get('/health', async () => ({ status: 'ok' }));
  await registerOpsRoutes(app);
  await registerAuthRoutes(app);
  await registerStreamRoutes(app);
  await registerDashboardRoutes(app);
  await registerAlertRoutes(app);
  await registerEventRoutes(app, realtimeHub);
  await registerSessionRoutes(app);
  await registerSessionReportRoutes(app);
  await registerSessionAiRoutes(app);
  return Object.assign(app, { realtimeHub });
};

if (config.NODE_ENV !== 'test' && !process.argv.some((argument) => argument.endsWith('.test.ts'))) {
  const app = await buildApp();
  await app.listen({ host: config.HOST, port: config.PORT });
  let shutdownPromise: Promise<void> | null = null;
  const shutdown = () => shutdownPromise ??= app.close().then(() => pool.end());
  process.once('SIGINT', () => void shutdown().catch((error) => { app.log.error(error); process.exitCode = 1; }));
  process.once('SIGTERM', () => void shutdown().catch((error) => { app.log.error(error); process.exitCode = 1; }));
}
