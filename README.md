# LiveWarden

LiveWarden is a livestream monitoring, automation, and audience intelligence platform for TikTok LIVE. It gives streamers and operators one place to monitor stream health, audience activity, events, alerts, and session history.

## Overview

LiveWarden periodically checks configured TikTok LIVE accounts, keeps a provider connection for active identifiers, and turns normalized observations into durable stream state, monitoring snapshots, live sessions, events, and alerts. The Next.js dashboard reads authoritative data from the Fastify API and receives transient realtime invalidation events over Server-Sent Events (SSE).

Monitoring and delivery run separately from the API. Alert delivery uses a PostgreSQL outbox and a delivery worker that sends authenticated webhooks to n8n. The included n8n workflow forwards selected alerts to Discord.

## Features

### Stream Monitoring

- Add, update, list, monitor, disable, and soft-delete TikTok LIVE streams.
- Periodic checks through configurable worker scheduling, leases, bounded retries, and timeouts.
- Persistent per-identifier TikTok WebSocket connections with bounded reconnect backoff.
- Explicit stream statuses: `LIVE`, `OFFLINE`, `DEGRADED`, `UNKNOWN`, and `DISCONNECTED`.
- Monitoring snapshots with viewer count, provider timestamps, latency, metadata, and classified errors.
- Operational Prometheus-style metrics at `/metrics`.

The collector uses `tiktok-live-connector`, which reads TikTok's internal Webcast connection. It is unofficial and is not an official TikTok API integration.

### Live Sessions

- Create one active session when verified live data is observed.
- Complete sessions when verified offline data is observed.
- Store duration, peak viewers, average viewers, comments, likes, gifts, event count, and alert count where data is available.
- Preserve session history after stream soft deletion.

### Audience Activity

- Capture bounded recent comments, likes, gifts, and viewer observations from the collector.
- Store comments, likes, and gifts as immutable session events.
- Calculate peak and arithmetic average viewers from valid monitoring snapshots.

Audience capture is bounded and provider-dependent. Like delivery semantics and gift aggregation remain subject to validation; missing values are kept unavailable rather than fabricated.

### Events & Alerts

- Record lifecycle, audience activity, monitoring, connection, recovery, and derived activity events.
- Detect and deduplicate monitoring failure, connection failure, stale data, viewer drop, comment activity, and gift activity conditions according to current rules.
- Track `INFO`, `WARNING`, and `CRITICAL` alert severity.
- Acknowledge alerts with an optional note and retain acknowledgement history.
- Resolve alerts when matching recovery conditions are observed.

### Automation / Discord Integration

- Create transactional outbox delivery intents for selected warning and critical alert changes.
- Claim deliveries with database leases and retry failed HTTP delivery with bounded attempts.
- Send authenticated delivery payloads to n8n.
- Include credential-free workflow export at `workflows/livewarden-alert-discord.json`.
- Forward accepted warning, critical, and resolved alerts to Discord through n8n.

Delivery is at-least-once. A rare duplicate can occur if Discord accepts a message before n8n persists its deduplication marker.

### Session Analytics

- Expose completed session reports and performance aggregates through the API.
- Optionally generate structured Gemini summaries when `GEMINI_API_KEY` is configured.
- Validate AI output and event references before persistence.

Gemini generation exists as an API/delivery path, but the documented n8n callback and end-to-end Gemini workflow are not implemented.

### Authentication

- Email/password registration and login.
- HTTP-only session cookie authentication with session expiry and logout/revocation.
- Server-side ownership checks for user data and protected routes.

### Dashboard

- Responsive authenticated UI for overview, streams, stream detail, events, alerts, and session history.
- REST-backed initial state with SSE invalidation and fallback polling.
- Alert acknowledgement and stream monitoring controls.

## Architecture

```mermaid
flowchart LR
    U[Operator] --> F[Next.js Frontend]
    F --> A[Fastify API]
    A --> DB[(PostgreSQL)]
    W[Monitoring Worker] --> C[TikTok Collector]
    C --> T[TikTok LIVE]
    W --> DB
    DB -- pg_notify --> A
    A -- authenticated SSE --> F
    W --> O[Integration Outbox]
    O --> DW[Delivery Worker]
    DW -- authenticated webhook --> N[n8n]
    N --> D[Discord]
```

The API, monitoring worker, and delivery worker are separate processes sharing application/domain modules and PostgreSQL. PostgreSQL is the durable source of truth. `pg_notify` and SSE are transient realtime signals; clients resync through REST after reconnects or listener interruptions.

