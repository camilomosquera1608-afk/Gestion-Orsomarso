import type {
  AppData,
  ClubCategory,
  CompetitionMatchSummary,
  CompetitionRecord,
  DailyExternalLoadRecord,
  DailyInternalLoadRecord,
  DailyWellnessRecord,
  Microcycle,
  Player,
  TrainingSessionType,
} from './types';
import { averageWellness, calculateInternalLoad, computeWellnessScore, getPlayerDayLoad, groupAverage } from './utils';
import { getEffectiveExternalLoads, getRelatedPlayerIds } from './relational-data';

export type InsightTone = 'green' | 'yellow' | 'red' | 'blue' | 'neutral';

export interface LogicInsight {
  id: string;
  title: string;
  description: string;
  tone: InsightTone;
  value?: string;
}

export interface SessionLoadMetrics {
  avgMinutes: number;
  avgRpe: number;
  avgInternalLoad: number;
  avgDistance?: number;
  avgAcc?: number;
  avgDcc?: number;
  avgPlayerLoad?: number;
  wellnessReadiness?: number;
  individualLoads?: number[];
}

const safeAverage = (values: number[]) => groupAverage(values.filter((value) => Number.isFinite(value) && value > 0));
const round = (value: number, digits = 0) => (Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits));

const safeDateText = (value: unknown) => String(value ?? '');
const compareDateDesc = <T extends { date?: string | null }>(a: T, b: T) =>
  safeDateText(b.date).localeCompare(safeDateText(a.date));
const hasDate = <T extends { date?: string | null }>(record: T | null | undefined): record is T =>
  Boolean(record && safeDateText(record.date));


export const trainingTypeLabel: Record<TrainingSessionType, string> = {
  'MD+1': 'MD+1',
  'MD+2': 'MD+2',
  'MD-5': 'MD-5',
  'MD-4': 'MD-4',
  'MD-3': 'MD-3',
  'MD-2': 'MD-2',
  'MD-1': 'MD-1',
  'MD': 'MD',
};

export const buildSessionTypeLoadControl = (sessionType: TrainingSessionType, metrics: SessionLoadMetrics): LogicInsight => {
  const individualLoads = (metrics.individualLoads ?? []).filter((value) => Number.isFinite(value) && value > 0);
  const avgLoad = metrics.avgInternalLoad;
  const avgIndividual = safeAverage(individualLoads);
  const sd = individualLoads.length > 1
    ? Math.sqrt(individualLoads.reduce((sum, value) => sum + Math.pow(value - avgIndividual, 2), 0) / individualLoads.length)
    : 0;
  const highOutliers = sd > 0 ? individualLoads.filter((value) => value > avgIndividual + sd).length : 0;
  const lowOutliers = sd > 0 ? individualLoads.filter((value) => value < avgIndividual - sd).length : 0;
  const highRpe = metrics.avgRpe >= 8;
  const wellnessLow = typeof metrics.wellnessReadiness === 'number' && metrics.wellnessReadiness > 0 && metrics.wellnessReadiness < 3.2;
  const tone: InsightTone = highRpe || (wellnessLow && avgLoad >= avgIndividual) || highOutliers >= Math.max(2, Math.ceil(individualLoads.length * 0.25))
    ? 'red'
    : wellnessLow || highOutliers > 0 || lowOutliers > 0
      ? 'yellow'
      : 'green';
  const status = tone === 'green'
    ? 'La sesión no muestra alertas grupales relevantes frente a la propia distribución de los jugadores.'
    : tone === 'yellow'
      ? 'Hay jugadores alejados de la distribución del grupo o señales subjetivas a revisar.'
      : 'Alerta: revisar jugadores con RPE alto, wellness bajo o carga individual por encima del grupo.';
  const sample = individualLoads.length && sd > 0
    ? `${highOutliers} por encima y ${lowOutliers} por debajo de 1 DE del grupo`
    : 'sin dispersión suficiente';
  return {
    id: `session-type-${sessionType}`,
    title: `Control de carga · ${trainingTypeLabel[sessionType]}`,
    tone,
    value: `${round(metrics.avgInternalLoad)} UA`,
    description: `${status} ${sample}. Promedio real: MIN ${round(metrics.avgMinutes)} · RPE ${round(metrics.avgRpe, 1)} · carga ${round(avgLoad)} UA. No se usan rangos estimados por MD; el MD solo identifica la ubicación de la sesión respecto al partido.`,
  };
};

const toDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const daysBetween = (a: string, b: string) => {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return 9999;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
};

export const getPlayerDailyInternalLoad = (playerId: string, date: string, internalLoads: DailyInternalLoadRecord[], externalLoads: DailyExternalLoadRecord[], competitionRecords: CompetitionRecord[] = []) =>
  getPlayerDayLoad(playerId, date, { internalLoads, externalLoads, competitionRecords }, { includeCompetitionExternal: true, includeCompetitionRecords: true });

