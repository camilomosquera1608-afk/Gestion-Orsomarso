-- Script para limpiar datos de competencia
-- Este script elimina todos los datos de competencia manteniendo los jugadores

-- Limpiar competition_matches
DELETE FROM competition_matches;

-- Limpiar competition_players
DELETE FROM competition_players;

-- Confirmar limpieza
SELECT 'Datos de competencia limpiados exitosamente' as status;
SELECT COUNT(*) as remaining_players FROM players;
SELECT COUNT(*) as competition_matches FROM competition_matches;
SELECT COUNT(*) as competition_players FROM competition_players;
