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
