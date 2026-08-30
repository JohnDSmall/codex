-- Planner: calendar activities.
--
-- One row per activity block. Single-day blocks have start_date = end_date;
-- multi-day blocks span the range inclusive and render as one bar across the
-- month grid. Category drives the color (web/lib/planner.ts owns the palette).

create table if not exists public.planner_activities (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null default 'personal'
              check (category in ('work', 'family_friends', 'health', 'travel', 'personal', 'misc')),
  start_date  date not null,
  end_date    date not null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists planner_activities_start_idx on public.planner_activities (start_date);
create index if not exists planner_activities_end_idx on public.planner_activities (end_date);

alter table public.planner_activities enable row level security;

comment on table public.planner_activities is
  'Calendar blocks for /planner. Inclusive date range; single-day when start = end.';
