import type { AppData, ClubCategory, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord, GlobalFilters, Player, PlayerStatus } from './types';
import { averageWellness, calculateExternalLoad, calculateInternalLoad, computeWellnessScore, externalLoadHasInternalPair, getPlayerDayLoad, groupAverage } from './utils';
import { findMicrocycleByDate, formatMatchScore, isGoalkeeper } from './performance-helpers';
import { addDays, buildDailyOperations, eachDateInRange, formatDateShort, getVisiblePlayers, isSameCategory, type OperationalAlert } from './operational-helpers';
import { supportsGps } from './report-utils';
import { getEffectiveExternalLoads, getRelatedPlayerIds, getRelatedPlayerIdSet, getWellnessRecordsForDate, uniqueWellnessByPlayerIdentityDate } from './relational-data';
import { computePlayerLoadRiskProfile, computeMonotonyStrain as computeEngineMonotonyStrain } from './load-risk-engine';

export type UiHealthTone = 'green' | 'amber' | 'red' | 'blue' | 'neutral' | 'dark';

export const playerStatusTone = (status: PlayerStatus | string): UiHealthTone => {
  if (status === 'Disponible') return 'green';
  if (status === 'Molestia') return 'amber';
  if (status === 'Readaptación') return 'blue';
  if (status === 'Lesionado') return 'red';
  return 'neutral';
};

export const activeCategoryLabel = (category: string) => category === 'all' ? 'Todas las categorías' : category;

const byDateDesc = <T extends { date: string }>(records: T[]) => records.slice().sort((a, b) => b.date.localeCompare(a.date));

const dateInRange = (date: string, dates: string[]) => dates.includes(date);

const daysDiff = (from?: string, to?: string) => {
  if (!from || !to) return 999;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 999;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
};

const playerIds = (allPlayers: Player[], players: Player[]) => getRelatedPlayerIdSet(allPlayers, players);

export const getActiveRange = (data: AppData, filters: GlobalFilters, activeCategory: string) => {
  const microcycle = filters.date
    ? findMicrocycleByDate(data.microcycles, filters.date, filters.microcycleId, activeCategory)
    : data.microcycles.find((item) => item.id === filters.microcycleId);
  const dates = microcycle?.startDate && microcycle?.endDate ? eachDateInRange(microcycle.startDate, microcycle.endDate) : [filters.date].filter(Boolean);
  return { microcycle, dates };
};

export interface AvailabilityRow {
  player: Player;
  tone: UiHealthTone;
  latestWellness: number;
  todayMinutes: number;
  weeklyMinutes: number;
  latestMedicalObservation: string;
  latestCompetitionDate?: string;
  recommendation: string;
}

