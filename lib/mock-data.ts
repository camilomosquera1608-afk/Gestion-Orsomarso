import { AppData } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// DATOS INICIALES — Solo estructura, sin datos de ejemplo operativos.
//
// FIX PRINCIPAL: Antes este archivo tenía jugadores de muestra (p1, p2...)
// con cargas, wellness, valoraciones y sesiones con valores reales.
// Eso causaba que en ciertos escenarios de fallback aparecieran datos
// fantasma en las vistas (ej: "Carga interna 665" sin haber subido nada).
//
// Ahora todos los arrays operativos están vacíos. Los microciclos se
// conservan como estructura de numeración base.
// ─────────────────────────────────────────────────────────────────────────────

export const initialData: AppData = {
  trainingSessionSummaries: [],
  strengthSessions: [],
  microcycles: [
    { id: 'mc-52', name: 'Microciclo 52', startDate: '', endDate: '' },
    { id: 'mc-51', name: 'Microciclo 51', startDate: '', endDate: '' },
    { id: 'mc-50', name: 'Microciclo 50', startDate: '', endDate: '' },
    { id: 'mc-49', name: 'Microciclo 49', startDate: '', endDate: '' },
    { id: 'mc-48', name: 'Microciclo 48', startDate: '', endDate: '' },
    { id: 'mc-47', name: 'Microciclo 47', startDate: '', endDate: '' },
    { id: 'mc-46', name: 'Microciclo 46', startDate: '', endDate: '' },
    { id: 'mc-45', name: 'Microciclo 45', startDate: '', endDate: '' },
    { id: 'mc-44', name: 'Microciclo 44', startDate: '', endDate: '' },
    { id: 'mc-43', name: 'Microciclo 43', startDate: '', endDate: '' },
    { id: 'mc-42', name: 'Microciclo 42', startDate: '', endDate: '' },
    { id: 'mc-41', name: 'Microciclo 41', startDate: '', endDate: '' },
    { id: 'mc-40', name: 'Microciclo 40', startDate: '', endDate: '' },
    { id: 'mc-39', name: 'Microciclo 39', startDate: '', endDate: '' },
    { id: 'mc-38', name: 'Microciclo 38', startDate: '', endDate: '' },
    { id: 'mc-37', name: 'Microciclo 37', startDate: '', endDate: '' },
    { id: 'mc-36', name: 'Microciclo 36', startDate: '', endDate: '' },
    { id: 'mc-35', name: 'Microciclo 35', startDate: '', endDate: '' },
    { id: 'mc-34', name: 'Microciclo 34', startDate: '', endDate: '' },
    { id: 'mc-33', name: 'Microciclo 33', startDate: '', endDate: '' },
    { id: 'mc-32', name: 'Microciclo 32', startDate: '', endDate: '' },
    { id: 'mc-31', name: 'Microciclo 31', startDate: '', endDate: '' },
    { id: 'mc-30', name: 'Microciclo 30', startDate: '', endDate: '' },
    { id: 'mc-29', name: 'Microciclo 29', startDate: '', endDate: '' },
    { id: 'mc-28', name: 'Microciclo 28', startDate: '', endDate: '' },
    { id: 'mc-27', name: 'Microciclo 27', startDate: '', endDate: '' },
    { id: 'mc-26', name: 'Microciclo 26', startDate: '', endDate: '' },
    { id: 'mc-25', name: 'Microciclo 25', startDate: '', endDate: '' },
    { id: 'mc-24', name: 'Microciclo 24', startDate: '', endDate: '' },
    { id: 'mc-23', name: 'Microciclo 23', startDate: '', endDate: '' },
    { id: 'mc-22', name: 'Microciclo 22', startDate: '', endDate: '' },
    { id: 'mc-21', name: 'Microciclo 21', startDate: '', endDate: '' },
    { id: 'mc-20', name: 'Microciclo 20', startDate: '', endDate: '' },
    { id: 'mc-19', name: 'Microciclo 19', startDate: '', endDate: '' },
    { id: 'mc-18', name: 'Microciclo 18', startDate: '', endDate: '' },
    { id: 'mc-17', name: 'Microciclo 17', startDate: '', endDate: '' },
    { id: 'mc-16', name: 'Microciclo 16', startDate: '', endDate: '' },
    { id: 'mc-15', name: 'Microciclo 15', startDate: '', endDate: '' },
    { id: 'mc-14', name: 'Microciclo 14', startDate: '', endDate: '' },
    { id: 'mc-13', name: 'Microciclo 13', startDate: '', endDate: '' },
    { id: 'mc-12', name: 'Microciclo 12', startDate: '', endDate: '' },
    { id: 'mc-11', name: 'Microciclo 11', startDate: '', endDate: '' },
    { id: 'mc-10', name: 'Microciclo 10', startDate: '', endDate: '' },
    { id: 'mc-9',  name: 'Microciclo 9',  startDate: '', endDate: '' },
    { id: 'mc-8',  name: 'Microciclo 8',  startDate: '', endDate: '' },
    { id: 'mc-7',  name: 'Microciclo 7',  startDate: '', endDate: '' },
    { id: 'mc-6',  name: 'Microciclo 6',  startDate: '', endDate: '' },
    { id: 'mc-5',  name: 'Microciclo 5',  startDate: '', endDate: '' },
    { id: 'mc-4',  name: 'Microciclo 4',  startDate: '', endDate: '' },
    { id: 'mc-3',  name: 'Microciclo 3',  startDate: '', endDate: '' },
    { id: 'mc-2',  name: 'Microciclo 2',  startDate: '', endDate: '' },
    { id: 'mc-1',  name: 'Microciclo 1',  startDate: '', endDate: '' },
  ],
  players: [],
  wellness: [],
  internalLoads: [],
  externalLoads: [],
  cmjRecords: [],
  nutritionRecords: [],
  neuromuscularRecords: [],
  fmsRecords: [],
  competitionMatchSummaries: [],
  competitionRecords: [],
};
