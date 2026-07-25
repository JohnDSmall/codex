-- Additional relationship fields imported from the old AWS Lambda backend.

alter table public.contacts
  add column if not exists company_tags    text[] not null default '{}',
  add column if not exists connection_tags text[] not null default '{}',
  add column if not exists interest_tags   text[] not null default '{}',
  add column if not exists university_tags text[] not null default '{}',
  add column if not exists connection_source text,
  add column if not exists looking_for     text,
  add column if not exists added_date      date,
  add column if not exists legacy_user_id  text;

-- Old system uses "loose" as a strength value; allow it in addition to the existing tiers.
alter table public.contacts drop constraint if exists contacts_strength_tier_check;
alter table public.contacts
  add constraint contacts_strength_tier_check
  check (strength_tier in ('strong', 'medium', 'weak', 'loose', 'none'));

create index if not exists contacts_company_tags_idx    on public.contacts using gin (company_tags);
create index if not exists contacts_connection_tags_idx on public.contacts using gin (connection_tags);
create index if not exists contacts_interest_tags_idx   on public.contacts using gin (interest_tags);
create index if not exists contacts_university_tags_idx on public.contacts using gin (university_tags);
