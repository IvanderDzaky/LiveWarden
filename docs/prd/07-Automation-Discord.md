# PRD-07 — Automation & Discord Notification

## Ringkasan

Mengirim event bisnis terpilih ke n8n untuk workflow eksternal dan menyediakan Discord sebagai kanal notifikasi MVP.

## Scope MVP

- Webhook event untuk stream started/ended, WARNING/CRITICAL alert, critical recovery, session ended.
- Payload versioned dengan event ID, timestamp, stream/session context, severity, detail, suggested action.
- n8n workflow filter dan format notification.
- Discord notification dengan konteks cukup untuk bertindak tanpa membuka dashboard.
- Retry, timeout, logging, dan failure isolation.

## User Stories

- Sebagai operator, saya menerima notifikasi Discord saat masalah kritis terjadi.
- Sebagai pemilik stream, saya menerima ringkasan ketika session selesai.
- Sebagai sistem, saya tetap memonitor walau n8n atau Discord unavailable.

## Acceptance Criteria

- Webhook delivery tidak memblokir monitoring atau session lifecycle.
- Timeout dan retry memiliki batas; failure dicatat untuk diagnosis.
- Payload tidak memuat password, API key, atau secret.
- Duplicate delivery dapat dikenali melalui event ID/idempotency key.
- Discord message memuat stream, severity, issue, waktu, last successful check, suggested action.
- Recovery notification hanya dikirim setelah kondisi critical benar-benar pulih.
- Session completion creates one idempotent `SESSION_ENDED` delivery intent for N8N.
- Test mencakup payload contract, timeout, retry, duplicate, dan external-service failure.

## Dependency

- PRD-03, PRD-05.
- n8n instance, Discord webhook.

## Out of Scope

- WhatsApp, Telegram, email, automatic action terhadap TikTok account.
