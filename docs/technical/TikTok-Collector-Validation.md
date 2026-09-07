# TikTok LIVE Collector Validation

## Status

Technical spike plus isolated MVP adapter boundary. `src/collectors/tiktok.ts` now wraps `tiktok-live-connector@2.4.4`; mock contract tests verify normalization and cleanup. No live-provider test is part of the automated suite. Production adoption remains conditional on provider, rate-limit, error-classification, and license review.

Validation date: 2026-09-04.

## 1. Library and Methods Tested

### Tested

- `tiktok-live-connector` `2.4.4` for Node.js.
- `TikTokLiveConnection` with username input.
- `connect()` and built-in room lookup.
- `ControlEvent.CONNECTED`, `ControlEvent.ERROR`, `ControlEvent.DISCONNECTED`.
- `WebcastEvent.CHAT`, `LIKE`, `GIFT`, `ROOM_USER` listeners.
- `fetchRoomInfoOnConnect: true`.
- HTTP request timeout: 10 seconds.
- WebSocket handshake timeout: 10 seconds.

The library reads TikTok's internal Webcast WebSocket. It is unofficial and not an official TikTok API.

### Alternatives Researched

- `TikTokLive` Python: broad equivalent capability, but weaker fit for Live Warden's Node.js/TypeScript direction.
- Official TikTok API: no public read-only LIVE Webcast API found that covers required chat, likes, gifts, and viewer events.
- Euler Stream managed WebSocket API: production-oriented alternative, but introduces managed-provider dependency and was not tested in this spike.

Sources:

- `https://github.com/zerodytrash/TikTok-Live-Connector`
- `https://www.npmjs.com/package/tiktok-live-connector`
- `https://github.com/isaackogan/TikTokLive`

## 2. Why This Library

- Native Node.js/TypeScript alignment.
- Username-based connection.
- Documented room ID, room info, viewer, chat, like, gift, connect, disconnect, and error events.
- No database or application integration required for a minimal spike.
- Public livestream reading does not require TikTok login according to library documentation.

This is a technical-spike choice, not a production approval.

## 3. Spike Structure and Connection

Files:

- `prototype/tiktok-collector/package.json`
- `prototype/tiktok-collector/package-lock.json`
- `prototype/tiktok-collector/README.md`
- `prototype/tiktok-collector/src/index.js`

Run:

```text
cd prototype/tiktok-collector
npm install
npm run start -- @username --seconds=15
```

Flow:

1. Normalize leading `@`.
2. Construct `TikTokLiveConnection`.
3. Resolve room and connect through the library.
4. Print room ID and status.
5. Count in-memory comments, likes, gifts, and latest viewer event.
6. Observe for configured seconds.
7. Disconnect without persistence.

## 4. Authentication and Credentials

### Observed

- `npm install` completed successfully.
- No TikTok cookie or login credential was supplied.
- No Euler API key was supplied.
- The prototype made no authenticated action and never sends chat messages.

### Library Documentation

- Reading public LIVE streams: no TikTok login, cookie, or app registration required.
- WebSocket signing uses Euler Stream sign service.
- Euler API key is optional for community access and may increase rate limits.
- Authenticated WebSocket mode requires a session bundle containing `sessionid` and `tt-target-idc`; this was not used or tested.

### Result

**Observed:** unauthenticated connection path was attempted.

**Not testable:** successful unauthenticated LIVE connection, because no active public test channel was available during execution.

**Open:** whether this access model is acceptable for production use, including provider terms and reliability.

## 5. Runtime Experiments

