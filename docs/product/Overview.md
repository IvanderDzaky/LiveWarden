# Live Warden

## Overview

Live Warden adalah aplikasi livestream monitoring dan audience intelligence yang membantu streamer atau operator memantau kondisi TikTok LIVE dari satu dashboard.

Sistem mengumpulkan data livestream secara berkala, mencatat aktivitas audiens, mendeteksi kejadian penting, membuat peringatan, menjalankan workflow automation melalui n8n, serta menghasilkan ringkasan performa setelah sesi livestream selesai.

Live Warden dirancang sebagai pusat monitoring sehingga pengguna tidak perlu memeriksa kondisi livestream, aktivitas audiens, alert, dan riwayat sesi secara terpisah.

Dokumen ini menjadi Product Requirements Document (PRD) utama untuk pengembangan MVP Live Warden.

---

## 1. Masalah yang Diselesaikan

Selama livestream berlangsung, streamer atau operator perlu memperhatikan berbagai informasi secara bersamaan, seperti status livestream, jumlah penonton, aktivitas komentar, engagement, dan gangguan yang mungkin terjadi.

Informasi tersebut sering tersebar atau harus diperiksa secara manual sehingga beberapa masalah dapat terlambat diketahui.

Beberapa masalah utama yang ingin diselesaikan Live Warden:

- Kondisi livestream harus diperiksa secara manual.
- Perubahan jumlah penonton sulit dipantau secara konsisten.
- Lonjakan atau penurunan aktivitas audiens dapat terlewat.
- Gangguan livestream tidak memiliki riwayat terpusat.
- Tidak ada sistem alert yang memberikan konteks masalah.
- Data dari livestream sebelumnya sulit dibandingkan.
- Aktivitas penting selama livestream tidak terdokumentasi dengan baik.
- Tidak tersedia ringkasan otomatis setelah livestream selesai.

Live Warden memusatkan informasi tersebut dan memprioritaskan kondisi yang membutuhkan perhatian pengguna.

---

## 2. Tujuan Produk

Live Warden harus mampu:

- Memantau status TikTok LIVE.
- Membuat sesi monitoring otomatis ketika livestream terdeteksi.
- Mengumpulkan data aktivitas audiens yang tersedia.
- Menampilkan kondisi livestream melalui dashboard.
- Mendeteksi kejadian atau perubahan yang tidak normal.
- Membuat alert yang dapat ditindaklanjuti.
- Mengirim notifikasi melalui Discord.
- Menyimpan riwayat livestream dan event penting.
- Menampilkan statistik setiap sesi livestream.
- Menghasilkan insight dan ringkasan sesi menggunakan AI.
- Menjalankan workflow automation menggunakan n8n.

Tujuan utama MVP adalah membangun sistem monitoring yang stabil dan dapat dipercaya sebelum memperluas integrasi ke platform atau fitur lain.

---

## 3. Pengguna Sasaran

### 3.1 Streamer Individu

Streamer yang ingin memantau kondisi livestream dan aktivitas audiens tanpa harus memperhatikan berbagai sumber data secara manual.

### 3.2 Operator atau Moderator

Pengguna yang bertugas mengawasi livestream dan membutuhkan informasi mengenai gangguan atau perubahan aktivitas secara cepat.

### 3.3 Tim Produksi

Tim yang membutuhkan riwayat teknis dan performa livestream untuk evaluasi setelah sesi selesai.

Untuk MVP, sistem tidak memerlukan manajemen organisasi atau role yang kompleks. Setiap akun bertindak sebagai pemilik data stream yang ditambahkan.

---

## 4. Platform MVP

Platform livestream pertama yang didukung adalah:

**TikTok LIVE**

Live Warden menggunakan data livestream yang tersedia dan dapat diakses oleh sistem untuk melakukan monitoring.

Integrasi platform lain seperti YouTube Live, Twitch, atau platform streaming lainnya berada di luar scope MVP.

Arsitektur aplikasi tetap dirancang agar integrasi platform tambahan dapat dilakukan pada pengembangan berikutnya.

---

## 5. Ruang Lingkup MVP

### 5.1 Autentikasi

Pengguna dapat:

- Membuat akun.
- Masuk ke aplikasi.
- Keluar dari aplikasi.
- Mengakses data miliknya secara aman.

