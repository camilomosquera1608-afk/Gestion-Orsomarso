-- Orsomarso Performance App
-- v107.4 - Wellness publico por categoria
-- Ejecutar en Supabase SQL Editor si los links /wellness/u20, /wellness/u17 o /wellness/u15 no cargan jugadores.
-- Seguro: no borra datos, no usa app_state y no abre eliminacion publica.

begin;

grant usage on schema public to anon;
grant select on public.players to anon;
grant insert, update on public.daily_wellness to anon;

drop policy if exists public_wellness_players_read on public.players;
create policy public_wellness_players_read
on public.players
for select
to anon
using (
  category in ('Sub15', 'Sub17', 'Sub20')
);

drop policy if exists public_wellness_insert on public.daily_wellness;
create policy public_wellness_insert
on public.daily_wellness
for insert
to anon
with check (
  category in ('Sub15', 'Sub17', 'Sub20')
  and sleep between 0 and 5
  and fatigue between 0 and 5
  and stress between 0 and 5
  and muscle_pain between 0 and 5
  and mood between 0 and 5
);

drop policy if exists public_wellness_update on public.daily_wellness;
create policy public_wellness_update
on public.daily_wellness
for update
to anon
using (
  category in ('Sub15', 'Sub17', 'Sub20')
)
with check (
  category in ('Sub15', 'Sub17', 'Sub20')
  and sleep between 0 and 5
  and fatigue between 0 and 5
  and stress between 0 and 5
  and muscle_pain between 0 and 5
  and mood between 0 and 5
);

commit;
