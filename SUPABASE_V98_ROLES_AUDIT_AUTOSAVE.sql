-- Orsomarso Performance App - v98 roles, category restrictions and audit logs
-- Run this in the Supabase SQL Editor for the production project.
-- It is safe to run multiple times.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'solo_lectura',
  category_scope text not null default 'Sub20',
  access_level text not null default 'read',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('admin', 'category_admin', 'director', 'preparador', 'medico', 'analista', 'valorador', 'solo_lectura')),
  constraint profiles_category_scope_check check (category_scope in ('ALL', 'Sub15', 'Sub17', 'Sub20')),
  constraint profiles_access_level_check check (access_level in ('full', 'write', 'read'))
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_role text,
  action text not null,
  table_name text not null,
  record_id text,
  record_label text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_role_scope on public.profiles(role, category_scope);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id, created_at desc);
create index if not exists idx_audit_logs_table on public.audit_logs(table_name, created_at desc);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profile_updated_at on public.profiles;
create trigger set_profile_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role from public.profiles p where p.id = auth.uid() and p.is_active = true), 'anonymous')
$$;

create or replace function public.current_user_scope()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.category_scope from public.profiles p where p.id = auth.uid() and p.is_active = true), 'NONE')
$$;

create or replace function public.current_user_access_level()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.access_level from public.profiles p where p.id = auth.uid() and p.is_active = true), 'none')
$$;

create or replace function public.has_write_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_access_level() in ('full', 'write')
     and public.current_user_role() <> 'anonymous'
$$;

