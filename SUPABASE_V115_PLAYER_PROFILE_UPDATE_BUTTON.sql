-- Orsomarso Performance App
-- v115 - Guardado estable de ficha completa del jugador
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

create index if not exists idx_players_category
  on public.players(category);

create index if not exists idx_players_category_history
  on public.players using gin (category_history);

create index if not exists idx_players_injury_history
  on public.players using gin (injury_history);

commit;
