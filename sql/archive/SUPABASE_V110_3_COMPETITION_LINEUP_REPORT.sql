-- Orsomarso Performance App - v110.3
-- Alineacion editable y datos de informe de competencia.
begin;

alter table if exists public.competition_matches
  add column if not exists lineup_formation text,
  add column if not exists lineup_slots jsonb not null default '[]'::jsonb;

create index if not exists idx_competition_matches_lineup_formation
  on public.competition_matches(lineup_formation);

commit;