Data stream dan monitoring setiap pengguna harus terisolasi dari pengguna lain.

---

### 5.2 Manajemen Stream

Pengguna dapat menambahkan akun atau channel TikTok yang ingin dipantau.

Setiap stream minimal memiliki:

- Nama stream.
- Username atau identifier TikTok.
- Platform.
- Status monitoring.
- Status stream terakhir.
- Waktu pemeriksaan terakhir.
- Waktu data terakhir berhasil diperoleh.
- Tanggal stream ditambahkan.

Pengguna dapat:

- Menambahkan stream.
- Melihat daftar stream.
- Mengaktifkan atau menonaktifkan monitoring.
- Membuka detail stream.
- Menghapus stream.

Sistem harus melakukan validasi sebelum stream mulai dipantau.

---

## 6. Live Session

Live Session merepresentasikan satu kejadian livestream.

`Stream` dan `Live Session` merupakan entitas yang berbeda.

Contoh:

```text
Stream
└── @creator

Live Sessions
    ├── Session #001
    ├── Session #002
    └── Session #003
```

Ketika Live Warden mendeteksi stream mulai aktif, sistem membuat Live Session baru.

Ketika livestream selesai, session ditutup dan statistik akhirnya dihitung.

Setiap Live Session minimal menyimpan:

- Stream terkait.
- Waktu mulai.
- Waktu selesai.
- Durasi.
- Peak viewers.
- Average viewers jika data memungkinkan.
- Total komentar.
- Total likes.
- Total gifts jika tersedia.
- Jumlah alert.
- Jumlah event penting.
- Status akhir session.
- AI summary jika tersedia.

Live Session menjadi dasar untuk history dan analisis performa livestream.

---

## 7. Dashboard

Dashboard merupakan halaman utama Live Warden.

Dashboard harus memberikan gambaran kondisi sistem tanpa membutuhkan navigasi berlebihan.

Dashboard menampilkan:

- Jumlah stream yang dipantau.
- Jumlah stream yang sedang live.
- Jumlah stream bermasalah.
- Jumlah alert aktif.
- Daftar stream.
- Status setiap stream.
- Durasi livestream aktif.
- Jumlah viewers terbaru.
- Waktu pemeriksaan terakhir.
- Event terbaru.
- Alert aktif.

Informasi yang membutuhkan tindakan harus memiliki prioritas visual tertinggi.

Status tidak boleh dibedakan hanya menggunakan warna.

---

## 8. Detail Stream

Halaman detail stream memberikan informasi lengkap mengenai satu channel.

Informasi yang ditampilkan meliputi:

- Nama channel.
- Username.
- Platform.
- Status monitoring.
- Status livestream.
- Waktu pemeriksaan terakhir.
- Live Session aktif jika tersedia.
- Statistik livestream.
- Aktivitas audiens.
- Alert aktif.
- Recent events.
- Riwayat Live Session.

Jika stream sedang aktif, halaman harus menampilkan data Live Session yang sedang berlangsung.

---

## 9. Monitoring

Live Warden melakukan monitoring stream secara berkala.

Monitoring bertanggung jawab untuk:

- Mengetahui apakah stream sedang live.
- Memperbarui data livestream.
- Mengambil statistik yang tersedia.
- Menyimpan snapshot monitoring.
- Mendeteksi perubahan status.
- Membuat event.
- Menjalankan rule alert.
- Memperbarui Live Session.

Interval monitoring awal:

**30–60 detik**

Interval dapat disesuaikan berdasarkan batas platform, stabilitas integrasi, dan kebutuhan sistem.

Monitoring harus membedakan:

- Stream tidak aktif.
- Stream aktif.
- Stream bermasalah.
- Pemeriksaan gagal.
- Integrasi terputus.

Kegagalan mengambil data tidak boleh langsung dianggap sebagai stream offline.

Sistem harus tetap menampilkan data terakhir yang berhasil diperoleh beserta waktunya.

---

## 10. Model Status Stream

| Status         | Arti                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| `LIVE`         | Stream terdeteksi aktif dan berjalan normal.                                             |
| `OFFLINE`      | Stream tidak sedang melakukan livestream.                                                |
| `DEGRADED`     | Stream aktif tetapi terdapat kondisi yang membutuhkan perhatian.                         |
| `UNKNOWN`      | Kondisi stream tidak dapat ditentukan karena data tidak tersedia atau pemeriksaan gagal. |
| `DISCONNECTED` | Integrasi atau sumber monitoring tidak dapat digunakan.                                  |

