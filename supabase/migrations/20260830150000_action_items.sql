-- Action items: a running to-do ledger with dated note threads.
--
-- action_items.seq is the human-facing ID (#1, #2, …) — an identity column,
-- never reused. updated_at is "last update date" and is touched by every edit,
-- including adding a note. due_date is optional; when set, active items show
-- as "N due" badges on the /planner calendar. Categories match the planner's
-- so both features share one color language.
--
-- action_item_notes is append-only from the UI: open-ended dated notes, many
-- per item.

create table if not exists public.action_items (
  id           uuid primary key default gen_random_uuid(),
  seq          integer generated always as identity,
  description  text not null,
  priority     text not null default 'medium'
               check (priority in ('high', 'medium', 'low')),
  category     text not null default 'work'
               check (category in ('work', 'family_friends', 'health', 'travel', 'personal', 'misc')),
  status       text not null default 'active'
               check (status in ('active', 'completed')),
  due_date     date,
  completed_at date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.action_item_notes (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.action_items (id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists action_items_status_idx on public.action_items (status);
create index if not exists action_items_due_idx on public.action_items (due_date);
create index if not exists action_item_notes_item_idx on public.action_item_notes (item_id, created_at);

alter table public.action_items enable row level security;
alter table public.action_item_notes enable row level security;

comment on table public.action_items is
  'To-do ledger. seq is the stable human ID; updated_at is touched by every change, notes included.';
comment on table public.action_item_notes is
  'Dated, open-ended notes per action item. Append-only from the UI.';
