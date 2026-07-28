-- Orsomarso Performance App - Limpiar todos los datos excepto jugadores
-- Este script elimina TODOS los datos de la base de datos EXCEPTO la tabla players
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

-- Evaluaciones y registros médicos
delete from public.nutrition_records;
delete from public.cmj_records;
delete from public.neuromuscular_records;
delete from public.fms_records;
delete from public.medical_notes;

-- Reportes y auditoría
delete from public.report_exports;
delete from public.audit_events;

-- Reactivar triggers
set session_replication_role = default;

commit;

-- Verificación: mostrar conteo de registros después de la limpieza
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
select 'nutrition_records', count(*) from public.nutrition_records
union all
select 'cmj_records', count(*) from public.cmj_records
union all
select 'neuromuscular_records', count(*) from public.neuromuscular_records
union all
select 'fms_records', count(*) from public.fms_records
union all
select 'medical_notes', count(*) from public.medical_notes
union all
select 'report_exports', count(*) from public.report_exports
union all
select 'audit_events', count(*) from public.audit_events
order by table_name;
