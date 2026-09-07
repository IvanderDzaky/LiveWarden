# LiveWarden n8n Workflow

Import `livewarden-alert-discord.json` into n8n.

Repository JSON contains no credentials or secrets. Published local n8n workflow uses Data Table `livewarden_delivery_dedupe`; configure imported nodes to point to that table.

Manual configuration:

- Create Header Auth credential `LiveWarden Bearer` with header `Authorization` and value `Bearer <N8N_WEBHOOK_SECRET>`.
- Set n8n workflow concurrency to `1`.
- Create/select n8n Data Table `livewarden_delivery_dedupe` used by `Get Idempotency Marker`, `Mark Processing`, and `Mark Delivered`; lookup must filter by `idempotency_key`.
- Set `DISCORD_WEBHOOK_URL` in n8n environment. Keep URL out of workflow JSON.
- Activate workflow only after redacted smoke tests pass.

Data Table rows use `idempotency_key` plus `state: PROCESSING|DELIVERED`. A PROCESSING marker older than configured operational timeout must be deleted/requeued manually for this MVP workflow before retry. A crash between Discord acceptance and DELIVERED persistence can produce rare duplicate notification; external delivery remains at-least-once.

Production webhook path: `/webhook/livewarden-alert`. Verified event inputs: `ALERT_CREATED` WARNING/CRITICAL ACTIVE and `ALERT_RESOLVED` WARNING/CRITICAL RESOLVED with `resolvedAt`.

Workflow never calls LiveWarden state-mutating endpoints. Discord failure fails workflow execution, allowing Delivery Worker retry.
