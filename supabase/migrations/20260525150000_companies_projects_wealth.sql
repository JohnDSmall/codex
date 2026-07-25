-- Companies (reference data: sector, sub-sector, logo path)
create table if not exists public.companies (
  company_id    text primary key,
  display_name  text,
  sector        text,
  sub_sector    text,
  logo_path     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists companies_sector_idx     on public.companies (sector);
create index if not exists companies_sub_sector_idx on public.companies (sub_sector);

-- Projects
create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  legacy_id           text unique,
  name                text not null,
  client              text,
  description         text,
  status              text not null default 'active'
    check (status in ('active', 'inactive', 'completed', 'abandoned', 'on_hold')),
  priority            text not null default 'medium'
    check (priority in ('high', 'medium', 'low', 'High', 'Medium', 'Low')),
  start_date          date,
  due_date            date,
  estimated_hours     numeric default 0,
  hours_spent         numeric default 0,
  hours_remaining     numeric default 0,
  total_actions       integer default 0,
  completed_actions   integer default 0,
  revenue             numeric default 0,
  projected_revenue   numeric default 0,
  cost                numeric default 0,
  costs               jsonb not null default '[]'::jsonb,
  revenues            jsonb not null default '[]'::jsonb,
  contacts            jsonb not null default '[]'::jsonb,
  tags                text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists projects_status_idx   on public.projects (status);
create index if not exists projects_due_date_idx on public.projects (due_date);
create index if not exists projects_tags_idx     on public.projects using gin (tags);

-- Wealth items (assets, liabilities, target assets). Currently empty in the legacy backend.
create table if not exists public.wealth_items (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       text unique,
  name            text not null,
  type            text not null default 'asset'
    check (type in ('asset', 'liability', 'target_asset')),
  category        text default 'other',
  source          text,
  current_value   numeric not null default 0,
  original_value  numeric default 0,
  eoy_values      jsonb not null default '{}'::jsonb,
  date_added      date,
  date_updated    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists wealth_items_type_idx     on public.wealth_items (type);
create index if not exists wealth_items_category_idx on public.wealth_items (category);

-- RLS: service-role only (consistent with contacts).
alter table public.companies    enable row level security;
alter table public.projects     enable row level security;
alter table public.wealth_items enable row level security;
