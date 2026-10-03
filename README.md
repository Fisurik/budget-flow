# Budget Flow v7 — Plaid Production

Budget Flow now connects directly to a real bank through Plaid Production. Posted bank outflows never go straight into the budget: they first appear in **Review Transactions**, where you choose Family/Business and the category, then Approve or Ignore. CSV import remains available as a fallback.

## 1) Supabase SQL
Run these files once in Supabase → SQL Editor:

1. `bank_transactions.sql` (already done if v6 worked)
2. `budget_limits.sql` (already done if cloud limits worked)
3. `plaid_setup.sql` (**new for v7**)

`plaid_items` stores Plaid access tokens. Browser roles have no permission to read it.

## 2) Vercel Environment Variables
In Vercel → Project → Settings → Environment Variables, set for Production:

- `PLAID_CLIENT_ID` = Plaid Production Client ID
- `PLAID_SECRET` = Plaid Production Secret
- `PLAID_ENV` = `production`
- `SUPABASE_SECRET_KEY` = Supabase **Secret key** (`sb_secret_...`) from Supabase → Settings → API Keys

Optional server overrides:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Never put `PLAID_SECRET` or `SUPABASE_SECRET_KEY` in `app.js`, GitHub, screenshots, or chat. After adding/changing Vercel environment variables, redeploy the project.

## 3) Deploy
Upload **all contents of this folder** to the root of the GitHub repository, including:

- `api/`
- `package.json`
- normal web files (`index.html`, `app.js`, etc.)

Vercel will deploy the static app and `/api/*` serverless functions together.

## 4) Connect the real bank
1. Sign in to Budget Flow.
2. Click **Connect Bank**.
3. Complete the real Plaid/Bank of America flow.
4. The Vercel backend exchanges the temporary public token for a Plaid access token and stores it in the server-only `plaid_items` table.
5. Budget Flow starts `/transactions/sync`. On the first connection, it only puts **current-month posted outflows** into Review Queue, so connecting in October will not flood the queue with previous months.
6. Review each operation, choose Family/Business + category, and Approve or Ignore.
7. On later app opens, Budget Flow syncs again and only receives changes after the saved Plaid cursor. You can also press **Sync Bank** manually.

## API routes
- `POST /api/plaid-link-token`
- `POST /api/plaid-exchange`
- `POST /api/plaid-sync`
- `GET /api/plaid-status`

Every route requires the signed-in Supabase user's session JWT. Plaid credentials, Plaid access tokens, and the Supabase secret key stay server-side.

## Transaction behavior
- Only posted outflows are sent to Review Queue.
- Incoming transfers/income are not imported as expenses.
- Pending charges wait until posted.
- Plaid transaction IDs prevent duplicate imports.
- Modified/removed pending bank transactions are reconciled on later syncs.
- `/transactions/sync` cursor is stored per connected bank Item.
