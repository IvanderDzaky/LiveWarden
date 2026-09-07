# Live Warden External Integrations

Canonical collector result, metric semantics, status mapping, and error taxonomy: [`Domain-Contract.md`](./Domain-Contract.md).

## Integration Principle

External services are adapters around Live Warden core logic. Failures are observable and isolated. No external service is authoritative for stream status, Live Session lifecycle, event detection, alert generation, severity, deduplication, or persistence.

## TikTok LIVE

### Boundary

The TikTok LIVE Collector accepts normalized stream platform/identifier and returns a normalized observation or typed failure to the Monitoring Worker. It does not write database rows or decide domain status.

Collector maintains one persistent TikTok WebSocket connection per active identifier. Disconnect reconnect uses one timer and bounded exponential delay from 1 to 30 seconds; delay resets after 30 seconds stable. Verified offline stops reconnect. Monitoring disable, stream deletion, pruning, and worker shutdown close the connection.

### Required Data

Spike 2 observed LIVE indication, Room ID, current viewers from `ROOM_USER.total`, comments from `CHAT.content`, likes from `LIKE.count`/`LIKE.total`, and provider timestamps from `common.createTime`. Title was not observed. Gifts remain unvalidated. Missing values remain unavailable/null; they are never fabricated.

### Failure Handling

Timeouts and transient invalid responses map to `UNKNOWN` after bounded retry. Invalid credentials, unavailable integration, or persistent connection-level failure map to `DISCONNECTED`. Valid offline data alone maps to `OFFLINE`. Rate-limit response handling and concurrency remain Open Decisions.

## PostgreSQL Realtime Transport

Worker/domain persistence transaction publishes normalized v1 events with `SELECT pg_notify` on `livewarden_realtime_v1`. PostgreSQL releases notifications after transaction commit. API listens through a dedicated `pg.Client`, retries listener connection with exponential 1–30 second delay, validates messages, then fans out only to authenticated stream owners and optional stream scope.

This transport is transient and adds no schema/table migration. It is not durable queue/storage and provides no `Last-Event-ID` replay. REST remains source of truth. `LISTEN` requires a direct or session-pooled PostgreSQL connection; transaction pooling cannot preserve its session state.

## n8n

MVP delivery uses PostgreSQL outbox. Monitoring transactions create `N8N` delivery intents for new WARNING/CRITICAL alerts (`ALERT_CREATED`) and resolution (`ALERT_RESOLVED`); they never perform HTTP calls. A separate Delivery Worker claims intents with `FOR UPDATE SKIP LOCKED`, bounded retries, and expiring lease tokens. INFO and ACKNOWLEDGED transitions are not delivered.

## Verified Implementation Status

- **Implemented:** PostgreSQL outbox, lease-based Delivery Worker, authenticated POST to n8n, credential-free n8n workflow, Data Table deduplication, and Discord forwarding.
- **Live/E2E verified:** local Docker n8n received LiveWarden delivery and forwarded notifications to Discord for resolved `MONITORING_FAILURE` and active critical `CONNECTION_FAILURE`.
- **Live verified:** Header Auth, WARNING, CRITICAL, RESOLVED, and duplicate idempotency-key behavior. Same key produced no second Discord message.
- **Not implemented:** Gemini, callback API, direct Discord integration from LiveWarden, and delivery-failure alerts.

### Boundary and Responsibility

Live Warden emits versioned webhook payloads after core records commit. n8n orchestrates:

- Alert filtering and Discord formatting/delivery.
- Session-ended data preparation, Gemini invocation, result callback, and summary notification remain planned.

n8n does not own status, session, event, alert, severity, deduplication, or persistence decisions.

### Delivery Contract

```json
{
  "deliveryId": "uuid",
  "eventId": "uuid|null",
  "eventType": "ALERT_CREATED",
  "schemaVersion": 1,
  "occurredAt": "ISO-8601 timestamp",
  "stream": { "id": "uuid", "name": "...", "identifier": "..." },
  "liveSessionId": "uuid|null",
  "severity": "CRITICAL|null",
  "alert": {
    "id": "uuid",
    "type": "CONNECTION_FAILURE",
    "severity": "CRITICAL",
    "status": "ACTIVE",
    "description": "...",
    "recommendedAction": "...",
    "firstDetectedAt": "ISO-8601",
    "lastDetectedAt": "ISO-8601",
    "resolvedAt": null
  },
  "idempotencyKey": "alert:<alertId>:ACTIVE"
}
```

