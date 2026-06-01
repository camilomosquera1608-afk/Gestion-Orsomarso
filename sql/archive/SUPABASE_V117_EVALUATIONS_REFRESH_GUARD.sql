-- Orsomarso Performance App
-- v117 - Guardas para valoraciones al refrescar y upsert tolerante
-- Seguro: no borra datos. Ejecutar una vez en Supabase SQL Editor.

begin;

-- Columnas e indices requeridos para guardar valoraciones por legacy_id.
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

alter table if exists public.cmj_records
  add column if not exists legacy_id text,
  add column if not exists category text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.neuromuscular_records
  add column if not exists legacy_id text,
  add column if not exists category text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.fms_records
  add column if not exists legacy_id text,
  add column if not exists category text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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

create index if not exists idx_nutrition_records_player_date
  on public.nutrition_records(player_id, date desc);
create index if not exists idx_cmj_records_player_date
  on public.cmj_records(player_id, date desc);
create index if not exists idx_neuromuscular_records_player_date
  on public.neuromuscular_records(player_id, date desc);
create index if not exists idx_fms_records_player_date
  on public.fms_records(player_id, date desc);

-- Reemplaza cualquier CHECK antiguo de porcentaje de grasa.
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

-- Politicas abiertas a usuarios autenticados para que los guardados no fallen por RLS.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'nutrition_records', 'cmj_records', 'neuromuscular_records', 'fms_records'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists authenticated_read on public.%I', table_name);
    execute format('drop policy if exists authenticated_insert on public.%I', table_name);
    execute format('drop policy if exists authenticated_update on public.%I', table_name);
    execute format('drop policy if exists authenticated_delete on public.%I', table_name);
    execute format('create policy authenticated_read on public.%I for select to authenticated using (true)', table_name);
    execute format('create policy authenticated_insert on public.%I for insert to authenticated with check (true)', table_name);
    execute format('create policy authenticated_update on public.%I for update to authenticated using (true) with check (true)', table_name);
    execute format('create policy authenticated_delete on public.%I for delete to authenticated using (true)', table_name);
  end loop;
end $$;

commit;
