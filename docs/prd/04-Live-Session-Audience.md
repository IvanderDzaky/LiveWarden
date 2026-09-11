# PRD-04 — Live Session & Audience Intelligence

## Ringkasan

Mengubah periode stream aktif menjadi `Live Session`, mengumpulkan metrik audiens dan teks komentar, serta menghitung statistik agregat sesi.

## Status Implementasi

- **Status:** Complete MVP; retention and full-fidelity audience capture remain limited by design.
- **Metrik Audiens:** Viewer count diperoleh dari `ROOM_USER` event atau fallback room info; `peakViewers` dan `averageViewers` dihitung dan diperbarui secara berkala pada session aktif.
- **Komentar & Likes:** Event `CHAT` dan `LIKE` dikonsumsi persisten. Komentar menyimpan `username`, `displayName`, dan `text` dalam payload `COMMENT` event terikat session; event timestamp menjadi waktu komentar pada API.
- **Deduplikasi & Ingest:** Deduplikasi otomatis berbasis (username, displayName, text, occurredAt) pada tingkat collector dan event idempotency persistence.
- **API & UI:** Endpoint `GET /api/streams/:streamId` menyajikan `recentComments` (hingga 50 item, urut terbaru). Detail UI menampilkan feed komentar terkontrol tanpa dangling `@`.
- **Realtime UI:** Viewer, comment, dan like yang sudah dipersist memicu invalidasi SSE (`stream.viewer_count`, `stream.comment`, `stream.like`). UI melakukan REST refetch setelah debounce 150 ms; payload SSE bukan state otoritatif.
- **Audience contributors:** Like menyimpan user dan jumlah like; gift menyimpan user, gift ID/nama, repeat count, optional coin count, dan URL gambar dari provider (`gift.image.urlList` atau fallback payload). Gift streak dipersist hanya saat `repeatEnd` agar tidak terhitung ganda.
- **Comment retention:** Komentar memakai aggregate + bounded sample. Collector menahan maksimal 100 sample terbaru; detail API menampilkan maksimal 50. Total count tetap disimpan, tetapi sistem bukan arsip chat penuh.
- **Gift aggregates:** Session menyimpan jumlah gift events, total gift quantity, dan total gift coins bila seluruh event memiliki coin metadata; coin aggregate `null` berarti provider tidak memberi data reliable.

## Scope MVP

- Create session saat transition ke `LIVE`.
- Close session saat data valid menunjukkan offline.
- Simpan start/end, duration, final status.
- Simpan current viewers, peak viewers, total comments, total likes.
- Ingest teks komentar, username, display name, dan timestamp dengan deduplikasi. Persist hanya field comment yang dibutuhkan: `username`, `displayName`, `text`; content bersifat retention-sensitive.
- Simpan monitoring snapshots selama sesi.
- Hitung average viewers dan aggregate counters pada `live_sessions`.
- Hitung total event/alert terkait.
- Perbarui detail stream melalui SSE stream-scoped, dengan initial REST load dan fallback polling 120 detik.

## User Stories

- Sebagai streamer, saya dapat melihat sesi live aktif.
- Sebagai operator, saya dapat melihat tren viewer dan aktivitas audiens.
- Sebagai tim produksi, saya dapat membandingkan hasil sesi sebelumnya.

## Acceptance Criteria

- Satu live episode menghasilkan tepat satu session aktif per stream.
- Repeated `LIVE` checks tidak membuat session duplikat.
- Session tidak ditutup oleh `UNKNOWN` atau kegagalan pemeriksaan.
- Session ditutup idempotent setelah offline terverifikasi.
- Peak viewers adalah nilai maksimum snapshot valid.
- Metrik yang tidak tersedia ditampilkan sebagai unavailable, bukan angka palsu.
- Test mencakup create, update, close, duplicate prevention, aggregation, dan restart/retry.
- Like/gift contributor feed menampilkan identitas pengirim; gift image memakai URL provider dengan fallback.
- Kehilangan notifikasi realtime tidak mengubah hasil session atau aggregate; reconnect/resync mengambil ulang data REST.

## Retention

- Raw snapshots disimpan minimal 30 hari.
- Agregat session disimpan lebih lama sesuai kebijakan produk.
- Monitoring snapshots dihapus otomatis setelah 30 hari melalui worker hourly cleanup atau `npm run db:retention`.

## Dependency

- PRD-03.

## Out of Scope

- Prediksi perilaku audiens, sentiment real-time, rekomendasi otomatis berbasis model.
