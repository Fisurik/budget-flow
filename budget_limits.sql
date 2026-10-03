create table if not exists budget_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  category text not null,
  amount numeric(10,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, category)
);

alter table budget_limits enable row level security;

drop policy if exists "users can read own budget limits" on budget_limits;
drop policy if exists "users can insert own budget limits" on budget_limits;
drop policy if exists "users can update own budget limits" on budget_limits;
drop policy if exists "users can delete own budget limits" on budget_limits;

create policy "users can read own budget limits" on budget_limits for select to authenticated using (auth.uid() = user_id);
create policy "users can insert own budget limits" on budget_limits for insert to authenticated with check (auth.uid() = user_id);
create policy "users can update own budget limits" on budget_limits for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users can delete own budget limits" on budget_limits for delete to authenticated using (auth.uid() = user_id);
