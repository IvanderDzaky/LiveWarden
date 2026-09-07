# PRD-09 — Hardening & Operations

## Ringkasan

Memastikan MVP stabil, dapat ditelusuri, aman, teruji, dan siap dijalankan dengan Docker.

## Scope MVP

- Structured logging untuk monitoring execution/failure, status transition, session, event, alert, automation, AI.
- Error taxonomy untuk timeout, rate limit, network, invalid response, database, external service.
- Metrics dasar: success/failure rate, latency, stale streams, active sessions, alert delivery.
- Retry/backoff dan timeout policy terdokumentasi.
- Secret management via environment/secret store.
- Database backup dan migration procedure.
- Raw data retention job 30 hari.
- Automated tests untuk monitoring, status transition, session, alert, authorization, integration failure.
- Responsive/accessibility/security review.
- Realtime API memakai same-origin cookie auth, ownership filtering, heartbeat session revalidation, slow-client disconnect, dan cleanup saat disconnect/shutdown.
- PostgreSQL realtime listener memakai koneksi dedicated serta reconnect exponential 1–30 detik. Deployment wajib memakai koneksi PostgreSQL direct/session-pooled; transaction pooling tidak kompatibel dengan `LISTEN` yang session-bound.

## Acceptance Criteria

- Setiap kegagalan penting memiliki log dengan correlation ID tanpa secret.
- Monitoring failure dapat dibedakan dari provider offline.
- n8n, Discord, Gemini failure terisolasi dan terukur.
- Credentials/API keys tidak berada di frontend, log, atau source repository.
- Request protected melewati authorization.
- Retention job menghapus raw data melewati 30 hari, mempertahankan agregat/event penting.
- Test suite berjalan di CI dan mencakup acceptance criteria inti.
- Docker setup dapat menjalankan dependency MVP pada environment development.
- Backup restore procedure diuji minimal sekali sebelum release.
- SSE mengirim heartbeat tiap 20 detik, menutup session yang tidak lagi valid, dan tidak membocorkan event antar-user/stream.
- Operasi memahami bahwa PostgreSQL `NOTIFY` bersifat transient: browser reconnect melakukan REST resync; tidak ada jaminan durable replay atau `Last-Event-ID` replay.

## Dependency

- Semua PRD sebelumnya.
- Deployment environment dan batas maksimum stream per user.

## Out of Scope

- Multi-region deployment, advanced SRE platform, native mobile release, multi-platform support.
