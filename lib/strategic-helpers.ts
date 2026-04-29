import type { AppData, ClubCategory, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord, GlobalFilters, Player, PlayerStatus } from './types';
import { averageWellness, calculateInternalLoad, groupAverage } from './utils';
import { findMicrocycleByDate, formatMatchScore, isGoalkeeper } from './performance-helpers';
import { buildDailyOperations, eachDateInRange, formatDateShort, getVisiblePlayers, isSameCategory, type OperationalAlert } from './operational-helpers';
import { supportsGps } from './report-utils';

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

const playerIds = (players: Player[]) => new Set(players.map((player) => player.id));

export const getActiveRange = (data: AppData, filters: GlobalFilters) => {
  const microcycle = filters.date
    ? findMicrocycleByDate(data.microcycles, filters.date, filters.microcycleId)
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
  const gpsEnabled = supportsGps(activeCategory);
  const players = getVisiblePlayers(data, filters, activeCategory);
  const ids = playerIds(players);
  const { dates } = getActiveRange(data, filters);
  const rows: AvailabilityRow[] = players.map((player) => {
    const wellnessToday = data.wellness.find((item) => item.playerId === player.id && item.date === filters.date);
    const externalToday = gpsEnabled ? data.externalLoads.find((item) => item.playerId === player.id && item.date === filters.date) : undefined;
    const weeklyExternal = gpsEnabled ? data.externalLoads.filter((item) => item.playerId === player.id && dateInRange(item.date, dates)) : [];
    const latestMedical = byDateDesc(data.competitionRecords.filter((item) => item.playerId === player.id && (item.medicalObservation || item.medicalStatus === 'Lesionado' || item.postCompetitionStatus === 'Lesionado')))[0];
    const latestCompetition = byDateDesc(data.competitionRecords.filter((item) => item.playerId === player.id))[0];
    const latestWellness = averageWellness(wellnessToday);
    const recommendation = player.status === 'Lesionado'
      ? 'No disponible - seguimiento médico'
      : player.status === 'Readaptación'
        ? 'Trabajo controlado y progresivo'
        : player.status === 'Molestia'
          ? 'Controlar antes de competir'
          : latestWellness > 0 && latestWellness < 3.2
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
  sprints: number;
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
  const ids = playerIds(players);
  const { microcycle, dates } = getActiveRange(data, filters);
  const gpsEnabled = supportsGps(activeCategory);
  const internal = data.internalLoads.filter((item) => ids.has(item.playerId) && dateInRange(item.date, dates));
  const external = data.externalLoads.filter((item) => ids.has(item.playerId) && dateInRange(item.date, dates));
  const rows: LoadPlayerRow[] = players.map((player) => {
    const playerInternal = internal.filter((item) => item.playerId === player.id);
    const playerExternal = external.filter((item) => item.playerId === player.id);
    const internalLoad = playerInternal.reduce((acc, item) => acc + calculateInternalLoad(item), 0);
    const minutes = playerExternal.reduce((acc, item) => acc + (item.min ?? 0), 0);
    const status = exposure(minutes, internalLoad);
    return {
      player,
      internalLoad,
      minutes,
      avgRpe: groupAverage(playerExternal.map((item) => item.rpe ?? 0).filter((value) => value > 0)),
      acc: playerExternal.reduce((acc, item) => acc + (item.acc ?? 0), 0),
      dcc: playerExternal.reduce((acc, item) => acc + (item.dcc ?? 0), 0),
      sprints: playerExternal.reduce((acc, item) => acc + (item.sprints ?? 0), 0),
      exposure: status,
      tone: exposureTone(status),
    };
  }).sort((a, b) => b.internalLoad - a.internalLoad || b.minutes - a.minutes);

  const highLoad = rows.filter((row) => row.exposure === 'Alta');
  const lowExposure = rows.filter((row) => row.exposure === 'Baja' || row.exposure === 'Sin datos');
  const dailyTrend = dates.map((date) => {
    const dayExternal = external.filter((item) => item.date === date);
    const dayInternal = internal.filter((item) => item.date === date);
    return {
      date: formatDateShort(date),
      min: dayExternal.reduce((acc, item) => acc + (item.min ?? 0), 0),
      rpe: groupAverage(dayExternal.map((item) => item.rpe ?? 0).filter((value) => value > 0)),
      carga: dayInternal.reduce((acc, item) => acc + calculateInternalLoad(item), 0),
    };
  });

  return {
    microcycle,
    dates,
    rows,
    highLoad,
    lowExposure,
    dailyTrend,
    totals: {
      internalLoad: internal.reduce((acc, item) => acc + calculateInternalLoad(item), 0),
      minutes: external.reduce((acc, item) => acc + (item.min ?? 0), 0),
      avgRpe: groupAverage(external.map((item) => item.rpe ?? 0).filter((value) => value > 0)),
      playersWithLoad: rows.filter((row) => row.minutes > 0 || row.internalLoad > 0).length,
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
  const ids = playerIds(players);
  const { microcycle, dates } = getActiveRange(data, filters);
  const records = data.wellness.filter((item) => ids.has(item.playerId) && dateInRange(item.date, dates));
  const today = data.wellness.filter((item) => ids.has(item.playerId) && item.date === filters.date);
  const rows: WellnessPlayerRow[] = players.map((player) => {
    const playerRecords = records.filter((item) => item.playerId === player.id);
    const latest = byDateDesc(playerRecords)[0];
    const average = groupAverage(playerRecords.map(averageWellness).filter((value) => value > 0));
    const tone = wellnessTone(latest ? averageWellness(latest) : average);
    return {
      player,
      records: playerRecords,
      latest,
      average,
      sleep: groupAverage(playerRecords.map((item) => item.sleep)),
      fatigue: groupAverage(playerRecords.map((item) => item.fatigue)),
      stress: groupAverage(playerRecords.map((item) => item.stress)),
      musclePain: groupAverage(playerRecords.map((item) => item.musclePain)),
      mood: groupAverage(playerRecords.map((item) => item.mood)),
      tone,
      recommendation: tone === 'red' ? 'Atención prioritaria' : tone === 'amber' ? 'Control preventivo' : tone === 'green' ? 'Estado favorable' : 'Sin registro reciente',
    };
  }).sort((a, b) => (a.average || 99) - (b.average || 99));
  return {
    microcycle,
    dates,
    today,
    records,
    rows,
    missingToday: players.filter((player) => !today.some((item) => item.playerId === player.id)),
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
  const ids = playerIds(players);
  const matches = data.competitionMatchSummaries.filter((match) => isSameCategory(activeCategory, match.category)).sort((a, b) => b.date.localeCompare(a.date));
  const records = data.competitionRecords.filter((record) => ids.has(record.playerId));
  const wins = matches.filter((match) => match.resultType === 'Victoria').length;
  const draws = matches.filter((match) => match.resultType === 'Empate').length;
  const losses = matches.filter((match) => match.resultType === 'Derrota').length;
  const goalsFor = matches.reduce((acc, item) => acc + (item.goalsFor ?? 0), 0);
  const goalsAgainst = matches.reduce((acc, item) => acc + (item.goalsAgainst ?? 0), 0);
  const playerParticipation = players.map((player) => {
    const playerRecords = records.filter((record) => record.playerId === player.id);
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
