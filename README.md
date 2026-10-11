# Budget Flow v9.4 — One-Month Budget Transfers

## New: move unused budget between categories (cloud synced, no new SQL)

- In **Budget → Categories** choose **Перенести** on a category with remaining funds, or select **+ Перенести остаток** in the new transfers panel.
- Choose another category in the **same Family or Business scope**, and enter an amount not exceeding the source's *unspent* allocation.
- Example: **Home Gas → Groceries: $4.00** in October. October Home Gas allocation falls by $4 and Groceries rises by $4; the total Family budget remains identical.
- Changes apply only to the currently selected month. November uses the unchanged normal monthly limits. October's transfer remains recorded when viewing October later.
- Transfers sync across devices using existing authenticated `budget_limits` rows, identified by an `xfer:` prefix. Supabase's existing RLS protects them; no schema change is required.
- **Отменить** deletes a transfer and restores that month's previous allocations.
- The Advisor respects deliberate decreases of a fixed-expense category instead of automatically reserving the reassigned money again based on historical bills.
- Transfers **do not** move bank money, change booked transactions, or change default category limits. No Plaid/API changes.

## Deploy
Unzip and upload all files to GitHub repo root (including `api/`). Vercel redeploys automatically. On iPhone, reload the installed PWA or reinstall its icon if the old cached UI persists.

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


## v9.3 — Predictive Budget Advisor
Analytics now includes a forward-looking advisor for the selected scope. It estimates month-end spend from current pace, protects remaining fixed-budget categories as a reserve, infers likely recurring-payment timing from prior months when enough history exists, calculates a safe flexible daily/weekly allowance, and surfaces 7–14 day category-specific slow-down recommendations. No new SQL is required.
