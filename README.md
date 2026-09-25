# Budget Flow v3

Cloud-enabled PWA budget tracker using Supabase Auth + Postgres.

## Features
- Email/password sign-up and login
- Per-user RLS-backed cloud expenses
- Sync across devices
- One-time migration of old local expenses
- Family / Business scopes
- Multi-expense parsing
- Edit/delete transactions

## Deploy
Upload the files in this folder to the root of the GitHub repository. Vercel will redeploy automatically.

If an older PWA is cached, hard-refresh or remove/re-add the Home Screen app after deployment.


## v3.1 auth fix
- Magic-link login by email.
- Password reset flow.
- Password recovery dialog.
- New service-worker cache version for mobile updates.
