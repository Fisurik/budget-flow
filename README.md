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