export const buildAvailabilityCenter = (data: AppData, filters: GlobalFilters, activeCategory: string) => {
  const gpsEnabled = activeCategory === 'all' || supportsGps(activeCategory);
  const players = getVisiblePlayers(data, filters, activeCategory);
  const ids = playerIds(data.players, players);
  const { dates } = getActiveRange(data, filters, activeCategory);
  const rows: AvailabilityRow[] = players.map((player) => {
    const relatedIds = getRelatedPlayerIds(data.players, player.id);
    const wellnessToday = getWellnessRecordsForDate(data, filters.date, relatedIds)[0];
    const playerEffectiveExternal = gpsEnabled ? getEffectiveExternalLoads(data, { activeCategory, playerIds: relatedIds }) : [];
    const externalToday = gpsEnabled ? playerEffectiveExternal.find((item) => item.date === filters.date) : undefined;
    const weeklyExternal = gpsEnabled ? playerEffectiveExternal.filter((item) => dateInRange(item.date, dates)) : [];
    const latestMedical = byDateDesc(data.competitionRecords.filter((item) => relatedIds.has(item.playerId) && (item.medicalObservation || item.medicalStatus === 'Lesionado' || item.postCompetitionStatus === 'Lesionado')))[0];
    const latestCompetition = byDateDesc(data.competitionRecords.filter((item) => relatedIds.has(item.playerId)))[0];
    const latestWellness = computeWellnessScore(wellnessToday);
    const recommendation = player.status === 'Lesionado'
      ? 'No disponible - seguimiento médico'
      : player.status === 'Readaptación'
        ? 'Trabajo controlado y progresivo'
        : player.status === 'Molestia'
          ? 'Controlar antes de competir'
          : latestWellness > 0 && latestWellness < 3
            ? 'Revisar wellness y recuperación'
            : 'Disponible para planificación';
    return {
      player,
      tone: playerStatusTone(player.status),
      latestWellness,
      todayMinutes: externalToday?.min ?? 0,
      weeklyMinutes: weeklyExternal.reduce((acc, item) => acc + (item.min ?? 0), 0),
      latestMedicalObservation: latestMedical?.medicalObservation || player.injuryArea || player.injuryType || '',
      latestCompetitionDate: latestCompetition?.date,
      recommendation,
    };
  });

  const statusCounts = {
    Disponible: players.filter((player) => player.status === 'Disponible').length,
    Molestia: players.filter((player) => player.status === 'Molestia').length,
    Readaptación: players.filter((player) => player.status === 'Readaptación').length,
    Lesionado: players.filter((player) => player.status === 'Lesionado').length,
  };

  const recentMedical = byDateDesc(data.competitionRecords.filter((item) => ids.has(item.playerId) && (item.medicalObservation || item.medicalStatus === 'Lesionado'))).slice(0, 8);

  return { players, rows, statusCounts, recentMedical };
};

export interface LoadPlayerRow {
  player: Player;
  internalLoad: number;
  minutes: number;
  avgRpe: number;
  acc: number;
  dcc: number;
  rhie: number;
  sprints: number;
  totalDistance: number;
  highSpeedDistance: number;
  sprintDistance: number;
  maxVelocity: number;
  playerLoad: number;
  distancePerMin: number;
  exposure: 'Alta' | 'Moderada' | 'Baja' | 'Sin datos';
  tone: UiHealthTone;
}

const exposure = (minutes: number, internalLoad: number): LoadPlayerRow['exposure'] => {
  if (minutes === 0 && internalLoad === 0) return 'Sin datos';
  if (minutes >= 240 || internalLoad >= 1300) return 'Alta';
  if (minutes >= 90 || internalLoad >= 500) return 'Moderada';
  return 'Baja';
};

const exposureTone = (value: LoadPlayerRow['exposure']): UiHealthTone => {
  if (value === 'Alta') return 'amber';
  if (value === 'Moderada') return 'blue';
  if (value === 'Baja') return 'green';
  return 'neutral';
};

