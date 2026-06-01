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
