# Budget Flow v9.2 — Fast Bank Refresh

Adds near-on-demand bank freshness on top of v9.1.

## New in v9.2
- `Refresh Bank` calls Plaid `/transactions/refresh`
- Plaid webhook endpoint: `/api/plaid-webhook`
- `SYNC_UPDATES_AVAILABLE` automatically runs `/transactions/sync` server-side
- Existing Plaid Items get their webhook URL updated when Refresh is used
- New Plaid Items receive the webhook URL during Link setup
- UI shows the bank's `last_successful_update` time from `/item/get`
- Refresh polls briefly so new pending/posted transactions can appear in Review without waiting for the next manual sync

No Supabase schema migration is required.

### Plaid requirement
`/transactions/refresh` is a Plaid Transactions Refresh add-on. If the button returns an access/product error, enable the add-on in Plaid before retrying.

### Optional webhook hardening
Set `PLAID_WEBHOOK_SECRET` in Vercel to any long random value. Budget Flow includes it in the webhook URL and rejects webhook calls without it.

# Budget Flow v9 — Dashboard

Stable v8.4 tabs plus a new monthly dashboard.

## New in v9
- Family and Business summary cards on the Dashboard
- Budget / Spent / Left at a glance
- Top spending categories
- Compact day-by-day spending trend
- Review badge and quick navigation
- Smart start: pending bank transactions open Review; otherwise Dashboard
- Existing Review, History, Analytics, Plaid, Supabase, limits and CSV flows remain intact

No new SQL migrations are required if v8.4 is already working.

Deploy by uploading all files (including `api/`) to the repository root and committing.

# Budget Flow v8.4 — Hard-isolated tabs

Fixes tab content leaking/repeating across Review, Budget, History, and Analytics.

- Review: only review queue
- Budget: only budget summary, quick entry, categories
- History: only monthly transaction history
- Analytics: only Monthly Explorer, charts, category table, archive and insights
- Cache-busted CSS/JS and updated service worker to avoid iPhone Safari serving mixed old/new assets.

No Supabase schema changes required.

## v9.1 — Project Notebook

Added a fifth `Project` tab so the project context is available inside Budget Flow instead of requiring the original ChatGPT thread.

It contains:
- architecture and data flow;
- non-negotiable behavior rules;
- Vercel environment variable names (never secret values);
- Supabase SQL/file map;
- v1 → v9.1 changelog;
- deployment/smoke-test checklist;
- copy/export context for starting a fresh ChatGPT chat;
- device-local editable project notes.
