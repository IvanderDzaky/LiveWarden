# Live Warden — PRD Index

Dokumen ini memecah `docs/Overview.md` menjadi PRD implementasi yang lebih kecil. `Overview.md` tetap menjadi sumber kebenaran produk utama.

## Status Implementasi Current State

| PRD | Fokus | Fase Overview | Status Implemented |
| --- | --- | --- | --- |
| [01 Foundation & Authentication](./01-Foundation-Authentication.md) | Akun, autentikasi, isolasi data, shell aplikasi | Phase 1 | Complete |
| [02 Stream Management](./02-Stream-Management.md) | Tambah, validasi, kelola TikTok stream | Phase 2 | Complete |
| [03 Monitoring & Status](./03-Monitoring-Status.md) | Collector berkala, snapshot, status, reliability | Phase 2 | Complete (Persistent Connection) |
| [04 Live Session & Audience](./04-Live-Session-Audience.md) | Lifecycle session, metrik audiens, agregasi | Phase 3 | Complete (Comments/Likes/Viewers) |
| [05 Events & Alerts](./05-Events-Alerts.md) | Event detection, rule alert, acknowledgement | Phase 4 | Complete |
| [06 Monitoring Dashboard](./06-Monitoring-Dashboard.md) | Overview, detail stream, timeline, alert UI | Phase 5 | Complete & Locked (Operations Console) |
| [07 Automation & Discord](./07-Automation-Discord.md) | n8n webhook, Discord notification, failure isolation | Phase 6 | Mostly Complete (Outbox Worker) |
| [08 Session Intelligence & Reports](./08-Session-Intelligence-Reports.md) | Gemini summary, key moments, history, report | Phase 7 | Not Started |
| [09 Hardening & Operations](./09-Hardening-Operations.md) | Testing, observability, security, retention, responsive UX | Phase 8 | Partial (Suite, Logging, Secret Isolation) |

## Urutan Implementasi

| PRD | Fokus | Fase Overview |
| --- | --- | --- |
| [01 Foundation & Authentication](./01-Foundation-Authentication.md) | Akun, autentikasi, isolasi data, shell aplikasi | Phase 1 |
| [02 Stream Management](./02-Stream-Management.md) | Tambah, validasi, kelola TikTok stream | Phase 2 |
| [03 Monitoring & Status](./03-Monitoring-Status.md) | Collector berkala, snapshot, status, reliability | Phase 2 |
| [04 Live Session & Audience](./04-Live-Session-Audience.md) | Lifecycle session, metrik audiens, agregasi | Phase 3 |
| [05 Events & Alerts](./05-Events-Alerts.md) | Event detection, rule alert, acknowledgement | Phase 4 |
| [06 Monitoring Dashboard](./06-Monitoring-Dashboard.md) | Overview, detail stream, timeline, alert UI | Phase 5 |
| [07 Automation & Discord](./07-Automation-Discord.md) | n8n webhook, Discord notification, failure isolation | Phase 6 |
| [08 Session Intelligence & Reports](./08-Session-Intelligence-Reports.md) | Gemini summary, key moments, history, report | Phase 7 |
| [09 Hardening & Operations](./09-Hardening-Operations.md) | Testing, observability, security, retention, responsive UX | Phase 8 |

## Prioritas

- **P0:** PRD 01–05. Core monitoring, persistent collection, status mapping, session aggregates, alerts terverifikasi.
- **P1:** PRD 06–07. Dashboard console, recent comments feed, outbox delivery worker.
- **P2:** PRD 08–09. AI report intelligence (PRD 08, belum dimulai) dan operasional retention job 30 hari.

## Definition of Done Bersama

- Data selalu terisolasi per user.
- `UNKNOWN` tidak diperlakukan sebagai `OFFLINE`.
- Persistent TikTok LIVE connection per channel memantau secara terus-menerus dan terhubung ulang otomatis jika terputus.
- Frontend memuat state awal dari REST, memakai SSE sebagai sinyal invalidasi lalu REST refetch setelah debounce 150 ms, dan mempertahankan fallback polling 120 detik.
- Dashboard memakai satu SSE user-scoped; detail memakai SSE stream-scoped. Database tetap source of truth dan tidak ada durable replay notifikasi.
- Kegagalan layanan eksternal tidak menghentikan core monitoring.
- Perubahan penting dapat ditelusuri melalui event atau log.
- UI konsol monitoring usable pada desktop dan mobile.
- Acceptance criteria PRD terkait memiliki test suite terverifikasi.
