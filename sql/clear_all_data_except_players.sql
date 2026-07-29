-- Orsomarso Performance App - Limpiar datos y resetear jugadores
-- UNA TABLA A LA VEZ para evitar timeout
-- Ejecutar cada línea por separado en Supabase SQL Editor

-- ═════════════════════════════════════════════════════════════════════════════
-- PASO 0: Deshabilitar triggers (ejecutar primero)
-- ═════════════════════════════════════════════════════════════════════════════
set session_replication_role = replica;

-- ═════════════════════════════════════════════════════════════════════════════
-- PASO 1: Eliminar tablas una por una (ejecutar cada línea por separado)
-- ═════════════════════════════════════════════════════════════════════════════
truncate table public.daily_external_loads cascade;
truncate table public.daily_internal_loads cascade;
truncate table public.daily_wellness cascade;
truncate table public.session_players cascade;
truncate table public.training_sessions cascade;
truncate table public.competition_players cascade;
truncate table public.competition_matches cascade;
truncate table public.microcycles cascade;
truncate table public.medical_notes cascade;
truncate table public.report_exports cascade;
truncate table public.audit_events cascade;

-- ═════════════════════════════════════════════════════════════════════════════
-- PASO 2: Resetear datos de jugadores
-- ═════════════════════════════════════════════════════════════════════════════
update public.players set
  load_tolerance = null,
  max_velocity_reference = null,
  baseline_wellness = null,
  baseline_rpe = null,
  target_weekly_load = null,
  target_weekly_hsr = null,
  target_weekly_sprint_distance = null,
  target_minutes_7d = null,
  max_training_percent = null,
  max_competition_minutes = null,
  return_to_play_phase = null,
  restrictions = '[]'::jsonb,
  injury_area = null,
  injury_type = null,
  injury_severity = null,
  return_date = null,
  injury_history = '[]'::jsonb,
  status = 'Disponible';

-- ═════════════════════════════════════════════════════════════════════════════
-- PASO 3: Reactivar triggers
-- ═════════════════════════════════════════════════════════════════════════════
set session_replication_role = default;
