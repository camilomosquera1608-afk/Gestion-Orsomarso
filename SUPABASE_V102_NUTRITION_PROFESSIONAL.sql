-- v102 - Nutrición profesional, auditoría compacta e informes limpios
-- Ejecutar una sola vez en Supabase SQL Editor. No borra datos existentes.

begin;

alter table public.nutrition_records
  add column if not exists weight_range text,
  add column if not exists skinfold_range text,
  add column if not exists fat_percentage_range text,
  add column if not exists muscle_mass_percentage numeric,
  add column if not exists muscle_mass_range text,
  add column if not exists imo numeric,
  add column if not exists diagnosis text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'nutrition_records_skinfold_range_check'
  ) then
    alter table public.nutrition_records
      add constraint nutrition_records_skinfold_range_check
      check (skinfold_range is null or skinfold_range in ('30 - 35', '35 - 40', '40 - 45', '45 - 50'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'nutrition_records_fat_percentage_range_check'
  ) then
    alter table public.nutrition_records
      add constraint nutrition_records_fat_percentage_range_check
      check (fat_percentage_range is null or fat_percentage_range in ('Adecuado', 'Seguimiento', 'Alerta'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'nutrition_records_muscle_mass_range_check'
  ) then
    alter table public.nutrition_records
      add constraint nutrition_records_muscle_mass_range_check
      check (muscle_mass_range is null or muscle_mass_range in ('50% - 55%', '55% - 60%'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'nutrition_records_non_negative_check'
  ) then
    alter table public.nutrition_records
      add constraint nutrition_records_non_negative_check
      check (
        (weight is null or weight >= 0) and
        (height is null or height >= 0) and
        (body_fat is null or (body_fat >= 0 and body_fat <= 100)) and
        (skinfold_sum is null or skinfold_sum >= 0) and
        (muscle_mass_percentage is null or (muscle_mass_percentage >= 0 and muscle_mass_percentage <= 100)) and
        (imo is null or imo >= 0)
      );
  end if;
end $$;

commit;