`UNKNOWN` tidak boleh diperlakukan sebagai `OFFLINE`.

---

## 11. Audience Intelligence

Ketika livestream aktif, Live Warden mengumpulkan metrik audiens yang tersedia.

Metrik dapat mencakup:

- Current viewers.
- Peak viewers.
- Viewer trend.
- Comments.
- Comment rate.
- Likes.
- Like activity.
- Gifts jika tersedia.
- Engagement events.

Data digunakan untuk membantu pengguna memahami perubahan aktivitas selama livestream.

MVP tidak bertujuan melakukan prediksi perilaku audiens.

Audience intelligence pada MVP berfokus pada:

- Monitoring.
- Trend sederhana.
- Deteksi perubahan.
- Identifikasi key moments.
- Ringkasan setelah livestream.

---

## 12. Event Detection

Live Warden mencatat kejadian penting selama livestream.

Contoh event:

- Stream started.
- Stream ended.
- Viewer spike.
- Viewer drop.
- Comment activity spike.
- Gift activity spike.
- Monitoring failure.
- Monitoring recovered.
- Connection lost.
- Connection recovered.

Event minimal memiliki:

- Jenis event.
- Stream.
- Live Session.
- Waktu kejadian.
- Nilai terkait jika tersedia.
- Metadata tambahan.

Event tidak selalu menghasilkan alert.

Event digunakan sebagai timeline aktivitas livestream.

---

## 13. Alert Engine

Alert dibuat ketika kondisi tertentu membutuhkan perhatian pengguna.

Contoh:

- Stream berhenti secara tidak terduga.
- Monitoring gagal berulang kali.
- Koneksi ke sumber data terputus.
- Viewer count turun secara signifikan.
- Nilai tertentu melewati threshold.
- Sistem tidak menerima data dalam periode tertentu.

Setiap alert memiliki:

- Jenis masalah.
- Severity.
- Stream terkait.
- Live Session terkait.
- Waktu mulai.
- Waktu selesai.
- Status.
- Detail masalah.
- Nilai pemicu.
- Tindakan yang disarankan.

Sistem harus mencegah alert duplikat untuk masalah yang sama.

---

## 14. Severity Alert

| Severity   | Penggunaan                                                      |
| ---------- | --------------------------------------------------------------- |
| `INFO`     | Informasi penting tetapi tidak membutuhkan tindakan segera.     |
| `WARNING`  | Kondisi yang berpotensi menjadi masalah dan perlu diperhatikan. |
| `CRITICAL` | Gangguan yang membutuhkan tindakan segera.                      |

---

## 15. Status Alert

| Status         | Arti                                                   |
| -------------- | ------------------------------------------------------ |
| `ACTIVE`       | Masalah masih terdeteksi.                              |
| `ACKNOWLEDGED` | Pengguna telah melihat atau mengakui masalah.          |
| `RESOLVED`     | Kondisi yang menyebabkan alert sudah tidak terdeteksi. |

Alert tetap tersimpan setelah `RESOLVED`.

---

## 16. Alert Acknowledgement

Pengguna dapat mengakui alert.

Acknowledgement digunakan untuk menandai bahwa alert telah dilihat atau sedang ditangani.

Sistem minimal menyimpan:

- User yang melakukan acknowledgement.
- Waktu acknowledgement.
- Catatan opsional.

Acknowledgement tidak mengubah kondisi teknis stream.

---

## 17. Discord Notification

Discord menjadi kanal notifikasi eksternal utama pada MVP.

Notifikasi dapat dikirim ketika:

- Stream mulai live.
- Stream berhenti.
- Alert WARNING dibuat.
- Alert CRITICAL dibuat.
- Kondisi CRITICAL kembali normal.
- Live Session selesai.

Notifikasi harus berisi konteks yang cukup agar pengguna memahami kejadian tanpa harus langsung membuka dashboard.

Contoh informasi:

```text
Live Warden Alert

Stream: @creator
Severity: CRITICAL
Issue: Monitoring connection lost
Started: 21:42

Last successful check:
21:40

Suggested Action:
Check TikTok LIVE status and monitoring connection.
```

