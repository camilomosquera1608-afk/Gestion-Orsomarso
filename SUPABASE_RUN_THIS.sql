-- Orsomarso Performance App - Secure Supabase schema
-- Version: v105 consolidated current schema
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

-- Optional/admin hardening for existing projects:
-- If Administración only shows the current user, run SUPABASE_FIX_ADMIN_PROFILES_RLS.sql.
