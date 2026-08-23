-- Goals: a target over a date range, plus dated increments toward it.
--
-- goals is the definition: what, how much, by when, in which category, and
-- where it sits in its lifecycle. goal_entries is the ledger: every time
-- progress is logged it lands here as a dated row, so progress-over-time is a
-- query, not a memory. Current value is derived, never stored:
--
--   measure = 'cumulative'  current = start_value + sum(entries.value)
--                           ("I ran 12 more miles")
--   measure = 'absolute'    current = value of the newest entry, else start_value
--                           ("I weigh 187 today")
--
-- direction = 'at_most' flips the success test (weight, spend), so a goal can
-- count down as well as up. Pace is also derived (lib/goals-server.ts): the
-- expected value at today is linear between start_value and target over the
-- date range; >=100% of expected is on track, 80-100% at risk, <80% off track.
--
-- legacy_key is the idempotency handle for the Life Trakker import
-- (scripts/import-life-trakker-goals.mjs): "2023:Miles Run" and so on.

create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null default 'misc'
                check (category in ('financial', 'professional', 'health', 'social', 'misc')),
  status        text not null default 'pending'
                check (status in ('pending', 'active', 'paused', 'completed', 'deprecated')),
  measure       text not null default 'cumulative'
                check (measure in ('cumulative', 'absolute')),
  direction     text not null default 'at_least'
                check (direction in ('at_least', 'at_most')),
  target        numeric not null,
  start_value   numeric not null default 0,
  unit          text,
  start_date    date not null,
  end_date      date not null,
  notes         text,
  source        text,
  legacy_key    text unique,
  completed_at  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.goal_entries (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references public.goals (id) on delete cascade,
  entry_date  date not null,
  value       numeric not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists goals_status_idx on public.goals (status);
create index if not exists goals_category_idx on public.goals (category);
create index if not exists goals_end_date_idx on public.goals (end_date);
create index if not exists goal_entries_goal_date_idx on public.goal_entries (goal_id, entry_date desc);

alter table public.goals enable row level security;
alter table public.goal_entries enable row level security;

comment on table public.goals is
  'A target over a date range. Current value and pace are derived from goal_entries, never stored.';
comment on column public.goals.measure is
  'cumulative: entries sum onto start_value. absolute: newest entry is the current value.';
comment on column public.goals.direction is
  'at_least: higher is better (miles). at_most: lower is better (weight).';
comment on column public.goals.legacy_key is
  'Idempotency key for imports, e.g. "2023:Miles Run" from the Life Trakker sheet.';
comment on table public.goal_entries is
  'Dated progress log. One row per logged increment (or reading, for absolute goals).';
