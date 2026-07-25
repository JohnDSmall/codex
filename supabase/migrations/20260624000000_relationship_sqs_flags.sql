-- Relationship enrichment: SQS skill score (1-5) + outreach flags.
-- All nullable with no default, so existing rows stay blank until filled in.

alter table public.contacts
  add column if not exists sqs         smallint check (sqs between 1 and 5),
  add column if not exists fundraising boolean,
  add column if not exists consulting  boolean,
  add column if not exists hiring      boolean;

comment on column public.contacts.sqs         is 'Skill/quality score 1-5 (how good they are at their job); null = unrated';
comment on column public.contacts.fundraising is 'Y/N flag: reach out when fundraising; null = unset';
comment on column public.contacts.consulting  is 'Y/N flag: reach out when selling consulting services; null = unset';
comment on column public.contacts.hiring      is 'Y/N flag: would want to hire on my team; null = unset';
