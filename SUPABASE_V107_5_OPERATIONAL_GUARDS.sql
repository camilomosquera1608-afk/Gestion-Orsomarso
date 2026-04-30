-- v107.5 - Guardas operativas de duplicados
-- Ejecutar solo si ya limpiaste duplicados existentes. No borra datos.

-- Una sesión por categoría y fecha.
create unique index if not exists ux_training_sessions_category_date
  on public.training_sessions(category, date);

-- Un partido por categoría, fecha y rival.
create unique index if not exists ux_competition_matches_category_date_opponent
  on public.competition_matches(category, date, lower(trim(opponent)));

-- Un jugador una sola vez por partido.
create unique index if not exists ux_competition_players_match_player
  on public.competition_players(match_id, player_id);

-- Nombre de microciclo único por categoría.
create unique index if not exists ux_microcycles_category_name
  on public.microcycles(category, lower(trim(name)));

-- Nota: PostgreSQL no puede garantizar solapamiento de fechas con un índice simple.
-- La app bloquea solapamientos de microciclos por categoría antes de guardar.
