# Budget Flow v7 — Plaid Sandbox

Budget Flow now supports Plaid Link + Transactions Sync. Bank transactions are never added directly to the budget: posted outflows go to the existing Review Transactions queue first.

## 1) Supabase
Run these SQL files once in Supabase SQL Editor:

1. `bank_transactions.sql` (if you have not already run it)
2. `budget_limits.sql` (if you use cloud limits and have not already run it)
3. `plaid_setup.sql` (new for v7)

`plaid_items` intentionally has no browser RLS policies and its table privileges are revoked from `anon` and `authenticated`, because it stores Plaid access tokens.

## 2) Vercel environment variables
Already configured:

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV=sandbox`

Add one more server-only variable:

- `SUPABASE_SECRET_KEY` = a Supabase **Secret key** (`sb_secret_...`) from Supabase → Settings → API Keys.

Do NOT use the publishable key for this variable, and never put the secret key in `app.js`, GitHub, or browser code.

The project URL and publishable key are already known by this app. Optional server overrides are supported with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.

After adding the secret, redeploy Vercel.

## 3) Deploy
Upload the contents of this folder to the root of the GitHub repo, including the new `api/` folder and `package.json`. Vercel will deploy the static app and `/api/*` serverless functions together.

## 4) Test Sandbox
1. Sign into Budget Flow.
2. Click **Connect Bank**.
3. Complete Plaid Sandbox Link using the test institution/credentials shown by Plaid.
4. After Link succeeds, Budget Flow exchanges the public token on the Vercel backend and stores the Plaid access token only in the server-only `plaid_items` table.
5. Click **Sync Bank** if transactions do not appear immediately.
6. Posted outflows appear in **Review Transactions**. Approve or Ignore them as before.

## API routes
- `POST /api/plaid-link-token`
- `POST /api/plaid-exchange`
- `POST /api/plaid-sync`
- `GET /api/plaid-status`

All routes require the signed-in Supabase user's session JWT. Plaid credentials and Supabase secret stay on the Vercel server.

## Notes
- v7 requests 30 days of history from Plaid but, on the very first sync, only puts **current-month** posted outflows into Review Queue. Later syncs use the Plaid cursor and import only new changes.
- Pending transactions are not put into Review Queue; only posted outflows are imported.
- Plaid `/transactions/sync` cursor is persisted per Item to avoid importing the same update repeatedly.
- Plaid transaction IDs are used as stable external IDs; existing Review Queue uniqueness prevents duplicate imports.
- CSV import remains available as a fallback.
