-- Orsomarso Performance App
-- v113 - Metricas de portero en competencia + carga GPS de jugador
-- Seguro: no borra datos. Ejecutar una vez en Supabase SQL Editor.

begin;

alter table public.competition_players
  add column if not exists penalties_saved integer default 0,
  add column if not exists crosses_defended integer default 0,
  add column if not exists footwork_actions integer default 0;

commit;