export const buildAbruptLoadAlerts = (params: {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  competitionRecords?: CompetitionRecord[];
  referenceDate: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): LogicInsight[] => {
  const { players, internalLoads, externalLoads, competitionRecords = [], referenceDate, category = 'all', limit = 8 } = params;
  const scopedPlayers = players.filter((player) => category === 'all' || !category || player.category === category);
  const rows = scopedPlayers.map((player) => {
    const dates = Array.from(new Set([
      ...internalLoads.filter((load) => load.playerId === player.id).map((load) => load.date),
      ...externalLoads.filter((load) => load.playerId === player.id).map((load) => load.date),
      ...competitionRecords.filter((load) => load.playerId === player.id).map((load) => load.date),
    ])).filter((date) => !referenceDate || date <= referenceDate);
    const current = dates
      .filter((date) => {
        const diff = daysBetween(date, referenceDate);
        return diff >= 0 && diff <= 6;
      })
      .reduce((sum, date) => sum + getPlayerDailyInternalLoad(player.id, date, internalLoads, externalLoads, competitionRecords), 0);
    const previous = dates
      .filter((date) => {
        const diff = daysBetween(date, referenceDate);
        return diff >= 7 && diff <= 13;
      })
      .reduce((sum, date) => sum + getPlayerDailyInternalLoad(player.id, date, internalLoads, externalLoads, competitionRecords), 0);
    const increase = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
    return { player, current, previous, increase };
  });
  return rows
    .filter((row) => row.current >= 280 && (row.increase >= 35 || row.previous === 0))
    .sort((a, b) => b.increase - a.increase)
    .slice(0, limit)
    .map((row) => ({
      id: `abrupt-${row.player.id}`,
      title: `${row.player.name}: aumento brusco de carga`,
      value: `${round(row.increase)}%`,
      tone: row.increase >= 60 || row.current >= 900 ? 'red' : 'yellow',
      description: `Carga últimos 7 días: ${round(row.current)} UA vs ${round(row.previous)} UA en los 7 días previos. Revisar recuperación, minutos y wellness antes de próxima carga alta.`,
    }));
};

export const wellnessReadiness = (record?: DailyWellnessRecord) => computeWellnessScore(record);

export const buildLoadWellnessRelation = (params: {
  players: Player[];
  wellness: DailyWellnessRecord[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  competitionRecords?: CompetitionRecord[];
  date: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): LogicInsight[] => {
  const { players, wellness, internalLoads, externalLoads, competitionRecords = [], date, category = 'all', limit = 6 } = params;
  return players
    .filter((player) => category === 'all' || !category || player.category === category)
    .map((player) => {
      const ready = wellnessReadiness(wellness.find((record) => record.playerId === player.id && record.date === date));
      const load = getPlayerDailyInternalLoad(player.id, date, internalLoads, externalLoads, competitionRecords);
      return { player, ready, load };
    })
    .filter((row) => row.load >= 300 || (row.ready > 0 && row.ready < 3))
    .sort((a, b) => (b.load * (b.ready ? 6 - b.ready : 1)) - (a.load * (a.ready ? 6 - a.ready : 1)))
    .slice(0, limit)
    .map((row) => {
      const red = row.load >= 450 && row.ready > 0 && row.ready < 3;
      return {
        id: `wellness-load-${row.player.id}`,
        title: `${row.player.name}: carga vs wellness`,
        tone: red ? 'red' : 'yellow' as InsightTone,
        value: `${round(row.load)} UA`,
        description: `Wellness readiness ${row.ready ? round(row.ready, 1) : 'sin dato'} / 5. ${red ? 'Riesgo elevado: carga alta con recuperación baja.' : 'Revisar coherencia entre carga, percepción y recuperación.'}`,
      };
    });
};



type ReadinessTone = 'green' | 'yellow' | 'red' | 'neutral';

const latestByDate = <T extends { date?: string | null }>(records: T[]) =>
  [...records].filter(hasDate).sort(compareDateDesc)[0];

const mean = (values: number[]) => safeAverage(values);
const stdDev = (values: number[]) => {
  const clean = values.filter((value) => Number.isFinite(value) && value > 0);
  if (clean.length < 2) return 0;
  const avg = clean.reduce((sum, value) => sum + value, 0) / clean.length;
  const variance = clean.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / clean.length;
  return Math.sqrt(variance);
};

const dateMinusDays = (referenceDate: string, days: number) => {
  const date = toDate(referenceDate);
  if (!date) return referenceDate;
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const getPlayerDatesUntil = (
  playerId: string,
  referenceDate: string,
  internalLoads: DailyInternalLoadRecord[],
  externalLoads: DailyExternalLoadRecord[],
  competitionRecords: CompetitionRecord[] = [],
) => Array.from(new Set([
  ...internalLoads.filter((load) => load.playerId === playerId).map((load) => load.date),
  ...externalLoads.filter((load) => load.playerId === playerId).map((load) => load.date),
  ...competitionRecords.filter((load) => load.playerId === playerId).map((load) => load.date),
])).filter((date) => !referenceDate || date <= referenceDate).sort();

const getPlayerLoadWindow = (
  playerId: string,
  referenceDate: string,
  minDiff: number,
  maxDiff: number,
  internalLoads: DailyInternalLoadRecord[],
  externalLoads: DailyExternalLoadRecord[],
  competitionRecords: CompetitionRecord[] = [],
) => getPlayerDatesUntil(playerId, referenceDate, internalLoads, externalLoads, competitionRecords)
  .filter((date) => {
    const diff = daysBetween(date, referenceDate);
    return diff >= minDiff && diff <= maxDiff;
  })
  .reduce((sum, date) => sum + getPlayerDailyInternalLoad(playerId, date, internalLoads, externalLoads, competitionRecords), 0);

export interface PlayerReadinessRow {
  playerId: string;
  name: string;
  position: string;
  score: number;
  tone: ReadinessTone;
  label: string;
  detail: string;
}

export const buildPlayerReadinessSemaphores = (params: {
  players: Player[];
  wellness: DailyWellnessRecord[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  competitionRecords?: CompetitionRecord[];
  referenceDate: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): PlayerReadinessRow[] => {
  const { players, wellness, internalLoads, externalLoads, competitionRecords = [], referenceDate, category = 'all', limit = 12 } = params;
  const acwrFactor = (ratio: number) => {
    if (!ratio) return 0.6;
    if (ratio >= 0.8 && ratio <= 1.3) return 1;
    if (ratio < 0.8) return Math.max(0.35, ratio / 0.8);
    if (ratio >= 2) return 0;
    return Math.max(0, 1 - ((ratio - 1.3) / 0.7));
  };
  const statusFactor = (status: Player['status']) => status === 'Disponible' ? 1 : status === 'Molestia' ? 0.5 : status === 'Readaptación' ? 0.25 : 0;
  return players
    .filter((player) => category === 'all' || !category || player.category === category)
    .map((player) => {
      const relatedIds = getRelatedPlayerIds(players, player.id);
      const latestWellness = latestByDate(wellness.filter((record) => relatedIds.has(record.playerId) && (!referenceDate || record.date <= referenceDate)));
      const ready = wellnessReadiness(latestWellness);
      const playerInternal = internalLoads.filter((record) => relatedIds.has(record.playerId));
      const playerExternal = externalLoads.filter((record) => relatedIds.has(record.playerId));
      const playerCompetition = competitionRecords.filter((record) => relatedIds.has(record.playerId));
      const currentLoad = Math.max(...Array.from(relatedIds).map((id) => getPlayerLoadWindow(id, referenceDate, 0, 6, playerInternal, playerExternal, playerCompetition)), 0);
      const previousLoads = [
        Math.max(...Array.from(relatedIds).map((id) => getPlayerLoadWindow(id, referenceDate, 7, 13, playerInternal, playerExternal, playerCompetition)), 0),
        Math.max(...Array.from(relatedIds).map((id) => getPlayerLoadWindow(id, referenceDate, 14, 20, playerInternal, playerExternal, playerCompetition)), 0),
        Math.max(...Array.from(relatedIds).map((id) => getPlayerLoadWindow(id, referenceDate, 21, 27, playerInternal, playerExternal, playerCompetition)), 0),
        Math.max(...Array.from(relatedIds).map((id) => getPlayerLoadWindow(id, referenceDate, 28, 34, playerInternal, playerExternal, playerCompetition)), 0),
      ].filter((value) => value > 0);
      const chronic = previousLoads.length ? previousLoads.reduce((sum, value) => sum + value, 0) / previousLoads.length : 0;
      const ratio = chronic > 0 ? currentLoad / chronic : 0;
      const wellnessFactor = ready > 0 ? ready / 5 : 0.6;
      const score = Math.max(0, Math.min(100, ((wellnessFactor * 0.40) + (acwrFactor(ratio) * 0.35) + (statusFactor(player.status) * 0.25)) * 100));
      const tone: ReadinessTone = score >= 75 ? 'green' : score >= 50 ? 'yellow' : 'red';
      const label = tone === 'green' ? 'Disponible' : tone === 'yellow' ? 'Precaución' : 'Riesgo';
      return {
        playerId: player.id,
        name: player.name,
        position: player.position,
        score: Number(score.toFixed(0)),
        tone,
        label,
        detail: `Wellness ${ready ? round(ready, 1) : 'neutro'} · carga 7d ${round(currentLoad)} UA · ACWR ${ratio ? round(ratio, 2) : 's/d'} · estado ${player.status}`,
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
};

export const buildAvailabilityIndex = (params: {
  players: Player[];
  wellness: DailyWellnessRecord[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  competitionRecords?: CompetitionRecord[];
  referenceDate: string;
  category?: ClubCategory | 'all';
}): LogicInsight => {
  const rows = buildPlayerReadinessSemaphores({ ...params, limit: 999 });
  const avgScore = mean(rows.map((row) => row.score));
  const risk = rows.filter((row) => row.tone === 'red').length;
  const caution = rows.filter((row) => row.tone === 'yellow').length;
  return {
    id: 'availability-index',
    title: 'Índice de disponibilidad del grupo',
    tone: avgScore >= 76 && risk === 0 ? 'green' : avgScore >= 60 ? 'yellow' : 'red',
    value: `${round(avgScore)}%`,
    description: `${risk} jugador(es) en riesgo · ${caution} en precaución. Combina wellness, carga reciente, cambio brusco y estado médico/deportivo.`,
  };
};

export const buildRoleLoadControl = (params: {
  players: Player[];
  competitionRecords: CompetitionRecord[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  referenceDate: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): LogicInsight[] => {
  const { players, competitionRecords, internalLoads, externalLoads, referenceDate, category = 'all', limit = 8 } = params;
  return players
    .filter((player) => category === 'all' || !category || player.category === category)
    .map((player) => {
      const relatedIds = getRelatedPlayerIds(players, player.id);
      const recentMatches = competitionRecords
        .filter((record) => relatedIds.has(record.playerId) && (!referenceDate || record.date <= referenceDate))
        .sort(compareDateDesc)
        .slice(0, 5);
      const currentLoad = Math.max(...Array.from(relatedIds).map((id) => getPlayerLoadWindow(id, referenceDate, 0, 6, internalLoads.filter((record) => relatedIds.has(record.playerId)), externalLoads.filter((record) => relatedIds.has(record.playerId)), competitionRecords.filter((record) => relatedIds.has(record.playerId)))), 0);
      if (recentMatches.length < 5) {
        return { player, role: 'Muestra insuficiente', currentLoad, avgMinutes: 0, tone: 'blue' as InsightTone, description: `Solo hay ${recentMatches.length}/5 partidos de referencia. No se aplican umbrales por rol hasta completar muestra mínima.` };
      }
      const avgMinutes = mean(recentMatches.map((record) => record.minutesPlayed ?? 0));
      const starts = recentMatches.filter((record) => record.startingRole === 'Titular' || (record.minutesPlayed ?? 0) >= 45).length;
      const role = player.status === 'Readaptación' || player.status === 'Molestia'
        ? 'Seguimiento/retorno'
        : starts >= 3 || avgMinutes >= 55
          ? 'Titular habitual'
          : avgMinutes > 0
            ? 'Suplente/rotación'
            : 'Sin minutos recientes';
      let tone: InsightTone = 'blue';
      let description = `${role}. Promedio competencia ${round(avgMinutes)} min · carga 7d ${round(currentLoad)} UA.`;
      if (role === 'Seguimiento/retorno' && currentLoad >= 450) {
        tone = 'red';
        description += ' Alerta: carga elevada para jugador en retorno o con molestia.';
      } else if (role === 'Suplente/rotación' && currentLoad >= 800) {
        tone = 'yellow';
        description += ' Carga semanal alta para rol de rotación; revisar compensatorios y recuperación.';
      } else if (role === 'Titular habitual' && currentLoad >= 1000) {
        tone = 'yellow';
        description += ' Titular con acumulación alta; controlar recuperación.';
      } else if (role === 'Sin minutos recientes' && currentLoad < 180) {
        tone = 'yellow';
        description += ' Riesgo de baja exposición competitiva; revisar estímulos compensatorios.';
      }
      return { player, role, currentLoad, avgMinutes, tone, description };
    })
    .filter((row) => row.tone !== 'blue')
    .sort((a, b) => (b.tone === 'red' ? 2 : 1) - (a.tone === 'red' ? 2 : 1) || b.currentLoad - a.currentLoad)
    .slice(0, limit)
    .map((row) => ({
      id: `role-load-${row.player.id}`,
      title: `${row.player.name}: control por rol competitivo`,
      tone: row.tone,
      value: row.role,
      description: row.description,
    }));
};

export const buildReturnToPlayAlerts = (params: {
  players: Player[];
  competitionRecords: CompetitionRecord[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  referenceDate: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): LogicInsight[] => {
  const { players, competitionRecords, internalLoads, externalLoads, referenceDate, category = 'all', limit = 8 } = params;
  const recentlyReturned = (player: Player) => (player.injuryHistory ?? []).some((injury) => {
    const returnDate = player.returnDate ?? injury.expectedReturnDate ?? injury.date;
    const days = daysBetween(returnDate, referenceDate);
    return injury.status === 'activa' || (days >= 0 && days <= 21);
  });
  return players
    .filter((player) => category === 'all' || !category || player.category === category)
    .map((player) => {
      const relatedIds = getRelatedPlayerIds(players, player.id);
      const playerInternal = internalLoads.filter((record) => relatedIds.has(record.playerId));
      const playerExternal = externalLoads.filter((record) => relatedIds.has(record.playerId));
      const playerCompetition = competitionRecords.filter((record) => relatedIds.has(record.playerId));
      const currentLoad = Math.max(...Array.from(relatedIds).map((id) => getPlayerLoadWindow(id, referenceDate, 0, 6, playerInternal, playerExternal, playerCompetition)), 0);
      const previousLoad = Math.max(...Array.from(relatedIds).map((id) => getPlayerLoadWindow(id, referenceDate, 7, 13, playerInternal, playerExternal, playerCompetition)), 0);
      const lastMatch = latestByDate(competitionRecords.filter((record) => relatedIds.has(record.playerId) && (!referenceDate || record.date <= referenceDate)));
      const increase = previousLoad > 0 ? ((currentLoad - previousLoad) / previousLoad) * 100 : currentLoad > 0 ? 100 : 0;
      const hasRtpStatus = player.status === 'Readaptación' || player.status === 'Molestia' || player.status === 'Lesionado' || lastMatch?.medicalStatus === 'Lesionado' || recentlyReturned(player);
      const riskyReturn = hasRtpStatus && (currentLoad >= 350 || (lastMatch?.minutesPlayed ?? 0) >= 30 || increase >= 45);
      return { player, currentLoad, previousLoad, lastMatch, increase, hasRtpStatus, riskyReturn };
    })
    .filter((row) => row.riskyReturn)
    .sort((a, b) => b.currentLoad - a.currentLoad)
    .slice(0, limit)
    .map((row) => ({
      id: `rtp-${row.player.id}`,
      title: `${row.player.name}: retorno progresivo`,
      tone: row.player.status === 'Lesionado' || (row.lastMatch?.minutesPlayed ?? 0) >= 60 ? 'red' : 'yellow',
      value: `${round(row.currentLoad)} UA`,
      description: `Estado ${row.player.status}. Último partido ${row.lastMatch?.minutesPlayed ?? 0} min · cambio carga ${round(row.increase)}%. Revisar fase de readaptación antes de alta intensidad o competencia completa.`,
    }));
};

export const buildWeeklyMonotonyFatigue = (params: {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  competitionRecords?: CompetitionRecord[];
  referenceDate: string;
  category?: ClubCategory | 'all';
}): LogicInsight => {
  const { players, internalLoads, externalLoads, competitionRecords = [], referenceDate, category = 'all' } = params;
  const scoped = players.filter((player) => category === 'all' || !category || player.category === category);
  const dailyLoads = Array.from({ length: 7 }, (_, index) => {
    const date = dateMinusDays(referenceDate, 6 - index);
    return scoped.reduce((sum, player) => sum + getPlayerDailyInternalLoad(player.id, date, internalLoads, externalLoads, competitionRecords), 0);
  });
  const totalLoad = dailyLoads.reduce((sum, value) => sum + value, 0);
  const avg = dailyLoads.reduce((sum, value) => sum + value, 0) / dailyLoads.length;
  const sd = (() => {
    const variance = dailyLoads.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / dailyLoads.length;
    return Math.sqrt(variance);
  })();
  const monotony = sd > 0 ? avg / sd : avg > 0 ? 9.99 : 0;
  const playersWithData = scoped.filter((player) => dailyLoads.some((_, index) => getPlayerDailyInternalLoad(player.id, dateMinusDays(referenceDate, 6 - index), internalLoads, externalLoads, competitionRecords) > 0)).length || 1;
  const strain = totalLoad * monotony;
  const strainPerCapita = strain / playersWithData;
  const tone: InsightTone = monotony >= 2.2 || strainPerCapita >= 6000 ? 'red' : monotony >= 1.5 || strainPerCapita >= 4000 ? 'yellow' : 'green';
  return {
    id: 'weekly-monotony-fatigue',
    title: 'Monotonía y fatiga semanal',
    tone,
    value: `${round(monotony, 2)}`,
    description: `Carga semanal ${round(totalLoad)} UA · strain per cápita ${round(strainPerCapita)}. Una monotonía alta indica poca variación entre días y posible acumulación de fatiga.`,
  };
};

export const buildSelfComparisonInsights = (params: {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  competitionRecords?: CompetitionRecord[];
  referenceDate: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): LogicInsight[] => {
  const { players, internalLoads, externalLoads, competitionRecords = [], referenceDate, category = 'all', limit = 8 } = params;
  return players
    .filter((player) => category === 'all' || !category || player.category === category)
    .map((player) => {
      const todayLoad = getPlayerDailyInternalLoad(player.id, referenceDate, internalLoads, externalLoads, competitionRecords);
      const historyDates = getPlayerDatesUntil(player.id, referenceDate, internalLoads, externalLoads, competitionRecords).filter((date) => date < referenceDate).slice(-28);
      const rawBaseline = historyDates.map((date) => getPlayerDailyInternalLoad(player.id, date, internalLoads, externalLoads, competitionRecords)).filter((value) => value > 0);
      const avg = rawBaseline.length ? rawBaseline.reduce((sum, value) => sum + value, 0) / rawBaseline.length : 0;
      const sd = rawBaseline.length > 1 ? Math.sqrt(rawBaseline.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / rawBaseline.length) : 0;
      const baselineValues = rawBaseline.filter((value) => sd === 0 || value <= avg + (2 * sd));
      const personalAvg = mean(baselineValues);
      const delta = personalAvg > 0 ? ((todayLoad - personalAvg) / personalAvg) * 100 : todayLoad > 0 ? 100 : 0;
      const latestExternal = latestByDate(externalLoads.filter((record) => record.playerId === player.id && record.date === referenceDate));
      const mmin = latestExternal?.totalDistance && latestExternal?.min ? latestExternal.totalDistance / latestExternal.min : 0;
      return { player, todayLoad, personalAvg, delta, mmin };
    })
    .filter((row) => row.todayLoad > 0 && row.personalAvg > 0 && Math.abs(row.delta) >= 30)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit)
    .map((row) => ({
      id: `self-comparison-${row.player.id}`,
      title: `${row.player.name}: comparación individual`,
      tone: row.delta >= 55 ? 'red' : row.delta >= 30 ? 'yellow' : 'blue',
      value: `${row.delta >= 0 ? '+' : ''}${round(row.delta)}%`,
      description: `Carga del día ${round(row.todayLoad)} UA vs promedio personal ${round(row.personalAvg)} UA. ${row.mmin ? `Intensidad ${round(row.mmin)} m/min.` : ''}`,
    }));
};

export const buildPositionComparisonInsights = (params: {
  players: Player[];
  externalLoads: DailyExternalLoadRecord[];
  referenceDate: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): LogicInsight[] => {
  const { players, externalLoads, referenceDate, category = 'all', limit = 8 } = params;
  const scopedPlayers = players.filter((player) => category === 'all' || !category || player.category === category);
  const rows = scopedPlayers.map((player) => {
    const load = latestByDate(externalLoads.filter((record) => record.playerId === player.id && record.date === referenceDate));
    const mmin = load?.totalDistance && load.min ? load.totalDistance / load.min : 0;
    const hsr = load?.highSpeedDistance ?? load?.hsr ?? 0;
    return { player, load, distance: load?.totalDistance ?? 0, mmin, hsr };
  }).filter((row) => row.load && (row.distance > 0 || row.mmin > 0 || row.hsr > 0));
  return rows
    .map((row) => {
      const peers = rows.filter((peer) => peer.player.position === row.player.position && peer.player.id !== row.player.id);
      const avgDistance = mean(peers.map((peer) => peer.distance));
      const avgMmin = mean(peers.map((peer) => peer.mmin));
      const avgHsr = mean(peers.map((peer) => peer.hsr));
      const distanceDelta = avgDistance > 0 ? ((row.distance - avgDistance) / avgDistance) * 100 : 0;
      const intensityDelta = avgMmin > 0 ? ((row.mmin - avgMmin) / avgMmin) * 100 : 0;
      const hsrDelta = avgHsr > 0 ? ((row.hsr - avgHsr) / avgHsr) * 100 : 0;
      const maxDelta = [distanceDelta, intensityDelta, hsrDelta].sort((a, b) => Math.abs(b) - Math.abs(a))[0] ?? 0;
      return { ...row, peers: peers.length, distanceDelta, intensityDelta, hsrDelta, maxDelta };
    })
    .filter((row) => row.peers >= 2 && Math.abs(row.maxDelta) >= 25)
    .sort((a, b) => Math.abs(b.maxDelta) - Math.abs(a.maxDelta))
    .slice(0, limit)
    .map((row) => ({
      id: `position-comparison-${row.player.id}`,
      title: `${row.player.name}: comparación por posición`,
      tone: Math.abs(row.maxDelta) >= 45 ? 'yellow' : 'blue',
      value: `${row.maxDelta >= 0 ? '+' : ''}${round(row.maxDelta)}%`,
      description: `${row.player.position}. Distancia ${row.distanceDelta >= 0 ? '+' : ''}${round(row.distanceDelta)}% · m/min ${row.intensityDelta >= 0 ? '+' : ''}${round(row.intensityDelta)}% · HSR ${row.hsrDelta >= 0 ? '+' : ''}${round(row.hsrDelta)}% frente a pares posicionales.`,
    }));
};

// Insights contextuales - consideran día de semana, momento de microciclo
export const buildContextualInsights = (params: {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  wellnessRecords: DailyWellnessRecord[];
  referenceDate: string;
  category?: ClubCategory | 'all';
}): LogicInsight[] => {
  const { players, internalLoads, externalLoads, wellnessRecords, referenceDate, category = 'all' } = params;
  const insights: LogicInsight[] = [];
  
  const dayOfWeek = new Date(referenceDate).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isMonday = dayOfWeek === 1;
  
  // Insight: Wellness bajo después del fin de semana
  if (isMonday) {
    const weekendWellness = wellnessRecords.filter((w) => {
      const wDate = new Date(w.date);
      const wDay = wDate.getDay();
      return wDay === 0 || wDay === 6;
    });
    
    const avgWeekendWellness = weekendWellness.length > 0 
      ? weekendWellness.reduce((sum, w) => sum + (w.sleep + w.fatigue + w.stress + w.musclePain + w.mood) / 5, 0) / weekendWellness.length
      : 0;
    
    if (avgWeekendWellness < 3.5) {
      insights.push({
        id: 'contextual-weekend-wellness',
        title: 'Wellness fin de semana',
        tone: 'yellow',
        value: `${round(avgWeekendWellness, 1)}/5`,
        description: 'Wellness promedio del fin de semana bajo. Considerar revisar hábitos de recuperación de los jugadores.',
      });
    }
  }
  
  // Insight: Carga elevada en día de descanso típico
  if (isWeekend) {
    const weekendLoad = internalLoads.filter((i) => {
      const iDate = new Date(i.date);
      const iDay = iDate.getDay();
      return iDay === 0 || iDay === 6;
    }).reduce((sum, i) => sum + (i.rpe * i.duration), 0);
    
    if (weekendLoad > 500) {
      insights.push({
        id: 'contextual-weekend-load',
        title: 'Carga fin de semana',
        tone: 'yellow',
        value: `${round(weekendLoad)} UA`,
        description: 'Carga significativa registrada en fin de semana. Verificar si corresponde a competición o ajustar programación.',
      });
    }
  }
  
  return insights;
};

// Alertas proactivas - antes de que ocurra el problema
export const buildProactiveAlerts = (params: {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  wellnessRecords: DailyWellnessRecord[];
  referenceDate: string;
  category?: ClubCategory | 'all';
}): LogicInsight[] => {
  const { players, internalLoads, externalLoads, wellnessRecords, referenceDate, category = 'all' } = params;
  const alerts: LogicInsight[] = [];
  
  // Alerta: Tendencia de wellness descendente
  players.filter((player) => category === 'all' || !category || player.category === category).forEach((player) => {
    const playerWellness = wellnessRecords
      .filter((w) => w.playerId === player.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
    
    if (playerWellness.length >= 5) {
      const recent = playerWellness.slice(0, 3).reduce((sum, w) => sum + (w.sleep + w.fatigue + w.stress + w.musclePain + w.mood) / 5, 0) / 3;
      const prior = playerWellness.slice(3, 6).reduce((sum, w) => sum + (w.sleep + w.fatigue + w.stress + w.musclePain + w.mood) / 5, 0) / 3;
      
      if (recent < prior - 0.5 && recent < 3.5) {
        alerts.push({
          id: `proactive-wellness-${player.id}`,
          title: `${player.name}: tendencia wellness`,
          tone: 'yellow',
          value: `${round(recent, 1)}/5`,
          description: `Wellness en descenso (${round(prior - recent, 1)} puntos). Monitorear de cerca en próximos días.`,
        });
      }
    }
  });
  
  // Alerta: ACWR elevado antes de competición
  const upcomingMatches = players.filter((player) => category === 'all' || !category || player.category === category)
    .map((player) => {
      const playerInternal = internalLoads.filter((i) => i.playerId === player.id);
      const recent7d = playerInternal
        .filter((i) => {
          const daysDiff = (new Date(referenceDate).getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff >= 0 && daysDiff <= 7;
        })
        .reduce((sum, i) => sum + (i.rpe * i.duration), 0);
      
      const prior21d = playerInternal
        .filter((i) => {
          const daysDiff = (new Date(referenceDate).getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff > 7 && daysDiff <= 28;
        })
        .reduce((sum, i) => sum + (i.rpe * i.duration), 0);
      
      const chronic = prior21d / 3;
      const acwr = chronic > 0 ? recent7d / chronic : 0;
      
      return { player, acwr };
    })
    .filter((row) => row.acwr > 1.3);
  
  if (upcomingMatches.length > 0) {
    alerts.push({
      id: 'proactive-acwr-competition',
      title: 'ACWR elevado antes de competición',
      tone: 'red',
      value: `${upcomingMatches.length} jugadores`,
      description: `${upcomingMatches.map((p) => p.player.name).join(', ')} con ACWR > 1.3. Considerar ajustar carga antes de próximo partido.`,
    });
  }
  
  return alerts.slice(0, 10);
};

export const buildDataInconsistencyAlerts = (params: {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  competitionRecords: CompetitionRecord[];
  competitionMatchSummaries?: CompetitionMatchSummary[];
  referenceDate?: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): LogicInsight[] => {
  const { players, internalLoads, externalLoads, competitionRecords, competitionMatchSummaries = [], referenceDate = '', category = 'all', limit = 12 } = params;
  const playerById = new Map(players.map((player) => [player.id, player]));
  const inScopePlayer = (playerId: string) => {
    const player = playerById.get(playerId);
    return Boolean(player && (category === 'all' || !category || player.category === category));
  };
  const alerts: LogicInsight[] = [];
  externalLoads
    .filter((record) => inScopePlayer(record.playerId) && (!referenceDate || record.date === referenceDate))
    .forEach((record) => {
      const player = playerById.get(record.playerId);
      const label = player?.name ?? 'Jugador';
      if ((record.min ?? 0) === 0 && (record.totalDistance ?? 0) > 300) alerts.push({ id: `inc-ext-min-${record.id}`, title: `${label}: GPS sin minutos`, tone: 'red', value: record.date, description: 'Tiene distancia registrada con 0 minutos. Revisar CSV o edición manual.' });
      if ((record.min ?? 0) >= 45 && (record.totalDistance ?? 0) === 0 && player?.position !== 'Portero') alerts.push({ id: `inc-ext-dist-${record.id}`, title: `${label}: minutos sin distancia`, tone: 'yellow', value: record.date, description: 'Tiene minutos altos pero sin distancia GPS. Revisar importación GPS.' });
      if ((record.rpe ?? 0) > 10 || (record.rpe ?? 0) < 0) alerts.push({ id: `inc-ext-rpe-${record.id}`, title: `${label}: RPE inválido`, tone: 'red', value: String(record.rpe), description: 'El RPE debe estar entre 0 y 10.' });
      if ((record.maxVelocity ?? 0) > 42) alerts.push({ id: `inc-ext-vmax-${record.id}`, title: `${label}: velocidad máxima improbable`, tone: 'yellow', value: `${record.maxVelocity} km/h`, description: 'Velocidad superior al rango esperado. Confirmar unidades o dato GPS.' });
      if ((record.totalDistance ?? 0) > 15000) alerts.push({ id: `inc-ext-distance-${record.id}`, title: `${label}: distancia improbable`, tone: 'yellow', value: `${round(record.totalDistance ?? 0)} m`, description: 'Distancia superior a lo esperado para una sesión normal. Revisar duración o archivo importado.' });
    });
  internalLoads
    .filter((record) => inScopePlayer(record.playerId) && (!referenceDate || record.date === referenceDate))
    .forEach((record) => {
      const label = playerById.get(record.playerId)?.name ?? 'Jugador';
      if (record.duration === 0 && record.rpe > 0) alerts.push({ id: `inc-int-duration-${record.id}`, title: `${label}: RPE sin duración`, tone: 'yellow', value: record.date, description: 'Tiene RPE pero 0 minutos/duración. Revisar carga interna.' });
      if (record.rpe > 10 || record.rpe < 0) alerts.push({ id: `inc-int-rpe-${record.id}`, title: `${label}: RPE interno inválido`, tone: 'red', value: String(record.rpe), description: 'El RPE debe estar entre 0 y 10.' });
    });
  competitionRecords
    .filter((record) => inScopePlayer(record.playerId) && (!referenceDate || record.date === referenceDate))
    .forEach((record) => {
      const player = playerById.get(record.playerId);
      const label = player?.name ?? 'Jugador';
      if ((record.minutesPlayed ?? 0) === 0 && (record.totalDistance ?? 0) > 300) alerts.push({ id: `inc-comp-min-${record.id}`, title: `${label}: partido GPS sin minutos`, tone: 'red', value: record.date, description: 'Partido con distancia registrada y 0 minutos jugados.' });
      if ((record.minutesPlayed ?? 0) > 120) alerts.push({ id: `inc-comp-time-${record.id}`, title: `${label}: minutos de partido inválidos`, tone: 'red', value: `${record.minutesPlayed} min`, description: 'Los minutos de competencia no deben superar 120.' });
      if ((record.maxVelocity ?? 0) > 42) alerts.push({ id: `inc-comp-vmax-${record.id}`, title: `${label}: velocidad de partido improbable`, tone: 'yellow', value: `${record.maxVelocity} km/h`, description: 'Confirmar unidades del GPS o dato importado.' });
    });

  players
    .filter((player) => category === 'all' || !category || player.category === category)
    .forEach((player) => {
      const dayInternal = internalLoads.filter((record) => record.playerId === player.id && (!referenceDate || record.date === referenceDate));
      const dayExternal = externalLoads.filter((record) => record.playerId === player.id && (!referenceDate || record.date === referenceDate));
      const hasLoad = dayInternal.some((record) => record.rpe >= 6 || record.duration > 0) || dayExternal.some((record) => (record.rpe ?? 0) >= 6 || record.participation === 'Completa' || (record.min ?? 0) >= 45);
      if ((player.status === 'Lesionado' || player.status === 'Readaptación') && hasLoad) {
        alerts.push({
          id: `inc-status-load-${player.id}-${referenceDate || 'all'}`,
          title: `${player.name}: estado médico vs carga`,
          tone: 'red',
          value: player.status,
          description: 'El jugador figura como lesionado/readaptación pero tiene carga relevante o participación completa. Revisar estado médico y registro de sesión.',
        });
      }
    });
  competitionMatchSummaries
    .filter((match) => (!referenceDate || match.date === referenceDate) && (category === 'all' || !category || match.category === category))
    .forEach((match) => {
      const matchRecords = competitionRecords.filter((record) => (record.matchId && record.matchId === match.id) || (record.date === match.date && record.opponent === match.opponent));
      const individualGoals = matchRecords.reduce((sum, record) => sum + (record.goals ?? 0), 0);
      const teamGoals = match.goalsFor ?? 0;
      if (matchRecords.length && individualGoals !== teamGoals) {
        alerts.push({
          id: `inc-goals-${match.id}`,
          title: `Goles de equipo vs jugadores`,
          tone: 'yellow',
          value: `${individualGoals}/${teamGoals}`,
          description: `La suma de goles individuales (${individualGoals}) no coincide con los goles del resumen (${teamGoals}) frente a ${match.opponent}.`,
        });
      }
    });
  return alerts.slice(0, limit);
};

export const buildCompetitionLogic = (params: {
  match?: CompetitionMatchSummary;
  records: CompetitionRecord[];
  players: Player[];
}): { insights: LogicInsight[]; ranking: Array<{ playerId: string; name: string; score: number; detail: string }> } => {
  const { match, records, players } = params;
  const playerName = (id: string) => players.find((player) => player.id === id)?.name ?? 'Jugador';
  const fieldRecords = records.filter((record) => (record.minutesPlayed ?? 0) > 0);
  const avgMinutes = safeAverage(fieldRecords.map((record) => record.minutesPlayed ?? 0));
  const avgDistance = safeAverage(fieldRecords.map((record) => record.totalDistance ?? 0));
  const totalMinutes = fieldRecords.reduce((sum, record) => sum + (record.minutesPlayed ?? 0), 0);
  const totalDistanceForMmin = fieldRecords.reduce((sum, record) => sum + (record.totalDistance ?? 0), 0);
  const avgMmin = totalMinutes > 0 ? totalDistanceForMmin / totalMinutes : 0;
  const gpsCompleteness = fieldRecords.length ? Math.round((fieldRecords.filter((record) => (record.totalDistance ?? 0) > 0 || (record.playerLoad ?? 0) > 0).length / fieldRecords.length) * 100) : 0;
  const starters = fieldRecords.filter((record) => record.startingRole === 'Titular');
  const substitutes = fieldRecords.filter((record) => record.startingRole === 'Suplente');
  const resultText = match ? `${match.resultType ?? 'Resultado'} ${match.goalsFor ?? '-'}-${match.goalsAgainst ?? '-'}` : 'Partido sin encabezado';
  const insights: LogicInsight[] = [
    {
      id: 'competition-volume',
      title: 'Lógica de competencia · volumen físico',
      tone: avgDistance >= 6500 || avgMmin >= 95 ? 'green' : avgDistance > 0 ? 'yellow' : 'neutral',
      value: `${round(avgDistance)} m`,
      description: `${resultText}. Promedio ${round(avgMinutes)} min · ${round(avgMmin)} m/min · GPS completo ${gpsCompleteness}%.`,
    },
    {
      id: 'competition-role-balance',
      title: 'Titulares vs suplentes',
      tone: starters.length ? 'blue' : 'yellow',
      value: `${starters.length}/${substitutes.length}`,
      description: `Titulares registrados: ${starters.length}. Suplentes registrados: ${substitutes.length}. Comparar demandas por rol para no mezclar cargas parciales con partido completo.`,
    },
  ];
  if (gpsCompleteness > 0 && gpsCompleteness < 80) {
    insights.push({
      id: 'competition-gps-missing',
      title: 'GPS incompleto en competencia',
      tone: 'yellow',
      value: `${gpsCompleteness}%`,
      description: 'Hay jugadores con minutos pero sin métricas GPS. Revisar importación antes de exportar informe.',
    });
  }
  const ranking = fieldRecords
    .map((record) => {
      const mmin = record.totalDistance && record.minutesPlayed ? record.totalDistance / record.minutesPlayed : 0;
      const score = (mmin * 0.25) + ((record.sprints ?? 0) * 1.8) + ((record.acc ?? 0) * 0.55) + ((record.dcc ?? 0) * 0.45) + ((record.sprintDistance ?? 0) * 0.06) + ((record.playerLoad ?? 0) * 0.12) + ((record.goals ?? 0) * 15) + ((record.assists ?? 0) * 10);
      return { playerId: record.playerId, name: playerName(record.playerId), score, detail: `${round(mmin)} m/min · ACC ${record.acc ?? 0} · Sprint ${record.sprintDistance ?? 0} m` };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  return { insights, ranking };
};

export const buildEvaluationLogic = (params: { data: AppData; players: Player[]; category?: ClubCategory | 'all'; limit?: number }): LogicInsight[] => {
  const { data, players, category = 'all', limit = 8 } = params;
  const scopedPlayers = players.filter((player) => category === 'all' || !category || player.category === category);
  const insights: LogicInsight[] = [];
  scopedPlayers.forEach((player) => {
    const cmj = data.cmjRecords.filter((record) => record.playerId === player.id && hasDate(record)).sort(compareDateDesc);
    const neuroSameDay = cmj[0] ? data.neuromuscularRecords.find((record) => record.playerId === player.id && record.date === cmj[0].date) : undefined;
    if (cmj[0] && neuroSameDay && Math.abs((neuroSameDay.cmj ?? 0) - cmj[0].value) >= 0.5) {
      insights.push({
        id: `eval-cmj-duplicate-${player.id}`,
        title: `${player.name}: CMJ duplicado`,
        tone: 'yellow',
        value: cmj[0].date,
        description: `Existe CMJ formal (${round(cmj[0].value, 1)} cm) y neuromuscular (${round(neuroSameDay.cmj, 1)} cm) en la misma fecha. Se prioriza CMJRecord.value.`,
      });
    }
    if (cmj[0] && cmj[1]) {
      const delta = cmj[0].value - cmj[1].value;
      const prev5Load = Array.from({ length: 5 }, (_, index) => getPlayerDailyInternalLoad(player.id, dateMinusDays(safeDateText(cmj[0].date), index + 1), data.internalLoads, data.externalLoads, data.competitionRecords)).reduce((sum, value) => sum + value, 0);
      if (Math.abs(delta) >= 2) {
        insights.push({
          id: `eval-cmj-${player.id}`,
          title: `${player.name}: cambio CMJ`,
          tone: delta >= 0 ? 'green' : prev5Load > 1500 ? 'yellow' : 'red',
          value: `${delta >= 0 ? '+' : ''}${round(delta, 1)} cm`,
          description: delta >= 0
            ? `Mejora neuromuscular frente a la medición anterior. Carga previa 5 días: ${round(prev5Load)} UA.`
            : prev5Load > 1500
              ? `Descenso CMJ con carga previa alta (${round(prev5Load)} UA en 5 días): fatiga esperada, controlar recuperación.`
              : `Descenso CMJ con carga previa baja (${round(prev5Load)} UA): revisar fatiga no explicada o posible deterioro.`,
        });
      }
    }
    const fms = data.fmsRecords.filter((record) => record.playerId === player.id && hasDate(record)).sort(compareDateDesc)[0];
    if (fms) {
      const total = fms.shoulderMobility + fms.squat + fms.legRaise + fms.hurdleStep + fms.lunge + fms.trunkStability + fms.rotaryStability;
      if (total <= 14 || [fms.shoulderMobility, fms.squat, fms.legRaise, fms.hurdleStep, fms.lunge, fms.trunkStability, fms.rotaryStability].some((value) => value <= 1)) {
        insights.push({
          id: `eval-fms-${player.id}`,
          title: `${player.name}: alerta FMS`,
          tone: 'yellow',
          value: `${total} pts`,
          description: 'Puntaje funcional con necesidad de seguimiento preventivo y trabajo correctivo.',
        });
      }
    }
  });
  return insights.slice(0, limit);
};

export const buildIntelligentRanking = (params: { data: AppData; players: Player[]; referenceDate?: string; category?: ClubCategory | 'all'; limit?: number }) => {
  const { data, players, referenceDate = '', category = 'all', limit = 10 } = params;
  const scopedPlayers = players.filter((player) => category === 'all' || !category || player.category === category);
  return scopedPlayers
    .map((player) => {
      const relatedIds = getRelatedPlayerIds(data.players, player.id);
      const effectiveExternal = getEffectiveExternalLoads(data, { activeCategory: category, playerIds: relatedIds });
      const loads = data.internalLoads
        .filter((record) => relatedIds.has(record.playerId) && (!referenceDate || record.date <= referenceDate))
        .sort(compareDateDesc);
      const recentLoad = loads.slice(0, 6).reduce((sum, record) => sum + calculateInternalLoad(record), 0);
      const wellness = averageWellness(data.wellness.filter((record) => relatedIds.has(record.playerId) && (!referenceDate || record.date <= referenceDate)).sort(compareDateDesc)[0]);
      const cmj = data.cmjRecords.filter((record) => relatedIds.has(record.playerId) && hasDate(record)).sort(compareDateDesc)[0]?.value ?? 0;
      const fms = data.fmsRecords.filter((record) => relatedIds.has(record.playerId) && hasDate(record)).sort(compareDateDesc)[0];
      const fmsTotal = fms ? fms.shoulderMobility + fms.squat + fms.legRaise + fms.hurdleStep + fms.lunge + fms.trunkStability + fms.rotaryStability : 0;
      const comp = data.competitionRecords.filter((record) => relatedIds.has(record.playerId));
      const goalsAssists = comp.reduce((sum, record) => sum + (record.goals * 8) + (record.assists * 6), 0);
      const gpsIntensity = safeAverage(effectiveExternal.filter((record) => relatedIds.has(record.playerId)).map((record) => record.totalDistance && record.min ? record.totalDistance / record.min : 0));
      const wellnessScore = wellness > 0 ? wellness * 12 : 0;
      const score = goalsAssists + Math.min(35, recentLoad / 120) + wellnessScore + Math.min(20, cmj / 2) + Math.min(15, fmsTotal) + Math.min(25, gpsIntensity / 4);
      return {
        id: player.id,
        name: player.name,
        score,
        detail: `Carga ${round(recentLoad)} UA · Wellness ${wellness ? round(wellness, 1) : 's/d'} · CMJ ${cmj || 's/d'} · FMS ${fmsTotal || 's/d'}`,
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

export const buildMicrocycleLogic = (params: {
  data: AppData;
  microcycle: Microcycle;
  players: Player[];
  category: ClubCategory;
}) => {
  const { data, microcycle, players, category } = params;
  const playerIds = new Set(players.map((player) => player.id));
  const hasRange = Boolean(microcycle.startDate && microcycle.endDate);
  const inRange = (date: string) => !hasRange || (date >= microcycle.startDate && date <= microcycle.endDate);
  const belongs = (recordMicrocycleId?: string, date?: string) => {
    if (recordMicrocycleId && recordMicrocycleId !== microcycle.id) return false;
    if (recordMicrocycleId === microcycle.id) return date ? inRange(date) : true;
    return false;
  };
  const sessions = data.trainingSessionSummaries.filter((session) => session.category === category && belongs(session.microcycleId, session.date));
  const external = data.externalLoads.filter((record) => (record.category === category || playerIds.has(record.playerId)) && belongs(record.microcycleId, record.date));
  const internal = data.internalLoads.filter((record) => (record.category === category || playerIds.has(record.playerId)) && belongs(record.microcycleId, record.date));
  const competition = data.competitionRecords.filter((record) => playerIds.has(record.playerId) && inRange(record.date));
  const dates = Array.from(new Set([...internal.map((record) => record.date), ...external.map((record) => record.date), ...competition.map((record) => record.date)])).sort();
  const loads = dates.reduce((sum, date) => sum + players.reduce((acc, player) => acc + getPlayerDailyInternalLoad(player.id, date, internal, external, competition), 0), 0);
  const typeCount = sessions.reduce<Record<string, number>>((acc, session) => {
    const label = trainingTypeLabel[session.sessionType] ?? 'Sin tipo';
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const physicalSessions = sessions.filter((session) => session.sessionType === 'MD-3' || session.sessionType === 'MD-4').length;
  const recoverySessions = sessions.filter((session) => session.sessionType === 'MD+1' || session.sessionType === 'MD+2').length;
  const decisionSessions = sessions.filter((session) => session.sessionType === 'MD-2').length;
  const insights: LogicInsight[] = [
    {
      id: 'microcycle-load-plan',
      title: 'Lógica de microciclo · carga ejecutada',
      tone: loads >= 3500 ? 'red' : loads >= 1800 ? 'yellow' : 'green',
      value: `${round(loads)} UA`,
      description: `Sesiones registradas: ${sessions.length}. Distribución: ${Object.entries(typeCount).map(([type, count]) => `${type} ${count}`).join(' · ') || 'sin sesiones'}.`,
    },
    {
      id: 'microcycle-type-balance',
      title: 'Balance de contenidos',
      tone: physicalSessions > 2 && recoverySessions === 0 ? 'yellow' : 'blue',
      value: `${physicalSessions} días fuertes · ${decisionSessions} MD-2`,
      description: physicalSessions > 2 && recoverySessions === 0 ? 'Microciclo con alta presencia de días fuertes y sin recuperación registrada.' : 'Distribución de contenidos apta para seguimiento técnico.',
    },
  ];
  return { sessions, loads, typeCount, insights };
};
