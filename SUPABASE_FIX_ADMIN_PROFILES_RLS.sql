-- Orsomarso Performance App
-- Hotfix: Administración muestra todos los perfiles autorizados.
-- Ejecutar una sola vez en Supabase SQL Editor.
-- No borra datos. No toca app_state. No cambia tablas de rendimiento.

begin;

-- Normaliza alcance antiguo usado en algunas bases: TODO/TODAS -> ALL.
update public.profiles
set category_scope = 'ALL'
where lower(coalesce(category_scope, '')) in ('todo', 'todos', 'todas', 'all');

-- Normaliza roles antiguos en español hacia los valores que usa la app.
update public.profiles
set role = case
  when lower(coalesce(role, '')) in ('administracion', 'administración', 'administrador', 'admin') then 'admin'
  when lower(coalesce(role, '')) in ('categoria_admin', 'categoría_admin', 'administrador_de_categoria', 'category_admin') then 'category_admin'
  when lower(coalesce(role, '')) in ('solo_lectura', 'lectura', 'read') then 'solo_lectura'
  else role
end;

-- Normaliza permisos vacíos para evitar que una sesión antigua quede bloqueada.
update public.profiles
set access_level = case
  when role = 'solo_lectura' then 'read'
  when coalesce(access_level, '') = '' then 'full'
  else access_level
end;

create or replace function public.current_user_can_manage_profiles()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_active, true) = true
      and coalesce(p.access_level, 'full') = 'full'
      and (
        p.role = 'admin'
        or (p.role = 'category_admin' and coalesce(p.category_scope, '') in ('ALL', 'TODO', 'TODAS', 'TODOS'))
      )
  );
$$;

create or replace function public.admin_list_profiles()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  category_scope text,
  access_level text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_user_can_manage_profiles() then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.category_scope,
    p.access_level,
    p.is_active,
    p.created_at,
    p.updated_at
  from public.profiles p
  order by p.email asc;
end;
$$;

create or replace function public.admin_update_profile(
  profile_id uuid,
  profile_full_name text,
  profile_role text,
  profile_category_scope text,
  profile_access_level text,
  profile_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_can_manage_profiles() then
    raise exception 'not authorized';
  end if;

  update public.profiles
  set
    full_name = profile_full_name,
    role = profile_role,
    category_scope = profile_category_scope,
    access_level = profile_access_level,
    is_active = profile_is_active,
    updated_at = now()
  where id = profile_id;
end;
$$;

grant execute on function public.current_user_can_manage_profiles() to authenticated;
grant execute on function public.admin_list_profiles() to authenticated;
grant execute on function public.admin_update_profile(uuid, text, text, text, text, boolean) to authenticated;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.current_user_can_manage_profiles());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
on public.profiles
for update
to authenticated
using (public.current_user_can_manage_profiles())
with check (public.current_user_can_manage_profiles());

commit;
