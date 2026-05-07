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
import { averageWellness, calculateInternalLoad, groupAverage } from './utils';

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
}

const safeAverage = (values: number[]) => groupAverage(values.filter((value) => Number.isFinite(value) && value > 0));
const round = (value: number, digits = 0) => (Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits));

export const trainingTypeLabel: Record<TrainingSessionType, string> = {
  cdef: 'Recuperación',
  cdEf: 'Ejecución',
  cdeF: 'Condición física',
  Cdef: 'Comunicación',
  deci: 'Decisión',
};

const typeTargets: Record<TrainingSessionType, { min: [number, number]; rpe: [number, number]; load: [number, number]; note: string }> = {
  cdef: { min: [15, 55], rpe: [1, 4.5], load: [20, 220], note: 'Debe favorecer recuperación, baja carga interna y control de fatiga.' },
  cdEf: { min: [35, 85], rpe: [3.5, 7], load: [160, 480], note: 'Debe permitir ejecución técnica/táctica con carga moderada y controlada.' },
  cdeF: { min: [45, 100], rpe: [5, 8.5], load: [280, 720], note: 'Acepta mayor volumen e intensidad, pero requiere control de wellness y recuperación.' },
  Cdef: { min: [25, 70], rpe: [2.5, 6], load: [100, 360], note: 'Debe priorizar organización y comunicación con carga física baja-media.' },
  deci: { min: [35, 85], rpe: [4, 7.5], load: [180, 560], note: 'Debe combinar exigencia cognitiva, toma de decisión e intensidad física moderada.' },
};

