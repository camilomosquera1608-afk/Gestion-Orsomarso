-- Orsomarso Performance App - Secure Supabase schema
-- Version: v106 consolidated current schema
-- Safe to run in a NEW Supabase project.
-- Do NOT use the old app_state JSON sync for production.

begin;

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_u20(category_value text)
returns boolean
language sql
stable
as $$
  select category_value = 'Sub20';
$$;

-- ─────────────────────────────────────────────────────────────
-- Core reference tables
-- ─────────────────────────────────────────────────────────────
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  birth_date date,
  age integer,
  position text not null,
  category text not null check (category in ('Sub15', 'Sub17', 'Sub20')),
  height numeric,
  weight numeric,
  status text not null default 'Disponible' check (status in ('Disponible', 'Lesionado', 'Molestia', 'Readaptación')),
  photo text,
  injury_area text,
  injury_type text,
  injury_severity text,
  return_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.microcycles (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  week_number integer,
  objective text,
  notes text,
  status text,
  start_date date not null,
  end_date date not null,
  category text not null default 'Sub20' check (category in ('Sub15', 'Sub17', 'Sub20')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint microcycles_date_order check (end_date >= start_date)
);

-- ─────────────────────────────────────────────────────────────
-- Daily monitoring
-- ─────────────────────────────────────────────────────────────
create table if not exists public.daily_wellness (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  player_id uuid not null references public.players(id) on delete cascade,
  date date not null,
  category text not null check (category in ('Sub15', 'Sub17', 'Sub20')),
  sleep numeric not null default 0,
  fatigue numeric not null default 0,
  stress numeric not null default 0,
  muscle_pain numeric not null default 0,
  mood numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, date)
);

create table if not exists public.daily_internal_loads (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  player_id uuid not null references public.players(id) on delete cascade,
  microcycle_id uuid references public.microcycles(id) on delete set null,
  date date not null,
  category text not null check (category in ('Sub15', 'Sub17', 'Sub20')),
  base_category text check (base_category in ('Sub15', 'Sub17', 'Sub20')),
  acting_category text check (acting_category in ('Sub15', 'Sub17', 'Sub20')),
  session_number integer,
  session_id uuid,
  rpe numeric not null default 0,
  duration numeric not null default 0,
  movement_type text,
  movement_note text,
  logged_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- GPS/external load is intentionally restricted to U20.
create table if not exists public.daily_external_loads (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  player_id uuid not null references public.players(id) on delete cascade,
  microcycle_id uuid references public.microcycles(id) on delete set null,
  date date not null,
  category text not null check (category in ('Sub15', 'Sub17', 'Sub20')),
  base_category text check (base_category in ('Sub15', 'Sub17', 'Sub20')),
  acting_category text check (acting_category in ('Sub15', 'Sub17', 'Sub20')),
  session_number integer,
  session_id uuid,
  minutes numeric not null default 0,
  acc numeric not null default 0,
  dcc numeric not null default 0,
  sprints numeric not null default 0,
  rhie numeric not null default 0,
  ima numeric not null default 0,
  rpe numeric,
  total_distance numeric,
  distance_per_min numeric,
  max_velocity numeric,
  player_load numeric,
  player_load_per_min numeric,
  high_speed_distance numeric,
  sprint_distance numeric,
  hsr numeric,
  participation text,
  session_type text,
  movement_type text,
  movement_note text,
  logged_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_loads_u20_only check (category = 'Sub20')
);

-- ─────────────────────────────────────────────────────────────
-- Sessions
-- ─────────────────────────────────────────────────────────────
create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  date date not null,
  category text not null check (category in ('Sub15', 'Sub17', 'Sub20')),
  microcycle_id uuid references public.microcycles(id) on delete set null,
  session_number integer not null default 1,
  session_type text,
  session_rpe numeric,
  objective text,
  observation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, category, session_number)
);

create table if not exists public.session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  participation text,
  minutes numeric default 0,
  rpe numeric default 0,
  status text,
  -- GPS metrics: store only for U20 sessions.
  acc numeric,
  dcc numeric,
  sprints numeric,
  rhie numeric,
  ima numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, player_id)
);