| Experiment | Result | Actual output/meaning |
| --- | --- | --- |
| Missing username | **observed** | CLI printed usage and exited with code 2. |
| Nonexistent username | **observed** | `Failed to retrieve Room ID from all sources.`; CLI mapped result to `UNKNOWN`. |
| `@tiktok` | **observed** | `The requested user isn't online :(`; CLI mapped result to `UNKNOWN`, not `OFFLINE`, because error was not exposed as `UserOfflineError` in this run. |
| Active LIVE channel | **not testable** | No known active channel was available during execution. |
| Comments | **not observed** | Requires successful active WebSocket session. |
| Likes | **not observed** | Requires successful active WebSocket session. |
| Gifts | **not observed** | Requires successful active WebSocket session. |
| Viewer count | **not observed** | Requires successful `ROOM_USER` event. |
| Room ID | **not observed** | `CONNECTED` never occurred. |
| Title/metadata | **not observed** | Room info was unavailable because connection did not succeed. |
| Invalid input handling | **observed** | Missing identifier rejected locally. |
| Database/API/integration isolation | **observed** | No such dependency exists in spike. |

No capability is marked observed solely because the library README claims it.

The official TikTok API path for the required public LIVE Webcast event set is **unsupported for this validation scope**: no documented public endpoint was identified that supplies the required comments, likes, gifts, and viewer event stream. This does not mean TikTok has no other APIs; it means that path cannot be used as the tested collector method for this requirement.

## 6. Capability Matrix

| Capability | Library documentation | Spike result | Live Warden conclusion |
| --- | --- | --- | --- |
| Username input | supported | observed input parsing | usable as collector input |
| Live status | supported | not testable successfully; failures returned `UNKNOWN` | requires explicit error classification validation |
| Room/live ID | supported | not observed | candidate normalized field |
| Stream title/metadata | supported through room info | not observed | optional field; validate shape on live run |
| Current viewers | supported through `ROOM_USER` | not observed | candidate snapshot metric |
| Comments | supported through `CHAT` | not observed | event stream, not polling snapshot |
| Likes | supported through `LIKE` | not observed | event plus possible total; reliability caveat |
| Gifts | supported through `GIFT` | not observed | event; streak normalization required |
| Timestamp/event metadata | event payloads documented | not observed | use local receipt time plus provider fields when present |
| Reconnect event | supported through `DISCONNECTED` and manual `connect()` | not observed | manual bounded reconnect required |
| Timeout | client options documented | configured, not triggered | needs controlled network test |
| Rate-limit behavior | delay recommended; API limits exist | not observed | needs repeated controlled test |

No required `tiktok-live-connector` capability was classified as `unsupported`; required capabilities remain `not observed` because no successful LIVE connection occurred. The official API alternative is classified `unsupported` for this scope as stated above.

## 7. Data and Raw Event Behavior

### Documented Library Fields, Not Runtime-Observed

- Room ID: `state.roomId` / `connection.roomId`.
- Room info: `connection.roomInfo`; may include title and room metadata.
- Viewer count: `ROOM_USER` payload `viewerCount`.
- Comment: `CHAT` payload `comment` plus user information.
- Like event count: `LIKE` payload `likeCount`.
- Like cumulative total: `LIKE` payload `totalLikeCount`.
- Gift identity/count: `GIFT` payload `giftId`, `repeatCount`, `repeatEnd`, gift details.
- Connection metadata: `CONNECTED`, `DISCONNECTED`, `ERROR`.

### Raw/Decoded Events

The library exposes `RAW_DATA` and `DECODED_DATA` control events. The spike did not enable raw payload dumping to avoid noisy output and accidental user-content logging. Raw protobuf payload shape is therefore **not observed**.

## 8. Cumulative, Snapshot, and Delta Behavior

### Observed

- No metric event was received. No cumulative/delta behavior was measured.

### Documented / To Validate

- `ROOM_USER.viewerCount` is a point-in-time viewer statistic and should be treated as a snapshot.
- `LIKE.likeCount` is event increment/count; `LIKE.totalLikeCount` appears cumulative per library event shape, but this was not validated at runtime.
- `GIFT.repeatCount` describes gift streak count, not a safe generic cumulative room total.
- Comments and gifts are event occurrences; totals must be derived from accepted events.

### Result

