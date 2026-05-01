-- Orsomarso Performance App
-- v108.1 - Wellness publico estable
-- Seguro: no borra datos. Crea RPC publica controlada para enviar wellness.

begin;

grant usage on schema public to anon;
grant select on public.players to anon;
grant insert, update on public.daily_wellness to anon;

create unique index if not exists ux_daily_wellness_player_date
  on public.daily_wellness(player_id, date);

drop policy if exists public_wellness_players_read on public.players;
create policy public_wellness_players_read
on public.players
for select
to anon
using (
  category in ('Sub15', 'Sub17', 'Sub20')
  and coalesce(status, 'active') <> 'archived'
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
using (category in ('Sub15', 'Sub17', 'Sub20'))
with check (
  category in ('Sub15', 'Sub17', 'Sub20')
  and sleep between 0 and 5
  and fatigue between 0 and 5
  and stress between 0 and 5
  and muscle_pain between 0 and 5
  and mood between 0 and 5
);

create or replace function public.submit_public_wellness(
  p_player_id uuid,
  p_date date,
  p_category text,
  p_sleep numeric,
  p_fatigue numeric,
  p_stress numeric,
  p_muscle_pain numeric,
  p_mood numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_category not in ('Sub15', 'Sub17', 'Sub20') then
    raise exception 'Categoria no permitida';
  end if;

  if not exists (
    select 1 from public.players
    where id = p_player_id
      and category = p_category
      and coalesce(status, 'active') <> 'archived'
  ) then
    raise exception 'Jugador no valido para esta categoria';
  end if;

  if p_sleep not between 1 and 5
    or p_fatigue not between 1 and 5
    or p_stress not between 1 and 5
    or p_muscle_pain not between 1 and 5
    or p_mood not between 1 and 5 then
    raise exception 'Respuestas incompletas';
  end if;

  insert into public.daily_wellness (
    player_id, date, category, sleep, fatigue, stress, muscle_pain, mood, updated_at
  ) values (
    p_player_id, p_date, p_category, p_sleep, p_fatigue, p_stress, p_muscle_pain, p_mood, now()
  )
  on conflict (player_id, date)
  do update set
    category = excluded.category,
    sleep = excluded.sleep,
    fatigue = excluded.fatigue,
    stress = excluded.stress,
    muscle_pain = excluded.muscle_pain,
    mood = excluded.mood,
    updated_at = now();
end;
$$;

grant execute on function public.submit_public_wellness(uuid, date, text, numeric, numeric, numeric, numeric, numeric) to anon;
grant execute on function public.submit_public_wellness(uuid, date, text, numeric, numeric, numeric, numeric, numeric) to authenticated;

commit;
