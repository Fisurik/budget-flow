# Budget Flow v8 — Monthly Explorer

Builds on v7 Production (Plaid + Supabase + Review Queue).

## New in v8
- Monthly Explorer with month picker
- Family / Business / All report scope
- KPI cards: spent, transaction count, average active-day spend, remaining/largest expense
- Daily spending bar chart
- Category report table with Budget / Spent / Left / Usage
- 12-month clickable archive
- Detailed transaction table with search and sorting
- Table / grouped-by-day history views
- Export selected month to CSV
- No new Supabase tables or SQL migration required

## Deploy
Upload all files and folders in this project to the root of the GitHub repository used by Vercel, then commit. Keep existing Vercel environment variables from v7.

If the PWA shows an older version, refresh once or reopen the site; the service worker cache key is bumped for v8.

## v8.1 — pending transactions count immediately
Plaid pending outflows are now imported into Review Queue immediately. Once approved, they count in the budget right away. When Plaid later replaces a pending transaction with its posted version, Budget Flow reconciles it to the same bank row/expense using `pending_transaction_id` so it does not create a duplicate. If the final posted amount changes, the linked approved expense amount/date are reconciled automatically.
