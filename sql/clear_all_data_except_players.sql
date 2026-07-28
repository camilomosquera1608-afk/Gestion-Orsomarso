-- Orsomarso Performance App - Limpiar datos y resetear jugadores
-- Este script:
-- 1. Mantiene las valoraciones (nutrition, cmj, neuromuscular, fms)
-- 2. Elimina todos los demás datos (sesiones, competición, monitoreo, etc.)
-- 3. Resetea los datos de rendimiento de los jugadores a 0/null
-- Ejecutar en Supabase SQL Editor
-- IMPORTANTE: Hacer backup antes de ejecutar

begin;

-- Deshabilitar triggers temporalmente para evitar errores
set session_replication_role = replica;

-- Eliminar datos de tablas hijas primero (respetando foreign keys)

-- Sesiones y datos relacionados
delete from public.session_players;
delete from public.training_sessions;

-- Competición y datos relacionados
delete from public.competition_players;
delete from public.competition_matches;

-- Monitoreo diario
delete from public.daily_wellness;
delete from public.daily_internal_loads;
delete from public.daily_external_loads;

-- Microciclos
delete from public.microcycles;

-- Registros médicos
delete from public.medical_notes;

-- Reportes y auditoría
delete from public.report_exports;
delete from public.audit_events;

-- Resetea datos de rendimiento de los jugadores a 0/null
-- Mantiene datos básicos: nombre, fecha nacimiento, posición, categoría, etc.
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
  status = 'Disponible';

-- Reactivar triggers
set session_replication_role = default;

commit;

-- Verificación: mostrar conteo de registros después de la limpieza
-- Las valoraciones (nutrition, cmj, neuromuscular, fms) deben mantener datos
-- El resto debe estar vacío excepto players
select 'players' as table_name, count(*) as remaining_records from public.players
union all
select 'microcycles', count(*) from public.microcycles
union all
select 'daily_wellness', count(*) from public.daily_wellness
union all
select 'daily_internal_loads', count(*) from public.daily_internal_loads
union all
select 'daily_external_loads', count(*) from public.daily_external_loads
union all
select 'training_sessions', count(*) from public.training_sessions
union all
select 'session_players', count(*) from public.session_players
union all
select 'competition_matches', count(*) from public.competition_matches
union all
select 'competition_players', count(*) from public.competition_players
union all
select 'nutrition_records (KEPT)', count(*) from public.nutrition_records
union all
select 'cmj_records (KEPT)', count(*) from public.cmj_records
union all
select 'neuromuscular_records (KEPT)', count(*) from public.neuromuscular_records
union all
select 'fms_records (KEPT)', count(*) from public.fms_records
union all
select 'medical_notes', count(*) from public.medical_notes
union all
select 'report_exports', count(*) from public.report_exports
union all
select 'audit_events', count(*) from public.audit_events
order by table_name;
