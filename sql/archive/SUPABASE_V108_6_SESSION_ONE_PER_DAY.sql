-- v108.6 - Sesion unica por categoria y fecha
-- Ejecuta este archivo despues de verificar que no existan sesiones duplicadas por date + category.
-- Si hay duplicados, primero consolida la sesion correcta desde la app o revisa manualmente en Supabase.

-- 1) Diagnostico: muestra duplicados si existen.
select date, category, count(*) as total
from public.training_sessions
group by date, category
having count(*) > 1;

-- 2) Guarda fuerte: una sesion por categoria y fecha.
create unique index if not exists training_sessions_one_per_category_date_idx
on public.training_sessions(date, category);

-- 3) Guarda fuerte para planilla: un registro por jugador dentro de una sesion.
create unique index if not exists daily_external_loads_one_player_per_session_idx
on public.daily_external_loads(session_id, player_id)
where session_id is not null;

create unique index if not exists daily_internal_loads_one_player_per_session_idx
on public.daily_internal_loads(session_id, player_id)
where session_id is not null;
