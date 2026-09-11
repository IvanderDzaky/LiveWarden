# Live Warden REST API

Domain enums, status semantics, event envelope, metric semantics, and error taxonomy are canonical in [`Domain-Contract.md`](./Domain-Contract.md).

## Conventions

Base path: `/api`. REST uses JSON request/response. Browser authentication uses an HTTP-only, Secure, SameSite session cookie. All protected endpoints authorize ownership server-side. Pagination uses opaque `cursor` and `limit` where collections can grow.

Success envelope:

```json
{ "data": {}, "meta": { "requestId": "uuid" } }
```

Error envelope:

```json
{ "error": { "code": "RESOURCE_NOT_FOUND", "message": "Resource not found", "details": {}, "requestId": "uuid" } }
```

Common errors: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `RESOURCE_NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500), `DEPENDENCY_UNAVAILABLE` (503). Auth errors use generic messages where account enumeration is possible.

## Authentication

`GET /metrics` exposes Prometheus-style operational counters: streams, monitored streams, active sessions, active alerts, and pending deliveries.

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | Public | `{ email, password }` | Created user, session |
| POST | `/auth/login` | Public | `{ email, password }` | User, session |
| POST | `/auth/logout` | Session | none | `{ success: true }` |
| GET | `/auth/me` | Session | none | Current user |

Errors: validation, duplicate email (`CONFLICT`), invalid credentials (`UNAUTHENTICATED`).

## Streams and Dashboard

| Method | Path | Purpose | Request/Response |
| --- | --- | --- | --- |
| GET | `/streams` | List active owned streams | Query `status`, `monitoringEnabled`, `cursor`, `limit`; stream summaries |
| POST | `/streams` | Add validated TikTok stream | `{ name, platform: "TIKTOK_LIVE", identifier }`; created stream |
| GET | `/streams/:streamId` | Stream detail | none; metadata, status, active session, metrics, recentComments, recentLikes, recentGifts, alerts/events summary |
| PATCH | `/streams/:streamId/monitoring` | Enable/disable monitoring | `{ enabled }`; updated stream |
| DELETE | `/streams/:streamId` | Soft-delete stream | none; `{ deleted: true }` |
| GET | `/dashboard/overview` | Dashboard KPIs and recent data | Query optional; counts, streams, active alerts, recent events |

Errors: invalid identifier (`VALIDATION_ERROR`), provider validation failure (`422` or documented domain error), ownership (`404`), already deleted (`CONFLICT` or idempotent success).

## Monitoring, Sessions, Metrics, and Events

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/streams/:streamId/status` | Current status, last check, last success, stale indicator |
| GET | `/streams/:streamId/metrics` | Current/live audience metrics; query session and range |
| GET | `/streams/:streamId/sessions` | Owned stream session history; cursor pagination |
| GET | `/live-sessions/:sessionId` | Session detail and aggregate metrics |
| GET | `/streams/:streamId/events` | Event timeline; query session/type/time |

Responses use canonical statuses and event names from `Monitoring.md` and `Events.md`. `UNKNOWN` is returned explicitly and never converted to `OFFLINE`.

## Realtime SSE

| Method | Path | Scope |
| --- | --- | --- |
| GET | `/streams/:streamId/live` | One owned stream; unknown or foreign stream returns `404` |
| GET | `/live` | All streams owned by authenticated user; one dashboard connection |

Both endpoints use same-origin session-cookie authentication and native browser `EventSource`. Successful response headers are `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, and `X-Accel-Buffering: no`. Initial frame sets `retry: 3000` and emits `stream.ready`.

Canonical data event names are `stream.status`, `stream.viewer_count`, `stream.comment`, `stream.like`, and `stream.alert`. Each data frame contains normalized v1 envelope fields `id` (UUID), `schemaVersion`, `type`, `streamId`, `identifier`, `occurredAt` (ISO-8601), and bounded `payload`. `stream.resync` tells clients to refetch REST state after listener disruption/reconnect.

API revalidates the auth session on each 20-second heartbeat. Invalid sessions, slow/unwritable clients, request disconnects, listener shutdown, and API shutdown close and clean up subscriptions. Fan-out is restricted to authenticated owning user and, for stream endpoint, requested stream.

SSE is an invalidation channel, not source of truth. PostgreSQL notifications are transient; UUID IDs do not imply durable `Last-Event-ID` replay. Native `EventSource` reconnect plus REST resync handles gaps. Frontend debounces invalidations for 150 ms and retains 120-second fallback polling. API limits each authenticated user to 10 concurrent SSE subscriptions and rejects excess connections with `429 RATE_LIMITED`.

## Alerts

| Method | Path | Purpose | Request |
| --- | --- | --- | --- |
| GET | `/alerts` | List owned alerts | Query `status`, `severity`, `streamId`, cursor |
| GET | `/alerts/:alertId` | Alert detail and acknowledgement history | none |
| POST | `/alerts/:alertId/acknowledgements` | Acknowledge alert | `{ note?: string }` |

Errors: invalid note (`VALIDATION_ERROR`), unknown/foreign alert (`404`), already resolved (`CONFLICT` according to product policy). Acknowledgement response returns `ACKNOWLEDGED`; technical stream status is unchanged.

## Reports and AI

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/live-sessions/:sessionId/report` | Completed session report | aggregates, timeline key moments, AI status/summary |
| GET | `/reports/performance` | Basic aggregate performance | Query stream/date range; totals and averages |
| GET | `/live-sessions/:sessionId/ai-summary` | AI result/status | summary fields, processing status, failure reason if applicable |

Report remains available when AI processing fails. Average viewers is snapshot average, not time-weighted.

## Internal Automation

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/internal/automation/events` | Service authentication | Receive n8n callback for Gemini result or delivery status |

Internal endpoint requires separate secret/service authentication, request signature or equivalent replay protection, schema validation, and idempotency key. It cannot directly mutate stream status, session lifecycle, event type, alert severity, or deduplication state.

## Open Decisions

- API versioning and pagination limits.
- Provider validation error contract.
- n8n callback authentication mechanism.
