-- ============================================================
-- OMW LabRepair v2.2.0 — produktionsmigration (idempotent)
-- Køres i Supabase SQL Editor. Kan køres flere gange uden skade.
-- ============================================================

-- 1) Tabel (oprettes kun hvis den ikke findes — eksisterende data røres ikke)
create table if not exists public.repairs (
  id             uuid primary key default gen_random_uuid(),
  request_type   text not null check (request_type in ('reparation','send_til')),
  sample_type    text not null check (sample_type in ('jord','materialer')),
  lab            text,
  destination    text,
  grams          numeric,
  sample         text not null,
  box            text,
  analysis       text,
  determinations text,
  reason         text,
  comment        text,
  first_weighing date,
  urgent         boolean not null default false,
  status         text not null default 'ny' check (status in ('ny','arkiv')),
  printed        boolean not null default false,
  printed_at     timestamptz,
  archive_date   timestamptz,
  archive_by     text,
  initials       text,
  created_at     timestamptz not null default now()
);

-- Manglende kolonner på eksisterende tabel (no-op hvis de findes)
alter table public.repairs add column if not exists printed_at   timestamptz;
alter table public.repairs add column if not exists archive_date timestamptz;
alter table public.repairs add column if not exists archive_by   text;
alter table public.repairs add column if not exists initials     text;
alter table public.repairs add column if not exists created_at   timestamptz not null default now();

-- 2) Indekser til appens faktiske forespørgsler
create index if not exists repairs_status_idx       on public.repairs (status);
create index if not exists repairs_created_at_idx   on public.repairs (created_at desc);
create index if not exists repairs_status_type_idx  on public.repairs (status, sample_type);

-- 3) Row Level Security
--    Appen bruger publishable/anon-nøglen. Politikkerne tillader læsning,
--    indsættelse og opdatering — men der findes INGEN delete-politik:
--    rækker kan dermed ALDRIG slettes fra klienten (kun soft delete via status).
alter table public.repairs enable row level security;

drop policy if exists repairs_select on public.repairs;
create policy repairs_select on public.repairs
  for select to anon, authenticated using (true);

drop policy if exists repairs_insert on public.repairs;
create policy repairs_insert on public.repairs
  for insert to anon, authenticated with check (
    status = 'ny' and printed = false            -- nye rækker kan ikke fødes arkiverede
  );

drop policy if exists repairs_update on public.repairs;
create policy repairs_update on public.repairs
  for update to anon, authenticated using (true) with check (true);

-- (bevidst ingen FOR DELETE-politik → DELETE afvises altid)

-- 4) Audit-log: hvem arkiverede/gendannede hvad, hvornår (kan ikke omgås fra klienten)
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     uuid,
  action     text not null,
  old_status text,
  new_status text,
  changed_by text,
  changed_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to anon, authenticated using (true);
-- ingen insert/update/delete-politik for klienter: kun triggeren skriver

create or replace function public.repairs_audit() returns trigger
language plpgsql security definer as $$
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.audit_log (table_name, row_id, action, old_status, new_status, changed_by)
    values ('repairs', new.id, 'status_change', old.status, new.status, coalesce(new.archive_by, new.initials));
  end if;
  return new;
end $$;

drop trigger if exists repairs_audit_trg on public.repairs;
create trigger repairs_audit_trg after update on public.repairs
  for each row execute function public.repairs_audit();

-- 5) Realtime (lyd + popup ved nye opgaver)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'repairs'
  ) then
    alter publication supabase_realtime add table public.repairs;
  end if;
end $$;

-- 6) Verifikation (kør og tjek output)
select
  (select count(*) from public.repairs)                                            as rows_total,
  (select relrowsecurity from pg_class where relname = 'repairs')                  as rls_enabled,
  (select count(*) from pg_policies where tablename = 'repairs')                   as policies,
  exists (select 1 from pg_policies where tablename='repairs' and cmd='DELETE')    as delete_allowed,  -- SKAL være false
  exists (select 1 from pg_publication_tables
          where pubname='supabase_realtime' and tablename='repairs')               as realtime_on;
