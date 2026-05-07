-- Orsomarso Performance App v110.1
-- Modulo Casa Hogar / Casa Club
-- Ejecutar en Supabase SQL Editor. Seguro para bases existentes: no borra datos.

begin;

create extension if not exists pgcrypto;

create table if not exists public.house_players (
  id text primary key,
  player_id uuid not null,
  category text,
  belongs_house boolean not null default false,
  room text,
  bed text,
  status text not null default 'Activo',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.house_daily_meals (
  id text primary key,
  player_id uuid not null,
  date date not null,
  breakfast boolean not null default false,
  lunch boolean not null default false,
  dinner boolean not null default false,
  notes text,
  responsible text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, date)
);

create table if not exists public.house_monthly_evaluations (
  id text primary key,
  player_id uuid not null,
  month integer not null,
  year integer not null,
  convivencia_score numeric not null default 3,
  responsabilidad_score numeric not null default 3,
  alimentacion_habitos_score numeric not null default 3,
  compromiso_deportivo_score numeric not null default 3,
  formacion_integral_score numeric not null default 3,
  bienestar_emocional_score numeric not null default 3,
  general_score numeric not null default 3,
  traffic_light text not null default 'Amarillo',
  observations text,
  commitments text,
  recommendations text,
  responsible text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, month, year)
);

create table if not exists public.house_exit_permissions (
  id text primary key,
  player_id uuid not null,
  date date not null,
  departure_time text,
  return_time text,
  reason text,
  authorized_by text,
  status text not null default 'Pendiente',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.house_academic_tracking (
  id text primary key,
  player_id uuid not null,
  month integer not null,
  year integer not null,
  academic_attendance numeric,
  academic_performance numeric,
  pending_tasks text,
  academic_alerts text,
  tutor_notes text,
  family_contact text,
  status text not null default 'Estable',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, month, year)
);

create table if not exists public.house_daily_news (
  id text primary key,
  player_id uuid not null,
  date date not null,
  type text not null default 'Seguimiento especial',
  description text not null default '',
  severity text not null default 'Seguimiento',
  responsible text,
  follow_up_required boolean not null default false,
  status text not null default 'Abierta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.house_rooms (
  id text primary key,
  room_name text not null unique,
  capacity integer not null default 4,
  responsible text,
  status text default 'Activa',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_house_players_player on public.house_players(player_id);
create index if not exists idx_house_players_category on public.house_players(category);
create index if not exists idx_house_meals_date on public.house_daily_meals(date);
create index if not exists idx_house_eval_period on public.house_monthly_evaluations(year, month);
create index if not exists idx_house_permissions_date on public.house_exit_permissions(date);
create index if not exists idx_house_news_date_status on public.house_daily_news(date, status);

alter table public.house_players enable row level security;
alter table public.house_daily_meals enable row level security;
alter table public.house_monthly_evaluations enable row level security;
alter table public.house_exit_permissions enable row level security;
alter table public.house_academic_tracking enable row level security;
alter table public.house_daily_news enable row level security;
alter table public.house_rooms enable row level security;

-- Politicas amplias para usuarios autenticados. Si ya existen, no se duplican.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='house_players' and policyname='house_players_auth_all') then
    create policy house_players_auth_all on public.house_players for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='house_daily_meals' and policyname='house_daily_meals_auth_all') then
    create policy house_daily_meals_auth_all on public.house_daily_meals for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='house_monthly_evaluations' and policyname='house_monthly_evaluations_auth_all') then
    create policy house_monthly_evaluations_auth_all on public.house_monthly_evaluations for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='house_exit_permissions' and policyname='house_exit_permissions_auth_all') then
    create policy house_exit_permissions_auth_all on public.house_exit_permissions for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='house_academic_tracking' and policyname='house_academic_tracking_auth_all') then
    create policy house_academic_tracking_auth_all on public.house_academic_tracking for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='house_daily_news' and policyname='house_daily_news_auth_all') then
    create policy house_daily_news_auth_all on public.house_daily_news for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='house_rooms' and policyname='house_rooms_auth_all') then
    create policy house_rooms_auth_all on public.house_rooms for all to authenticated using (true) with check (true);
  end if;
end $$;

commit;

select
  to_regclass('public.house_players') as house_players,
  to_regclass('public.house_daily_meals') as house_daily_meals,
  to_regclass('public.house_monthly_evaluations') as house_monthly_evaluations,
  to_regclass('public.house_rooms') as house_rooms;