---

## 18. Automation dengan n8n

n8n digunakan sebagai workflow automation layer Live Warden.

n8n tidak menggantikan business logic utama aplikasi.

Core monitoring, penyimpanan data, status, dan alert tetap dikelola oleh backend Live Warden.

n8n digunakan untuk workflow seperti:

```text
Alert Created
      ↓
n8n Webhook
      ↓
Filter Severity
      ↓
Format Notification
      ↓
Discord
```

dan:

```text
Live Session Ended
      ↓
n8n
      ↓
Prepare Session Data
      ↓
AI Analysis
      ↓
Store Summary
      ↓
Discord Summary
```

Workflow automation harus dapat gagal tanpa menghentikan proses monitoring utama.

---

## 19. AI Insight

Live Warden menggunakan Gemini untuk menghasilkan ringkasan setelah Live Session selesai.

AI dapat menggunakan data seperti:

- Durasi livestream.
- Viewer trend.
- Peak viewers.
- Aktivitas komentar.
- Aktivitas likes.
- Gifts jika tersedia.
- Event penting.
- Alert.
- Timeline session.

AI dapat menghasilkan:

- Session summary.
- Key moments.
- Ringkasan perubahan audience.
- Masalah yang terjadi.
- Insight sederhana.
- Rekomendasi evaluasi.

AI tidak menentukan status teknis utama stream.

Status dan alert harus tetap berasal dari rule dan data yang dapat diverifikasi.

Kegagalan AI tidak boleh menyebabkan monitoring atau session processing gagal.

---

## 20. Session Report

Setelah livestream selesai, pengguna dapat membuka laporan Live Session.

Laporan minimal menampilkan:

- Waktu mulai.
- Waktu selesai.
- Durasi.
- Peak viewers.
- Average viewers jika tersedia.
- Total comments.
- Total likes.
- Total gifts jika tersedia.
- Jumlah event.
- Jumlah alert.
- Timeline key moments.
- AI summary.

Session Report menjadi bagian utama dari riwayat Live Warden.

---

## 21. History

Live Warden menyimpan riwayat untuk membantu pengguna mengevaluasi livestream sebelumnya.

History mencakup:

- Live Sessions.
- Monitoring events.
- Alerts.
- Audience metrics.
- AI summaries.

Pengguna dapat membuka session sebelumnya dan melihat detail performanya.

Untuk MVP, raw monitoring data disimpan selama:

**30 hari**

Data agregat Live Session, alert, dan event penting dapat disimpan lebih lama.

---

## 22. Ringkasan Performa

Live Warden menyediakan statistik dasar berdasarkan Live Session.

Statistik dapat mencakup:

- Total Live Sessions.
- Total durasi livestream.
- Average duration.
- Average viewers.
- Highest peak viewers.
- Total comments.
- Total likes.
- Total alerts.
- Total gangguan.
- Uptime monitoring.

Analitik lanjutan dan predictive analytics berada di luar scope MVP.

---

## 23. Alur Utama Sistem

### Menambahkan Stream

```text
User
 ↓
Add TikTok Stream
 ↓
Validate Stream
 ↓
Save Stream
 ↓
Enable Monitoring
```

### Livestream Dimulai

```text
Monitoring
 ↓
LIVE Detected
 ↓
Create Live Session
 ↓
Create STREAM_STARTED Event
 ↓
Start Audience Monitoring
 ↓
Trigger Automation
```

### Monitoring Berjalan

```text
Fetch Stream Data
 ↓
Validate Data
 ↓
Store Snapshot
 ↓
Update Session
 ↓
Detect Events
 ↓
Evaluate Alert Rules
 ↓
Update Dashboard
```

### Masalah Terdeteksi

```text
Condition Detected
 ↓
Create Event
 ↓
Evaluate Severity
 ↓
Create Alert
 ↓
Trigger n8n
 ↓
Discord Notification
```

### Livestream Selesai

```text
OFFLINE Detected
 ↓
Close Live Session
 ↓
Calculate Aggregates
 ↓
Generate Session Metrics
 ↓
Trigger n8n
 ↓
Gemini Analysis
 ↓
Store AI Summary
 ↓
Send Discord Summary
```

