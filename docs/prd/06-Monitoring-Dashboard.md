# PRD-06 — Monitoring Dashboard

## Ringkasan

Menyediakan satu dashboard konsol pemantauan bergaya operasional yang memprioritaskan kondisi yang membutuhkan tindakan.

## Status Implementasi

- **Status:** Complete & Locked (Verified)
- **Desain & Hierarchy:** Refactored menjadi konsol pemantauan padat dan bersih. Mengeliminasi visual noise (card berlebihan, gradient generik, glassmorphism, badge dekoratif, dan highlight warna berlebih).
- **Recent Comments Feed:** Menampilkan komponen Recent Comments pada detail stream (menampilkan `Display Name @username` jika username ada, atau `Display Name` tanpa dangling `@` jika username kosong).
- **Audience Activity Feed:** Detail stream menampilkan recent likes dan completed gifts, termasuk pengirim, jumlah, nama gift, serta gambar gift bila provider menyediakan URL.
- **Data Delivery:** Initial state berasal dari REST. Browser memakai native `EventSource`: detail membuka koneksi stream-scoped, dashboard membuka satu koneksi user-scoped. Event di-debounce 150 ms lalu memicu REST refetch. Fallback polling 120 detik tetap aktif.
- **Layout:** Detail stream menempatkan Recent Chat, Recent Likes, dan Recent Gifts dalam tiga kolom desktop dan satu kolom pada mobile. Gift image memakai provider URL dengan fallback.

## Scope MVP

- KPI: monitored streams, live streams, problem streams, active alerts.
- Stream list dengan status text, icon, label, latest viewers, duration, last check.
- Active alerts dan recent events.
- Stream detail: metadata, active session, audience metrics, alerts, events, session history, dan Recent Comments feed.
- Stream detail: Recent Chat, Recent Likes, dan Recent Gifts contributor feeds.
- Responsive desktop/mobile layout.
- Status koneksi realtime dapat berupa connecting/open/retrying tanpa menggantikan status teknis stream.

## User Stories

- Sebagai operator, saya memahami kondisi semua stream dari satu halaman.
- Sebagai operator, saya dapat membuka stream bermasalah dengan cepat.
- Sebagai pengguna mobile, saya tetap dapat membaca status dan alert penting.

## Acceptance Criteria

- Active `CRITICAL` alert tampil paling menonjol dan menyediakan konteks/action.
- `UNKNOWN` tampil berbeda dari `OFFLINE` melalui text, icon, dan label; bukan warna saja.
- Timestamp last check dan last successful data selalu terlihat saat relevan.
- Dashboard tidak menampilkan data stream user lain.
- Detail stream menampilkan session aktif bila tersedia.
- Empty, loading, stale, error, dan no-data states tersedia.
- Layout usable pada desktop dan mobile tanpa kehilangan informasi kritis.
- Keyboard navigation, focus state, heading hierarchy, dan accessible labels tersedia.
- Reconnect native `EventSource`, `stream.ready`, atau `stream.resync` memicu REST refetch; UI tidak mengandalkan replay notifikasi yang terlewat.

## Dependency

- PRD-01 sampai PRD-05.

## Out of Scope

- Native mobile app, advanced analytics, customizable multi-tenant dashboards.
