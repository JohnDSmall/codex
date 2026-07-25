-- Ephemeris: financial management sub-app (ported from the standalone Flask
-- app that used a local SQLite file at ephemeris/ephemeris.db).
--
-- Tables are prefixed `eph_` because several of the source names (assets,
-- income, categories) are generic enough to collide with future top-level
-- codex tables, and `assets` in particular would read ambiguously next to the
-- existing `wealth_items`.
--
-- `legacy_id` mirrors the old SQLite INTEGER PRIMARY KEY so the one-off import
-- (ephemeris/export_to_supabase.py) can resolve foreign keys and stay
-- idempotent on re-run.

-- Life-area buckets: Personal, Halo, Snorkel, HAI, Handshake, 7 Shot Tennis, ...
create table if not exists public.eph_tags (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   integer unique,
  name        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- COGS / F&O / S&M / T&E / R&D / L&A subcategories, plus Personal-*
create table if not exists public.eph_categories (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   integer unique,
  parent      text not null,
  name        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists eph_categories_parent_idx on public.eph_categories (parent);

create table if not exists public.eph_expenses (
  id           uuid primary key default gen_random_uuid(),
  legacy_id    integer unique,
  date         date not null,
  description  text not null,
  amount       numeric not null,
  category_id  uuid references public.eph_categories (id) on delete set null,
  tag_id       uuid references public.eph_tags (id) on delete set null,
  client       text,
  tax_status   text,
  notes        text,
  card         text,
  merchant     text,
  source       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists eph_expenses_date_idx     on public.eph_expenses (date desc);
create index if not exists eph_expenses_tag_idx      on public.eph_expenses (tag_id);
create index if not exists eph_expenses_category_idx on public.eph_expenses (category_id);
create index if not exists eph_expenses_card_idx     on public.eph_expenses (card);
create index if not exists eph_expenses_merchant_idx on public.eph_expenses (merchant);

create table if not exists public.eph_income (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       integer unique,
  date            date not null,
  description     text not null,
  amount          numeric not null,
  client          text,
  tag_id          uuid references public.eph_tags (id) on delete set null,
  notes           text,
  income_type     text,
  source_account  text,
  source_file     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists eph_income_date_idx on public.eph_income (date desc);
create index if not exists eph_income_tag_idx  on public.eph_income (tag_id);

create table if not exists public.eph_assets (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   integer unique,
  name        text not null,
  asset_type  text not null,
  value       numeric not null,
  as_of_date  date not null,
  tag_id      uuid references public.eph_tags (id) on delete set null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists eph_assets_tag_idx on public.eph_assets (tag_id);

create table if not exists public.eph_hours (
  id           uuid primary key default gen_random_uuid(),
  legacy_id    integer unique,
  date         date not null,
  hours        numeric not null,
  rate         numeric,
  pay_status   text,
  client       text,
  project      text,
  description  text,
  tag_id       uuid references public.eph_tags (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists eph_hours_date_idx on public.eph_hours (date desc);
create index if not exists eph_hours_tag_idx  on public.eph_hours (tag_id);

-- Manual confirm/reject overrides layered on top of auto-detected subscriptions.
create table if not exists public.eph_merchant_subscriptions (
  merchant    text primary key,
  status      text not null check (status in ('confirmed', 'rejected')),
  notes       text,
  updated_at  timestamptz not null default now()
);

-- RLS: service-role only (consistent with contacts / wealth_items).
alter table public.eph_tags                  enable row level security;
alter table public.eph_categories            enable row level security;
alter table public.eph_expenses              enable row level security;
alter table public.eph_income                enable row level security;
alter table public.eph_assets                enable row level security;
alter table public.eph_hours                 enable row level security;
alter table public.eph_merchant_subscriptions enable row level security;
