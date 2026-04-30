-- Orsomarso Performance App - v101 administration, profiles and audit stability
-- Run in Supabase SQL Editor. Safe to run multiple times.

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
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists role text not null default 'solo_lectura',
  add column if not exists category_scope text not null default 'Sub20',
  add column if not exists access_level text not null default 'read',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role in ('admin', 'category_admin', 'director', 'preparador', 'medico', 'analista', 'valorador', 'solo_lectura')
);

alter table public.profiles drop constraint if exists profiles_category_scope_check;
alter table public.profiles add constraint profiles_category_scope_check check (
  category_scope in ('ALL', 'U15', 'U17', 'U20', 'Sub15', 'Sub17', 'Sub20')
);

alter table public.profiles drop constraint if exists profiles_access_level_check;
alter table public.profiles add constraint profiles_access_level_check check (access_level in ('full', 'write', 'read'));

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
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

alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'audit_logs' loop
    execute format('drop policy if exists %I on public.audit_logs', pol.policyname);
  end loop;
end $$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.access_level = 'full'
      and p.is_active = true
  )
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.role, 'solo_lectura')
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true
  limit 1
$$;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, category_scope, access_level, is_active, created_at, updated_at)
  values (new.id, lower(new.email), 'solo_lectura', 'Sub20', 'read', true, now(), now())
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_profile();

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.current_profile_role() to authenticated;

create policy "profiles_select_own_or_admin"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_platform_admin());

create policy "profiles_update_admin"
on public.profiles for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "profiles_insert_admin"
on public.profiles for insert to authenticated
with check (public.is_platform_admin());

create policy "profiles_delete_admin"
on public.profiles for delete to authenticated
using (public.is_platform_admin());

create policy "audit_logs_select_admin"
on public.audit_logs for select to authenticated
using (public.is_platform_admin());

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
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  category_scope = excluded.category_scope,
  access_level = excluded.access_level,
  is_active = true,
  updated_at = now();

commit;