Metric normalization is **not closed**. Live Warden must not assume cumulative versus delta semantics until an active-stream capture validates them. Gift streak finalization requires `repeatEnd` handling. Likes may be incomplete: library documents that like events are not always triggered for high-viewer streams.

## 9. Error Behavior

### Observed

- Invalid/nonexistent username: `Failed to retrieve Room ID from all sources.`
- Offline target in this environment: `The requested user isn't online :(`.
- Both cases surfaced as connection rejection and were conservatively reported by spike as `UNKNOWN`.
- General `ERROR` listener was invoked for failed connection.

### Collector Mapping Implication

The library error name/message alone is insufficient to safely map all cases. A production adapter must classify:

- verified provider offline response → `OFFLINE`;
- temporary lookup/network/timeout failure → `UNKNOWN`;
- invalid credential, unavailable sign/provider service, or persistent connection failure → `DISCONNECTED`;
- live response with technical attention condition → `DEGRADED`.

The spike did not prove that the library consistently exposes distinguishable error types for every case.

## 10. Timeout and Reconnect

### Configured

- HTTP request timeout configured to 10 seconds.
- WebSocket handshake timeout configured to 10 seconds.
- Observation window supports one manual reconnect attempt after a 5-second delay on `DISCONNECTED` event.

### Observed

- No timeout occurred.
- No WebSocket `DISCONNECTED` event occurred after a successful connection.
- No reconnect succeeded or failed in the runtime experiments.

### Library Limitation

Library documentation recommends waiting before reconnecting to avoid rate limiting. It does not provide a production-grade reconnect policy. Live Warden must own bounded reconnect, backoff, attempt classification, and session safety.

## 11. Rate-Limit Observations

**Not observed.** No deliberate repeated connection or load test was run. Such a test would risk violating provider limits and producing misleading results from one network/IP.

Library documentation indicates free community rate limits and optional Euler API key for increased limits. Exact quota and production-safe polling budget remain unknown.

## 12. Known Limitations

### TikTok/Provider

- Internal Webcast protocol can change without notice.
- Public access behavior may vary by region, account, channel, and anti-abuse controls.
- Viewer count and engagement data may be sampled, delayed, missing, or inconsistent.
- Like events are documented as not always emitted for high-viewer streams.
- Offline detection may not expose a stable error type across lookup paths.
- Exact rate limits are not established.

### Library

- Unofficial reverse-engineering project.
- README explicitly says it is not production-ready.
- WebSocket signing depends on Euler Stream sign service.
- Reconnect policy is caller-owned.
- Raw protobuf schema and event payloads may drift.
- Modified AGPL license creates production distribution/compliance risk; legal review required before dependency adoption.

### Spike

- No active LIVE channel was available, so no positive capability was runtime-proven.
- No raw event capture.
- No controlled timeout, reconnect, or rate-limit test.
- No cumulative/delta measurement.
- No resilience or long-duration test.

## 13. Risks for Live Warden

1. **Highest risk: false status.** A connection rejection may represent offline, invalid user, provider failure, or network failure. Mapping everything to `OFFLINE` would violate Live Warden requirements.
2. **Protocol drift.** Internal Webcast changes can break collector parsing without a stable official contract.
3. **Availability dependency.** Sign service/Euler and TikTok access become operational dependencies despite no TikTok login.
4. **Metric integrity.** Likes may be incomplete; gift streak events can double-count without normalization; cumulative/delta semantics remain unproven.
5. **Reconnect/rate-limit interaction.** Aggressive worker polling or reconnect can trigger rate limits.
6. **License risk.** Modified AGPL dependency may impose obligations incompatible with intended deployment; obtain legal review.
7. **Data privacy.** Chat and gift events contain user identifiers/content; retention and minimization must be defined before production storage.

## 14. Recommended Collector Contract

This is an adapter contract proposal, not production code:

```text
collect(username, options) ->
  {
    provider: "tiktok",
    requestedUsername,
    canonicalUsername,
    observedAt,
    providerTimestamp?,
    providerRoomId?,
    live: true | false | unknown,
    title?,
    viewers?: number,
    metrics: {
      comments?: { kind: "event", count, items? },
      likes?: { kind: "event", count?, total? },
      gifts?: { kind: "event", items? }
    },
    rawMetadata?,
    failure?: {
      category: "NOT_FOUND" | "OFFLINE" | "TIMEOUT" | "NETWORK" | "RATE_LIMITED" | "AUTH" | "PROVIDER" | "INVALID_RESPONSE",
      retryable: boolean,
      message: string
    }
  }
```

Rules:

- Adapter returns normalized observation/failure only; it does not decide Live Warden status, create sessions, events, or alerts.
- `live: false` is allowed only after verified provider offline evidence.
- Unknown/ambiguous errors remain failure categories for domain mapping, never implicit offline.
- Preserve local receipt timestamp and provider timestamp separately.
- Treat viewers as snapshot.
- Treat comments/gifts as events.
- Treat likes as event count plus optional total, pending runtime validation.
- Preserve provider room ID as opaque string.
- Never persist raw user content by default in spike/adapter boundary.

## 15. Open Decisions Closed by Spike

- **Runtime direction:** Node.js package is compatible with project direction; Python is not preferred for this codebase.
- **Prototype method:** username-based internal Webcast connection is feasible to invoke in isolated Node.js.
- **Prototype isolation:** no production integrations are needed to exercise the library boundary.
- **Unauthenticated read path:** library documents a public read path without TikTok cookies; Spike 1 did not observe success, Spike 2 observed successful LIVE connection on `@tv_asahi_news`.

These are only partial closures. They do not establish production reliability or TikTok policy compatibility.

## 16. Open Decisions Remaining

- Adopt `tiktok-live-connector` for MVP or use Euler Stream managed WebSocket API.
- TikTok authentication/credential requirement under production access conditions.
- Exact collector/library and version pinning strategy.
- Exact collector capabilities on active streams.
- TikTok rate-limit strategy and safe stream polling budget.
- Cumulative versus delta normalization for likes and gifts.
- Viewer spike/drop thresholds.
- Comment/gift activity thresholds.
- Worker concurrency limit.
- Exact timeout/retry/backoff values.
- License approval and dependency compliance.

## Spike 2 Runtime Results

Spike 2 target: `@tv_asahi_news`, used as known-active public LIVE account.

### Runtime Tests

| Test | Result | Evidence |
| --- | --- | --- |
| Successful unauthenticated LIVE connection | **observed** | `STATUS value=LIVE`, `CONNECTED`. No TikTok cookie or Euler API key. |
| Observation window | **observed** | 180-second run completed with live event traffic; additional 30-second extraction run completed. |
| Room ID | **observed** | `7680106927032535826`. Same value after reconnect. |
| Room info object | **observed** | Object keys `data`, `extra`, `status_code`. |
| Stream title | **not observed** | Expected title path unavailable in runtime object. |
| Viewer count | **observed** | `ROOM_USER.total`, values such as `21792`, `21939`, `22781`, `22765`. |
| Viewer event frequency | **observed** | Repeated event-driven updates; 3 samples arrived within first few seconds, cadence varied. |
| CHAT comments | **observed** | Non-empty `content`; repeated callbacks. |
| CHAT user field | **observed** | User identity field available; output redacted. |
| CHAT provider timestamp | **observed** | `common.createTime` present. |
| LIKE delta/total fields | **observed** | Actual v3 fields `count` and `total`. |
| GIFT fields | **not observed** | No gift event during windows. |
| Controlled disconnect | **observed** | `DISCONNECTED code=1005`. |
| Reconnect | **observed** | One reconnect after delay succeeded; same Room ID. |
| Timeout | **not testable** | No forced network simulation used. |
| Rate limit | **not observed** | No aggressive/repeated load test used. |
| Clean shutdown | **observed** | Process inspection found `SPIKE_NODE_PIDS=none`; unrelated Node processes remained untouched. |