## Tech Stack

- **Frontend:** Next.js `16.3.4`, React `19.0.0`, Tailwind CSS `3.4.17`
- **Backend:** Node.js, TypeScript `5.7.2`, Fastify `5.2.1`, Zod `3.24.1`
- **Database:** PostgreSQL `16` in Docker Compose, Drizzle ORM `0.36.4`, `pg` `8.13.1`, Drizzle Kit `0.30.2`
- **Monitoring / Collector:** `tiktok-live-connector` `2.4.4`, fake collector for tests
- **Automation:** n8n webhook workflow, Discord webhook delivery, optional direct Gemini API call
- **Infrastructure:** Docker, Docker Compose, Node.js `22` Alpine images
- **Testing:** Node test runner through `tsx`; backend core/database suites and frontend test script

## Project Structure

```text
src/
  auth/          Authentication and session routes/services
  collectors/    TikTok and fake collector adapters
  dashboard/     Dashboard read model and API
  db/            PostgreSQL client, schema, migrations, retention commands
  delivery/      Outbox delivery, retries, payloads, HTTP client
  domain/        Status, session, event, alert, and collector contracts
  events/        Event query routes/services and SSE routes
  alerts/        Alert query and acknowledgement routes/services
  sessions/      Session history, reports, and Gemini summary path
  streams/       Stream management and validation
  worker/        Scheduling, collection, state processing, alerts, delivery intents
  realtime/      PostgreSQL notification listener and SSE hub
web/
  app/           Next.js routes and protected/auth layouts
  components/    Dashboard, stream, event, alert, auth, and UI components
  lib/           Frontend API and realtime clients
drizzle/         PostgreSQL migration files
tests/           Backend unit, integration, contract, and database tests
workflows/       Importable n8n-to-Discord workflow
docs/            Product requirements and technical documentation
```

## Getting Started

### Prerequisites

- Node.js 22 or compatible current Node.js runtime
- npm
- PostgreSQL, or Docker Desktop for the included PostgreSQL service
- n8n and Discord webhook only when using alert automation

### Installation