---

## 24. Reliability

Monitoring merupakan fungsi utama Live Warden sehingga harus tetap berjalan meskipun layanan tambahan mengalami gangguan.

Sistem harus menangani:

- API timeout.
- Rate limiting.
- Network error.
- Invalid response.
- External service unavailable.
- Database error.
- n8n unavailable.
- Gemini unavailable.
- Discord unavailable.

Sistem harus menerapkan mekanisme yang sesuai seperti:

- Retry.
- Timeout.
- Backoff.
- Error logging.
- Last successful state.
- Alert deduplication.

Kegagalan Discord, Gemini, atau n8n tidak boleh menghentikan monitoring stream.

---

## 25. Security

Live Warden harus melindungi:

- User credentials.
- Session authentication.
- Platform credentials jika digunakan.
- Webhook credentials.
- API keys.
- Discord webhook.
- Gemini API key.

Secret tidak boleh disimpan di frontend atau source code repository.

Setiap request yang mengakses data pengguna harus melalui authorization.

---

## 26. Accessibility

Dashboard harus tetap dapat dipahami tanpa mengandalkan warna.

Status harus menggunakan kombinasi:

- Text.
- Icon.
- Label.
- Warna sebagai indikator tambahan.

Interface harus dapat digunakan pada desktop maupun perangkat mobile.

---

## 27. Observability

Live Warden harus memiliki logging untuk proses penting.

Minimal mencatat:

- Monitoring execution.
- Monitoring failure.
- Status transition.
- Session creation.
- Session completion.
- Event creation.
- Alert creation.
- Alert resolution.
- Automation failure.
- AI processing failure.

Logging digunakan untuk debugging dan evaluasi reliability sistem.

---

## 28. Di Luar Scope MVP

Fitur berikut tidak menjadi kebutuhan wajib MVP:

- Multi-platform streaming.
- YouTube Live.
- Twitch.
- Predictive analytics.
- Automatic moderation.
- Automatic action terhadap akun TikTok.
- Analisis sentimen komentar secara real-time.
- Sistem organisasi kompleks.
- Multi-role permission kompleks.
- Mobile application native.
- Notifikasi WhatsApp.
- Notifikasi Telegram.
- Production scheduling.
- AI chatbot.
- AI sebagai penentu status stream.

Fitur tersebut dapat dipertimbangkan setelah sistem monitoring utama stabil.

---

## 29. Kriteria Penerimaan MVP

MVP Live Warden dianggap siap ketika pengguna dapat:

- Membuat akun.
- Login dan logout.
- Menambahkan TikTok stream.
- Menghapus stream.
- Mengaktifkan dan menonaktifkan monitoring.
- Melihat status stream terbaru.
- Melihat waktu pemeriksaan terakhir.
- Mengetahui apakah data monitoring masih valid.
- Melihat Live Session aktif.
- Melihat statistik audience yang tersedia.
- Melihat event penting.
- Menerima alert.
- Mengakui alert.
- Menerima notifikasi Discord.
- Melihat riwayat Live Session.
- Membuka Session Report.
- Melihat ringkasan performa.
- Melihat AI summary setelah livestream selesai.

Sistem juga harus:

- Membedakan `OFFLINE` dan `UNKNOWN`.
- Menyimpan data terakhir yang berhasil diperoleh.
- Mencegah alert duplikat.
- Menangani timeout dan external service failure.
- Melindungi credentials dan API key.
- Memiliki pengujian untuk monitoring, status transition, Live Session, dan alert generation.

---

## 30. Tahapan Pengembangan

### Phase 1 — Foundation

- Project structure.
- Database.
- Authentication.
- User management.
- Basic dashboard layout.

### Phase 2 — TikTok Integration

- TikTok LIVE data collector.
- Stream validation.
- Stream management.
- Monitoring service.
- Stream status model.

### Phase 3 — Live Session

- Session detection.
- Session lifecycle.
- Monitoring snapshots.
- Audience metrics.
- Session statistics.

### Phase 4 — Events & Alerts

- Event detection.
- Alert rules.
- Severity.
- Alert lifecycle.
- Acknowledgement.
- Alert deduplication.

### Phase 5 — Dashboard

- Monitoring overview.
- Stream detail.
- Active session.
- Audience metrics.
- Event timeline.
- Alert interface.

