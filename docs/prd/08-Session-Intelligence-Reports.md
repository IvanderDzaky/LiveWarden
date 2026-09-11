# PRD-08 — Session Intelligence & Reports

## Ringkasan

Menghasilkan laporan historis dan ringkasan AI setelah session selesai tanpa menjadikan AI sumber kebenaran teknis.

## Status Implementasi

- Session report contract/API and optional Gemini generation endpoint implemented behind `GEMINI_API_KEY`.
- Report metrics remain available when Gemini is unavailable.

## Scope MVP

- Session history dengan filter stream dan waktu dasar.
- Session report: start/end, duration, peak/average viewers, comments, likes, gifts, events, alerts.
- Timeline key moments dari event terverifikasi.
- Gemini summary: session summary, audience changes, problems, simple insights, evaluation recommendations.
- AI input contract: full session aggregates, bounded comment samples, verified key events/alerts, explicit data limitations, and token budget capped at 12,000 input tokens per session.
- Persist AI result, processing status, dan failure reason bila gagal.
- Optional Discord summary melalui automation.
- Performa agregat dasar: total sessions/duration, averages, highest peak, comments, likes, alerts, interruptions, monitoring uptime.

## User Stories

- Sebagai streamer, saya dapat memahami hasil session tanpa membaca seluruh timeline.
- Sebagai tim produksi, saya dapat membandingkan session sebelumnya.
- Sebagai pengguna, saya tetap dapat membuka report walau Gemini gagal.

## Acceptance Criteria

- Session report tersedia setelah session closed dan aggregation selesai.
- Raw snapshot 30 hari tidak menghapus agregat, event penting, alert, atau summary.
- AI hanya menerima data yang diizinkan dan tidak menentukan `Stream Status` atau alert.
- AI failure tidak menggagalkan session close, aggregation, atau report metrics.
- Summary mencantumkan keterbatasan ketika metrik unavailable.
- AI input excludes secrets and unrelated users; comment data is sample-based, not a full chat archive.
- Reprocessing tidak membuat summary duplikat tanpa status/idempotency yang jelas.
- Test mencakup aggregation, history authorization, AI success/failure, retention, dan report availability.

## Dependency

- PRD-04, PRD-05, PRD-07.
- Gemini integration.

## Out of Scope

- Predictive analytics, chatbot, real-time AI moderation, sentiment real-time.
