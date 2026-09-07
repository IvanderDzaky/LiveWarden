# PRD-01 — Foundation & Authentication

## Ringkasan

Menyediakan akun, login, logout, authorization, database foundation, dan application shell untuk satu pemilik data stream.

## Tujuan

- Pengguna dapat mengakses aplikasi secara aman.
- Data setiap pengguna terisolasi.
- Tim dapat membangun fitur monitoring di atas fondasi konsisten.

## Scope MVP

- Register, login, logout.
- Session authentication dengan expiry dan invalidation.
- Password disimpan dalam bentuk hash.
- Authorization pada setiap resource milik user.
- PostgreSQL schema foundation dan migration.
- Basic authenticated application shell.

## User Stories

- Sebagai streamer, saya dapat membuat akun agar memiliki ruang data sendiri.
- Sebagai pengguna, saya dapat login dan logout.
- Sebagai pengguna, saya tidak dapat melihat atau mengubah stream milik akun lain.

## Acceptance Criteria

- Register menolak email/username duplikat dan input invalid.
- Login gagal dengan pesan generik untuk kredensial invalid.
- Logout menginvalidasi session aktif.
- Request tanpa session valid mendapat `401`.
- Resource milik user lain mendapat `404` atau `403` sesuai kebijakan API yang konsisten.
- Secret, password, dan token tidak masuk frontend atau repository.
- Test mencakup register, login, logout, authorization isolation, dan expiry.

## Non-functional

- Error autentikasi tidak membocorkan apakah akun tertentu ada.
- Audit log minimal mencatat login berhasil, login gagal, logout, dan authorization failure.

## Dependency

- PostgreSQL.
- Keputusan mekanisme session dan password hashing pada technical design.

## Out of Scope

- Organization, role kompleks, SSO, native mobile app.