Install backend dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
cd web
npm install
cd ..
```

Copy `.env.example` to `.env` and set at least `DATABASE_URL`.

### Environment Variables

`.env.example` is canonical. Available variables:

```text
DATABASE_URL
HOST
PORT
NODE_ENV
SESSION_LIFETIME_MS
COLLECTOR_PROVIDER
WORKER_INTERVAL_MS
WORKER_CONCURRENCY
WORKER_LEASE_MS
COLLECTOR_TIMEOUT_MS
COLLECTOR_RETRIES
COLLECTOR_RETRY_BACKOFF_MS
TIKTOK_OBSERVATION_WINDOW_MS
TIKTOK_REQUEST_TIMEOUT_MS
TIKTOK_HANDSHAKE_TIMEOUT_MS
TIKTOK_SIGN_API_KEY
GEMINI_API_KEY
GEMINI_MODEL
N8N_WEBHOOK_URL
N8N_WEBHOOK_SECRET
DELIVERY_POLL_INTERVAL_MS
DELIVERY_CONCURRENCY
DELIVERY_LEASE_MS
DELIVERY_TIMEOUT_MS
DELIVERY_MAX_ATTEMPTS
```

`DATABASE_URL` is required. Most other settings have defaults in `src/config.ts`. Keep API keys, webhook URLs, webhook secrets, and database credentials out of source control.

### Database Setup

Start PostgreSQL on host port `5433`:

```bash
docker compose up -d postgres
```

For local development, use a connection string such as:

```text
postgres://livewarden:livewarden@localhost:5433/livewarden
```

Run migrations:

```bash
npm run db:migrate
```

Generate a new migration after schema changes:

```bash
npm run db:generate
```

The retention command deletes monitoring snapshots older than 30 days:

```bash
npm run db:retention
```

`npm run db:truncate` is available for local database cleanup. Use it only when intentionally removing local data.

### Running the Application

Backend API, default port `3001`:

```bash
npm run dev
```

Frontend, default Next.js development port:

```bash
cd web
npm run dev
```

The frontend rewrites `/api/*` to `http://localhost:3001/api/*`.

Monitoring Worker:

```bash
npm run dev:worker
```

Delivery Worker:

```bash
npm run dev:delivery-worker
```

The delivery worker requires `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET`, or `GEMINI_API_KEY` when processing Gemini deliveries.

Build and run the backend:

```bash
npm run build
npm start
```

Docker Compose currently defines PostgreSQL and the API only:

```bash
docker compose up --build
```

It does not define frontend, monitoring worker, delivery worker, or n8n services.

### n8n

Import `workflows/livewarden-alert-discord.json` into n8n. Configure:

- Header Auth credential `LiveWarden Bearer` with `Authorization: Bearer <N8N_WEBHOOK_SECRET>`.
- Data Table `livewarden_delivery_dedupe`.
- `DISCORD_WEBHOOK_URL` in the n8n environment.
- Workflow concurrency `1`.

The webhook path is `/webhook/livewarden-alert`. Activate workflow only after deployment smoke tests.

## Testing

Backend core tests:

```bash
npm run test:core
```

Backend database/API/realtime tests:

```bash
npm run test:db
```

All backend tests:

```bash
npm test
```

Frontend typecheck, build, and test scripts:

```bash
cd web
npm run typecheck
npm run build
npm test
```

Database tests require a configured PostgreSQL database. TikTok automated tests use isolated collector contracts/fakes; no live-provider test is included.

## Monitoring Flow

1. Worker claims an enabled stream using a database lease.
2. Collector returns a normalized live, offline, or failure observation.
3. Worker retries retryable failures within configured limits.
4. Transaction stores a monitoring snapshot and updates stream status.
5. Valid live evidence creates or updates one `ACTIVE` Live Session.
6. Valid offline evidence completes the session with final status `OFFLINE`.
7. Activity and derived conditions create idempotent events and deduplicated alerts.
8. Recovery observations resolve matching alerts.
9. Transaction publishes realtime invalidation events through PostgreSQL `NOTIFY`.
10. API fans out authorized SSE events; frontend refetches REST state.
11. Alert delivery intents are claimed by Delivery Worker and sent to n8n.

Collection failures are not treated as verified offline evidence. `UNKNOWN` and `DISCONNECTED` remain distinct from `OFFLINE`.

## Data & Retention

- PostgreSQL stores users, sessions, streams, live sessions, snapshots, events, alerts, acknowledgements, AI summaries, and integration deliveries.
- Stream deletion is soft delete; historical sessions, events, alerts, and summaries remain.
- Monitoring snapshots are deleted after 30 days by `npm run db:retention`.
- Events and session aggregates remain available beyond snapshot retention.
- Recent comments, likes, gifts, and deduplication keys are bounded in collector memory; comments are capped at 100 recent samples per connection and deduplication sets at 200 keys.
- Reports use sampled/bounded audience data, not a full chat archive.
- Average viewers is an arithmetic average of valid snapshots, not time-weighted.
- Gift coin totals remain unavailable when any captured gift lacks reliable coin data.
- SSE notifications are transient and have no durable replay; REST remains source of truth.

## Current Status

### Implemented

- User authentication and ownership isolation.
- TikTok stream management and periodic monitoring worker.
- Persistent collector connection, status projection, snapshots, sessions, events, alerts, acknowledgement, dashboard, and SSE.
- PostgreSQL migrations, outbox delivery, n8n workflow, and Discord alert forwarding.
- Optional Gemini session-summary API/delivery implementation.
- Backend automated test suites and frontend typecheck/build scripts.

### Partial / Limitations

- TikTok collection depends on an unofficial internal Webcast protocol and has no live-provider coverage in automated tests.
- Provider policy compatibility, rate limits, and production reliability are not established.
- Like semantics may be incomplete; gift semantics and coin aggregation require further validation.
- Viewer, stale-data, comment, and gift alert behavior is rule-based and bounded by currently implemented thresholds.
- Gemini n8n callback and end-to-end workflow are not available.
- Docker Compose does not run all application processes.
- Retention is a manual CLI operation, not a scheduled job.

### Planned

- Production-safe TikTok provider/rate-limit strategy and compatibility review.
- Complete Gemini workflow, callback contract, and session notifications.
- Additional notification types and delivery-failure alerts.
- Formalize remaining alert thresholds, provider semantics, and deployment/scaling decisions.
- Automated operational scheduling for retention.

## Roadmap

- Harden the TikTok collector against provider changes and validate live-stream metric semantics.
- Complete session intelligence through Gemini workflow integration and callbacks.
- Expand operational deployment beyond the current development/MVP Compose setup.
- Add broader delivery coverage after core monitoring reliability is established.

## License

Licensing information has not been added yet.
