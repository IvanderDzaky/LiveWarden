# TikTok LIVE Collector Spike

Isolated technical spike for validating `tiktok-live-connector`. No Live Warden production dependency or integration.

## Run

```text
npm install
npm run start -- @username
npm run start -- @username --seconds=180 --disconnect-after=60 --reconnect-delay=10
```

The command reads a public stream only. It does not send chat, persist data, or use cookies. `--seconds` controls the observation window. Spike 2 performs one controlled disconnect and one reconnect by default; use `--disconnect-after=0` to disable it.

## Interpretation

- A live channel is required to observe chat, likes, gifts, and viewer events.
- Offline and invalid-user checks are separate outcomes.
- This spike intentionally does not implement production retry policy, scheduling, persistence, or domain status mapping.
