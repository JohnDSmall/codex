-- Structured income: Type + Company on every eph_income row.
--
-- Type reuses the existing free-text `income_type` column, which was null on
-- all 56 historical rows, and constrains it to a closed list. Null stays legal
-- so the pre-2026 rows remain valid until they are categorized.
--
-- Company is a foreign key rather than another text enum. The same companies
-- are already named in `companies` (and carry the logos), so a second spelling
-- would reintroduce exactly the drift the 2026-08-08 standardization removed.
-- `on delete set null`: deleting a company must not delete revenue history.

alter table public.eph_income
  add column if not exists company_id text references public.companies (company_id) on delete set null;

create index if not exists eph_income_company_idx on public.eph_income (company_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eph_income_income_type_check'
  ) then
    alter table public.eph_income
      add constraint eph_income_income_type_check
      check (income_type is null or income_type in
        ('Contract', 'Salary', 'Bonus', 'Expense Reimbursement', 'Misc'));
  end if;
end $$;

comment on column public.eph_income.income_type is
  'Contract | Salary | Bonus | Expense Reimbursement | Misc. Null = not yet categorized.';
comment on column public.eph_income.company_id is
  'FK to companies.company_id. Null where no company applies (interest, tax refunds).';

-- The two companies referenced by income that had no row to point at.
-- Spellings match what the rest of the data already uses: "7 Shot Tennis" from
-- eph_income.client and eph_tags, "Backcountry Academics" from projects.client.
insert into public.companies (company_id, sector)
values ('7 Shot Tennis', 'Sports'), ('Backcountry Academics', 'Education')
on conflict (company_id) do nothing;
