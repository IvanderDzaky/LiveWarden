# PRD-02 — Stream Management

## Ringkasan

Memungkinkan pengguna menambahkan dan mengelola channel TikTok LIVE yang dipantau.

## Scope MVP

- Add stream dengan nama, username/identifier, platform.
- Validasi channel sebelum monitoring aktif.
- List stream milik user.
- Enable/disable monitoring.
- Detail stream.
- Delete stream dengan konfirmasi.
- Metadata status terakhir, last check, last successful data.

## User Stories

- Sebagai pengguna, saya dapat menambahkan `@creator` agar dipantau.
- Sebagai pengguna, saya dapat menonaktifkan monitoring tanpa menghapus riwayat.
- Sebagai pengguna, saya dapat menghapus stream yang tidak lagi diperlukan.

## Acceptance Criteria

- MVP hanya menerima platform `TikTok LIVE`.
- Identifier dinormalisasi konsisten, misalnya leading `@` tidak menggandakan nilai.
- Stream invalid tidak tersimpan sebagai stream aktif.
- Stream baru memiliki status monitoring yang jelas.
- Toggle monitoring idempotent dan tercermin pada list/detail.
- Delete hanya menghapus stream milik user dan kebijakan riwayat dinyatakan eksplisit.
- Stream user lain tidak muncul pada list, detail, update, atau delete.
- Test mencakup validation, CRUD authorization, toggle, dan duplicate stream.

## Dependency

- PRD-01.
- TikTok collector/validation capability.

## Out of Scope

- YouTube Live, Twitch, multi-platform, organization sharing, bulk import.
