-- Contacts table: one row per person, denormalized with JSONB for multi-valued fields.
-- Source: iCloud vCard export, imported via contacts/load_contacts.py.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  uid             text unique,
  full_name       text,
  first_name      text,
  last_name       text,
  middle_name     text,
  prefix          text,
  suffix          text,
  nickname        text,
  organization    text,
  job_title       text,
  department      text,
  phones          jsonb not null default '[]'::jsonb,
  emails          jsonb not null default '[]'::jsonb,
  addresses       jsonb not null default '[]'::jsonb,
  urls            jsonb not null default '[]'::jsonb,
  social          jsonb not null default '[]'::jsonb,
  related         jsonb not null default '[]'::jsonb,
  birthday        date,
  anniversary     date,
  notes           text,
  categories      text[] not null default '{}',
  source          text not null default 'icloud',
  raw_vcard       text,
  imported_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists contacts_full_name_trgm_idx
  on public.contacts using gin (full_name gin_trgm_ops);

create index if not exists contacts_organization_idx on public.contacts (organization);
create index if not exists contacts_phones_gin_idx   on public.contacts using gin (phones);
create index if not exists contacts_emails_gin_idx   on public.contacts using gin (emails);
create index if not exists contacts_categories_gin_idx on public.contacts using gin (categories);

alter table public.contacts enable row level security;
-- No anon/authenticated policies: service-role only. Add policies later when a UI needs read access.
