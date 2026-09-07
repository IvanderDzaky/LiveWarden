# PRD-05 — Events & Alerts

## Ringkasan

Mencatat kejadian penting dan membuat alert actionable ketika kondisi membutuhkan perhatian.

## Status Implementasi Realtime

- Event domain tetap immutable, append-only, dan tersimpan di database.
- Worker/API menerbitkan notifikasi realtime v1 ter-normalisasi setelah transaksi commit: `stream.status`, `stream.viewer_count`, `stream.comment`, `stream.like`, dan `stream.alert`.
- Setiap notifikasi membawa UUID `id`, `schemaVersion: 1`, `type`, `streamId`, `identifier`, `occurredAt` ISO, dan `payload` terbatas. UUID memberi identitas stabil selama delivery, bukan replay durable.
- Lifecycle alert tetap `ACTIVE`, `ACKNOWLEDGED`, `RESOLVED`; SSE tidak mengubah rule, deduplication, atau lifecycle tersebut.

## Scope MVP

- Event timeline: start/end, viewer spike/drop, activity spike, monitoring failure/recovery, connection lost/recovered.
- Alert severity `INFO`, `WARNING`, `CRITICAL`.
- Alert status `ACTIVE`, `ACKNOWLEDGED`, `RESOLVED`.
- Rules untuk unexpected stop, repeated failure, lost connection, significant viewer drop, stale data.
- Deduplication dan resolution.
- Acknowledge dengan user, timestamp, optional note.

## User Stories

- Sebagai operator, saya mendapat alert ketika masalah perlu tindakan.
- Sebagai operator, saya dapat mengakui alert dan menambahkan catatan.
- Sebagai tim produksi, saya dapat menelusuri event dan alert setelah sesi selesai.

## Acceptance Criteria

- Setiap event menyimpan type, stream, session bila ada, waktu, value, metadata.
- Event tidak otomatis menjadi alert tanpa rule yang cocok.
- Kondisi sama tidak membuat alert aktif duplikat.
- Alert menyimpan detail masalah, trigger value, suggested action, severity, dan lifecycle timestamps.
- Alert berubah `RESOLVED` ketika kondisi penyebab tidak lagi terdeteksi, tetapi record tetap tersimpan.
- Acknowledgement tidak mengubah status teknis stream.
- Threshold dapat diuji dan didokumentasikan; nilai default ditentukan sebelum production.
- Test mencakup rule matching, deduplication, acknowledgement, resolution, dan alert isolation.
- Notifikasi hanya terlihat oleh user pemilik stream; kehilangan notifikasi dipulihkan dengan REST resync, bukan replay `Last-Event-ID`.

## Dependency

- PRD-03, PRD-04.

## Out of Scope

- Automatic remediation, sentiment analysis, AI sebagai penentu status atau severity utama.
