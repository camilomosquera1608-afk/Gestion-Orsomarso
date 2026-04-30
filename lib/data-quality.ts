import type { AppData } from './types';
import { supportsGps } from './report-utils';

export type QualitySeverity = 'ok' | 'warning' | 'error';

export interface QualityCheck {
  id: string;
  label: string;
  severity: QualitySeverity;
  detail: string;
}

const hasValue = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';

const isGpsLike = (record: { totalDistance?: number; playerLoad?: number; highSpeedDistance?: number; sprintDistance?: number; maxVelocity?: number }) =>
  Number(record.totalDistance ?? 0) > 0 ||
  Number(record.playerLoad ?? 0) > 0 ||
  Number(record.highSpeedDistance ?? 0) > 0 ||
  Number(record.sprintDistance ?? 0) > 0 ||
  Number(record.maxVelocity ?? 0) > 0;

export const getDataTotals = (data: AppData) => {
  const u20Players = data.players.filter((player) => player.category === 'Sub20');
  const u17Players = data.players.filter((player) => player.category === 'Sub17');
  const microcyclesU20 = data.microcycles.filter((item) => item.category === 'Sub20');
  const microcyclesU17 = data.microcycles.filter((item) => item.category === 'Sub17');
  const gpsRecords = data.externalLoads.filter(isGpsLike);

  return {
    players: data.players.length,
    u20Players: u20Players.length,
    u17Players: u17Players.length,
    microcycles: data.microcycles.length,
    microcyclesU20: microcyclesU20.length,
    microcyclesU17: microcyclesU17.length,
    sessions: data.trainingSessionSummaries.length,
    matches: data.competitionMatchSummaries.length,
    nutrition: data.nutritionRecords.length,
    evaluations: data.cmjRecords.length + data.neuromuscularRecords.length + data.fmsRecords.length,
    gpsRecords: gpsRecords.length,
  };
};

export const getU20ReadinessChecks = (data: AppData): QualityCheck[] => {
  const totals = getDataTotals(data);
  const u20PlayerIds = new Set(data.players.filter((player) => player.category === 'Sub20').map((player) => player.id));
  const playersWithoutPosition = data.players.filter((player) => player.category === 'Sub20' && !hasValue(player.position));
  const playersWithoutStatus = data.players.filter((player) => player.category === 'Sub20' && !hasValue(player.status));
  const microcyclesWithoutCategory = data.microcycles.filter((item) => !hasValue(item.category));
  const u20Sessions = data.trainingSessionSummaries.filter((item) => item.category === 'Sub20');
  const u20Matches = data.competitionMatchSummaries.filter((item) => item.category === 'Sub20');
  const gpsOutsideU20 = data.externalLoads.filter((record) => isGpsLike(record) && !supportsGps(record.category));
  const gpsWithoutKnownPlayer = data.externalLoads.filter((record) => isGpsLike(record) && !u20PlayerIds.has(record.playerId));

  return [
    {
      id: 'u20-players',
      label: 'Jugadores U20',
      severity: totals.u20Players > 0 ? 'ok' : 'warning',
      detail: totals.u20Players > 0 ? `${totals.u20Players} jugadores U20 disponibles.` : 'Carga jugadores U20 antes de sesiones, competencia o GPS.',
    },
    {
      id: 'u20-microcycles',
      label: 'Microciclos U20',
      severity: totals.microcyclesU20 > 0 ? 'ok' : 'warning',
      detail: totals.microcyclesU20 > 0 ? `${totals.microcyclesU20} microciclos U20 creados.` : 'Crea el microciclo U20 actual antes de cargar sesiones.',
    },
    {
      id: 'microcycle-category',
      label: 'Categoría por microciclo',
      severity: microcyclesWithoutCategory.length === 0 ? 'ok' : 'error',
      detail: microcyclesWithoutCategory.length === 0 ? 'Todos los microciclos tienen categoría.' : `${microcyclesWithoutCategory.length} microciclos no tienen categoría.`,
    },
    {
      id: 'u20-player-profile',
      label: 'Perfiles de jugador U20',
      severity: playersWithoutPosition.length === 0 && playersWithoutStatus.length === 0 ? 'ok' : 'warning',
      detail: playersWithoutPosition.length === 0 && playersWithoutStatus.length === 0 ? 'Jugadores U20 con datos operativos básicos.' : `${playersWithoutPosition.length} sin posición · ${playersWithoutStatus.length} sin estado.`,
    },
    {
      id: 'u20-sessions',
      label: 'Sesiones U20',
      severity: u20Sessions.length > 0 ? 'ok' : 'warning',
      detail: u20Sessions.length > 0 ? `${u20Sessions.length} sesiones U20 registradas.` : 'Todavía no hay sesiones U20 registradas.',
    },
    {
      id: 'u20-matches',
      label: 'Competencia U20',
      severity: u20Matches.length > 0 ? 'ok' : 'warning',
      detail: u20Matches.length > 0 ? `${u20Matches.length} partidos U20 registrados.` : 'Todavía no hay partidos U20 registrados.',
    },
    {
      id: 'gps-u20-only',
      label: 'GPS solo U20',
      severity: gpsOutsideU20.length === 0 ? 'ok' : 'error',
      detail: gpsOutsideU20.length === 0 ? 'No hay métricas GPS fuera de U20.' : `${gpsOutsideU20.length} registros GPS están fuera de U20.`,
    },
    {
      id: 'gps-player-link',
      label: 'GPS asociado a jugadores U20',
      severity: gpsWithoutKnownPlayer.length === 0 ? 'ok' : 'warning',
      detail: gpsWithoutKnownPlayer.length === 0 ? 'Registros GPS asociados a jugadores U20 conocidos.' : `${gpsWithoutKnownPlayer.length} registros GPS no coinciden con jugadores U20 cargados.`,
    },
  ];
};

export const getOverallDataQuality = (checks: QualityCheck[]): QualitySeverity => {
  if (checks.some((check) => check.severity === 'error')) return 'error';
  if (checks.some((check) => check.severity === 'warning')) return 'warning';
  return 'ok';
};

export const qualityLabel = (severity: QualitySeverity) => {
  if (severity === 'ok') return 'Correcto';
  if (severity === 'warning') return 'Revisar';
  return 'Crítico';
};

export const qualityToneClass = (severity: QualitySeverity) => `quality-${severity}`;
