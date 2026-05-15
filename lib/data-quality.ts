import type { AppData, ClubCategory } from './types';
import { categoryLabel } from './labels';
import { supportsGps } from './report-utils';
import { getEffectiveExternalLoads } from './relational-data';

export type QualitySeverity = 'ok' | 'warning' | 'error';

export interface QualityCheck {
  id: string;
  label: string;
  severity: QualitySeverity;
  detail: string;
}

export interface CategoryDataTotals {
  players: number;
  u15Players: number;
  u17Players: number;
  u20Players: number;
  microcycles: number;
  microcyclesU15: number;
  microcyclesU17: number;
  microcyclesU20: number;
  sessions: number;
  matches: number;
  nutrition: number;
  evaluations: number;
  gpsRecords: number;
}

export interface CategoryReadinessSummary {
  players: number;
  microcycles: number;
  sessions: number;
  matches: number;
  evaluations: number;
  nutrition: number;
  gpsRecords: number;
}

const hasValue = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';

const isGpsLike = (record: { totalDistance?: number; playerLoad?: number; highSpeedDistance?: number; sprintDistance?: number; maxVelocity?: number }) =>
  Number(record.totalDistance ?? 0) > 0 ||
  Number(record.playerLoad ?? 0) > 0 ||
  Number(record.highSpeedDistance ?? 0) > 0 ||
  Number(record.sprintDistance ?? 0) > 0 ||
  Number(record.maxVelocity ?? 0) > 0;

const categoryKeys: Record<ClubCategory, keyof CategoryDataTotals> = {
  Sub15: 'u15Players',
  Sub17: 'u17Players',
  Sub20: 'u20Players',
};

const microcycleKeys: Record<ClubCategory, keyof CategoryDataTotals> = {
  Sub15: 'microcyclesU15',
  Sub17: 'microcyclesU17',
  Sub20: 'microcyclesU20',
};

export const getDataTotals = (data: AppData): CategoryDataTotals => {
  const u15Players = data.players.filter((player) => player.category === 'Sub15');
  const u17Players = data.players.filter((player) => player.category === 'Sub17');
  const u20Players = data.players.filter((player) => player.category === 'Sub20');
  const microcyclesU15 = data.microcycles.filter((item) => item.category === 'Sub15');
  const microcyclesU17 = data.microcycles.filter((item) => item.category === 'Sub17');
  const microcyclesU20 = data.microcycles.filter((item) => item.category === 'Sub20');
  const gpsRecords = getEffectiveExternalLoads(data).filter(isGpsLike);

  return {
    players: data.players.length,
    u15Players: u15Players.length,
    u17Players: u17Players.length,
    u20Players: u20Players.length,
    microcycles: data.microcycles.length,
    microcyclesU15: microcyclesU15.length,
    microcyclesU17: microcyclesU17.length,
    microcyclesU20: microcyclesU20.length,
    sessions: data.trainingSessionSummaries.length,
    matches: data.competitionMatchSummaries.length,
    nutrition: data.nutritionRecords.length,
    evaluations: data.cmjRecords.length + data.neuromuscularRecords.length + data.fmsRecords.length,
    gpsRecords: gpsRecords.length,
  };
};

export const getCategoryReadinessSummary = (data: AppData, category: ClubCategory): CategoryReadinessSummary => {
  const playerIds = new Set(data.players.filter((player) => player.category === category).map((player) => player.id));
  const gpsRecords = getEffectiveExternalLoads(data, { activeCategory: category, playerIds }).filter(isGpsLike);

  return {
    players: data.players.filter((player) => player.category === category).length,
    microcycles: data.microcycles.filter((item) => item.category === category).length,
    sessions: data.trainingSessionSummaries.filter((item) => item.category === category).length,
    matches: data.competitionMatchSummaries.filter((item) => item.category === category).length,
    evaluations:
      data.cmjRecords.filter((item) => item.category === category).length +
      data.neuromuscularRecords.filter((item) => item.category === category).length +
      data.fmsRecords.filter((item) => item.category === category).length,
    nutrition: data.nutritionRecords.filter((item) => item.category === category).length,
    gpsRecords: gpsRecords.length,
  };
};

