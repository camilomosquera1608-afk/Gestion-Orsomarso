-- Orsomarso Performance App
-- V130 - Mapa corporal de wellness visible para cuerpo tecnico
-- Seguro: no borra datos. Crea tabla remota y RPC publica controlada.

begin;

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

create table if not exists public.body_map_reports (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  player_id uuid references public.players(id) on delete cascade,
  player_legacy_id text,
  date date not null,
  category text check (category in ('Sub15', 'Sub17', 'Sub20')),
  source text not null default 'Jugador',
  type text not null default 'Molestia',
  region text not null default 'Otro',
  side text not null default 'Central',
  intensity numeric not null default 0 check (intensity between 0 and 10),
  limitation boolean not null default false,
  increases_with_sprint boolean not null default false,
  increases_with_change_of_direction boolean not null default false,
  mechanism text,
  notes text,
  action text,
  restriction text,
  load_allowed_pct numeric,
  status text not null default 'Abierto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.body_map_reports add column if not exists player_legacy_id text;
alter table public.body_map_reports add column if not exists increases_with_sprint boolean not null default false;
alter table public.body_map_reports add column if not exists increases_with_change_of_direction boolean not null default false;
alter table public.body_map_reports add column if not exists load_allowed_pct numeric;

create index if not exists idx_body_map_reports_date_category on public.body_map_reports(date, category);
create index if not exists idx_body_map_reports_player_date on public.body_map_reports(player_id, date desc);
create index if not exists idx_body_map_reports_player_legacy_date on public.body_map_reports(player_legacy_id, date desc);
create index if not exists idx_body_map_reports_status on public.body_map_reports(status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_body_map_reports_updated_at
before update on public.body_map_reports
for each row execute function public.set_updated_at();

alter table public.body_map_reports enable row level security;

grant select, insert, update on public.body_map_reports to anon, authenticated;

drop policy if exists body_map_staff_read on public.body_map_reports;
create policy body_map_staff_read
on public.body_map_reports
for select
to authenticated
using (true);

drop policy if exists body_map_public_read_recent on public.body_map_reports;
create policy body_map_public_read_recent
on public.body_map_reports
for select
to anon
using (false);

drop policy if exists body_map_public_insert on public.body_map_reports;
create policy body_map_public_insert
on public.body_map_reports
for insert
to anon
with check (
  source = 'Jugador'
  and category in ('Sub15', 'Sub17', 'Sub20')
  and intensity between 0 and 10
  and date between current_date - interval '7 days' and current_date + interval '1 day'
);

drop policy if exists body_map_public_update on public.body_map_reports;
create policy body_map_public_update
on public.body_map_reports
for update
to anon
using (source = 'Jugador')
with check (
  source = 'Jugador'
  and category in ('Sub15', 'Sub17', 'Sub20')
  and intensity between 0 and 10
);

drop policy if exists body_map_staff_write on public.body_map_reports;
create policy body_map_staff_write
on public.body_map_reports
for all
to authenticated
using (true)
with check (true);

create or replace function public.submit_public_body_map_report(
  p_player_id uuid,
  p_player_legacy_id text,
  p_date date,
  p_category text,
  p_type text,
  p_region text,
  p_side text,
  p_intensity numeric,
  p_limitation boolean,
  p_increases_with_sprint boolean,
  p_increases_with_change_of_direction boolean,
  p_action text,
  p_restriction text,
  p_legacy_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_legacy_id text := coalesce(nullif(p_legacy_id, ''), 'body-map-' || extract(epoch from clock_timestamp())::bigint::text || '-' || substr(md5(random()::text), 1, 8));
begin
  if p_category not in ('Sub15', 'Sub17', 'Sub20') then
    raise exception 'Categoria no permitida';
  end if;

  if p_intensity is null or p_intensity < 0 or p_intensity > 10 then
    raise exception 'Intensidad no valida';
  end if;

  if not exists (
    select 1 from public.players
    where id = p_player_id
      and category = p_category
      and coalesce(status, 'active') <> 'archived'
  ) then
    raise exception 'Jugador no valido para esta categoria';
  end if;

  insert into public.body_map_reports (
    legacy_id,
    player_id,
    player_legacy_id,
    date,
    category,
    source,
    type,
    region,
    side,
    intensity,
    limitation,
    increases_with_sprint,
    increases_with_change_of_direction,
    action,
    restriction,
    status,
    created_at,
    updated_at
  ) values (
    v_legacy_id,
    p_player_id,
    nullif(p_player_legacy_id, ''),
    p_date,
    p_category,
    'Jugador',
    coalesce(nullif(p_type, ''), 'Molestia'),
    coalesce(nullif(p_region, ''), 'Otro'),
    coalesce(nullif(p_side, ''), 'Central'),
    p_intensity,
    coalesce(p_limitation, false),
    coalesce(p_increases_with_sprint, false),
    coalesce(p_increases_with_change_of_direction, false),
    p_action,
    p_restriction,
    'Abierto',
    now(),
    now()
  )
  on conflict (legacy_id)
  do update set
    player_id = excluded.player_id,
    player_legacy_id = excluded.player_legacy_id,
    date = excluded.date,
    category = excluded.category,
    source = excluded.source,
    type = excluded.type,
    region = excluded.region,
    side = excluded.side,
    intensity = excluded.intensity,
    limitation = excluded.limitation,
    increases_with_sprint = excluded.increases_with_sprint,
    increases_with_change_of_direction = excluded.increases_with_change_of_direction,
    action = excluded.action,
    restriction = excluded.restriction,
    status = excluded.status,
    updated_at = now();
end;
$$;

grant execute on function public.submit_public_body_map_report(uuid, text, date, text, text, text, text, numeric, boolean, boolean, boolean, text, text, text) to anon;
grant execute on function public.submit_public_body_map_report(uuid, text, date, text, text, text, text, numeric, boolean, boolean, boolean, text, text, text) to authenticated;

commit;