export const buildLoadCenter = (data: AppData, filters: GlobalFilters, activeCategory: string) => {
  const players = getVisiblePlayers(data, filters, activeCategory);
  const ids = playerIds(data.players, players);
  const { microcycle, dates } = getActiveRange(data, filters, activeCategory);
  const gpsEnabled = activeCategory === 'all' || supportsGps(activeCategory);

  // Carga del jugador = entrenamientos + competencia.
  // La competencia puede venir como externalLoad (si se sincroniza así) o como
  // competitionRecord; se convierte a una fila GPS compatible para que el Centro
  // de carga pueda medir minutos, Player Load, distancia, DCC y RHIE del partido.
  const external = getEffectiveExternalLoads(data, { activeCategory, playerIds: ids })
    .filter((item) => dateInRange(item.date, dates));
  const internalFallback = data.internalLoads.filter((item) => ids.has(item.playerId) && dateInRange(item.date, dates));
  const effectiveRpe = (item: DailyExternalLoadRecord) => {
    const rpe = Number(item.rpe ?? 0);
    if (Number.isFinite(rpe) && rpe > 0) return rpe;
    return item.movementModule === 'competencia' ? 8 : 0;
  };
  const internalHasExternalPair = (internal: DailyInternalLoadRecord, externalItems: DailyExternalLoadRecord[]) =>
    externalItems.some((externalItem) => externalLoadHasInternalPair(externalItem, [internal]));
  const internalOnlyRows = (internalItems: DailyInternalLoadRecord[], externalItems: DailyExternalLoadRecord[]) =>
    internalItems.filter((internal) => !internalHasExternalPair(internal, externalItems));
  const loadForRecords = (internalItems: DailyInternalLoadRecord[], externalItems: DailyExternalLoadRecord[]) => {
    const internalLoad = internalItems.reduce((sum, item) => sum + calculateInternalLoad(item), 0);
    const externalOnlyLoad = externalItems
      .filter((item) => !externalLoadHasInternalPair(item, internalItems))
      .reduce((sum, item) => sum + calculateExternalLoad(item), 0);
    return internalLoad + externalOnlyLoad;
  };
  const minutesForRecords = (internalItems: DailyInternalLoadRecord[], externalItems: DailyExternalLoadRecord[]) =>
    externalItems.reduce((sum, item) => sum + (item.min ?? 0), 0) +
    internalOnlyRows(internalItems, externalItems).reduce((sum, item) => sum + (item.duration ?? 0), 0);
  const rpeValuesForRecords = (internalItems: DailyInternalLoadRecord[], externalItems: DailyExternalLoadRecord[]) => [
    ...internalItems.map((item) => item.rpe ?? 0),
    ...externalItems
      .filter((item) => !externalLoadHasInternalPair(item, internalItems))
      .map(effectiveRpe),
  ].filter((value) => value > 0);

  const rows: LoadPlayerRow[] = players.map((player) => {
    const relatedIds = getRelatedPlayerIds(data.players, player.id);
    const playerExternal = external.filter((item) => relatedIds.has(item.playerId));
    const playerInternalFallback = internalFallback.filter((item) => relatedIds.has(item.playerId));
    const internalLoad = dates.reduce((sum, date) => {
      const dayExternal = playerExternal.filter((item) => item.date === date);
      const dayInternal = playerInternalFallback.filter((item) => item.date === date);
      return sum + loadForRecords(dayInternal, dayExternal);
    }, 0);
    const minutes = dates.reduce((sum, date) => {
      const dayExternal = playerExternal.filter((item) => item.date === date);
      const dayInternal = playerInternalFallback.filter((item) => item.date === date);
      return sum + minutesForRecords(dayInternal, dayExternal);
    }, 0);
    const rpeValues = dates.flatMap((date) => {
      const dayExternal = playerExternal.filter((item) => item.date === date);
      const dayInternal = playerInternalFallback.filter((item) => item.date === date);
      return rpeValuesForRecords(dayInternal, dayExternal);
    });
    const status = exposure(minutes, internalLoad);
    const totalDistance = playerExternal.reduce((acc, item) => acc + (item.totalDistance ?? 0), 0);
    return {
      player,
      internalLoad,
      minutes,
      avgRpe: groupAverage(rpeValues),
      acc: playerExternal.reduce((acc, item) => acc + (item.acc ?? 0), 0),
      dcc: playerExternal.reduce((acc, item) => acc + (item.dcc ?? 0), 0),
      rhie: playerExternal.reduce((acc, item) => acc + (item.rhie ?? 0), 0),
      sprints: playerExternal.reduce((acc, item) => acc + (item.sprints ?? 0), 0),
      totalDistance,
      highSpeedDistance: playerExternal.reduce((acc, item) => acc + (item.highSpeedDistance ?? item.hsr ?? 0), 0),
      sprintDistance: playerExternal.reduce((acc, item) => acc + (item.sprintDistance ?? 0), 0),
      maxVelocity: playerExternal.reduce((max, item) => Math.max(max, item.maxVelocity ?? 0), 0),
      playerLoad: playerExternal.reduce((acc, item) => acc + (item.playerLoad ?? 0), 0),
      distancePerMin: minutes ? Number((totalDistance / minutes).toFixed(1)) : 0,
      exposure: status,
      tone: exposureTone(status),
    };
  }).sort((a, b) => b.internalLoad - a.internalLoad || b.minutes - a.minutes);

  const highLoad = rows.filter((row) => row.exposure === 'Alta');
  const lowExposure = rows.filter((row) => row.exposure === 'Baja' || row.exposure === 'Sin datos');
  const dailyTrend = dates.map((date) => {
    const dayExternal = external.filter((item) => item.date === date);
    const dayInternalFallback = internalFallback.filter((item) => item.date === date);
    const derivedInternalLoad = players.reduce((sum, player) => {
      const relatedIds = getRelatedPlayerIds(data.players, player.id);
      const playerDayExternal = dayExternal.filter((item) => relatedIds.has(item.playerId));
      const playerDayInternal = dayInternalFallback.filter((item) => relatedIds.has(item.playerId));
      return sum + loadForRecords(playerDayInternal, playerDayExternal);
    }, 0);
    const dayMinutes = players.reduce((sum, player) => {
      const relatedIds = getRelatedPlayerIds(data.players, player.id);
      const playerDayExternal = dayExternal.filter((item) => relatedIds.has(item.playerId));
      const playerDayInternal = dayInternalFallback.filter((item) => relatedIds.has(item.playerId));
      return sum + minutesForRecords(playerDayInternal, playerDayExternal);
    }, 0);
    const dayRpeValues = players.flatMap((player) => {
      const relatedIds = getRelatedPlayerIds(data.players, player.id);
      const playerDayExternal = dayExternal.filter((item) => relatedIds.has(item.playerId));
      const playerDayInternal = dayInternalFallback.filter((item) => relatedIds.has(item.playerId));
      return rpeValuesForRecords(playerDayInternal, playerDayExternal);
    });
    return {
      date: formatDateShort(date),
      min: dayMinutes,
      totalDistance: dayExternal.reduce((acc, item) => acc + (item.totalDistance ?? 0), 0),
      playerLoad: dayExternal.reduce((acc, item) => acc + (item.playerLoad ?? 0), 0),
      hsr: dayExternal.reduce((acc, item) => acc + (item.highSpeedDistance ?? item.hsr ?? 0), 0),
      sprints: dayExternal.reduce((acc, item) => acc + (item.sprints ?? 0), 0),
      rpe: groupAverage(dayRpeValues),
      carga: derivedInternalLoad,
    };
  });

  const allRpeValues = dates.flatMap((date) =>
    rpeValuesForRecords(
      internalFallback.filter((item) => item.date === date),
      external.filter((item) => item.date === date),
    ),
  );

  return {
    microcycle,
    dates,
    rows,
    highLoad,
    lowExposure,
    dailyTrend,
    totals: {
      internalLoad: rows.reduce((acc, row) => acc + row.internalLoad, 0),
      minutes: rows.reduce((acc, row) => acc + row.minutes, 0),
      avgRpe: groupAverage(allRpeValues),
      playersWithLoad: rows.filter((row) => row.minutes > 0 || row.internalLoad > 0).length,
      totalDistance: rows.reduce((acc, row) => acc + row.totalDistance, 0),
      playerLoad: rows.reduce((acc, row) => acc + row.playerLoad, 0),
      highSpeedDistance: rows.reduce((acc, row) => acc + row.highSpeedDistance, 0),
      sprintDistance: rows.reduce((acc, row) => acc + row.sprintDistance, 0),
      sprints: rows.reduce((acc, row) => acc + row.sprints, 0),
      dcc: rows.reduce((acc, row) => acc + row.dcc, 0),
      rhie: rows.reduce((acc, row) => acc + row.rhie, 0),
      maxVelocity: rows.reduce((max, row) => Math.max(max, row.maxVelocity), 0),
    },
  };
};