Production webhook path is `/webhook/livewarden-alert`. Authentication uses n8n Header Auth with `Authorization: Bearer <N8N_WEBHOOK_SECRET>`. The secret is configured outside workflow JSON. n8n Data Table `livewarden_delivery_dedupe` uses `idempotency_key` as dedupe identity; `deliveryId`, timestamp, and execution ID are not dedupe keys. Delivery records track attempts, status, and error without blocking monitoring.

Current n8n workflow accepts only `ALERT_CREATED` with WARNING/CRITICAL + ACTIVE, or `ALERT_RESOLVED` with WARNING/CRITICAL + RESOLVED + `resolvedAt`. It minimizes payload before Discord formatting; raw provider payload, trigger evidence, TikTok user data, comment content, credentials, and secrets are excluded.

Workflow artifact: `workflows/livewarden-alert-discord.json`. Published local workflow uses Data Table `livewarden_delivery_dedupe` with `PROCESSING` and `DELIVERED` markers, filtered lookup by `idempotency_key`, workflow concurrency 1, and one Discord embed per accepted delivery. A stale PROCESSING marker is eligible for manual requeue after its operational timeout. Delivery remains at-least-once; a crash between Discord acceptance and DELIVERED persistence can rarely duplicate a notification.

The repository workflow JSON is credential-free and serves as the exportable workflow definition. Local n8n publication was configured with Data Table `livewarden_delivery_dedupe`; credentials and environment values remain external to the repository artifact.

### Verified Smoke Matrix

| Scenario | Result |
| --- | --- |
| Header Auth | Passed |
| `ALERT_CREATED` + `WARNING` | Passed |
| `ALERT_CREATED` + `CRITICAL` | Passed |
| `ALERT_RESOLVED` | Passed |
| Duplicate ACTIVE idempotency key | Passed; no second Discord message |
| Duplicate RESOLVED idempotency key | Passed; no second Discord message |
| Invalid auth / malformed payload / Discord failure-retry | Not recorded in repository; run during deployment verification |

## Discord

### Notifications

- **Implemented and E2E verified:** `WARNING` and `CRITICAL` alert created, plus resolved alert notification.
- **Planned:** stream started, stream ended, Live Session completed, and Gemini-related notifications.

Verified alert embeds include stream name/identifier, alert type, severity/status, description, recommended action, lifecycle timestamps, optional session ID, and shortened alert ID. `idempotencyKey`, raw provider payload, and sensitive user data are excluded.

### Security and Failure

Webhook URL is a secret held server-side/n8n-side, never frontend or logs. Timeout and bounded retry occur in delivery workflow. Discord outage marks delivery failed and does not alter core records or stop worker execution.

## Gemini

### Trigger and Input

n8n invokes Gemini after Live Session close and aggregation. Input is sanitized session data: duration, peak/average viewers, audience trend/activity, comments, likes, gifts if available, verified events, alerts, and timeline. Credentials remain in n8n secret storage. AI must not receive unnecessary credentials or unrelated users' data.

### Structured Output

```json
{
  "sessionSummary": "string",
  "keyMoments": [{ "eventId": "uuid", "description": "string" }],
  "audienceChanges": "string",
  "problems": ["string"],
  "insights": ["string"],
  "recommendations": ["string"],
  "limitations": ["string"]
}
```

Output is schema-validated before persistence. Key moments must reference existing events or be marked unverified and excluded from authoritative timeline. AI summary status records `PENDING`, `COMPLETED`, or `FAILED`.

### Failure Handling

n8n applies timeout and bounded retry. Invalid output or unavailable Gemini produces `FAILED` with reason; report metrics remain available. Reprocessing uses session/delivery idempotency. Gemini cannot set stream status, close/open sessions, create authoritative events, choose alert severity, or resolve alerts.

## Open Decisions

- TikTok authentication requirement and production-safe rate-limit strategy.
- LIKE multi-session validation and gift semantics.
- n8n authentication and callback contract details.
- Gemini model and token budget.