### Actual Event Samples

Output was capped at three samples per event type and sensitive values were redacted:

```text
[CONNECTED] roomId=7680106927032535826 localTimestamp=...
[ROOM_USER] viewerCount=21792 totalUser=22825886 providerTimestamp=...
[CHAT] user=<redacted> userField=available comment=<redacted> providerTimestamp=...
[LIKE] user=<redacted> userField=available likeCount=15 totalLikeCount=3429960 providerTimestamp=...
[GIFT] not observed
```

The v3 protobuf declarations and runtime behavior differ from the older documented aliases. Correct runtime accessors:

- CHAT: `content`, `user`, `common.createTime`.
- ROOM_USER: `total` for current viewers, `totalUser` as separate aggregate.
- LIKE: `count` for event count, `total` for cumulative-like field, `user`, `common.createTime`.
- GIFT: `giftId`, `gift.name`, `repeatCount`, `repeatEnd`, `user`, `common.createTime`; not runtime-observed.

## Spike 2 Metric Semantics

### Viewer Count

**Observed:** `ROOM_USER.total` changed between event samples and was emitted repeatedly. It is event-driven current viewer data, not a cumulative count. `totalUser` also changed but is a separate provider aggregate and must not be normalized as current viewers.

Exact cadence is **not fixed**. It varied during the run. Live Warden should store each valid observation with local receipt timestamp and provider timestamp.

### Likes

**Observed:** `LIKE.count` values such as `1`, `2`, `3`, `8`, and `15`; `LIKE.total` values in the millions. This supports:

- `count`: event/delta-like count for received like event.
- `total`: provider cumulative-like field.

Runtime samples included totals that were not strictly monotonic in tool output ordering. Do not use `total` as unquestioned durable aggregation without per-session validation and anomaly handling. Library limitation remains: like events may not always be emitted for high-viewer streams.

### Gifts

**Not observed.** No gift was received. `repeatCount`, `repeatEnd`, gift name, and streak behavior remain unproven. Do not calculate final gift totals from the library declarations alone.

### Comments

**Observed:** `CHAT.content` was non-empty in sampled callbacks. Each callback represents one emitted chat message event in this run. User identity was available but redacted. Provider `common.createTime` was available. Deleted-message behavior and duplicate delivery were not tested.

## Spike 2 Error Classification Findings

| Error class | Evidence | Status |
| --- | --- | --- |
| `USER_NOT_FOUND` | Generic `Error: Failed to retrieve Room ID from all sources.` for synthetic username | Candidate only; not a stable typed classification |
| `OFFLINE` | `Error: The requested user isn't online :(` from `@tiktok` | Candidate only; no stable `UserOfflineError` name in observed run |
| `TIMEOUT` | No timeout induced | `not testable` |
| `NETWORK_ERROR` | No controlled network failure | `not testable` |
| `PROVIDER_UNAVAILABLE` | No isolated provider outage | `not testable` |
| `AUTHENTICATION_ERROR` | Public unauthenticated path succeeded | `not testable` as failure case |
| `UNKNOWN` | Generic fallback required for ambiguous connection failures | **observed as necessary fallback** |

Do not map every rejected `connect()` call to `OFFLINE`. Adapter must preserve error name, message, and source path for domain classification.

## Spike 2 Disconnect, Reconnect, and Cleanup

Controlled test: disconnect after 12–15 seconds, wait 8–10 seconds, reconnect once.

**Observed:**

- `CONTROLLED_DISCONNECT` invoked.
- `DISCONNECTED code=1005` emitted.
- Reconnect emitted a second `CONNECTED`.
- Room ID remained `7680106927032535826`.
- No reconnect loop ran.
- Centralized shutdown clears timers, prevents reconnect after shutdown, awaits disconnect, removes listeners, and handles `SIGINT`/`SIGTERM`.
- Process lookup filtered by `prototype*tiktok-collector` returned `SPIKE_NODE_PIDS=none` after completion.

