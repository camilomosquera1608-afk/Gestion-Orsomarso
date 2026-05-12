-- Orsomarso v1112 - ficha completa del jugador
-- Ejecutar en Supabase antes de usar la nueva ficha completa.

begin;

alter table public.players add column if not exists jersey_number integer;
alter table public.players add column if not exists document_id text;
alter table public.players add column if not exists nationality text;
alter table public.players add column if not exists birthplace text;
alter table public.players add column if not exists phone text;
alter table public.players add column if not exists guardian_name text;
alter table public.players add column if not exists guardian_phone text;
alter table public.players add column if not exists emergency_contact_name text;
alter table public.players add column if not exists emergency_contact_phone text;
alter table public.players add column if not exists dominant_foot text;
alter table public.players add column if not exists secondary_position text;
alter table public.players add column if not exists competitive_role text;
alter table public.players add column if not exists date_joined date;
alter table public.players add column if not exists load_tolerance text;
alter table public.players add column if not exists max_velocity_reference numeric;
alter table public.players add column if not exists baseline_wellness numeric;
alter table public.players add column if not exists baseline_rpe numeric;
alter table public.players add column if not exists target_weekly_load numeric;
alter table public.players add column if not exists target_weekly_hsr numeric;
alter table public.players add column if not exists target_weekly_sprint_distance numeric;
alter table public.players add column if not exists target_minutes_7d numeric;
alter table public.players add column if not exists max_training_percent numeric;
alter table public.players add column if not exists max_competition_minutes numeric;
alter table public.players add column if not exists return_to_play_phase text;
alter table public.players add column if not exists restrictions jsonb default '[]'::jsonb;
alter table public.players add column if not exists medical_notes text;
alter table public.players add column if not exists allergies text;
alter table public.players add column if not exists chronic_conditions text;
alter table public.players add column if not exists risk_areas text;

commit;
