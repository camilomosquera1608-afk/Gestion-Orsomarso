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
