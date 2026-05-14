-- Orsomarso Performance App
-- v121 - Fecha de nacimiento estable e informe individual unificado
-- Seguro: no borra datos. Ejecutar una vez en Supabase SQL Editor.

begin;

alter table if exists public.players
  add column if not exists birth_date date,
  add column if not exists updated_at timestamptz default now();

-- Mantener updated_at disponible para auditoria de futuras actualizaciones.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_players_updated_at on public.players;
create trigger trg_players_updated_at
before update on public.players
for each row execute function public.set_updated_at();

create unique index if not exists ux_players_legacy_id_not_null
  on public.players(legacy_id)
  where legacy_id is not null;

commit;
