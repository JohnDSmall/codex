-- Credit-card line items, stored as REFERENCE DATA.
--
-- These are deliberately NOT in eph_expenses. Expenses are cash that left the
-- bank (card payments); these are what the card was used for. Keeping them in
-- a separate table means totals cannot double-count no matter what a query
-- does, while still allowing a card payment to be drilled into.
--
-- The Amex is shared with a partner, so these rows include charges that are not
-- personally attributable. That is fine for browsing a statement; it is exactly
-- why they must not feed expense totals.

create table if not exists public.eph_card_transactions (
  id           uuid primary key default gen_random_uuid(),
  card         text not null,
  date         date not null,
  description  text not null,
  merchant     text,
  amount       numeric not null,
  category_id  uuid references public.eph_categories (id) on delete set null,
  source_file  text,
  -- Statement exports overlap, and two identical charges on one day are
  -- legitimate (a return subway fare). The occurrence index makes the key
  -- unique without collapsing genuine repeats, so re-import is idempotent.
  dedupe_key   text not null unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists eph_card_tx_card_date_idx on public.eph_card_transactions (card, date desc);
create index if not exists eph_card_tx_month_idx     on public.eph_card_transactions (card, (to_char(date, 'YYYY-MM')));
create index if not exists eph_card_tx_merchant_idx  on public.eph_card_transactions (merchant);
create index if not exists eph_card_tx_category_idx  on public.eph_card_transactions (category_id);

comment on table public.eph_card_transactions is
  'Credit-card line items. Reference data for drill-down only — never counted as expenses, which are cash out of the bank.';
comment on column public.eph_card_transactions.dedupe_key is
  'card|date|amount|description|occurrence — unique so re-importing overlapping statement exports is idempotent.';

alter table public.eph_card_transactions enable row level security;