export const getCategoryReadinessChecks = (data: AppData, category: ClubCategory): QualityCheck[] => {
  const label = categoryLabel(category);
  const playerIds = new Set(data.players.filter((player) => player.category === category).map((player) => player.id));
  const playersWithoutPosition = data.players.filter((player) => player.category === category && !hasValue(player.position));
  const playersWithoutStatus = data.players.filter((player) => player.category === category && !hasValue(player.status));
  const microcyclesWithoutCategory = data.microcycles.filter((item) => !hasValue(item.category));
  const categoryPlayers = data.players.filter((player) => player.category === category);
  const categoryMicrocycles = data.microcycles.filter((item) => item.category === category);
  const categorySessions = data.trainingSessionSummaries.filter((item) => item.category === category);
  const categoryMatches = data.competitionMatchSummaries.filter((item) => item.category === category);
  const categoryNutrition = data.nutritionRecords.filter((item) => item.category === category);
  const categoryEvaluations = [
    ...data.cmjRecords.filter((item) => item.category === category),
    ...data.neuromuscularRecords.filter((item) => item.category === category),
    ...data.fmsRecords.filter((item) => item.category === category),
  ];
  const effectiveGpsLoads = getEffectiveExternalLoads(data);
  const gpsOutsideU20 = effectiveGpsLoads.filter((record) => isGpsLike(record) && !supportsGps(record.category));
  const gpsWithoutKnownPlayer = effectiveGpsLoads.filter((record) => isGpsLike(record) && supportsGps(record.category) && !playerIds.has(record.playerId));

  const checks: QualityCheck[] = [
    {
      id: `${category}-players`,
      label: `Jugadores ${label}`,
      severity: categoryPlayers.length > 0 ? 'ok' : 'warning',
      detail: categoryPlayers.length > 0 ? `${categoryPlayers.length} jugadores ${label} disponibles.` : `Carga jugadores ${label} antes de sesiones, competencia o valoraciones.`,
    },
    {
      id: `${category}-microcycles`,
      label: `Microciclos ${label}`,
      severity: categoryMicrocycles.length > 0 ? 'ok' : 'warning',
      detail: categoryMicrocycles.length > 0 ? `${categoryMicrocycles.length} microciclos ${label} creados.` : `Crea el microciclo ${label} actual antes de cargar sesiones.`,
    },
    {
      id: 'microcycle-category',
      label: 'Categoría por microciclo',
      severity: microcyclesWithoutCategory.length === 0 ? 'ok' : 'error',
      detail: microcyclesWithoutCategory.length === 0 ? 'Todos los microciclos tienen categoría.' : `${microcyclesWithoutCategory.length} microciclos no tienen categoría.`,
    },
    {
      id: `${category}-player-profile`,
      label: `Perfiles de jugador ${label}`,
      severity: playersWithoutPosition.length === 0 && playersWithoutStatus.length === 0 ? 'ok' : 'warning',
      detail: playersWithoutPosition.length === 0 && playersWithoutStatus.length === 0 ? `Jugadores ${label} con datos operativos básicos.` : `${playersWithoutPosition.length} sin posición · ${playersWithoutStatus.length} sin estado.`,
    },
    {
      id: `${category}-sessions`,
      label: `Sesiones ${label}`,
      severity: categorySessions.length > 0 ? 'ok' : 'warning',
      detail: categorySessions.length > 0 ? `${categorySessions.length} sesiones ${label} registradas.` : `Todavía no hay sesiones ${label} registradas.`,
    },
    {
      id: `${category}-matches`,
      label: `Competencia ${label}`,
      severity: categoryMatches.length > 0 ? 'ok' : 'warning',
      detail: categoryMatches.length > 0 ? `${categoryMatches.length} partidos ${label} registrados.` : `Todavía no hay partidos ${label} registrados.`,
    },
    {
      id: `${category}-evaluations`,
      label: `Valoraciones ${label}`,
      severity: categoryEvaluations.length > 0 || categoryNutrition.length > 0 ? 'ok' : 'warning',
      detail: categoryEvaluations.length > 0 || categoryNutrition.length > 0 ? `${categoryEvaluations.length} valoraciones · ${categoryNutrition.length} nutrición.` : `Todavía no hay valoraciones ${label}.`,
    },
    {
      id: 'gps-u20-only',
      label: 'GPS solo U20',
      severity: gpsOutsideU20.length === 0 ? 'ok' : 'error',
      detail: gpsOutsideU20.length === 0 ? 'No hay métricas GPS fuera de U20.' : `${gpsOutsideU20.length} registros GPS están fuera de U20.`,
    },
  ];

  if (supportsGps(category)) {
    checks.push({
      id: 'gps-player-link',
      label: 'GPS asociado a jugadores U20',
      severity: gpsWithoutKnownPlayer.length === 0 ? 'ok' : 'warning',
      detail: gpsWithoutKnownPlayer.length === 0 ? 'Registros GPS asociados a jugadores U20 conocidos.' : `${gpsWithoutKnownPlayer.length} registros GPS no coinciden con jugadores U20 cargados.`,
    });
  }

  return checks;
};

