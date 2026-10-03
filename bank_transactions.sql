-- Budget Flow v6: bank CSV review queue.
-- Run this once in Supabase -> SQL Editor before using CSV import.

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  external_id text not null,
  merchant text,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  transaction_date date not null,
  suggested_category text not null default 'other',
  suggested_budget_type text not null default 'family' check (suggested_budget_type in ('family','business')),
  status text not null default 'pending' check (status in ('pending','approved','ignored')),
  raw_data jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

alter table public.bank_transactions enable row level security;

drop policy if exists "users can read own bank transactions" on public.bank_transactions;
drop policy if exists "users can insert own bank transactions" on public.bank_transactions;
drop policy if exists "users can update own bank transactions" on public.bank_transactions;
drop policy if exists "users can delete own bank transactions" on public.bank_transactions;

create policy "users can read own bank transactions"
on public.bank_transactions for select to authenticated
using (auth.uid() = user_id);

create policy "users can insert own bank transactions"
on public.bank_transactions for insert to authenticated
with check (auth.uid() = user_id);

create policy "users can update own bank transactions"
on public.bank_transactions for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete own bank transactions"
on public.bank_transactions for delete to authenticated
using (auth.uid() = user_id);

-- Link an approved bank row to the expense it created. Nullable UNIQUE allows
-- manual expenses to keep using NULL while preventing duplicate bank approvals.
alter table public.expenses
  add column if not exists source_bank_transaction_id uuid references public.bank_transactions(id) on delete set null;

create unique index if not exists expenses_source_bank_transaction_id_key
  on public.expenses(source_bank_transaction_id);
