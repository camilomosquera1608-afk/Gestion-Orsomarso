-- Orsomarso Performance App v110.6
-- Competencia: guardar Eyeball completo, primer tiempo y segundo tiempo.
-- Ejecutar una vez en Supabase SQL Editor antes del deploy si estas columnas no existen.

alter table if exists public.competition_matches
  add column if not exists eyeball_stats jsonb,
  add column if not exists eyeball_first_half_stats jsonb,
  add column if not exists eyeball_second_half_stats jsonb;

create index if not exists idx_competition_matches_eyeball_stats
  on public.competition_matches using gin (eyeball_stats);

create index if not exists idx_competition_matches_eyeball_first_half_stats
  on public.competition_matches using gin (eyeball_first_half_stats);

create index if not exists idx_competition_matches_eyeball_second_half_stats
  on public.competition_matches using gin (eyeball_second_half_stats);