export interface WellnessPlayerRow {
  player: Player;
  records: DailyWellnessRecord[];
  latest?: DailyWellnessRecord;
  average: number;
  sleep: number;
  fatigue: number;
  stress: number;
  musclePain: number;
  mood: number;
  tone: UiHealthTone;
  recommendation: string;
}

const wellnessTone = (value: number): UiHealthTone => {
  if (!value) return 'neutral';
  if (value < 3) return 'red';
  if (value < 3.6) return 'amber';
  return 'green';
};

export const buildWellnessCenter = (data: AppData, filters: GlobalFilters, activeCategory: string) => {
  const players = getVisiblePlayers(data, filters, activeCategory);
  const ids = playerIds(data.players, players);
  const { microcycle, dates } = getActiveRange(data, filters, activeCategory);
  const records = uniqueWellnessByPlayerIdentityDate(data.players, data.wellness.filter((item) => ids.has(item.playerId) && dateInRange(item.date, dates)));
  const today = getWellnessRecordsForDate(data, filters.date, ids);
  const rows: WellnessPlayerRow[] = players.map((player) => {
    const relatedIds = getRelatedPlayerIds(data.players, player.id);
    const playerRecords = records.filter((item) => relatedIds.has(item.playerId));
    const todayRecord = today.find((item) => relatedIds.has(item.playerId));
    const latest = todayRecord ?? byDateDesc(playerRecords)[0];
    // Para que no haya incoherencias visuales: la tabla y las alertas usan la fecha activa.
    // La tendencia sigue usando el periodo completo, pero el estado individual del día
    // no mezcla promedios históricos con pendientes de hoy.
    const todayAverage = averageWellness(todayRecord);
    const periodAverage = groupAverage(playerRecords.map(averageWellness).filter((value) => value > 0));
    const latestIsStale = !todayRecord;
    const tone = latestIsStale ? 'neutral' : wellnessTone(todayAverage);
    return {
      player,
      records: playerRecords,
      latest,
      average: todayAverage,
      sleep: todayRecord?.sleep ?? 0,
      fatigue: todayRecord?.fatigue ?? 0,
      stress: todayRecord?.stress ?? 0,
      musclePain: todayRecord?.musclePain ?? 0,
      mood: todayRecord?.mood ?? 0,
      tone,
      recommendation: todayRecord ? (tone === 'red' ? 'Atención prioritaria' : tone === 'amber' ? 'Control preventivo' : tone === 'green' ? 'Estado favorable' : 'Sin registro') : periodAverage > 0 ? `Sin registro hoy · periodo ${periodAverage.toFixed(1)}` : 'Sin registro hoy',
    };
  }).sort((a, b) => (a.average || 99) - (b.average || 99));
  return {
    microcycle,
    dates,
    today,
    records,
    rows,
    missingToday: players.filter((player) => {
      const relatedIds = getRelatedPlayerIds(data.players, player.id);
      return !today.some((item) => relatedIds.has(item.playerId));
    }),
    lowWellness: rows.filter((row) => row.tone === 'red' || row.tone === 'amber'),
    averages: {
      wellness: groupAverage(today.map(averageWellness).filter((value) => value > 0)),
      sleep: groupAverage(today.map((item) => item.sleep)),
      fatigue: groupAverage(today.map((item) => item.fatigue)),
      stress: groupAverage(today.map((item) => item.stress)),
      musclePain: groupAverage(today.map((item) => item.musclePain)),
      mood: groupAverage(today.map((item) => item.mood)),
    },
  };
};