Earlier runner left orphan processes because it called `process.exit()` while asynchronous/event cleanup remained active. Refactored runner no longer uses forced process exit for normal shutdown. Unrelated Node processes were not killed.

Reconnect beyond one delayed attempt and reconnect after provider-side termination remain untested.

## Spike 2 Rate Limit Findings

**Not observed:** no explicit request rejection, signing-service rejection, or rate-limit response occurred during the small safe test set. No aggressive load test was run. This does not establish absence of limits.

## Updated Capability Matrix

| Capability | Final status | Evidence/limitation |
| --- | --- | --- |
| LIVE detection | **observed** | Successful public connection on `@tv_asahi_news`. |
| Room ID | **observed** | Stable across controlled reconnect. |
| Room metadata | **observed** partially | Room info object exists; title not observed. |
| Current viewers | **observed** | `ROOM_USER.total`; event-driven snapshots. |
| Comments | **observed** | `CHAT.content`, one callback per emitted message in samples. |
| Comment user | **observed** | Available; redacted. |
| Event/provider timestamp | **observed** | `common.createTime`. |
| Likes | **observed** partially | `count` and `total`; total requires defensive validation. |
| Gifts | **not observed** | No event window sample. |
| Gift streak semantics | **not observed** | No `repeatCount`/`repeatEnd` runtime sample. |
| Controlled disconnect | **observed** | Code `1005`. |
| Basic reconnect | **observed** | One attempt; same Room ID. |
| Clean shutdown | **observed** | No prototype PID remained. |
| Timeout classification | **not testable** | No controlled failure. |
| Rate-limit behavior | **not observed** | No explicit response in safe tests. |

## Updated MVP Recommendation

**CONDITIONAL.** Spike 2 proves the core positive path required by the decision gate: LIVE connection, LIVE detection, Room ID, viewer data, CHAT/comments, basic reconnect, and clean shutdown. Likes are usable only with explicit delta/cumulative and anomaly handling. Gifts remain unproven. Error classification, timeout behavior, rate limits, long-term reliability, provider terms, and license compliance remain unresolved.

MVP adoption requires:

- Keep `tiktok-live-connector` behind an adapter boundary.
- Treat `ROOM_USER.total` as current viewer snapshot.
- Treat `CHAT.content` as an event payload.
- Treat `LIKE.count` as received event count and `LIKE.total` as advisory cumulative value until stronger validation.
- Do not aggregate gifts until streak behavior is observed and normalized.
- Map ambiguous connection errors to `UNKNOWN`, never implicit `OFFLINE`.
- Implement bounded reconnect and provider-aware rate limiting outside this spike.
- Complete modified AGPL and provider terms review.
- Add contract tests against captured redacted fixtures before production use.

If error classification or availability fails under a controlled second test, use **REJECT** for this library and evaluate Euler Stream managed WebSocket API separately. Do not start production implementation before these conditions close.

## Collector Adoption Risk Register

| Risk/condition | Current status | Required closure |
| --- | --- | --- |
| Timeout/network classification | Open Validation | Safe simulated failure tests and typed adapter mapping. |
| `OFFLINE` vs `USER_NOT_FOUND` | Open Validation | Stable evidence from provider/library error paths. |
| LIKE semantics across sessions | Open Validation | Multi-session capture; anomaly handling for non-monotonic totals. |
| Gift semantics | Open Validation | Runtime gift samples; `repeatCount`/`repeatEnd` streak contract. |
| Safe rate-limit budget | Open Validation | Provider-safe budget and signing dependency policy. |
| Provider terms | Open Decision | Legal/product review of unofficial access. |
| Modified AGPL license | Open Decision | Legal compliance approval before production dependency. |
| Redacted fixture contract tests | Open Decision | Capture and test v3 fields without PII. |
| Version pinning | Open Decision | Pin `tiktok-live-connector@2.4.4`; define upgrade compatibility checks. |
