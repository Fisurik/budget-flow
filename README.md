# Budget Flow v8.4 — Hard-isolated tabs

Fixes tab content leaking/repeating across Review, Budget, History, and Analytics.

- Review: only review queue
- Budget: only budget summary, quick entry, categories
- History: only monthly transaction history
- Analytics: only Monthly Explorer, charts, category table, archive and insights
- Cache-busted CSS/JS and updated service worker to avoid iPhone Safari serving mixed old/new assets.

No Supabase schema changes required.
