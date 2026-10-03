# Budget Flow v6

Cloud budget tracker with Supabase authentication, monthly budgets, Family/Business history, editable limits, and a bank CSV review queue.

## New in v6

- CSV bank transaction import.
- Imported bank rows go to **Review transactions** first and never affect the budget automatically.
- Suggested category and Family/Business based on merchant text.
- Approve, Ignore, or Approve all.
- Pending review opens before the normal dashboard after sign-in.
- Duplicate CSV rows are ignored using a stable transaction key.

## One-time Supabase setup

Before using CSV import, open **Supabase -> SQL Editor**, paste the contents of `bank_transactions.sql`, and run it once.

`budget_limits.sql` is still required if it has not already been run for earlier versions.

## CSV expectations

The importer understands common columns such as Date / Posted Date, Description / Merchant / Name, Amount, or Debit/Credit. If an Amount export contains negative debits and positive credits, credits are skipped automatically. Every imported expense must still be reviewed before it reaches the budget.


## v6.1 category separation
Family and Business now use separate category sets. Changing Family/Business in Review Queue immediately changes the available categories. Business categories: Materials, Tools & Equipment, Business Fuel, Subcontractors / Labor, Leads & Advertising, Business Subscriptions, Fees & Insurance, Other Business.
