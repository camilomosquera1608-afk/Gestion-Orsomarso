-- Orsomarso Performance App v107
-- Microciclos por categoria + base GPS Catapult U20
-- Seguro para ejecutar sobre la base actual. No borra datos.

begin;

alter table if exists public.microcycles
  add column if not exists category text not null default 'Sub20',
  add column if not exists objective text,
  add column if not exists notes text,
  add column if not exists status text;

update public.microcycles set category = 'Sub20' where category is null or category = '';

alter table if exists public.daily_external_loads
  add column if not exists distance_per_min numeric,
  add column if not exists max_velocity numeric,
  add column if not exists player_load numeric,
  add column if not exists player_load_per_min numeric,
  add column if not exists high_speed_distance numeric,
  add column if not exists sprint_distance numeric;

update public.daily_external_loads
set distance_per_min = round((total_distance / nullif(minutes, 0))::numeric, 1)
where distance_per_min is null and total_distance is not null and minutes is not null and minutes > 0;

update public.daily_external_loads
set player_load_per_min = round((player_load / nullif(minutes, 0))::numeric, 2)
where player_load_per_min is null and player_load is not null and minutes is not null and minutes > 0;

create index if not exists idx_microcycles_category_dates on public.microcycles(category, start_date, end_date);
create index if not exists idx_external_loads_category_date on public.daily_external_loads(category, date);

commit;
