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