export const buildCompetitionCenter = (data: AppData, filters: GlobalFilters, activeCategory: string) => {
  const players = getVisiblePlayers(data, filters, activeCategory);
  const ids = playerIds(data.players, players);
  const matches = data.competitionMatchSummaries.filter((match) => isSameCategory(activeCategory, match.category)).sort((a, b) => b.date.localeCompare(a.date));
  const records = data.competitionRecords.filter((record) => ids.has(record.playerId));
  const wins = matches.filter((match) => match.resultType === 'Victoria').length;
  const draws = matches.filter((match) => match.resultType === 'Empate').length;
  const losses = matches.filter((match) => match.resultType === 'Derrota').length;
  const goalsFor = matches.reduce((acc, item) => acc + (item.goalsFor ?? 0), 0);
  const goalsAgainst = matches.reduce((acc, item) => acc + (item.goalsAgainst ?? 0), 0);
  const playerParticipation = players.map((player) => {
    const relatedIds = getRelatedPlayerIds(data.players, player.id);
    const playerRecords = records.filter((record) => relatedIds.has(record.playerId));
    return {
      player,
      minutes: playerRecords.reduce((acc, item) => acc + (item.minutesPlayed ?? 0), 0),
      starts: playerRecords.filter((item) => item.startingRole === 'Titular').length,
      substitute: playerRecords.filter((item) => item.startingRole === 'Suplente').length,
      goals: isGoalkeeper(player) ? 0 : playerRecords.reduce((acc, item) => acc + (item.goals ?? 0), 0),
      assists: isGoalkeeper(player) ? 0 : playerRecords.reduce((acc, item) => acc + (item.assists ?? 0), 0),
      yellows: playerRecords.reduce((acc, item) => acc + (item.yellowCards ?? 0), 0),
      reds: playerRecords.reduce((acc, item) => acc + (item.redCards ?? 0), 0),
      medical: playerRecords.filter((item) => item.medicalStatus === 'Lesionado' || item.medicalObservation).length,
    };
  }).sort((a, b) => b.minutes - a.minutes || b.starts - a.starts);
  const latest = matches[0];
  const upcoming = data.competitionMatchSummaries.filter((match) => match.date > filters.date && isSameCategory(activeCategory, match.category)).sort((a, b) => a.date.localeCompare(b.date))[0];
  return {
    matches,
    records,
    latest,
    upcoming,
    balance: { wins, draws, losses, goalsFor, goalsAgainst },
    totals: {
      matches: matches.length,
      minutes: records.reduce((acc, item) => acc + (item.minutesPlayed ?? 0), 0),
      playersUsed: new Set(records.map((item) => item.playerId)).size,
      yellows: records.reduce((acc, item) => acc + (item.yellowCards ?? 0), 0),
      reds: records.reduce((acc, item) => acc + (item.redCards ?? 0), 0),
    },
    playerParticipation,
  };
};

