-- Orsomarso Performance App v107 - Setup recomendado
-- Incluye estabilidad de administracion/permisos y microciclos por categoria + GPS Catapult U20.
-- Seguro para ejecutar varias veces. No borra datos.

-- Orsomarso Performance App
-- v106 - Estabilidad, permisos y diagnostico de Administracion
-- Ejecutar en Supabase SQL Editor.
-- Seguro: no borra datos, no usa app_state y no toca tablas deportivas.

begin;

create or replace function public.orsomarso_profile_table_name()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if to_regclass('public.profiles') is not null then
    return 'profiles';
  end if;
  if to_regclass('public.perfiles') is not null then
    return 'perfiles';
  end if;
  return null;
end;
$$;

create or replace function public.orsomarso_pick_profile_col(target_table text, candidates text[])
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  if target_table is null then
    return null;
  end if;

  foreach candidate in array candidates loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = candidate
    ) then
      return candidate;
    end if;
  end loop;

  return null;
end;
$$;

create or replace function public.current_user_can_manage_profiles_safe()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_table text := public.orsomarso_profile_table_name();
  id_col text;
  role_col text;
  scope_col text;
  access_col text;
  active_col text;
  active_expr text;
  access_expr text;
  sql text;
  allowed boolean := false;
begin
  if target_table is null or auth.uid() is null then
    return false;
  end if;

  id_col := public.orsomarso_pick_profile_col(target_table, array['id', 'identificacion', 'identificación']);
  role_col := public.orsomarso_pick_profile_col(target_table, array['role', 'rol']);
  scope_col := public.orsomarso_pick_profile_col(target_table, array['category_scope', 'ambito_de_categoria', 'ámbito_de_categoría']);
  access_col := public.orsomarso_pick_profile_col(target_table, array['access_level', 'nivel_acceso', 'permiso']);
  active_col := public.orsomarso_pick_profile_col(target_table, array['is_active', 'activo']);

  if id_col is null or role_col is null then
    return false;
  end if;

  active_expr := case when active_col is null then 'true' else format('coalesce(p.%I::boolean, true)', active_col) end;
  access_expr := case when access_col is null then '''full''' else format('coalesce(lower(p.%I::text), ''full'')', access_col) end;

  sql := format(
    'select exists (
      select 1
      from public.%I p
      where p.%I::text = $1::text
        and %s = true
        and %s in (''full'', ''edicion_completa'', ''edición_completa'', ''completa'', ''admin'', ''total'')
        and (
          lower(p.%I::text) in (''admin'', ''administracion'', ''administración'', ''administrador'', ''master'', ''maestro'')
          or (
            lower(p.%I::text) in (''category_admin'', ''categoria_admin'', ''categoría_admin'', ''administrador_de_categoria'')
            and lower(coalesce(p.%I::text, '''')) in (''all'', ''todo'', ''todos'', ''todas'')
          )
        )
    )',
    target_table,
    id_col,
    active_expr,
    access_expr,
    role_col,
    role_col,
    coalesce(scope_col, role_col)
  );

  execute sql into allowed using auth.uid();
  return coalesce(allowed, false);
end;
$$;

create or replace function public.current_user_profile_safe()
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
declare
  target_table text := public.orsomarso_profile_table_name();
  id_col text;
  email_col text;
  full_name_col text;
  role_col text;
  scope_col text;
  access_col text;
  active_col text;
  created_col text;
  updated_col text;
  select_sql text;
begin
  if target_table is null or auth.uid() is null then
    return;
  end if;

  id_col := public.orsomarso_pick_profile_col(target_table, array['id', 'identificacion', 'identificación']);
  email_col := public.orsomarso_pick_profile_col(target_table, array['email', 'correo_electronico', 'correo electrónico', 'correo']);
  full_name_col := public.orsomarso_pick_profile_col(target_table, array['full_name', 'nombre_completo', 'nombre completo']);
  role_col := public.orsomarso_pick_profile_col(target_table, array['role', 'rol']);
  scope_col := public.orsomarso_pick_profile_col(target_table, array['category_scope', 'ambito_de_categoria', 'ámbito_de_categoría']);
  access_col := public.orsomarso_pick_profile_col(target_table, array['access_level', 'nivel_acceso', 'permiso']);
  active_col := public.orsomarso_pick_profile_col(target_table, array['is_active', 'activo']);
  created_col := public.orsomarso_pick_profile_col(target_table, array['created_at', 'creado_en']);
  updated_col := public.orsomarso_pick_profile_col(target_table, array['updated_at', 'actualizado_en']);

  if id_col is null then
    return;
  end if;

  select_sql := format(
    'select %s as id, %s as email, %s as full_name, %s as role, %s as category_scope, %s as access_level, %s as is_active, %s as created_at, %s as updated_at from public.%I p where p.%I::text = $1::text limit 1',
    format('p.%I::uuid', id_col),
    case when email_col is null then '''''::text' else format('p.%I::text', email_col) end,
    case when full_name_col is null then 'null::text' else format('p.%I::text', full_name_col) end,
    case when role_col is null then '''solo_lectura''::text' else format('p.%I::text', role_col) end,
    case when scope_col is null then '''Sub20''::text' else format('p.%I::text', scope_col) end,
    case when access_col is null then '''full''::text' else format('p.%I::text', access_col) end,
    case when active_col is null then 'true::boolean' else format('coalesce(p.%I::boolean, true)', active_col) end,
    case when created_col is null then 'now()' else format('p.%I::timestamptz', created_col) end,
    case when updated_col is null then 'now()' else format('p.%I::timestamptz', updated_col) end,
    target_table,
    id_col
  );

  return query execute select_sql using auth.uid();
end;
$$;

create or replace function public.admin_list_profiles_safe()
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
declare
  target_table text := public.orsomarso_profile_table_name();
  id_col text;
  email_col text;
  full_name_col text;
  role_col text;
  scope_col text;
  access_col text;
  active_col text;
  created_col text;
  updated_col text;
  select_sql text;
begin
  if not public.current_user_can_manage_profiles_safe() then
    raise exception 'not authorized';
  end if;

  id_col := public.orsomarso_pick_profile_col(target_table, array['id', 'identificacion', 'identificación']);
  email_col := public.orsomarso_pick_profile_col(target_table, array['email', 'correo_electronico', 'correo electrónico', 'correo']);
  full_name_col := public.orsomarso_pick_profile_col(target_table, array['full_name', 'nombre_completo', 'nombre completo']);
  role_col := public.orsomarso_pick_profile_col(target_table, array['role', 'rol']);
  scope_col := public.orsomarso_pick_profile_col(target_table, array['category_scope', 'ambito_de_categoria', 'ámbito_de_categoría']);
  access_col := public.orsomarso_pick_profile_col(target_table, array['access_level', 'nivel_acceso', 'permiso']);
  active_col := public.orsomarso_pick_profile_col(target_table, array['is_active', 'activo']);
  created_col := public.orsomarso_pick_profile_col(target_table, array['created_at', 'creado_en']);
  updated_col := public.orsomarso_pick_profile_col(target_table, array['updated_at', 'actualizado_en']);

  if target_table is null or id_col is null then
    raise exception 'profile table not found';
  end if;

  select_sql := format(
    'select %s as id, %s as email, %s as full_name, %s as role, %s as category_scope, %s as access_level, %s as is_active, %s as created_at, %s as updated_at from public.%I p order by 2 asc',
    format('p.%I::uuid', id_col),
    case when email_col is null then '''''::text' else format('p.%I::text', email_col) end,
    case when full_name_col is null then 'null::text' else format('p.%I::text', full_name_col) end,
    case when role_col is null then '''solo_lectura''::text' else format('p.%I::text', role_col) end,
    case when scope_col is null then '''Sub20''::text' else format('p.%I::text', scope_col) end,
    case when access_col is null then '''full''::text' else format('p.%I::text', access_col) end,
    case when active_col is null then 'true::boolean' else format('coalesce(p.%I::boolean, true)', active_col) end,
    case when created_col is null then 'now()' else format('p.%I::timestamptz', created_col) end,
    case when updated_col is null then 'now()' else format('p.%I::timestamptz', updated_col) end,
    target_table
  );

  return query execute select_sql;
end;
$$;

create or replace function public.admin_update_profile_access_safe(
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
declare
  target_table text := public.orsomarso_profile_table_name();
  id_col text;
  full_name_col text;
  role_col text;
  scope_col text;
  access_col text;
  active_col text;
  updated_col text;
  set_clauses text[] := array[]::text[];
  update_sql text;
begin
  if not public.current_user_can_manage_profiles_safe() then
    raise exception 'not authorized';
  end if;

  id_col := public.orsomarso_pick_profile_col(target_table, array['id', 'identificacion', 'identificación']);
  full_name_col := public.orsomarso_pick_profile_col(target_table, array['full_name', 'nombre_completo', 'nombre completo']);
  role_col := public.orsomarso_pick_profile_col(target_table, array['role', 'rol']);
  scope_col := public.orsomarso_pick_profile_col(target_table, array['category_scope', 'ambito_de_categoria', 'ámbito_de_categoría']);
  access_col := public.orsomarso_pick_profile_col(target_table, array['access_level', 'nivel_acceso', 'permiso']);
  active_col := public.orsomarso_pick_profile_col(target_table, array['is_active', 'activo']);
  updated_col := public.orsomarso_pick_profile_col(target_table, array['updated_at', 'actualizado_en']);

  if target_table is null or id_col is null then
    raise exception 'profile table not found';
  end if;

  if full_name_col is not null then set_clauses := set_clauses || format('%I = $2', full_name_col); end if;
  if role_col is not null then set_clauses := set_clauses || format('%I = $3', role_col); end if;
  if scope_col is not null then set_clauses := set_clauses || format('%I = $4', scope_col); end if;
  if access_col is not null then set_clauses := set_clauses || format('%I = $5', access_col); end if;
  if active_col is not null then set_clauses := set_clauses || format('%I = $6', active_col); end if;
  if updated_col is not null then set_clauses := set_clauses || format('%I = now()', updated_col); end if;

  if array_length(set_clauses, 1) is null then
    return;
  end if;

  update_sql := format('update public.%I set %s where %I::text = $1::text', target_table, array_to_string(set_clauses, ', '), id_col);
  execute update_sql using profile_id, profile_full_name, profile_role, profile_category_scope, profile_access_level, profile_is_active;
end;
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
  return query select * from public.admin_list_profiles_safe();
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
  perform public.admin_update_profile_access_safe(profile_id, profile_full_name, profile_role, profile_category_scope, profile_access_level, profile_is_active);
end;
$$;

grant execute on function public.orsomarso_profile_table_name() to authenticated;
grant execute on function public.orsomarso_pick_profile_col(text, text[]) to authenticated;
grant execute on function public.current_user_can_manage_profiles_safe() to authenticated;
grant execute on function public.current_user_profile_safe() to authenticated;
grant execute on function public.admin_list_profiles_safe() to authenticated;
grant execute on function public.admin_update_profile_access_safe(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_list_profiles() to authenticated;
grant execute on function public.admin_update_profile(uuid, text, text, text, text, boolean) to authenticated;

do $$
declare
  target_table text := public.orsomarso_profile_table_name();
  id_col text;
begin
  if target_table is not null then
    id_col := public.orsomarso_pick_profile_col(target_table, array['id', 'identificacion', 'identificación']);
    execute format('alter table public.%I enable row level security', target_table);
    execute format('drop policy if exists profiles_select_self_or_admin_v106 on public.%I', target_table);
    if id_col is not null then
      execute format('create policy profiles_select_self_or_admin_v106 on public.%I for select to authenticated using (%I::text = auth.uid()::text or public.current_user_can_manage_profiles_safe())', target_table, id_col);
    end if;
    execute format('drop policy if exists profiles_update_admin_v106 on public.%I', target_table);
    execute format('create policy profiles_update_admin_v106 on public.%I for update to authenticated using (public.current_user_can_manage_profiles_safe()) with check (public.current_user_can_manage_profiles_safe())', target_table);
  end if;
end $$;

commit;

-- ------------------------------------------------------------
-- v107 Microciclos por categoria + GPS Catapult U20
-- ------------------------------------------------------------
-- Orsomarso Performance App v107
-- Microciclos por categoria + base GPS Catapult U20
-- Seguro para ejecutar sobre la base actual. No borra datos.

begin;

alter table if exists public.microcycles
  add column if not exists category text not null default 'Sub20',
  add column if not exists objective text,
  add column if not exists notes text,
  add column if not exists status text;

update public.microcycles set category = 'Sub20' where category is null or category = '';

alter table if exists public.daily_external_loads
  add column if not exists distance_per_min numeric,
  add column if not exists max_velocity numeric,
  add column if not exists player_load numeric,
  add column if not exists player_load_per_min numeric,
  add column if not exists high_speed_distance numeric,
  add column if not exists sprint_distance numeric;

update public.daily_external_loads
set distance_per_min = round((total_distance / nullif(minutes, 0))::numeric, 1)
where distance_per_min is null and total_distance is not null and minutes is not null and minutes > 0;

update public.daily_external_loads
set player_load_per_min = round((player_load / nullif(minutes, 0))::numeric, 2)
where player_load_per_min is null and player_load is not null and minutes is not null and minutes > 0;

create index if not exists idx_microcycles_category_dates on public.microcycles(category, start_date, end_date);
create index if not exists idx_external_loads_category_date on public.daily_external_loads(category, date);

commit;

-- ─────────────────────────────────────────────────────────────
-- v107.4 public wellness by category patch
-- ─────────────────────────────────────────────────────────────
-- Orsomarso Performance App
-- v107.4 - Wellness publico por categoria
-- Seguro: no borra datos, no usa app_state y no abre eliminacion publica.

begin;

grant usage on schema public to anon;
grant select on public.players to anon;
grant insert, update on public.daily_wellness to anon;

drop policy if exists public_wellness_players_read on public.players;
create policy public_wellness_players_read
on public.players
for select
to anon
using (
  category in ('Sub15', 'Sub17', 'Sub20')
);

drop policy if exists public_wellness_insert on public.daily_wellness;
create policy public_wellness_insert
on public.daily_wellness
for insert
to anon
with check (
  category in ('Sub15', 'Sub17', 'Sub20')
  and sleep between 0 and 5
  and fatigue between 0 and 5
  and stress between 0 and 5
  and muscle_pain between 0 and 5
  and mood between 0 and 5
);

drop policy if exists public_wellness_update on public.daily_wellness;
create policy public_wellness_update
on public.daily_wellness
for update
to anon
using (
  category in ('Sub15', 'Sub17', 'Sub20')
)
with check (
  category in ('Sub15', 'Sub17', 'Sub20')
  and sleep between 0 and 5
  and fatigue between 0 and 5
  and stress between 0 and 5
  and muscle_pain between 0 and 5
  and mood between 0 and 5
);

commit;

-- ─────────────────────────────────────────────────────────────
-- v107.5 - Guardas operativas de duplicados
-- ─────────────────────────────────────────────────────────────
-- v107.5 - Guardas operativas de duplicados
-- Ejecutar solo si ya limpiaste duplicados existentes. No borra datos.

-- Una sesión por categoría y fecha.
create unique index if not exists ux_training_sessions_category_date
  on public.training_sessions(category, date);

-- Un partido por categoría, fecha y rival.
create unique index if not exists ux_competition_matches_category_date_opponent
  on public.competition_matches(category, date, lower(trim(opponent)));

-- Un jugador una sola vez por partido.
create unique index if not exists ux_competition_players_match_player
  on public.competition_players(match_id, player_id);

-- Nombre de microciclo único por categoría.
create unique index if not exists ux_microcycles_category_name
  on public.microcycles(category, lower(trim(name)));

-- Nota: PostgreSQL no puede garantizar solapamiento de fechas con un índice simple.
-- La app bloquea solapamientos de microciclos por categoría antes de guardar.
-- Orsomarso Performance App
-- v108.1 - Wellness publico estable
-- Seguro: no borra datos. Crea RPC publica controlada para enviar wellness.

begin;

grant usage on schema public to anon;
grant select on public.players to anon;
grant insert, update on public.daily_wellness to anon;

create unique index if not exists ux_daily_wellness_player_date
  on public.daily_wellness(player_id, date);

drop policy if exists public_wellness_players_read on public.players;
create policy public_wellness_players_read
on public.players
for select
to anon
using (
  category in ('Sub15', 'Sub17', 'Sub20')
  and coalesce(status, 'active') <> 'archived'
);

drop policy if exists public_wellness_insert on public.daily_wellness;
create policy public_wellness_insert
on public.daily_wellness
for insert
to anon
with check (
  category in ('Sub15', 'Sub17', 'Sub20')
  and sleep between 0 and 5
  and fatigue between 0 and 5
  and stress between 0 and 5
  and muscle_pain between 0 and 5
  and mood between 0 and 5
);

drop policy if exists public_wellness_update on public.daily_wellness;
create policy public_wellness_update
on public.daily_wellness
for update
to anon
using (category in ('Sub15', 'Sub17', 'Sub20'))
with check (
  category in ('Sub15', 'Sub17', 'Sub20')
  and sleep between 0 and 5
  and fatigue between 0 and 5
  and stress between 0 and 5
  and muscle_pain between 0 and 5
  and mood between 0 and 5
);

create or replace function public.submit_public_wellness(
  p_player_id uuid,
  p_date date,
  p_category text,
  p_sleep numeric,
  p_fatigue numeric,
  p_stress numeric,
  p_muscle_pain numeric,
  p_mood numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_category not in ('Sub15', 'Sub17', 'Sub20') then
    raise exception 'Categoria no permitida';
  end if;

  if not exists (
    select 1 from public.players
    where id = p_player_id
      and category = p_category
      and coalesce(status, 'active') <> 'archived'
  ) then
    raise exception 'Jugador no valido para esta categoria';
  end if;

  if p_sleep not between 1 and 5
    or p_fatigue not between 1 and 5
    or p_stress not between 1 and 5
    or p_muscle_pain not between 1 and 5
    or p_mood not between 1 and 5 then
    raise exception 'Respuestas incompletas';
  end if;

  insert into public.daily_wellness (
    player_id, date, category, sleep, fatigue, stress, muscle_pain, mood, updated_at
  ) values (
    p_player_id, p_date, p_category, p_sleep, p_fatigue, p_stress, p_muscle_pain, p_mood, now()
  )
  on conflict (player_id, date)
  do update set
    category = excluded.category,
    sleep = excluded.sleep,
    fatigue = excluded.fatigue,
    stress = excluded.stress,
    muscle_pain = excluded.muscle_pain,
    mood = excluded.mood,
    updated_at = now();
end;
$$;

grant execute on function public.submit_public_wellness(uuid, date, text, numeric, numeric, numeric, numeric, numeric) to anon;
grant execute on function public.submit_public_wellness(uuid, date, text, numeric, numeric, numeric, numeric, numeric) to authenticated;

commit;

-- v108.6 - Sesion unica por categoria y fecha
-- Ejecuta SUPABASE_V108_6_SESSION_ONE_PER_DAY.sql por separado si quieres aplicar la guarda unica en base de datos.

-- ─────────────────────────────────────────────────────────────
-- v108.5 - Fix training_sessions: agregar unique index en legacy_id
-- Ejecutar en SQL Editor de Supabase para que onConflict='legacy_id' funcione.
-- Seguro: no borra datos.
-- ─────────────────────────────────────────────────────────────

-- Agrega legacy_id a training_sessions si no existe
alter table public.training_sessions
  add column if not exists legacy_id text;

-- Hace legacy_id unique para que upsert onConflict funcione
create unique index if not exists ux_training_sessions_legacy_id
  on public.training_sessions(legacy_id)
  where legacy_id is not null;

-- Agrega status si no existe
alter table public.training_sessions
  add column if not exists status text;
-- Orsomarso Performance App
-- v108.8 - GPS en competencia + columnas de estado + soporte para borrado robusto
-- Seguro: no borra datos. Ejecutar una vez en Supabase SQL Editor.

begin;

alter table public.training_sessions
  add column if not exists status text;

alter table public.competition_matches
  add column if not exists status text;

alter table public.competition_players
  add column if not exists total_distance numeric,
  add column if not exists high_speed_distance numeric,
  add column if not exists sprint_distance numeric,
  add column if not exists hsr numeric,
  add column if not exists max_velocity numeric,
  add column if not exists player_load numeric;

create unique index if not exists ux_training_sessions_legacy_id
  on public.training_sessions(legacy_id)
  where legacy_id is not null;

create unique index if not exists ux_competition_matches_legacy_id
  on public.competition_matches(legacy_id)
  where legacy_id is not null;

create unique index if not exists ux_competition_players_legacy_id
  on public.competition_players(legacy_id)
  where legacy_id is not null;

commit;

-- v113 - Metricas de portero en competencia + carga GPS de jugador
begin;

alter table public.competition_players
  add column if not exists penalties_saved integer default 0,
  add column if not exists crosses_defended integer default 0,
  add column if not exists footwork_actions integer default 0;

commit;
-- Orsomarso Performance App
-- v114 - Persistencia estable de competencia
-- Seguro: no borra datos. Ejecutar una vez en Supabase SQL Editor.

begin;

alter table if exists public.competition_matches
  add column if not exists legacy_id text,
  add column if not exists status text,
  add column if not exists lineup_formation text,
  add column if not exists lineup_slots jsonb not null default '[]'::jsonb,
  add column if not exists opponent_logo text,
  add column if not exists eyeball_stats jsonb,
  add column if not exists eyeball_first_half_stats jsonb,
  add column if not exists eyeball_second_half_stats jsonb;

alter table if exists public.competition_players
  add column if not exists legacy_id text,
  add column if not exists starting_role text,
  add column if not exists goals_conceded integer default 0,
  add column if not exists goals_prevented integer default 0,
  add column if not exists penalties_saved integer default 0,
  add column if not exists crosses_defended integer default 0,
  add column if not exists footwork_actions integer default 0,
  add column if not exists medical_status text default 'Sin lesión',
  add column if not exists injury_kind text,
  add column if not exists medical_observation text,
  add column if not exists acc numeric,
  add column if not exists dcc numeric,
  add column if not exists sprints numeric,
  add column if not exists rhie numeric,
  add column if not exists ima numeric,
  add column if not exists total_distance numeric,
  add column if not exists high_speed_distance numeric,
  add column if not exists sprint_distance numeric,
  add column if not exists hsr numeric,
  add column if not exists max_velocity numeric,
  add column if not exists player_load numeric,
  add column if not exists logged_by text;

create unique index if not exists ux_competition_matches_legacy_id
  on public.competition_matches(legacy_id)
  where legacy_id is not null;

create unique index if not exists ux_competition_players_legacy_id
  on public.competition_players(legacy_id)
  where legacy_id is not null;

create unique index if not exists ux_competition_matches_category_date_opponent
  on public.competition_matches(category, date, lower(trim(opponent)));

create unique index if not exists ux_competition_players_match_player
  on public.competition_players(match_id, player_id);

create index if not exists idx_competition_matches_lineup_formation
  on public.competition_matches(lineup_formation);

create index if not exists idx_competition_matches_eyeball_stats
  on public.competition_matches using gin (eyeball_stats);

create index if not exists idx_competition_matches_eyeball_first_half_stats
  on public.competition_matches using gin (eyeball_first_half_stats);

create index if not exists idx_competition_matches_eyeball_second_half_stats
  on public.competition_matches using gin (eyeball_second_half_stats);

comment on column public.competition_matches.opponent_logo is 'Imagen base64 o URL del escudo rival usada en el informe de competencia.';

commit;

-- ------------------------------------------------------------
-- v115 - Guardado estable de ficha completa del jugador
-- ------------------------------------------------------------

begin;

alter table if exists public.players
  add column if not exists jersey_number integer,
  add column if not exists document_id text,
  add column if not exists nationality text,
  add column if not exists birthplace text,
  add column if not exists phone text,
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists dominant_foot text,
  add column if not exists secondary_position text,
  add column if not exists competitive_role text,
  add column if not exists date_joined date,
  add column if not exists load_tolerance text,
  add column if not exists max_velocity_reference numeric,
  add column if not exists baseline_wellness numeric,
  add column if not exists baseline_rpe numeric,
  add column if not exists target_weekly_load numeric,
  add column if not exists target_weekly_hsr numeric,
  add column if not exists target_weekly_sprint_distance numeric,
  add column if not exists target_minutes_7d numeric,
  add column if not exists max_training_percent numeric,
  add column if not exists max_competition_minutes numeric,
  add column if not exists return_to_play_phase text,
  add column if not exists restrictions jsonb default '[]'::jsonb,
  add column if not exists medical_notes text,
  add column if not exists allergies text,
  add column if not exists chronic_conditions text,
  add column if not exists risk_areas text,
  add column if not exists category_history jsonb default '[]'::jsonb,
  add column if not exists injury_history jsonb default '[]'::jsonb,
  add column if not exists photo text,
  add column if not exists injury_area text,
  add column if not exists injury_type text,
  add column if not exists injury_severity text,
  add column if not exists return_date date;

create unique index if not exists ux_players_legacy_id
  on public.players(legacy_id)
  where legacy_id is not null;

create index if not exists idx_players_category
  on public.players(category);

create index if not exists idx_players_category_history
  on public.players using gin (category_history);

create index if not exists idx_players_injury_history
  on public.players using gin (injury_history);

commit;

-- ============================================================
-- V116 - Valoraciones estables y guardado rapido de ficha
-- ============================================================
-- Orsomarso Performance App
-- v116 - Valoraciones estables y guardado rapido de ficha
-- Seguro: no borra datos. Ejecutar una vez en Supabase SQL Editor.

begin;

-- Asegura columnas usadas por la ficha completa del jugador.
alter table if exists public.players
  add column if not exists jersey_number integer,
  add column if not exists document_id text,
  add column if not exists nationality text,
  add column if not exists birthplace text,
  add column if not exists phone text,
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists dominant_foot text,
  add column if not exists secondary_position text,
  add column if not exists competitive_role text,
  add column if not exists date_joined date,
  add column if not exists load_tolerance text,
  add column if not exists max_velocity_reference numeric,
  add column if not exists baseline_wellness numeric,
  add column if not exists baseline_rpe numeric,
  add column if not exists target_weekly_load numeric,
  add column if not exists target_weekly_hsr numeric,
  add column if not exists target_weekly_sprint_distance numeric,
  add column if not exists target_minutes_7d numeric,
  add column if not exists max_training_percent numeric,
  add column if not exists max_competition_minutes numeric,
  add column if not exists return_to_play_phase text,
  add column if not exists restrictions jsonb default '[]'::jsonb,
  add column if not exists medical_notes text,
  add column if not exists allergies text,
  add column if not exists chronic_conditions text,
  add column if not exists risk_areas text,
  add column if not exists category_history jsonb default '[]'::jsonb,
  add column if not exists injury_history jsonb default '[]'::jsonb,
  add column if not exists photo text,
  add column if not exists injury_area text,
  add column if not exists injury_type text,
  add column if not exists injury_severity text,
  add column if not exists return_date date;

create unique index if not exists ux_players_legacy_id
  on public.players(legacy_id)
  where legacy_id is not null;

-- Asegura columnas de valoraciones nutricionales.
alter table if exists public.nutrition_records
  add column if not exists legacy_id text,
  add column if not exists category text,
  add column if not exists weight numeric,
  add column if not exists height numeric,
  add column if not exists body_fat numeric,
  add column if not exists skinfold_sum numeric,
  add column if not exists plan text,
  add column if not exists weight_range text,
  add column if not exists skinfold_range text,
  add column if not exists fat_percentage_range text,
  add column if not exists muscle_mass_percentage numeric,
  add column if not exists muscle_mass_range text,
  add column if not exists imo numeric,
  add column if not exists diagnosis text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists ux_nutrition_records_legacy_id
  on public.nutrition_records(legacy_id)
  where legacy_id is not null;
create index if not exists idx_nutrition_records_player_date
  on public.nutrition_records(player_id, date desc);

-- Reemplaza restricciones antiguas que solo aceptaban Adecuado/Seguimiento/Alerta.
do $$
declare
  constraint_name text;
begin
  if to_regclass('public.nutrition_records') is null then
    return;
  end if;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.nutrition_records'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%fat_percentage_range%'
  loop
    execute format('alter table public.nutrition_records drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table if exists public.nutrition_records
  add constraint nutrition_records_fat_percentage_range_check
  check (
    fat_percentage_range is null
    or fat_percentage_range in (
      '5.7% - 6.2%',
      '6.2% - 6.8%',
      '6.8% - 7.3%',
      '7.3% - 7.8%',
      'Adecuado',
      'Seguimiento',
      'Alerta'
    )
  );

-- Asegura indices de valoraciones fisicas/funcionales para upsert estable.
create unique index if not exists ux_cmj_records_legacy_id
  on public.cmj_records(legacy_id)
  where legacy_id is not null;
create unique index if not exists ux_neuromuscular_records_legacy_id
  on public.neuromuscular_records(legacy_id)
  where legacy_id is not null;
create unique index if not exists ux_fms_records_legacy_id
  on public.fms_records(legacy_id)
  where legacy_id is not null;

create index if not exists idx_cmj_records_player_date
  on public.cmj_records(player_id, date desc);
create index if not exists idx_neuromuscular_records_player_date
  on public.neuromuscular_records(player_id, date desc);
create index if not exists idx_fms_records_player_date
  on public.fms_records(player_id, date desc);

commit;
-- Orsomarso Performance App
-- v117 - Guardas para valoraciones al refrescar y upsert tolerante
-- Seguro: no borra datos. Ejecutar una vez en Supabase SQL Editor.

begin;

-- Columnas e indices requeridos para guardar valoraciones por legacy_id.
alter table if exists public.nutrition_records
  add column if not exists legacy_id text,
  add column if not exists category text,
  add column if not exists weight numeric,
  add column if not exists height numeric,
  add column if not exists body_fat numeric,
  add column if not exists skinfold_sum numeric,
  add column if not exists plan text,
  add column if not exists weight_range text,
  add column if not exists skinfold_range text,
  add column if not exists fat_percentage_range text,
  add column if not exists muscle_mass_percentage numeric,
  add column if not exists muscle_mass_range text,
  add column if not exists imo numeric,
  add column if not exists diagnosis text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.cmj_records
  add column if not exists legacy_id text,
  add column if not exists category text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.neuromuscular_records
  add column if not exists legacy_id text,
  add column if not exists category text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.fms_records
  add column if not exists legacy_id text,
  add column if not exists category text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists ux_nutrition_records_legacy_id
  on public.nutrition_records(legacy_id)
  where legacy_id is not null;
create unique index if not exists ux_cmj_records_legacy_id
  on public.cmj_records(legacy_id)
  where legacy_id is not null;
create unique index if not exists ux_neuromuscular_records_legacy_id
  on public.neuromuscular_records(legacy_id)
  where legacy_id is not null;
create unique index if not exists ux_fms_records_legacy_id
  on public.fms_records(legacy_id)
  where legacy_id is not null;

create index if not exists idx_nutrition_records_player_date
  on public.nutrition_records(player_id, date desc);
create index if not exists idx_cmj_records_player_date
  on public.cmj_records(player_id, date desc);
create index if not exists idx_neuromuscular_records_player_date
  on public.neuromuscular_records(player_id, date desc);
create index if not exists idx_fms_records_player_date
  on public.fms_records(player_id, date desc);

-- Reemplaza cualquier CHECK antiguo de porcentaje de grasa.
do $$
declare
  constraint_name text;
begin
  if to_regclass('public.nutrition_records') is null then
    return;
  end if;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.nutrition_records'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%fat_percentage_range%'
  loop
    execute format('alter table public.nutrition_records drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table if exists public.nutrition_records
  add constraint nutrition_records_fat_percentage_range_check
  check (
    fat_percentage_range is null
    or fat_percentage_range in (
      '5.7% - 6.2%',
      '6.2% - 6.8%',
      '6.8% - 7.3%',
      '7.3% - 7.8%',
      'Adecuado',
      'Seguimiento',
      'Alerta'
    )
  );

-- Politicas abiertas a usuarios autenticados para que los guardados no fallen por RLS.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'nutrition_records', 'cmj_records', 'neuromuscular_records', 'fms_records'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists authenticated_read on public.%I', table_name);
    execute format('drop policy if exists authenticated_insert on public.%I', table_name);
    execute format('drop policy if exists authenticated_update on public.%I', table_name);
    execute format('drop policy if exists authenticated_delete on public.%I', table_name);
    execute format('create policy authenticated_read on public.%I for select to authenticated using (true)', table_name);
    execute format('create policy authenticated_insert on public.%I for insert to authenticated with check (true)', table_name);
    execute format('create policy authenticated_update on public.%I for update to authenticated using (true) with check (true)', table_name);
    execute format('create policy authenticated_delete on public.%I for delete to authenticated using (true)', table_name);
  end loop;
end $$;

commit;


-- ─────────────────────────────────────────────────────────────
-- SUPABASE_V118_PLAYER_PROFILE_AND_EVALUATIONS_REFRESH.sql
-- ─────────────────────────────────────────────────────────────
-- Orsomarso Performance App
-- v118 - Ficha del jugador y valoraciones estables en refresco
-- Seguro: no borra datos. Ejecutar una vez en Supabase SQL Editor.

begin;

alter table if exists public.players
  add column if not exists jersey_number integer,
  add column if not exists document_id text,
  add column if not exists nationality text,
  add column if not exists birthplace text,
  add column if not exists phone text,
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists dominant_foot text,
  add column if not exists secondary_position text,
  add column if not exists competitive_role text,
  add column if not exists date_joined date,
  add column if not exists load_tolerance text,
  add column if not exists max_velocity_reference numeric,
  add column if not exists baseline_wellness numeric,
  add column if not exists baseline_rpe numeric,
  add column if not exists target_weekly_load numeric,
  add column if not exists target_weekly_hsr numeric,
  add column if not exists target_weekly_sprint_distance numeric,
  add column if not exists target_minutes_7d numeric,
  add column if not exists max_training_percent numeric,
  add column if not exists max_competition_minutes numeric,
  add column if not exists return_to_play_phase text,
  add column if not exists restrictions jsonb default '[]'::jsonb,
  add column if not exists medical_notes text,
  add column if not exists allergies text,
  add column if not exists chronic_conditions text,
  add column if not exists risk_areas text,
  add column if not exists category_history jsonb default '[]'::jsonb,
  add column if not exists injury_history jsonb default '[]'::jsonb,
  add column if not exists photo text,
  add column if not exists injury_area text,
  add column if not exists injury_type text,
  add column if not exists injury_severity text,
  add column if not exists return_date date;

create unique index if not exists ux_players_legacy_id
  on public.players(legacy_id)
  where legacy_id is not null;

alter table if exists public.nutrition_records
  drop constraint if exists nutrition_records_fat_percentage_range_check;

alter table if exists public.nutrition_records
  add constraint nutrition_records_fat_percentage_range_check
  check (
    fat_percentage_range is null
    or fat_percentage_range in (
      '5.7% - 6.2%',
      '6.2% - 6.8%',
      '6.8% - 7.3%',
      '7.3% - 7.8%',
      'Adecuado',
      'Seguimiento',
      'Alerta'
    )
  );

create unique index if not exists ux_nutrition_records_legacy_id
  on public.nutrition_records(legacy_id)
  where legacy_id is not null;
create unique index if not exists ux_cmj_records_legacy_id
  on public.cmj_records(legacy_id)
  where legacy_id is not null;
create unique index if not exists ux_neuromuscular_records_legacy_id
  on public.neuromuscular_records(legacy_id)
  where legacy_id is not null;
create unique index if not exists ux_fms_records_legacy_id
  on public.fms_records(legacy_id)
  where legacy_id is not null;

commit;

-- ===============================================
-- V119 PDF_REPORTS_AND_NAV_CLEANUP
-- ===============================================
-- No hay cambios SQL obligatorios en esta versión.

-- ─────────────────────────────────────────────────────────────
-- V120 · Estabilidad de competencia/ficha, rendimiento de equipo y limpieza
-- ─────────────────────────────────────────────────────────────
-- Orsomarso SC V120
-- Estabilidad de competencia/ficha, rendimiento de equipo y limpieza de tablas heredadas.
-- Ejecutar en Supabase SQL Editor.

-- 1) Columnas que permiten que la ficha completa del jugador y competencia no fallen si el proyecto viene de una versión antigua.
alter table public.players add column if not exists category_history jsonb default '[]'::jsonb;
alter table public.players add column if not exists injury_history jsonb default '[]'::jsonb;

alter table public.competition_matches add column if not exists lineup_formation text;
alter table public.competition_matches add column if not exists lineup_slots jsonb not null default '[]'::jsonb;
alter table public.competition_matches add column if not exists opponent_logo text;
alter table public.competition_matches add column if not exists eyeball_stats jsonb;
alter table public.competition_matches add column if not exists eyeball_first_half_stats jsonb;
alter table public.competition_matches add column if not exists eyeball_second_half_stats jsonb;

alter table public.competition_players add column if not exists goals_prevented integer default 0;
alter table public.competition_players add column if not exists penalties_saved integer default 0;
alter table public.competition_players add column if not exists crosses_defended integer default 0;
alter table public.competition_players add column if not exists footwork_actions integer default 0;
alter table public.competition_players add column if not exists total_distance numeric;
alter table public.competition_players add column if not exists high_speed_distance numeric;
alter table public.competition_players add column if not exists sprint_distance numeric;
alter table public.competition_players add column if not exists hsr numeric;
alter table public.competition_players add column if not exists max_velocity numeric;
alter table public.competition_players add column if not exists player_load numeric;
alter table public.competition_players add column if not exists rhie numeric;
alter table public.competition_players add column if not exists dcc numeric;

-- GPS de competencia también puede vivir en daily_external_loads como carga del jugador.
alter table public.daily_external_loads add column if not exists movement_module text;
alter table public.daily_external_loads add column if not exists high_speed_distance numeric;
alter table public.daily_external_loads add column if not exists sprint_distance numeric;
alter table public.daily_external_loads add column if not exists hsr numeric;

-- Rango actualizado de porcentaje de grasa.
alter table public.nutrition_records drop constraint if exists nutrition_records_fat_percentage_range_check;
alter table public.nutrition_records add constraint nutrition_records_fat_percentage_range_check
check (
  fat_percentage_range is null or fat_percentage_range in (
    '5.7% - 6.2%',
    '6.2% - 6.8%',
    '6.8% - 7.3%',
    '7.3% - 7.8%'
  )
);

-- Índices de estabilidad. Usan WHERE para permitir nulos y evitar choques con datos antiguos.
create unique index if not exists ux_players_legacy_id_not_null on public.players(legacy_id) where legacy_id is not null;
create unique index if not exists ux_competition_matches_legacy_id_not_null on public.competition_matches(legacy_id) where legacy_id is not null;
create unique index if not exists ux_competition_players_legacy_id_not_null on public.competition_players(legacy_id) where legacy_id is not null;
create unique index if not exists ux_daily_external_loads_legacy_id_not_null on public.daily_external_loads(legacy_id) where legacy_id is not null;
create index if not exists idx_daily_external_loads_movement_module on public.daily_external_loads(movement_module);
create index if not exists idx_competition_matches_eyeball_stats on public.competition_matches using gin (eyeball_stats);

-- 2) Limpieza de tablas heredadas/no usadas por la app actual.
-- Se dejan en IF EXISTS para que no falle si no están creadas.
drop table if exists public.casa_hogar cascade;
drop table if exists public.casa_hogar_records cascade;
drop table if exists public.house_home cascade;
drop table if exists public.house_home_records cascade;
drop table if exists public.home_records cascade;
drop table if exists public.player_home_records cascade;
drop table if exists public.hogar_records cascade;
drop table if exists public.nutrition_home cascade;

