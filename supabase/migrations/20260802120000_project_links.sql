-- Link time and revenue to projects.
--
-- projects/eph_hours/eph_income already existed; what was missing was a real
-- foreign key between them. eph_hours.project was free text and eph_income had
-- no project reference at all.
--
-- Nullable on purpose: linking is optional, and an unlinked hour or income row
-- is still a valid row. on delete set null so deleting a project never destroys
-- financial history.

alter table public.eph_hours
  add column if not exists project_id uuid references public.projects (id) on delete set null;

alter table public.eph_income
  add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists eph_hours_project_idx  on public.eph_hours  (project_id);
create index if not exists eph_income_project_idx on public.eph_income (project_id);

comment on column public.eph_hours.project_id  is 'Optional link to projects.id. eph_hours.project (text) is the legacy label.';
comment on column public.eph_income.project_id is 'Optional link to projects.id; null = revenue not attributed to a project.';

-- ---------------------------------------------------------------------------
-- Backfill (103 rows linked, 25 left null)
--
-- Rule, applied mechanically -- no amount matching, no fuzzy names:
--   1. Candidates = projects whose client matches the row's client (via an
--      explicit alias list: "7 Shot Tennis"->"7Shot Tennis",
--      "Powered By Halo"->"Halo"), else projects whose *name* equals it.
--   2. Exactly one candidate -> link.
--   3. Otherwise keep candidates whose [start_date, due_date] window contains
--      the row's date; exactly one survivor -> link.
--   4. Anything else stays null, to be assigned in the UI.
--
-- Guarded by "project_id is null", so re-running is safe and never overwrites
-- a link you set by hand.
-- ---------------------------------------------------------------------------

-- 28 rows (37.0 h) -> 7Shot Tennis Platform Ops 2025 [7Shot Tennis]
update public.eph_hours set project_id = '7d8ba856-bb17-47ae-b0e5-af871081823d'
 where project_id is null and id in (
   'f317204d-0970-4c45-8fb2-faa88b72d8d2',
   'be9a1bb2-3ed6-4565-b4be-ea13f42cc457',
   'ed309de5-1454-4d84-ac2d-5d26f136d02d',
   '172aa12a-0b9d-413a-9f0e-f472e1551b15',
   'a62b791f-63fd-45bc-9785-0b31bb22608a',
   '8e0c3aee-ee4c-4474-a7a8-f93da765c473',
   '5365a482-98b2-4b5c-b4ba-5db415796a2c',
   '41323c3e-7485-44fd-be84-6de4d039c4cd',
   '195f97b0-2d3b-4442-804d-10ff6cd05a59',
   '603f8296-c548-4136-8d4e-bd5fe026f0d5',
   '7afaa3b7-05ef-4e3f-9dba-1e4597e2f250',
   'e0d53aa0-1c1a-463b-8717-ebc8babf45a2',
   'ff35a80a-3381-4f17-8c54-0b61a326086b',
   '592ddabc-b2a8-4adb-9bae-c6009986d96a',
   'a617a753-c650-4b6d-ac7c-c5186e3f85d5',
   '225c28cf-7620-410b-bf9e-243dd803383b',
   '80b6f607-4d03-42c4-bd31-c56728cc613f',
   'fc804f69-ed4e-4c92-acc3-913c51e2e3bf',
   'c19aa745-5c8a-46a8-9f69-ab5283064224',
   '253bce42-f073-4956-936e-b9e1799e01e3',
   'bfc5b5a7-115c-46a9-a713-b87b0f2871b8',
   '138cc105-e1ae-458b-b0b8-67a29f64169f',
   'ede1800b-90a9-4c40-9760-1e42ae0924c5',
   'a23b9cdd-b53a-4d22-a777-cc6f5cdd89d3',
   '75cbb1f6-13e5-49dd-a804-62f1a7563447',
   'acf4a452-0a52-4366-b6a2-11d1270dd0c9',
   'ee50fb60-9fb3-404e-b675-9161e7b4b5ba',
   '934ef90a-6ed7-4b0c-aa62-03f6e0222da6'
 );