-- ─────────────────────────────────────────────────────────────
-- Competition
-- ─────────────────────────────────────────────────────────────
create table if not exists public.competition_matches (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  date date not null,
  category text not null check (category in ('Sub15', 'Sub17', 'Sub20')),
  competition_name text,
  opponent text not null,
  venue text check (venue in ('Local', 'Visitante')),
  goals_for integer default 0,
  goals_against integer default 0,
  result_type text check (result_type in ('Victoria', 'Empate', 'Derrota')),
  observation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competition_players (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  match_id uuid not null references public.competition_matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  category text not null check (category in ('Sub15', 'Sub17', 'Sub20')),
  starting_role text check (starting_role in ('Titular', 'Suplente')),
  minutes_played numeric not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  goals_conceded integer default 0,
  goals_prevented integer default 0,
  medical_status text default 'Sin lesión' check (medical_status in ('Sin lesión', 'Lesionado')),
  injury_kind text,
  medical_observation text,
  -- GPS metrics are optional and only visible/calculated for U20 in the app.
  acc numeric,
  dcc numeric,
  sprints numeric,
  rhie numeric,
  ima numeric,
  logged_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

-- ─────────────────────────────────────────────────────────────
-- Evaluations
-- ─────────────────────────────────────────────────────────────
create table if not exists public.nutrition_records (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  player_id uuid not null references public.players(id) on delete cascade,
  date date not null,
  category text not null check (category in ('Sub15', 'Sub17', 'Sub20')),
  weight numeric,
  height numeric,
  body_fat numeric,
  skinfold_sum numeric,
  plan text,
  weight_range text,
  skinfold_range text check (skinfold_range is null or skinfold_range in ('30 - 35', '35 - 40', '40 - 45', '45 - 50')),
  fat_percentage_range text check (fat_percentage_range is null or fat_percentage_range in ('Adecuado', 'Seguimiento', 'Alerta')),
  muscle_mass_percentage numeric,
  muscle_mass_range text check (muscle_mass_range is null or muscle_mass_range in ('50% - 55%', '55% - 60%')),
  imo numeric,
  diagnosis text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cmj_records (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  player_id uuid not null references public.players(id) on delete cascade,
  date date not null,
  category text not null check (category in ('Sub15', 'Sub17', 'Sub20')),
  value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.neuromuscular_records (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  player_id uuid not null references public.players(id) on delete cascade,
  date date not null,
  category text not null check (category in ('Sub15', 'Sub17', 'Sub20')),
  cmj numeric,
  sj numeric,
  reactive_jumps numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fms_records (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  player_id uuid not null references public.players(id) on delete cascade,
  date date not null,
  category text not null check (category in ('Sub15', 'Sub17', 'Sub20')),
  shoulder_mobility integer,
  squat integer,
  leg_raise integer,
  hurdle_step integer,
  lunge integer,
  trunk_stability integer,
  rotary_stability integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Medical / reports / audit
-- ─────────────────────────────────────────────────────────────
create table if not exists public.medical_notes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  date date not null default current_date,
  category text check (category in ('Sub15', 'Sub17', 'Sub20')),
  status text,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  category text check (category in ('Sub15', 'Sub17', 'Sub20')),
  player_id uuid references public.players(id) on delete set null,
  match_id uuid references public.competition_matches(id) on delete set null,
  session_id uuid references public.training_sessions(id) on delete set null,
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text,
  record_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_players_category on public.players(category);
create index if not exists idx_players_status on public.players(status);
create index if not exists idx_wellness_date_category on public.daily_wellness(date, category);
create index if not exists idx_internal_date_category on public.daily_internal_loads(date, category);
create index if not exists idx_external_date_category on public.daily_external_loads(date, category);
create index if not exists idx_sessions_date_category on public.training_sessions(date, category);
create index if not exists idx_matches_date_category on public.competition_matches(date, category);
create index if not exists idx_competition_players_match on public.competition_players(match_id);
create index if not exists idx_nutrition_player_date on public.nutrition_records(player_id, date desc);
create index if not exists idx_cmj_player_date on public.cmj_records(player_id, date desc);
create index if not exists idx_neuro_player_date on public.neuromuscular_records(player_id, date desc);
create index if not exists idx_fms_player_date on public.fms_records(player_id, date desc);

-- ─────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'players', 'microcycles', 'daily_wellness', 'daily_internal_loads',
    'daily_external_loads', 'training_sessions', 'session_players',
    'competition_matches', 'competition_players', 'nutrition_records',
    'cmj_records', 'neuromuscular_records', 'fms_records', 'medical_notes'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- RLS: locked by default to authenticated users only.
-- IMPORTANT: app integration must use Supabase Auth before enabling remote writes.
-- ─────────────────────────────────────────────────────────────
alter table public.players enable row level security;
alter table public.microcycles enable row level security;
alter table public.daily_wellness enable row level security;
alter table public.daily_internal_loads enable row level security;
alter table public.daily_external_loads enable row level security;
alter table public.training_sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.competition_matches enable row level security;
alter table public.competition_players enable row level security;
alter table public.nutrition_records enable row level security;
alter table public.cmj_records enable row level security;
alter table public.neuromuscular_records enable row level security;
alter table public.fms_records enable row level security;
alter table public.medical_notes enable row level security;
alter table public.report_exports enable row level security;
alter table public.audit_events enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'players', 'microcycles', 'daily_wellness', 'daily_internal_loads',
    'daily_external_loads', 'training_sessions', 'session_players',
    'competition_matches', 'competition_players', 'nutrition_records',
    'cmj_records', 'neuromuscular_records', 'fms_records', 'medical_notes',
    'report_exports', 'audit_events'
  ] loop
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

-- Admin stability patch for existing projects is included below.
-- For an existing database, you may run only SUPABASE_V106_STABILITY_ADMIN.sql.


-- ─────────────────────────────────────────────────────────────
-- v106 admin stability patch
-- ─────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────
-- v107.4 public wellness by category links
-- ─────────────────────────────────────────────────────────────
grant usage on schema public to anon;
grant select on public.players to anon;
grant insert, update on public.daily_wellness to anon;

drop policy if exists public_wellness_players_read on public.players;
create policy public_wellness_players_read
on public.players
for select
to anon
using (category in ('Sub15', 'Sub17', 'Sub20'));

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