export const getU20ReadinessChecks = (data: AppData): QualityCheck[] => getCategoryReadinessChecks(data, 'Sub20');

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

export interface DuplicateCheck {
  id: string;
  label: string;
  severity: QualitySeverity;
  detail: string;
  count: number;
}

const normalizeKeyPart = (value: unknown) => String(value ?? '').trim().toLowerCase();

const countDuplicateGroups = <T,>(items: T[], getKey: (item: T) => string) => {
  const groups = new Map<string, number>();
  items.forEach((item) => {
    const key = getKey(item);
    if (!key || key.includes('undefined')) return;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  });
  return Array.from(groups.values()).filter((count) => count > 1).length;
};

const countOverlappingMicrocycles = (data: AppData) => {
  let overlaps = 0;
  const byCategory = new Map<string, typeof data.microcycles>();
  data.microcycles.forEach((microcycle) => {
    const key = microcycle.category ?? 'sin-categoria';
    byCategory.set(key, [...(byCategory.get(key) ?? []), microcycle]);
  });
  byCategory.forEach((items) => {
    items.forEach((current, index) => {
      items.slice(index + 1).forEach((other) => {
        if (!current.startDate || !current.endDate || !other.startDate || !other.endDate) return;
        const overlapsDates = current.startDate <= other.endDate && other.startDate <= current.endDate;
        if (overlapsDates) overlaps += 1;
      });
    });
  });
  return overlaps;
};

export const getDuplicateChecks = (data: AppData): DuplicateCheck[] => {
  const duplicatePlayers = countDuplicateGroups(data.players, (player) => normalizeKeyPart(player.name));
  const duplicateSessions = countDuplicateGroups(data.trainingSessionSummaries, (session) => `${normalizeKeyPart(session.category)}|${session.date}|${session.sessionNumber ?? 1}`);
  const duplicateMatches = countDuplicateGroups(data.competitionMatchSummaries, (match) => `${normalizeKeyPart(match.category)}|${match.date}|${normalizeKeyPart(match.opponent)}`);
  const duplicateWellness = countDuplicateGroups(data.wellness, (record) => `${record.playerId}|${record.date}|${normalizeKeyPart(record.category)}`);
  const duplicateNutrition = countDuplicateGroups(data.nutritionRecords, (record) => `${record.playerId}|${record.date}`);
  const duplicateExternalLoads = countDuplicateGroups(data.externalLoads, (record) => `${record.sessionId ?? `${record.date}-${record.sessionNumber ?? 1}`}|${record.playerId}`);
  const duplicateInternalLoads = countDuplicateGroups(data.internalLoads, (record) => `${record.sessionId ?? `${record.date}-${record.sessionNumber ?? 1}`}|${record.playerId}`);
  const overlappingMicrocycles = countOverlappingMicrocycles(data);

  const build = (id: string, label: string, count: number, okDetail: string, badDetail: string): DuplicateCheck => ({
    id,
    label,
    count,
    severity: count === 0 ? 'ok' : 'warning',
    detail: count === 0 ? okDetail : badDetail.replace('{count}', String(count)),
  });

  return [
    build('duplicate-players', 'Jugadores repetidos', duplicatePlayers, 'Sin nombres de jugador repetidos.', '{count} posibles nombres repetidos.'),
    build('duplicate-sessions', 'Sesiones duplicadas', duplicateSessions, 'Sin sesiones repetidas por fecha, categoría y número de sesión.', '{count} fecha/categoría/número de sesión con más de un registro.'),
    build('overlap-microcycles', 'Microciclos solapados', overlappingMicrocycles, 'Sin solapamientos de microciclo por categoría.', '{count} solapamientos de microciclo detectados.'),
    build('duplicate-matches', 'Partidos duplicados', duplicateMatches, 'Sin partidos repetidos por fecha, categoría y rival.', '{count} partidos posiblemente duplicados.'),
    build('duplicate-wellness', 'Wellness duplicado', duplicateWellness, 'Una respuesta wellness por jugador y fecha.', '{count} jugadores con más de un wellness el mismo día.'),
    build('duplicate-nutrition', 'Nutrición duplicada', duplicateNutrition, 'Una valoración nutricional por jugador y fecha.', '{count} valoraciones nutricionales posiblemente duplicadas.'),
    build('duplicate-external-loads', 'Carga externa duplicada', duplicateExternalLoads, 'Una carga externa por jugador y sesión.', '{count} jugadores con carga externa duplicada en sesión.'),
    build('duplicate-internal-loads', 'Carga interna duplicada', duplicateInternalLoads, 'Una carga interna por jugador y sesión.', '{count} jugadores con carga interna duplicada en sesión.'),
  ];
};
