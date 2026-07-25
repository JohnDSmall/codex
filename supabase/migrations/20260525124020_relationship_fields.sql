-- Extend contacts to act as relationships in the Codex life-org app.
-- Adds curation fields (strength, priority, dates, reminders, notes timeline).
-- All defaults preserve the "raw imported" feel until the user starts curating.

alter table public.contacts
  add column if not exists strength_tier text default 'none',
  add column if not exists priority text default 'low',
  add column if not exists follow_up_fl boolean not null default false,
  add column if not exists last_contact_date date,
  add column if not exists target_contact_date date,
  add column if not exists contact_frequency text,
  add column if not exists reminders jsonb not null default '[]'::jsonb,
  add column if not exists timeline_notes jsonb not null default '[]'::jsonb,
  add column if not exists tracked boolean not null default false,
  add column if not exists linkedin text,
  add column if not exists primary_company text;

-- Constraints (separate from add-column for idempotency).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_strength_tier_check'
  ) then
    alter table public.contacts
      add constraint contacts_strength_tier_check
      check (strength_tier in ('strong', 'medium', 'weak', 'none'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contacts_priority_check'
  ) then
    alter table public.contacts
      add constraint contacts_priority_check
      check (priority in ('high', 'medium', 'low'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contacts_contact_frequency_check'
  ) then
    alter table public.contacts
      add constraint contacts_contact_frequency_check
      check (contact_frequency is null or contact_frequency in ('weekly', 'monthly', 'quarterly', 'biannually', 'yearly'));
  end if;
end $$;

create index if not exists contacts_strength_tier_idx on public.contacts (strength_tier);
create index if not exists contacts_target_contact_date_idx on public.contacts (target_contact_date) where target_contact_date is not null;
create index if not exists contacts_tracked_idx on public.contacts (tracked) where tracked = true;
