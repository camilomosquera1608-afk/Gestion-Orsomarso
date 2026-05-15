-- v132 - Sincronizacion de datos compartidos entre apartados
-- Ejecutar despues de la v131 si tu proyecto ya esta desplegado en Vercel.
-- Objetivo: que sesiones, competencia, GPS y wellness mantengan llaves estables
-- y no aparezcan en un modulo pero desaparezcan en otro.

begin;

-- 1) Una categoria puede tener mas de una sesion el mismo dia.
-- Antes algunas instalaciones tenian unique(date, category), lo que pisaba dobles jornadas.
alter table public.training_sessions
  add column if not exists session_number integer not null default 1;

alter table public.training_sessions
  drop constraint if exists training_sessions_date_category_key;

drop index if exists public.ux_training_sessions_category_date;

create unique index if not exists ux_training_sessions_category_date_number
  on public.training_sessions(category, date, session_number);

create unique index if not exists ux_training_sessions_legacy_id
  on public.training_sessions(legacy_id)
  where legacy_id is not null;

create index if not exists idx_training_sessions_date_category_number
  on public.training_sessions(date, category, session_number);

-- 2) Mantener las metricas GPS secundarias en todos los flujos.
alter table public.daily_external_loads add column if not exists high_speed_distance numeric;
alter table public.daily_external_loads add column if not exists sprint_distance numeric;
alter table public.daily_external_loads add column if not exists hsr numeric;
alter table public.daily_external_loads add column if not exists movement_module text;
alter table public.daily_internal_loads add column if not exists movement_module text;

alter table public.competition_players add column if not exists high_speed_distance numeric;
alter table public.competition_players add column if not exists sprint_distance numeric;
alter table public.competition_players add column if not exists hsr numeric;

-- 3) Indices para que las vistas cruzadas carguen rapido.
create index if not exists idx_daily_external_loads_player_date
  on public.daily_external_loads(player_id, date);

create index if not exists idx_daily_internal_loads_player_date
  on public.daily_internal_loads(player_id, date);

create index if not exists idx_daily_wellness_player_date
  on public.daily_wellness(player_id, date);

create index if not exists idx_competition_players_player_match
  on public.competition_players(player_id, match_id);

-- 4) Realtime opcional para refrescar al staff cuando llega wellness o mapa corporal.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.daily_wellness;
    exception when duplicate_object then null;
    end;

    if to_regclass('public.body_map_reports') is not null then
      begin
        alter publication supabase_realtime add table public.body_map_reports;
      exception when duplicate_object then null;
      end;
    end if;
  end if;
end $$;

commit;
