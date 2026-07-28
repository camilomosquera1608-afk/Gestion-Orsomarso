-- Script para limpiar datos de competencia
-- Este script elimina todos los datos de competencia manteniendo los jugadores

-- Limpiar CompetitionMatchSummaries
DELETE FROM competition_match_summaries;

-- Limpiar CompetitionRecords
DELETE FROM competition_records;

-- Limpiar CompetitionLineupSlots
DELETE FROM competition_lineup_slots;

-- Confirmar limpieza
SELECT 'Datos de competencia limpiados exitosamente' as status;
SELECT COUNT(*) as remaining_players FROM players;
SELECT COUNT(*) as competition_match_summaries FROM competition_match_summaries;
SELECT COUNT(*) as competition_records FROM competition_records;
SELECT COUNT(*) as competition_lineup_slots FROM competition_lineup_slots;