export const buildExecutiveCenter = (data: AppData, filters: GlobalFilters, activeCategory: string) => {
  const ops = buildDailyOperations(data, filters, activeCategory);
  const availability = buildAvailabilityCenter(data, filters, activeCategory);
  const load = buildLoadCenter(data, filters, activeCategory);
  const wellness = buildWellnessCenter(data, filters, activeCategory);
  const competition = buildCompetitionCenter(data, filters, activeCategory);
  const criticalAlerts = ops.alerts.filter((alert) => alert.level === 'critical');
  const trends: string[] = [
    `${ops.dataQualityPercent}% de completitud operativa del día`,
    `${load.highLoad.length} jugador(es) con exposición alta`,
    `${wellness.lowWellness.length} jugador(es) con wellness en zona de atención`,
    competition.latest ? `Último partido: ${competition.latest.opponent} · ${formatMatchScore(competition.latest)}` : 'Sin partidos registrados',
  ];
  return { ops, availability, load, wellness, competition, criticalAlerts, trends };
};

export const buildGlobalAlertCenter = (data: AppData, filters: GlobalFilters, activeCategory: string) => {
  const ops = buildDailyOperations(data, filters, activeCategory);
  const availability = buildAvailabilityCenter(data, filters, activeCategory);
  const load = buildLoadCenter(data, filters, activeCategory);
  const wellness = buildWellnessCenter(data, filters, activeCategory);
  const competition = buildCompetitionCenter(data, filters, activeCategory);
  const additional: OperationalAlert[] = [
    ...load.lowExposure.slice(0, 4).map((row) => ({
      id: `low-exposure-${row.player.id}`,
      level: 'info' as const,
      title: `${row.player.name} con baja exposición`,
      description: `Acumula ${row.minutes} minutos y ${row.internalLoad.toFixed(0)} UA en el periodo activo.`,
      action: 'Revisar Centro de Carga',
    })),
    ...competition.playerParticipation.filter((row) => row.yellows >= 3 || row.reds > 0).slice(0, 4).map((row) => ({
      id: `discipline-${row.player.id}`,
      level: row.reds > 0 ? 'critical' as const : 'warning' as const,
      title: `${row.player.name} requiere control disciplinario`,
      description: `${row.yellows} amarilla(s) y ${row.reds} roja(s) registradas.`,
      action: 'Revisar Centro de Competencia',
    })),
    ...availability.rows.filter((row) => row.player.status === 'Readaptación').map((row) => ({
      id: `return-${row.player.id}`,
      level: 'info' as const,
      title: `${row.player.name} en readaptación`,
      description: row.latestMedicalObservation || 'Planificar carga progresiva y controlada.',
      action: 'Revisar disponibilidad médica',
    })),
  ];
  const alerts = [...ops.alerts, ...additional];
  return {
    alerts,
    critical: alerts.filter((alert) => alert.level === 'critical'),
    warning: alerts.filter((alert) => alert.level === 'warning'),
    info: alerts.filter((alert) => alert.level === 'info'),
    tasks: ops.tasks,
  };
};