-- 11 rows (10.0 h) -> Backcountry Academics - Ops Support [Backcountry Academics]
update public.eph_hours set project_id = 'd411aab1-1c03-4fde-8c71-38fe8d6e19e0'
 where project_id is null and id in (
   '03c3c490-2bae-46c3-8829-b9740d5ea19f',
   '53f58c4d-8773-4bd6-9dc1-6901b9ce63dd',
   '7e422b8a-e09d-426a-8f66-6260909abee2',
   'e61eca77-d88d-41e6-86f3-f6a65f9cf01e',
   'fb940480-7900-416d-b1f5-0f8cfe661287',
   '88e762aa-afe0-41b1-8c36-b482da74d535',
   '21a73023-6c46-48be-84fa-77719fb74a0f',
   '4c9d09f0-547e-4113-8b87-a07c2ff69743',
   '4188eb2f-a9d5-4f80-a991-31b354403ae6',
   'd7375155-d9f9-4e88-a79f-044c87624bbd',
   'c11ea9ac-148d-44cf-9435-7c7daa1bede7'
 );

-- 6 rows (9.5 h) -> Data Hunter Framework [Data Hunter]
update public.eph_hours set project_id = '38825c3f-666b-4344-a9df-84292f509c56'
 where project_id is null and id in (
   '747ce046-429e-48d4-bb89-f509a6be3dcb',
   '622d1763-be3a-4f05-af45-0c383534eadf',
   '7e4af52f-6a37-4b18-a129-538e52f09f3d',
   '72fee518-04aa-446b-8779-445b4f32aced',
   'a31464a7-14eb-4378-a60b-40e6bf3f6e7b',
   'a8e07902-5071-4a88-8714-341d9a819e5a'
 );

-- 6 rows (9.0 h) -> Codex [Personal]
update public.eph_hours set project_id = 'e4b91d87-77c6-4d92-9e40-6f95180aa49f'
 where project_id is null and id in (
   'c41686da-413e-4eb9-af07-bc3802519580',
   'cdf3aa0e-6d30-41ab-80ec-e34330e178fc',
   '03a75b65-3408-4a7a-9796-0ff9ee531620',
   '20302a8a-4435-4123-8cc2-5a7948b33680',
   '623a5f27-2541-4445-bb8c-da0d26c099a4',
   '958c32f9-a45a-470e-a705-450e76bb9d35'
 );

-- 1 rows ($7500.00) -> 7Shot Analytics Platform MVP [7Shot Tennis]
update public.eph_income set project_id = '1dba9acb-47dc-41d7-b648-ea5323f7a2bc'
 where project_id is null and id in (
   '5a8e0957-4a83-46da-8c57-6626ab9a1be2'
 );

