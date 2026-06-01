-- V112 · Módulo de fuerza planificada y respuesta post gimnasio
-- Ejecutar en Supabase SQL Editor para sincronizar el módulo Fuerza entre dispositivos.

create table if not exists public.strength_sessions (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique not null,
  date date not null,
  category text default 'Sub20',
  group_name text not null default 'Todo el plantel',
  strength_type text not null default 'Concéntrica',
  zone text not null default 'Cadena posterior',
  intent text default 'Activación',
  movement_pattern text default 'Aceleración',
  duration_min numeric default 0,
  expected_rpe numeric default 0,
  objective text,
  restrictions text,
  player_ids jsonb default '[]'::jsonb,
  excluded_player_ids jsonb default '[]'::jsonb,
  exercises jsonb default '[]'::jsonb,
  adjustments jsonb default '[]'::jsonb,
  responses jsonb default '[]'::jsonb,
  created_by text,
  created_at timestamptz default now(),
  status text default 'Planificada',
  updated_at timestamptz default now()
);

create index if not exists idx_strength_sessions_date_category on public.strength_sessions(date, category);

alter table public.strength_sessions enable row level security;

do $$ begin
  create policy "strength_sessions_authenticated_all" on public.strength_sessions
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create or replace function public.set_strength_sessions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_strength_sessions_updated_at on public.strength_sessions;
create trigger trg_strength_sessions_updated_at
before update on public.strength_sessions
for each row execute function public.set_strength_sessions_updated_at();


-- Compatibilidad para proyectos que ya ejecutaron V112 antes de agregar diseño de ejercicios
alter table public.strength_sessions
  add column if not exists exercises jsonb default '[]'::jsonb;

-- V112.2 · Microdosis de fuerza y patrón de movimiento
alter table public.strength_sessions
  add column if not exists intent text default 'Activación',
  add column if not exists movement_pattern text default 'Aceleración';
