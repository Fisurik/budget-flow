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