-- 27 rows ($20669.00) -> 7Shot Tennis Platform Ops 2023-2024 [7Shot Tennis]
update public.eph_income set project_id = '559f3f20-e2ec-4660-a06c-8030900b7246'
 where project_id is null and id in (
   'ebfb40aa-1d6e-482a-a286-6ed16de29f5b',
   '011604c5-d0ca-4240-90c1-b882d0b75db6',
   'fbd814e4-af13-478c-a2df-9edf5830fead',
   'e53cec35-0aab-4e4e-aaae-7b315953040d',
   'a69edac5-6597-4ab6-bf1f-0c437d940383',
   'd541acfe-64c3-4d23-8840-dac801bb86c0',
   '266d1bc1-b89d-479d-ba5e-9ee46452a8f9',
   'eef96439-23aa-4387-9070-83c7b552258d',
   'fb175505-5fc6-4ad4-afff-117e150594d0',
   'e5bae044-80c6-4fd4-a7a8-d45328921957',
   '8486f7b9-11cb-4a25-8f92-ae6f89432a01',
   'cb5dd0a4-925e-4b27-b147-1e3837725cab',
   '7bd638f6-ced7-4562-954b-012c3d53c425',
   'fe2d0cc6-2677-4249-94f0-cbdf0bc24323',
   'a0d3b1dd-dcf0-4108-abf8-22e6024f86e8',
   '75ba8698-2805-487c-9855-11798f1e6272',
   '3eedbae0-bbf3-4eee-80f9-3efdfb7987f1',
   'b6cba7b8-a0a6-4c28-a986-5483a3052489',
   '925426a4-ca09-40be-ba9e-4dc34c817897',
   '9823e1a0-c614-473f-a564-0d99c26a8dea',
   '87857a33-ee89-4353-882b-00585e7a97c1',
   '62a0c54c-f674-462b-a126-4c240ccde876',
   '70b3f278-28ef-420a-a422-f436911dde92',
   'c44550db-cb1c-47f2-ac86-94bb10149d98',
   '11d56529-60d3-42aa-98a2-cd69abab776e',
   '20301bf5-8294-40e5-b113-42407ea2cbd9',
   '5e99e7ac-5d22-4c21-bc53-668ea9f92cfc'
 );

-- 3 rows ($2400.00) -> Backcountry Academics - Website Development [Backcountry Academics]
update public.eph_income set project_id = 'ae428965-218b-4ed2-9d7d-27d43801243e'
 where project_id is null and id in (
   'a19fdace-2d47-435d-9f0a-eec11d7380b5',
   '6c858b29-054d-434a-8510-478e0166926a',
   '5aefe748-c121-4c27-a1da-8a3090fcbea2'
 );

-- 10 rows ($95000.00) -> MVP Development [Halo]
update public.eph_income set project_id = '0bd2d454-c908-4734-b016-ee5bf8397828'
 where project_id is null and id in (
   '9c9b7557-6f00-4549-93f5-4a3087b0c4ba',
   '0ecf6af2-b346-4fc8-bea2-4dc3d8e4fea0',
   'a9204720-b240-4475-b947-5599e8c1379b',
   '854e815e-9c09-495b-9b01-de834cfd3c40',
   'a911c7dd-e3e3-4c0c-8335-09d2afdd324e',
   '8b9d34f1-a819-466b-a30b-091ba67106ed',
   'e502309e-0b5c-4aea-92ab-4ecf6a2fd06e',
   '20e4e7fa-1eb7-446e-9fe8-319e7c39f777',
   '748b30d1-937e-4c09-acb4-c0f6af1b5bbc',
   'e1ce0b9b-d8f9-4f22-bd3e-413f372dc118'
 );

-- 6 rows ($5202.00) -> 7Shot Tennis Platform Ops 2025 [7Shot Tennis]
update public.eph_income set project_id = '7d8ba856-bb17-47ae-b0e5-af871081823d'
 where project_id is null and id in (
   '73c1cdda-6432-40e0-acb2-628bc0b53308',
   'a455883a-876d-4044-b335-9750d5eecb49',
   '21c4d68a-d895-4025-896d-5f14318a0f56',
   'd9f4e1ed-40ba-4087-b532-eab08597837e',
   'f8b46523-2d30-4914-b2b0-f38d12eb042b',
   '4d8513d2-eb58-443c-81b3-4836e4550068'
 );

-- 5 rows ($2275.00) -> Backcountry Academics - Ops Support [Backcountry Academics]
update public.eph_income set project_id = 'd411aab1-1c03-4fde-8c71-38fe8d6e19e0'
 where project_id is null and id in (
   '0f1c82b5-ccdb-4ba2-9e8d-e61e3900e8fd',
   'c597b4ae-4928-4282-97b9-89f0e4087c72',
   'efe2c605-9fca-4168-bbbe-4a420a047f0e',
   'f019a807-5e5d-4ecc-b13e-32ad203b0d7e',
   '718beac2-784a-45ac-bc9f-284a44d16616'
 );