export const buildSessionTypeLoadControl = (sessionType: TrainingSessionType, metrics: SessionLoadMetrics): LogicInsight => {
  const target = typeTargets[sessionType];
  const highLoad = metrics.avgInternalLoad > target.load[1];
  const lowLoad = metrics.avgInternalLoad > 0 && metrics.avgInternalLoad < target.load[0];
  const highRpe = metrics.avgRpe > target.rpe[1];
  const highVolume = metrics.avgMinutes > target.min[1];
  const wellnessLow = typeof metrics.wellnessReadiness === 'number' && metrics.wellnessReadiness > 0 && metrics.wellnessReadiness < 3.2;
  const tone: InsightTone = highLoad || highRpe || (wellnessLow && (metrics.avgRpe >= 6 || metrics.avgInternalLoad >= target.load[1] * 0.85)) ? 'red' : lowLoad || highVolume || wellnessLow ? 'yellow' : 'green';
  const status = tone === 'green' ? 'La carga es coherente con el tipo de sesión.' : tone === 'yellow' ? 'Carga con desviación moderada frente al objetivo.' : 'Alerta: la carga supera lo esperado para el objetivo.';
  return {
    id: `session-type-${sessionType}`,
    title: `Control de carga · ${trainingTypeLabel[sessionType]}`,
    tone,
    value: `${round(metrics.avgInternalLoad)} UA`,
    description: `${status} MIN ${round(metrics.avgMinutes)} · RPE ${round(metrics.avgRpe, 1)} · objetivo ${target.load[0]}-${target.load[1]} UA. ${target.note}`,
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

export const getPlayerDailyInternalLoad = (playerId: string, date: string, internalLoads: DailyInternalLoadRecord[], externalLoads: DailyExternalLoadRecord[]) => {
  const internal = internalLoads.filter((load) => load.playerId === playerId && load.date === date);
  if (internal.length) return internal.reduce((sum, load) => sum + calculateInternalLoad(load), 0);
  return externalLoads
    .filter((load) => load.playerId === playerId && load.date === date)
    .reduce((sum, load) => sum + ((load.min ?? 0) * (load.rpe ?? 0)), 0);
};

export const buildAbruptLoadAlerts = (params: {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  referenceDate: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): LogicInsight[] => {
  const { players, internalLoads, externalLoads, referenceDate, category = 'all', limit = 8 } = params;
  const scopedPlayers = players.filter((player) => category === 'all' || !category || player.category === category);
  const rows = scopedPlayers.map((player) => {
    const dates = Array.from(new Set([
      ...internalLoads.filter((load) => load.playerId === player.id).map((load) => load.date),
      ...externalLoads.filter((load) => load.playerId === player.id).map((load) => load.date),
    ])).filter((date) => !referenceDate || date <= referenceDate);
    const current = dates
      .filter((date) => {
        const diff = daysBetween(date, referenceDate);
        return diff >= 0 && diff <= 6;
      })
      .reduce((sum, date) => sum + getPlayerDailyInternalLoad(player.id, date, internalLoads, externalLoads), 0);
    const previous = dates
      .filter((date) => {
        const diff = daysBetween(date, referenceDate);
        return diff >= 7 && diff <= 13;
      })
      .reduce((sum, date) => sum + getPlayerDailyInternalLoad(player.id, date, internalLoads, externalLoads), 0);
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

export const wellnessReadiness = (record?: DailyWellnessRecord) => {
  if (!record) return 0;
  const sleep = record.sleep || 0;
  const mood = record.mood || 0;
  const fatigue = 6 - (record.fatigue || 0);
  const stress = 6 - (record.stress || 0);
  const musclePain = 6 - (record.musclePain || 0);
  return (sleep + mood + fatigue + stress + musclePain) / 5;
};

export const buildLoadWellnessRelation = (params: {
  players: Player[];
  wellness: DailyWellnessRecord[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  date: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): LogicInsight[] => {
  const { players, wellness, internalLoads, externalLoads, date, category = 'all', limit = 6 } = params;
  return players
    .filter((player) => category === 'all' || !category || player.category === category)
    .map((player) => {
      const ready = wellnessReadiness(wellness.find((record) => record.playerId === player.id && record.date === date));
      const load = getPlayerDailyInternalLoad(player.id, date, internalLoads, externalLoads);
      return { player, ready, load };
    })
    .filter((row) => row.load >= 300 || (row.ready > 0 && row.ready < 3.2))
    .sort((a, b) => (b.load * (b.ready ? 6 - b.ready : 1)) - (a.load * (a.ready ? 6 - a.ready : 1)))
    .slice(0, limit)
    .map((row) => {
      const red = row.load >= 450 && row.ready > 0 && row.ready < 3.2;
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

const latestByDate = <T extends { date: string }>(records: T[]) =>
  [...records].sort((a, b) => b.date.localeCompare(a.date))[0];

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
) => Array.from(new Set([
  ...internalLoads.filter((load) => load.playerId === playerId).map((load) => load.date),
  ...externalLoads.filter((load) => load.playerId === playerId).map((load) => load.date),
])).filter((date) => !referenceDate || date <= referenceDate).sort();

const getPlayerLoadWindow = (
  playerId: string,
  referenceDate: string,
  minDiff: number,
  maxDiff: number,
  internalLoads: DailyInternalLoadRecord[],
  externalLoads: DailyExternalLoadRecord[],
) => getPlayerDatesUntil(playerId, referenceDate, internalLoads, externalLoads)
  .filter((date) => {
    const diff = daysBetween(date, referenceDate);
    return diff >= minDiff && diff <= maxDiff;
  })
  .reduce((sum, date) => sum + getPlayerDailyInternalLoad(playerId, date, internalLoads, externalLoads), 0);

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
  referenceDate: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): PlayerReadinessRow[] => {
  const { players, wellness, internalLoads, externalLoads, referenceDate, category = 'all', limit = 12 } = params;
  return players
    .filter((player) => category === 'all' || !category || player.category === category)
    .map((player) => {
      const latestWellness = latestByDate(wellness.filter((record) => record.playerId === player.id && (!referenceDate || record.date <= referenceDate)));
      const ready = wellnessReadiness(latestWellness);
      const currentLoad = getPlayerLoadWindow(player.id, referenceDate, 0, 6, internalLoads, externalLoads);
      const previousLoad = getPlayerLoadWindow(player.id, referenceDate, 7, 13, internalLoads, externalLoads);
      const increase = previousLoad > 0 ? ((currentLoad - previousLoad) / previousLoad) * 100 : currentLoad > 0 ? 100 : 0;
      let score = 100;
      if (ready > 0) score += (ready - 3.5) * 12;
      else score -= 10;
      if (currentLoad >= 900) score -= 22;
      else if (currentLoad >= 650) score -= 12;
      if (increase >= 60) score -= 18;
      else if (increase >= 35) score -= 10;
      if (player.status === 'Lesionado') score -= 55;
      if (player.status === 'Readaptación') score -= 25;
      if (player.status === 'Molestia') score -= 18;
      score = Math.max(0, Math.min(100, score));
      const tone: ReadinessTone = score >= 76 ? 'green' : score >= 56 ? 'yellow' : 'red';
      const label = tone === 'green' ? 'Disponible' : tone === 'yellow' ? 'Precaución' : 'Riesgo';
      return {
        playerId: player.id,
        name: player.name,
        position: player.position,
        score,
        tone,
        label,
        detail: `Wellness ${ready ? round(ready, 1) : 's/d'} · carga 7d ${round(currentLoad)} UA · cambio ${round(increase)}% · estado ${player.status}`,
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
      const recentMatches = competitionRecords
        .filter((record) => record.playerId === player.id && (!referenceDate || record.date <= referenceDate))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);
      const avgMinutes = mean(recentMatches.map((record) => record.minutesPlayed ?? 0));
      const starts = recentMatches.filter((record) => record.startingRole === 'Titular' || (record.minutesPlayed ?? 0) >= 45).length;
      const currentLoad = getPlayerLoadWindow(player.id, referenceDate, 0, 6, internalLoads, externalLoads);
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
  return players
    .filter((player) => category === 'all' || !category || player.category === category)
    .map((player) => {
      const currentLoad = getPlayerLoadWindow(player.id, referenceDate, 0, 6, internalLoads, externalLoads);
      const previousLoad = getPlayerLoadWindow(player.id, referenceDate, 7, 13, internalLoads, externalLoads);
      const lastMatch = latestByDate(competitionRecords.filter((record) => record.playerId === player.id && (!referenceDate || record.date <= referenceDate)));
      const increase = previousLoad > 0 ? ((currentLoad - previousLoad) / previousLoad) * 100 : currentLoad > 0 ? 100 : 0;
      const hasRtpStatus = player.status === 'Readaptación' || player.status === 'Molestia' || player.status === 'Lesionado' || lastMatch?.medicalStatus === 'Lesionado';
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
  referenceDate: string;
  category?: ClubCategory | 'all';
}): LogicInsight => {
  const { players, internalLoads, externalLoads, referenceDate, category = 'all' } = params;
  const scoped = players.filter((player) => category === 'all' || !category || player.category === category);
  const dailyLoads = Array.from({ length: 7 }, (_, index) => {
    const date = dateMinusDays(referenceDate, 6 - index);
    return scoped.reduce((sum, player) => sum + getPlayerDailyInternalLoad(player.id, date, internalLoads, externalLoads), 0);
  });
  const avg = mean(dailyLoads);
  const sd = stdDev(dailyLoads);
  const monotony = sd > 0 ? avg / sd : avg > 0 ? 9.99 : 0;
  const strain = avg * 7 * monotony;
  const tone: InsightTone = monotony >= 2.2 || strain >= 9000 ? 'red' : monotony >= 1.5 || strain >= 5500 ? 'yellow' : 'green';
  return {
    id: 'weekly-monotony-fatigue',
    title: 'Monotonía y fatiga semanal',
    tone,
    value: `${round(monotony, 2)}`,
    description: `Carga semanal ${round(avg * 7)} UA · strain ${round(strain)}. Una monotonía alta indica poca variación entre días y posible acumulación de fatiga.`,
  };
};

export const buildSelfComparisonInsights = (params: {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  referenceDate: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): LogicInsight[] => {
  const { players, internalLoads, externalLoads, referenceDate, category = 'all', limit = 8 } = params;
  return players
    .filter((player) => category === 'all' || !category || player.category === category)
    .map((player) => {
      const todayLoad = getPlayerDailyInternalLoad(player.id, referenceDate, internalLoads, externalLoads);
      const historyDates = getPlayerDatesUntil(player.id, referenceDate, internalLoads, externalLoads).filter((date) => date < referenceDate).slice(-12);
      const personalAvg = mean(historyDates.map((date) => getPlayerDailyInternalLoad(player.id, date, internalLoads, externalLoads)));
      const delta = personalAvg > 0 ? ((todayLoad - personalAvg) / personalAvg) * 100 : todayLoad > 0 ? 100 : 0;
      const latestExternal = latestByDate(externalLoads.filter((record) => record.playerId === player.id && record.date === referenceDate));
      const mmin = latestExternal?.totalDistance && latestExternal?.min ? latestExternal.totalDistance / latestExternal.min : 0;
      return { player, todayLoad, personalAvg, delta, mmin };
    })
    .filter((row) => row.todayLoad > 0 && Math.abs(row.delta) >= 30)
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

export const buildDataInconsistencyAlerts = (params: {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  competitionRecords: CompetitionRecord[];
  referenceDate?: string;
  category?: ClubCategory | 'all';
  limit?: number;
}): LogicInsight[] => {
  const { players, internalLoads, externalLoads, competitionRecords, referenceDate = '', category = 'all', limit = 12 } = params;
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
  const avgMmin = safeAverage(fieldRecords.map((record) => record.totalDistance && record.minutesPlayed ? record.totalDistance / record.minutesPlayed : 0));
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
    const cmj = data.cmjRecords.filter((record) => record.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date));
    if (cmj[0] && cmj[1]) {
      const delta = cmj[0].value - cmj[1].value;
      if (Math.abs(delta) >= 2) {
        insights.push({
          id: `eval-cmj-${player.id}`,
          title: `${player.name}: cambio CMJ`,
          tone: delta >= 0 ? 'green' : 'red',
          value: `${delta >= 0 ? '+' : ''}${round(delta, 1)} cm`,
          description: delta >= 0 ? 'Mejora neuromuscular frente a la medición anterior.' : 'Descenso relevante en CMJ. Revisar fatiga, recuperación o carga previa.',
        });
      }
    }
    const fms = data.fmsRecords.filter((record) => record.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date))[0];
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
      const loads = data.internalLoads.filter((record) => record.playerId === player.id && (!referenceDate || record.date <= referenceDate));
      const recentLoad = loads.slice(-6).reduce((sum, record) => sum + calculateInternalLoad(record), 0);
      const wellness = averageWellness(data.wellness.filter((record) => record.playerId === player.id && (!referenceDate || record.date <= referenceDate)).sort((a, b) => b.date.localeCompare(a.date))[0]);
      const cmj = data.cmjRecords.filter((record) => record.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date))[0]?.value ?? 0;
      const fms = data.fmsRecords.filter((record) => record.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      const fmsTotal = fms ? fms.shoulderMobility + fms.squat + fms.legRaise + fms.hurdleStep + fms.lunge + fms.trunkStability + fms.rotaryStability : 0;
      const comp = data.competitionRecords.filter((record) => record.playerId === player.id);
      const goalsAssists = comp.reduce((sum, record) => sum + (record.goals * 8) + (record.assists * 6), 0);
      const gpsIntensity = safeAverage(data.externalLoads.filter((record) => record.playerId === player.id).map((record) => record.totalDistance && record.min ? record.totalDistance / record.min : 0));
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
  const inRange = (date: string) => Boolean(microcycle.startDate && microcycle.endDate && date >= microcycle.startDate && date <= microcycle.endDate);
  const sessions = data.trainingSessionSummaries.filter((session) => session.category === category && (session.microcycleId === microcycle.id || inRange(session.date)));
  const external = data.externalLoads.filter((record) => (record.category === category || playerIds.has(record.playerId)) && (record.microcycleId === microcycle.id || inRange(record.date)));
  const internal = data.internalLoads.filter((record) => (record.category === category || playerIds.has(record.playerId)) && (record.microcycleId === microcycle.id || inRange(record.date)));
  const loads = internal.reduce((sum, record) => sum + calculateInternalLoad(record), 0) || external.reduce((sum, record) => sum + ((record.min ?? 0) * (record.rpe ?? 0)), 0);
  const typeCount = sessions.reduce<Record<string, number>>((acc, session) => {
    const label = trainingTypeLabel[session.sessionType] ?? 'Sin tipo';
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const physicalSessions = sessions.filter((session) => session.sessionType === 'cdeF').length;
  const recoverySessions = sessions.filter((session) => session.sessionType === 'cdef').length;
  const decisionSessions = sessions.filter((session) => session.sessionType === 'deci').length;
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
      value: `${physicalSessions} CF · ${decisionSessions} Dec`,
      description: physicalSessions > 2 && recoverySessions === 0 ? 'Microciclo con alta presencia física y sin recuperación registrada.' : 'Distribución de contenidos apta para seguimiento técnico.',
    },
  ];
  return { sessions, loads, typeCount, insights };
};