// ─── ACWR: Ratio carga aguda / crónica ────────────────────────────────────
// Estándar de prevención de lesiones en fútbol profesional.
// Aguda = carga últimos 7 días. Crónica = promedio semanal de las 4 semanas previas.
// Zona objetivo: 0.8-1.3. Precaución: 1.31-1.50 o <0.8. Riesgo alto: >1.50.

export type AcwrZone = 'safe' | 'warning' | 'danger' | 'no_data';

export interface AcwrRow {
  player: Player;
  acute: number;       // Carga últimos 7 días
  chronic: number;     // Promedio semanal últimas 4 semanas
  ratio: number;       // acute / chronic
  zone: AcwrZone;
  zoneLabel: string;
  weeklyLoads: number[]; // Carga por semana [w5_base, w4, w3, w2, w1_reciente]
}

const getCompetitionDayLoad = (data: AppData, playerId: string, date: string) => {
  const externalCompetition = data.externalLoads
    .filter((item) => item.playerId === playerId && item.date === date && item.movementModule === 'competencia')
    .reduce((sum, item) => sum + ((item.min ?? 0) * (item.rpe ?? 8)), 0);
  if (externalCompetition > 0) return externalCompetition;
  return data.competitionRecords
    .filter((item) => item.playerId === playerId && item.date === date)
    .reduce((sum, item) => sum + ((item.minutesPlayed ?? 0) * 8), 0);
};

const getWeekLoad = (data: AppData, playerId: string, endDate: string, days: number): number => {
  const dailyLoads = Array.from({ length: days }, (_, index) => {
    const date = addDays(endDate, -(days - 1 - index));
    return getPlayerDayLoad(playerId, date, data, { includeCompetitionExternal: true, includeCompetitionRecords: true });
  });
  return dailyLoads.reduce((sum, value) => sum + value, 0);
};

export const buildAcwrData = (data: AppData, activeCategory: string, referenceDate?: string): AcwrRow[] => {
  const today = referenceDate ?? new Date().toISOString().slice(0, 10);
  const players = data.players.filter((player) =>
    activeCategory === 'all' || player.category === activeCategory,
  );

  return players.map((player) => {
    const profile = computePlayerLoadRiskProfile({ data, player, date: today });
    const metric = profile.acwr.primary;
    const zone: AcwrZone = metric.zone === 'danger'
      ? 'danger'
      : metric.zone === 'target'
        ? 'safe'
        : metric.zone === 'no_data'
          ? 'no_data'
          : 'warning';
    return {
      player,
      acute: metric.acute,
      chronic: metric.chronic,
      ratio: metric.rolling,
      zone,
      zoneLabel: metric.zoneLabel,
      weeklyLoads: metric.weeklyLoads,
    };
  }).sort((a, b) => {
    const order: AcwrZone[] = ['danger', 'warning', 'safe', 'no_data'];
    return order.indexOf(a.zone) - order.indexOf(b.zone) || b.ratio - a.ratio;
  });
};

