-- Skill tags and a competency rating on contacts.
--
-- skill_tags mirrors the existing tag arrays (company_tags, interest_tags, …):
-- a text[] defaulting to empty, so every existing row is immediately valid.
--
-- competency is "how good they are, in general", 1-10. Nullable on purpose and
-- left null everywhere: an unrated person must be distinguishable from a
-- person rated zero, and the whole book starts unrated.

alter table public.contacts
  add column if not exists skill_tags text[] not null default '{}';

alter table public.contacts
  add column if not exists competency smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_competency_check') then
    alter table public.contacts
      add constraint contacts_competency_check
      check (competency is null or (competency >= 1 and competency <= 10));
  end if;
end $$;

create index if not exists contacts_skill_tags_idx  on public.contacts using gin (skill_tags);
create index if not exists contacts_competency_idx  on public.contacts (competency);

comment on column public.contacts.skill_tags is
  'Free-form skill labels, same shape as company_tags / interest_tags.';
comment on column public.contacts.competency is
  'How good they are at what they do, 1-10. Null = unrated, which is not the same as low.';
