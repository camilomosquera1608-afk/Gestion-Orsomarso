-- Orsomarso Performance App
-- v116 - Valoraciones estables y guardado rapido de ficha
-- Seguro: no borra datos. Ejecutar una vez en Supabase SQL Editor.

begin;

-- Asegura columnas usadas por la ficha completa del jugador.
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

-- Asegura columnas de valoraciones nutricionales.
alter table if exists public.nutrition_records
  add column if not exists legacy_id text,
  add column if not exists category text,
  add column if not exists weight numeric,
  add column if not exists height numeric,
  add column if not exists body_fat numeric,
  add column if not exists skinfold_sum numeric,
  add column if not exists plan text,
  add column if not exists weight_range text,
  add column if not exists skinfold_range text,
  add column if not exists fat_percentage_range text,
  add column if not exists muscle_mass_percentage numeric,
  add column if not exists muscle_mass_range text,
  add column if not exists imo numeric,
  add column if not exists diagnosis text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists ux_nutrition_records_legacy_id
  on public.nutrition_records(legacy_id)
  where legacy_id is not null;
create index if not exists idx_nutrition_records_player_date
  on public.nutrition_records(player_id, date desc);

-- Reemplaza restricciones antiguas que solo aceptaban Adecuado/Seguimiento/Alerta.
do $$
declare
  constraint_name text;
begin
  if to_regclass('public.nutrition_records') is null then
    return;
  end if;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.nutrition_records'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%fat_percentage_range%'
  loop
    execute format('alter table public.nutrition_records drop constraint if exists %I', constraint_name);
  end loop;
end $$;

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

-- Asegura indices de valoraciones fisicas/funcionales para upsert estable.
create unique index if not exists ux_cmj_records_legacy_id
  on public.cmj_records(legacy_id)
  where legacy_id is not null;
create unique index if not exists ux_neuromuscular_records_legacy_id
  on public.neuromuscular_records(legacy_id)
  where legacy_id is not null;
create unique index if not exists ux_fms_records_legacy_id
  on public.fms_records(legacy_id)
  where legacy_id is not null;

create index if not exists idx_cmj_records_player_date
  on public.cmj_records(player_id, date desc);
create index if not exists idx_neuromuscular_records_player_date
  on public.neuromuscular_records(player_id, date desc);
create index if not exists idx_fms_records_player_date
  on public.fms_records(player_id, date desc);

commit;