### Phase 6 — Automation

- n8n integration.
- Webhook events.
- Discord notifications.
- Retry and failure handling.

### Phase 7 — Intelligence

- Session aggregation.
- Gemini integration.
- AI summary.
- Key moments.
- Session Report.

### Phase 8 — Hardening

- Error handling.
- Logging.
- Security review.
- Testing.
- Performance optimization.
- Responsive interface.
- Documentation.

---

## 31. Teknologi Utama

Stack awal Live Warden:

```text
Frontend
└── Next.js
    ├── TypeScript
    └── Tailwind CSS

Backend
└── API / Monitoring Service

Database
└── PostgreSQL

Automation
└── n8n

AI
└── Gemini

Notification
└── Discord

Infrastructure
└── Docker
```

Pemilihan framework backend dan mekanisme TikTok LIVE collector ditentukan pada tahap technical design.

---

## 32. Prinsip Arsitektur

Live Warden mengikuti beberapa prinsip utama:

### Monitoring First

Monitoring merupakan fungsi utama dan tidak boleh bergantung pada AI atau layanan notifikasi.

### Event Driven

Perubahan penting direpresentasikan sebagai event yang dapat digunakan oleh alert, automation, dan analytics.

### Historical by Default

Perubahan penting disimpan sehingga kondisi sebelumnya dapat ditelusuri.

### AI as Enhancement

AI digunakan untuk membantu interpretasi data, bukan sebagai sumber kebenaran status sistem.

### Automation as Integration Layer

n8n menangani workflow dan integrasi eksternal tanpa mengambil alih core business logic.

### Failure Isolation

Kegagalan satu layanan tidak boleh menyebabkan seluruh monitoring berhenti.

### Actionable Information

Dashboard harus memprioritaskan informasi yang membutuhkan tindakan pengguna.

---

## 33. Keputusan MVP

Keputusan awal untuk implementasi:

| Area                | Keputusan                                          |
| ------------------- | -------------------------------------------------- |
| Platform            | TikTok LIVE                                        |
| Frontend            | Next.js + TypeScript + Tailwind CSS                |
| Database            | PostgreSQL                                         |
| Automation          | n8n                                                |
| AI                  | Gemini                                             |
| Notification        | Discord                                            |
| Infrastructure      | Docker                                             |
| Monitoring Interval | 30–60 detik                                        |
| Raw Data Retention  | 30 hari                                            |
| User Model          | Single owner                                       |
| Alert Severity      | INFO / WARNING / CRITICAL                          |
| Stream Status       | LIVE / OFFLINE / DEGRADED / UNKNOWN / DISCONNECTED |

---

## 34. Keputusan Teknis Terbuka

Beberapa keputusan harus ditentukan pada tahap technical design:

- Library atau metode pengambilan data TikTok LIVE.
- Framework backend.
- Arsitektur monitoring worker.
- Mekanisme scheduler.
- Strategi retry dan backoff.
- Threshold viewer spike.
- Threshold viewer drop.
- Threshold monitoring failure.
- Struktur penyimpanan audience metrics.
- Strategi agregasi metrics.
- Mekanisme komunikasi backend dengan n8n.
- Format event internal.
- Mekanisme real-time update dashboard.
- Deployment environment.
- Backup database.
- Batas maksimum stream per user.

Keputusan tersebut harus dibuat berdasarkan hasil prototype integrasi TikTok LIVE dan kebutuhan reliability sistem.

---

## 35. Definisi Keberhasilan MVP

Live Warden MVP berhasil apabila sistem dapat menjalankan satu siklus livestream secara lengkap:

```text
TikTok Stream
      ↓
Stream Detected
      ↓
Live Session Created
      ↓
Monitoring Running
      ↓
Audience Data Collected
      ↓
Events Detected
      ↓
Alerts Generated
      ↓
Discord Notification
      ↓
Stream Ended
      ↓
Session Aggregated
      ↓
AI Summary Generated
      ↓
Session Report Available
```

Keberhasilan MVP tidak diukur dari jumlah fitur atau platform yang didukung.

Prioritas utama adalah memastikan seluruh lifecycle monitoring tersebut berjalan secara stabil, dapat ditelusuri, dan menghasilkan informasi yang berguna bagi pengguna.
