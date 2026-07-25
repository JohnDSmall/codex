-- Dated wealth history.
--
-- Before this, wealth_items held a single `current_value` (overwritten on every
-- update, so prior readings were lost) plus `eoy_values`, a jsonb map of
-- year -> value giving one snapshot per calendar year. That can't express
-- "Schwab was worth X on 2026-03-15".
--
-- wealth_snapshots makes value-at-a-date the unit of record. wealth_items keeps
-- `current_value` / `date_updated` as a denormalized mirror of the newest
-- snapshot so existing readers (and contacts/load_wealth.py) keep working.

create table if not exists public.wealth_snapshots (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.wealth_items (id) on delete cascade,
  as_of_date  date not null,
  value       numeric not null,
  note        text,
  created_at  timestamptz not null default now(),
  unique (item_id, as_of_date)
);

create index if not exists wealth_snapshots_item_date_idx
  on public.wealth_snapshots (item_id, as_of_date desc);
create index if not exists wealth_snapshots_date_idx
  on public.wealth_snapshots (as_of_date);

alter table public.wealth_snapshots enable row level security;

-- ---------------------------------------------------------------- backfill --
-- Idempotent: `on conflict do nothing` against the (item_id, as_of_date)
-- unique key, so re-running this migration adds nothing.

-- 1. Every eoy_values entry becomes a Dec 31 snapshot for that year.
insert into public.wealth_snapshots (item_id, as_of_date, value, note)
select
  w.id,
  make_date(y.key::int, 12, 31),
  y.value::numeric,
  'backfilled from eoy_values'
from public.wealth_items w
cross join lateral jsonb_each_text(w.eoy_values) as y(key, value)
where y.key ~ '^[0-9]{4}$'
  and y.value ~ '^-?[0-9]+(\.[0-9]+)?$'
on conflict (item_id, as_of_date) do nothing;

-- 2. The live current_value becomes a snapshot at date_updated. Runs second so
--    a same-date collision keeps the eoy_values row.
insert into public.wealth_snapshots (item_id, as_of_date, value, note)
select
  w.id,
  coalesce(w.date_updated, w.created_at::date, current_date),
  w.current_value,
  'backfilled from current_value'
from public.wealth_items w
where w.current_value is not null
on conflict (item_id, as_of_date) do nothing;
