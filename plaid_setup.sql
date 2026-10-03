-- Budget Flow v7: secure Plaid connection storage.
-- Run once in Supabase -> SQL Editor.
-- Access tokens are intentionally server-only: no anon/authenticated policies are created.

create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  access_token text not null,
  institution_id text,
  institution_name text,
  cursor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

alter table public.plaid_items enable row level security;

-- Browser users must never be able to read Plaid access tokens.
revoke all on table public.plaid_items from anon, authenticated;

-- v6 tables are still used for the Review Queue.
-- Keep running bank_transactions.sql too if you have not already done so.
