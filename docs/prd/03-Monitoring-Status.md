# PRD-03 — Monitoring & Stream Status

## Ringkasan

Menjalankan monitoring TikTok LIVE secara persisten per channel yang dipantau, menyimpan data snapshot secara berkala ke database, dan membedakan kondisi teknis secara aman.

## Status Implementasi

- **Status:** Complete (Verified)
- **Koleksi:** Persistent `TikTokLiveConnection` per channel terdaftar & aktif. Event provider (`ROOM_USER`, `CHAT`, `LIKE`) dikonsumsi secara terus-menerus.
- **Worker/Flush:** Worker mengklaim stream dan memicu snapshot DB secara berkala (`WORKER_INTERVAL_MS=30000`).
- **Reconnect:** Reconnect otomatis memakai bounded exponential backoff 1–30 detik dengan maksimal satu timer per koneksi. Counter backoff direset setelah koneksi stabil 30 detik; status offline terverifikasi menghentikan reconnect. Koneksi juga ditutup bersih saat monitoring disabled atau stream dihapus.
- **Realtime:** Setelah transaksi domain berhasil commit, worker menerbitkan notifikasi status dan aktivitas v1 melalui PostgreSQL untuk invalidasi UI. Database tetap menjadi source of truth; notifikasi bukan penyimpanan atau durable queue.

## Scope MVP

- Persistent connection per monitored channel + worker snapshot interval (30s).
- Fetch, timeout, room-info fallback, response validation, snapshot DB.
- Status `LIVE`, `OFFLINE`, `DEGRADED`, `UNKNOWN`, `DISCONNECTED`.
- Last successful state, provider timestamp, dan room ID.
- Status transition event hooks (`STREAM_STARTED`, `STREAM_ENDED`, `CONNECTION_LOST`, `CONNECTION_RECOVERED`).
- Retry terbatas dengan exponential backoff 1–30 detik, satu timer per koneksi, dan reset setelah 30 detik stabil.

## User Stories

- Sebagai operator, saya dapat mengetahui stream live tanpa refresh manual.
- Sebagai operator, saya dapat membedakan stream offline dari pemeriksaan yang gagal.
- Sebagai operator, saya dapat melihat kapan data terakhir berhasil diperoleh.

## Acceptance Criteria

- Stream aktif terdeteksi dan snapshot tersimpan.
- Stream offline menghasilkan `OFFLINE` hanya jika data valid menyatakan offline.
- Timeout, invalid response, atau error network menghasilkan `UNKNOWN` atau `DISCONNECTED` sesuai akar masalah, bukan `OFFLINE`.
- `lastSuccessfulAt` dan data terakhir tetap tersedia setelah kegagalan.
- Retry memiliki timeout, batas percobaan, dan backoff.
- Monitoring satu stream gagal tidak menghentikan stream lain.
- Status transition dapat ditelusuri melalui log/event.
- Perubahan status yang sudah tersimpan memicu event realtime `stream.status`; UI tetap mengambil state otoritatif melalui REST.
- Test mencakup status mapping, retry, stale data, dan isolation antar-stream.

## Reliability

- Core monitoring tidak bergantung pada n8n, Discord, atau Gemini.
- Database error dicatat dan tidak ditelan diam-diam.
- Rate limit TikTok dihormati; limit concurrency worker tetap dikonfigurasi terpisah.

## Dependency

- PRD-01, PRD-02.
- Hasil prototype metode TikTok LIVE collector.

## Out of Scope

- Durable realtime replay/`Last-Event-ID`, predictive analytics, automatic moderation.
