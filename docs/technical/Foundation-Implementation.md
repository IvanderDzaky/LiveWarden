# Foundation Implementation Notes

## Closed Decisions

- Backend transport foundation: Fastify 5 with TypeScript.
- ORM/query layer: Drizzle ORM with `drizzle-kit` and `pg`.
- Domain enum storage: text columns with PostgreSQL `CHECK` constraints; no native PostgreSQL enums.
- Historical foreign keys: restrictive `NO ACTION`; stream deletion is soft delete via `deleted_at`.
- JSON policy: normalized/allowlisted JSONB only; no default full provider payload storage.
- Audience storage: no `audience_metrics`; viewer snapshots live in `monitoring_snapshots`, activity belongs in `events`.
- Realtime transport: transactional PostgreSQL `NOTIFY` plus dedicated API `LISTEN`; no new table or schema migration.

## Scope Boundary

Implemented MVP includes configuration, health endpoint, PostgreSQL client, Drizzle schema/migrations, Docker Compose development database, authentication and user-scoped stream API, Monitoring Worker, persistent TikTok Collector Adapter, Event Engine, Alert Engine, monitoring dashboard/detail UI, PostgreSQL realtime publisher/listener and SSE fan-out, PostgreSQL outbox Delivery Worker, and local n8n-to-Discord workflow. Gemini, callback API, and direct Discord integration remain unimplemented.

Realtime publication uses normalized v1 envelopes and transactional `SELECT pg_notify('livewarden_realtime_v1', ...)`, so delivery occurs only after commit. API owns a dedicated `pg.Client` listener with 1–30 second exponential reconnect and authenticated owner/stream filtering. SSE endpoints are `GET /api/live` for one dashboard-wide user subscription and `GET /api/streams/:streamId/live` for detail scope. Frontend performs initial REST reads, debounces SSE invalidation by 150 ms, refetches REST, and retains 120-second fallback polling.

Notifications are transient. No durable replay or `Last-Event-ID` recovery exists; `stream.resync` and browser reconnect trigger REST resync. Deployment must use direct/session-pooled PostgreSQL for `LISTEN`, not transaction pooling.

## Verification Status

- `npm install`: passed; npm reported 7 transitive audit vulnerabilities (5 moderate, 2 high). No force fix applied.
- `npm run build`: passed.
- `npm run db:generate`: passed; 9 tables generated, no pending schema diff after generation.
- `npm run test:db`: passed for current database foundation and worker/integration coverage.
- Local Docker n8n integration was verified separately from the database test command.
- Integration E2E: verified with local Docker n8n and Discord Webhook; Header Auth, WARNING, CRITICAL, RESOLVED, and duplicate idempotency behavior passed.
- Realtime database test verifies notification is not delivered before transaction commit; SSE test verifies authentication and foreign-stream `404` ownership behavior.
- Verified E2E examples: resolved `MONITORING_FAILURE`; active CRITICAL `CONNECTION_FAILURE`.
- Lint: no lint framework selected; no lint script is exposed.

Run after Docker is available:

```text
docker compose up -d postgres
npm run db:migrate
npm run test:db
```

## Remaining Integration Work

- Production deployment hardening for n8n and Discord credentials.
- Operational stale `PROCESSING` marker recovery procedure.
- Secret rotation and monitoring for abandoned deliveries.
- Gemini workflow and callback API remain planned, not implemented.