create or replace function public.can_access_category(category_value text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin'
      or public.current_user_scope() = 'ALL'
      or public.current_user_scope() = category_value
$$;

alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_insert_admin on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_delete_admin on public.profiles;

create policy profiles_read on public.profiles
for select to authenticated
using (id = auth.uid() or public.current_user_role() = 'admin');

create policy profiles_insert_admin on public.profiles
for insert to authenticated
with check (public.current_user_role() = 'admin');

create policy profiles_update_admin on public.profiles
for update to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy profiles_delete_admin on public.profiles
for delete to authenticated
using (public.current_user_role() = 'admin');

drop policy if exists audit_logs_read on public.audit_logs;
drop policy if exists audit_logs_insert_system on public.audit_logs;

create policy audit_logs_read on public.audit_logs
for select to authenticated
using (public.current_user_role() = 'admin' or actor_id = auth.uid());

create policy audit_logs_insert_system on public.audit_logs
for insert to authenticated
with check (false);

-- Assign current users. Edit or rerun this block when new emails are added.
insert into public.profiles (id, email, role, category_scope, access_level, is_active, updated_at)
select
  u.id,
  lower(u.email),
  case
    when lower(u.email) in ('camilomosquera1608@gmail.com', 'migueldajome25@gmail.com') then 'admin'
    when lower(u.email) in ('cabrerajda2001@gmail.com', 'riveramateo336@gmail.com') then 'category_admin'
    else 'solo_lectura'
  end,
  case
    when lower(u.email) in ('camilomosquera1608@gmail.com', 'migueldajome25@gmail.com') then 'ALL'
    when lower(u.email) in ('cabrerajda2001@gmail.com', 'riveramateo336@gmail.com') then 'Sub17'
    else 'Sub20'
  end,
  case
    when lower(u.email) in ('camilomosquera1608@gmail.com', 'migueldajome25@gmail.com', 'cabrerajda2001@gmail.com', 'riveramateo336@gmail.com') then 'full'
    else 'read'
  end,
  true,
  now()
from auth.users u
where lower(u.email) in ('camilomosquera1608@gmail.com', 'migueldajome25@gmail.com', 'cabrerajda2001@gmail.com', 'riveramateo336@gmail.com')
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  category_scope = excluded.category_scope,
  access_level = excluded.access_level,
  is_active = true,
  updated_at = now();

-- Replace broad authenticated policies with role/category aware policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'players', 'daily_wellness', 'daily_internal_loads',
    'daily_external_loads', 'training_sessions', 'competition_matches',
    'competition_players', 'nutrition_records', 'cmj_records',
    'neuromuscular_records', 'fms_records', 'medical_notes', 'report_exports'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists authenticated_read on public.%I', t);
      execute format('drop policy if exists authenticated_insert on public.%I', t);
      execute format('drop policy if exists authenticated_update on public.%I', t);
      execute format('drop policy if exists authenticated_delete on public.%I', t);
      execute format('drop policy if exists role_read on public.%I', t);
      execute format('drop policy if exists role_insert on public.%I', t);
      execute format('drop policy if exists role_update on public.%I', t);
      execute format('drop policy if exists role_delete on public.%I', t);

      execute format('create policy role_read on public.%I for select to authenticated using (public.can_access_category(category))', t);
      execute format('create policy role_insert on public.%I for insert to authenticated with check (public.has_write_access() and public.can_access_category(category))', t);
      execute format('create policy role_update on public.%I for update to authenticated using (public.has_write_access() and public.can_access_category(category)) with check (public.has_write_access() and public.can_access_category(category))', t);
      execute format('create policy role_delete on public.%I for delete to authenticated using (public.has_write_access() and public.can_access_category(category))', t);
    end if;
  end loop;
end $$;

-- microcycles are shared planning references in the current app data model.
do $$
begin
  if to_regclass('public.microcycles') is not null then
    alter table public.microcycles enable row level security;
    drop policy if exists authenticated_read on public.microcycles;
    drop policy if exists authenticated_insert on public.microcycles;
    drop policy if exists authenticated_update on public.microcycles;
    drop policy if exists authenticated_delete on public.microcycles;
    drop policy if exists role_read on public.microcycles;
    drop policy if exists role_insert on public.microcycles;
    drop policy if exists role_update on public.microcycles;
    drop policy if exists role_delete on public.microcycles;

    create policy role_read on public.microcycles for select to authenticated using (true);
    create policy role_insert on public.microcycles for insert to authenticated with check (public.has_write_access());
    create policy role_update on public.microcycles for update to authenticated using (public.has_write_access()) with check (public.has_write_access());
    create policy role_delete on public.microcycles for delete to authenticated using (public.has_write_access());
  end if;
end $$;

-- session_players does not store category, so it is checked through its parent session.
do $$
begin
  if to_regclass('public.session_players') is not null then
    alter table public.session_players enable row level security;
    drop policy if exists authenticated_read on public.session_players;
    drop policy if exists authenticated_insert on public.session_players;
    drop policy if exists authenticated_update on public.session_players;
    drop policy if exists authenticated_delete on public.session_players;
    drop policy if exists role_read on public.session_players;
    drop policy if exists role_insert on public.session_players;
    drop policy if exists role_update on public.session_players;
    drop policy if exists role_delete on public.session_players;

    create policy role_read on public.session_players
    for select to authenticated
    using (exists (select 1 from public.training_sessions s where s.id = session_id and public.can_access_category(s.category)));

    create policy role_insert on public.session_players
    for insert to authenticated
    with check (public.has_write_access() and exists (select 1 from public.training_sessions s where s.id = session_id and public.can_access_category(s.category)));

    create policy role_update on public.session_players
    for update to authenticated
    using (public.has_write_access() and exists (select 1 from public.training_sessions s where s.id = session_id and public.can_access_category(s.category)))
    with check (public.has_write_access() and exists (select 1 from public.training_sessions s where s.id = session_id and public.can_access_category(s.category)));

    create policy role_delete on public.session_players
    for delete to authenticated
    using (public.has_write_access() and exists (select 1 from public.training_sessions s where s.id = session_id and public.can_access_category(s.category)));
  end if;
end $$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
  label text;
begin
  if tg_op = 'DELETE' then
    payload := to_jsonb(old);
  else
    payload := to_jsonb(new);
  end if;

  label := coalesce(
    payload->>'name',
    payload->>'opponent',
    payload->>'date',
    payload->>'legacy_id',
    payload->>'id'
  );

  insert into public.audit_logs (
    actor_id,
    actor_email,
    actor_role,
    action,
    table_name,
    record_id,
    record_label,
    before_data,
    after_data
  ) values (
    auth.uid(),
    (select p.email from public.profiles p where p.id = auth.uid()),
    public.current_user_role(),
    tg_op,
    tg_table_name,
    coalesce(payload->>'id', payload->>'legacy_id'),
    label,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'players', 'microcycles', 'daily_wellness', 'daily_internal_loads',
    'daily_external_loads', 'training_sessions', 'session_players',
    'competition_matches', 'competition_players', 'nutrition_records',
    'cmj_records', 'neuromuscular_records', 'fms_records', 'medical_notes',
    'report_exports'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_row_change on public.%I', t);
      execute format('create trigger audit_row_change after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t);
    end if;
  end loop;
end $$;

commit;