// ─── Tendencia de wellness individual (últimos N días) ────────────────────
export interface WellnessTrend {
  playerId: string;
  values: number[];        // Últimos 7 valores de promedio wellness (del más antiguo al más reciente)
  trend: 'up' | 'down' | 'stable' | 'no_data';
  lastValue: number;
  avgValue: number;
  alert: boolean;          // true si los últimos 3 días están todos bajo 3.2
}

export const buildWellnessTrends = (data: AppData, activeCategory: string, days = 7): Map<string, WellnessTrend> => {
  const result = new Map<string, WellnessTrend>();
  const players = data.players.filter((player) =>
    activeCategory === 'all' || player.category === activeCategory,
  );

  players.forEach((player) => {
    const relatedIds = getRelatedPlayerIds(data.players, player.id);
    const records = uniqueWellnessByPlayerIdentityDate(data.players, data.wellness.filter((record) => relatedIds.has(record.playerId)))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days);

    if (records.length === 0) {
      result.set(player.id, { playerId: player.id, values: [], trend: 'no_data', lastValue: 0, avgValue: 0, alert: false });
      return;
    }

    const values = records.map(computeWellnessScore);
    const lastValue = values.at(-1) ?? 0;
    const avgValue = Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
    const last3 = values.slice(-3);
    const alert = last3.length >= 3 && last3.every((v) => v < 3);

    let trend: WellnessTrend['trend'] = 'stable';
    if (values.length >= 3) {
      const first = values.slice(0, Math.ceil(values.length / 2));
      const last = values.slice(Math.floor(values.length / 2));
      const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
      const lastAvg = last.reduce((a, b) => a + b, 0) / last.length;
      if (lastAvg - firstAvg > 0.3) trend = 'up';
      else if (firstAvg - lastAvg > 0.3) trend = 'down';
    }

    result.set(player.id, { playerId: player.id, values, trend, lastValue, avgValue, alert });
  });

  return result;
};

// ─── Monotonía y Strain del microciclo ────────────────────────────────────
// Monotonía = carga media semanal / desviación estándar semanal.
// Strain = carga total × monotonía.
// Monotonía óptima: < 2. Strain alto indica distribución peligrosa.

export interface MonotonyStrain {
  dailyLoads: number[];
  mean: number;
  stdDev: number;
  monotony: number;
  strain: number;
  totalLoad: number;
  verdict: 'optimal' | 'acceptable' | 'high';
  verdictLabel: string;
}

export const buildMonotonyStrain = (data: AppData, microcycleId: string, activeCategory: string): MonotonyStrain => {
  const microcycle = data.microcycles.find((item) => item.id === microcycleId);
  const dates = microcycle?.startDate && microcycle?.endDate
    ? eachDateInRange(microcycle.startDate, microcycle.endDate)
    : [...new Set(data.trainingSessionSummaries.filter((session) => session.microcycleId === microcycleId).map((session) => session.date))].sort();
  const players = data.players.filter((player) => activeCategory === 'all' || player.category === activeCategory);

  const dailyLoads = dates.map((date) => players.reduce((sum, player) => sum + getPlayerDayLoad(player.id, date, data, { includeCompetitionExternal: true, includeCompetitionRecords: true }), 0));

  if (dailyLoads.length === 0 || dailyLoads.every((load) => load === 0)) {
    return { dailyLoads, mean: 0, stdDev: 0, monotony: 0, strain: 0, totalLoad: 0, verdict: 'optimal', verdictLabel: 'Sin datos' };
  }

  const metric = computeEngineMonotonyStrain(dailyLoads);
  const verdict = metric.monotony < 2 ? 'optimal' : metric.monotony < 2.5 ? 'acceptable' : 'high';
  const verdictLabel = verdict === 'optimal' ? 'Optimo' : verdict === 'acceptable' ? 'Revisar' : 'Alto riesgo';

  return { dailyLoads: metric.dailyLoads, mean: metric.meanLoad, stdDev: metric.stdDev, monotony: metric.monotony, strain: metric.strain, totalLoad: metric.totalLoad, verdict, verdictLabel };
};
