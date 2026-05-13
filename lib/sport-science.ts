import type { AppData, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord, Player } from './types';

const MS_DAY = 24 * 60 * 60 * 1000;
const num = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value: number, digits = 0) => Number(value.toFixed(digits));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const toDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const dateMinusDays = (referenceDate: string, days: number) => {
  const parsed = toDate(referenceDate);
  if (!parsed) return referenceDate;
  const next = new Date(parsed.getTime() - days * MS_DAY);
  return next.toISOString().slice(0, 10);
};

export const datePlusDays = (referenceDate: string, days: number) => dateMinusDays(referenceDate, -days);

export const daysBetween = (date: string, referenceDate: string) => {
  const a = toDate(date);
  const b = toDate(referenceDate);
  if (!a || !b) return 9999;
  return Math.round((b.getTime() - a.getTime()) / MS_DAY);
};

export const dateRange = (startDate: string, endDate: string) => {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end || start > end) return [];
  const dates: string[] = [];
  for (let ts = start.getTime(); ts <= end.getTime(); ts += MS_DAY) dates.push(new Date(ts).toISOString().slice(0, 10));
  return dates;
};

const inWindow = (date: string, referenceDate: string, minDays: number, maxDays: number) => {
  const diff = daysBetween(date, referenceDate);
  return diff >= minDays && diff <= maxDays;
};

export const wellnessAverage = (record?: Pick<DailyWellnessRecord, 'sleep' | 'fatigue' | 'stress' | 'musclePain' | 'mood'>) => {
  if (!record) return undefined;
  return (num(record.sleep) + num(record.fatigue) + num(record.stress) + num(record.musclePain) + num(record.mood)) / 5;
};

export const internalLoadValue = (record?: Pick<DailyInternalLoadRecord, 'duration' | 'rpe'>) => {
  if (!record) return 0;
  return num(record.duration) * num(record.rpe);
};

export const externalLoadValue = (record?: DailyExternalLoadRecord) => {
  if (!record) return 0;
  const rpeLoad = num(record.rpe) * num(record.min);
  if (rpeLoad > 0) return rpeLoad;
  return num(record.playerLoad) + (num(record.totalDistance) / 10) + num(record.acc) + num(record.dcc) + (num(record.sprints) * 4) + num(record.rhie);
};

export const playerDayLoad = (data: Pick<AppData, 'internalLoads' | 'externalLoads'>, playerId: string, date: string) => {
  const internal = data.internalLoads.filter((record) => record.playerId === playerId && record.date === date).reduce((sum, record) => sum + internalLoadValue(record), 0);
  if (internal > 0) return internal;
  return data.externalLoads.filter((record) => record.playerId === playerId && record.date === date).reduce((sum, record) => sum + externalLoadValue(record), 0);
};

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const standardDeviation = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const percentile = (values: number[], p: number) => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const low = Math.floor(index);
  const high = Math.ceil(index);
  const weight = index - low;
  return sorted[low] * (1 - weight) + sorted[high] * weight;
};

export interface FosterPlayerMetrics {
  playerId: string;
  name: string;
  dailyLoads: number[];
  totalLoad: number;
  meanLoad: number;
  stdDev: number;
  monotony: number;
  strain: number;
  alert: boolean;
  tone: 'green' | 'amber' | 'red';
  label: string;
}

export const computeFosterPlayerMetrics = (data: AppData, player: Player, referenceDate: string, days = 7): FosterPlayerMetrics => {
  const dailyLoads = Array.from({ length: days }, (_, index) => playerDayLoad(data, player.id, dateMinusDays(referenceDate, days - 1 - index)));
  const totalLoad = dailyLoads.reduce((sum, value) => sum + value, 0);
  const meanLoad = mean(dailyLoads);
  const stdDev = standardDeviation(dailyLoads);
  const monotony = stdDev > 0 ? meanLoad / stdDev : totalLoad > 0 ? 9.99 : 0;
  const strain = totalLoad * monotony;
  const alert = monotony > 2;
  const tone: FosterPlayerMetrics['tone'] = monotony > 2.5 ? 'red' : monotony > 2 ? 'amber' : 'green';
  const label = totalLoad === 0 ? 'Sin carga' : alert ? 'Monotonía alta' : 'Distribución adecuada';
  return {
    playerId: player.id,
    name: player.name,
    dailyLoads: dailyLoads.map((value) => round(value)),
    totalLoad: round(totalLoad),
    meanLoad: round(meanLoad),
    stdDev: round(stdDev),
    monotony: round(monotony, 2),
    strain: round(strain),
    alert,
    tone,
    label,
  };
};

export const buildFosterTable = (data: AppData, referenceDate: string, category: string = 'all') =>
  data.players
    .filter((player) => category === 'all' || player.category === category)
    .map((player) => computeFosterPlayerMetrics(data, player, referenceDate))
    .sort((a, b) => Number(b.alert) - Number(a.alert) || b.monotony - a.monotony || b.strain - a.strain);

export type DynamicVariable = 'wellness' | 'rpe' | 'load';

export interface DynamicThresholdMetric {
  variable: DynamicVariable;
  label: string;
  count: number;
  p10?: number;
  p90?: number;
  mean?: number;
  sd?: number;
  today?: number;
  zScore?: number;
  outsideNormal: boolean;
  tone: 'green' | 'amber' | 'red' | 'neutral';
  message: string;
}

const metricTone = (count: number, outside: boolean, z?: number): DynamicThresholdMetric['tone'] => {
  if (count < 5) return 'neutral';
  if (!outside) return 'green';
  return Math.abs(z ?? 0) >= 2 ? 'red' : 'amber';
};

const buildMetric = (variable: DynamicVariable, label: string, values: number[], today?: number): DynamicThresholdMetric => {
  const clean = values.filter((value) => Number.isFinite(value));
  const p10 = percentile(clean, 10);
  const p90 = percentile(clean, 90);
  const avg = mean(clean);
  const sd = standardDeviation(clean);
  const zScore = today !== undefined && sd > 0 ? (today - avg) / sd : undefined;
  const outsideNormal = today !== undefined && clean.length >= 5 && ((p10 !== undefined && today < p10) || (p90 !== undefined && today > p90) || Math.abs(zScore ?? 0) > 1.5);
  const tone = metricTone(clean.length, outsideNormal, zScore);
  const message = clean.length < 5 ? 'Historial insuficiente' : outsideNormal ? 'Fuera del rango individual habitual' : 'Dentro del rango individual';
  return { variable, label, count: clean.length, p10: p10 !== undefined ? round(p10, 1) : undefined, p90: p90 !== undefined ? round(p90, 1) : undefined, mean: round(avg, 1), sd: round(sd, 1), today: today !== undefined ? round(today, 1) : undefined, zScore: zScore !== undefined ? round(zScore, 2) : undefined, outsideNormal, tone, message };
};

export const computeDynamicThresholds = (data: AppData, player: Player, referenceDate: string, lookbackDays = 56) => {
  const wellnessValues = data.wellness
    .filter((record) => record.playerId === player.id && inWindow(record.date, referenceDate, 1, lookbackDays))
    .map(wellnessAverage)
    .filter((value): value is number => value !== undefined);
  const rpeValues = data.internalLoads
    .filter((record) => record.playerId === player.id && inWindow(record.date, referenceDate, 1, lookbackDays))
    .map((record) => num(record.rpe))
    .filter((value) => value > 0);
  const loadValues = Array.from({ length: lookbackDays }, (_, index) => playerDayLoad(data, player.id, dateMinusDays(referenceDate, lookbackDays - index)))
    .filter((value) => value > 0);

  const todayWellness = wellnessAverage(data.wellness.find((record) => record.playerId === player.id && record.date === referenceDate));
  const todayRpe = data.internalLoads.find((record) => record.playerId === player.id && record.date === referenceDate)?.rpe;
  const todayLoad = playerDayLoad(data, player.id, referenceDate) || undefined;

  return {
    wellness: buildMetric('wellness', 'Wellness', wellnessValues, todayWellness),
    rpe: buildMetric('rpe', 'RPE', rpeValues, todayRpe),
    load: buildMetric('load', 'Carga', loadValues, todayLoad),
  };
};

export interface BanisterMetrics {
  playerId: string;
  name: string;
  ctl: number;
  atl: number;
  tsb: number;
  projectedMatchDate?: string;
  daysToMatch?: number;
  projectedCtl?: number;
  projectedAtl?: number;
  projectedTsb?: number;
  alert: boolean;
  tone: 'green' | 'amber' | 'red';
  label: string;
}

const exponentialWeightedAverage = (loads: Array<{ date: string; load: number }>, referenceDate: string, tau: number) => {
  let weighted = 0;
  let weights = 0;
  loads.forEach((item) => {
    const diff = daysBetween(item.date, referenceDate);
    if (diff < 0 || diff > 120) return;
    const weight = Math.exp(-diff / tau);
    weighted += item.load * weight;
    weights += weight;
  });
  return weights > 0 ? weighted / weights : 0;
};

const findNextMatchDate = (data: AppData, player: Player, referenceDate: string) => {
  const sessionMd = data.trainingSessionSummaries
    .filter((session) => session.date >= referenceDate && session.sessionType === 'MD' && (!session.category || !player.category || session.category === player.category))
    .map((session) => session.date)
    .sort()[0];
  const match = data.competitionMatchSummaries
    .filter((item) => item.date >= referenceDate && (!item.category || !player.category || item.category === player.category))
    .map((item) => item.date)
    .sort()[0];
  return [sessionMd, match].filter(Boolean).sort()[0];
};

export const computeBanisterMetrics = (data: AppData, player: Player, referenceDate: string): BanisterMetrics => {
  const loads = Array.from({ length: 120 }, (_, index) => {
    const date = dateMinusDays(referenceDate, 119 - index);
    return { date, load: playerDayLoad(data, player.id, date) };
  }).filter((item) => item.load > 0);
  const ctl = exponentialWeightedAverage(loads, referenceDate, 42);
  const atl = exponentialWeightedAverage(loads, referenceDate, 7);
  const tsb = ctl - atl;
  const projectedMatchDate = findNextMatchDate(data, player, referenceDate);
  const daysToMatch = projectedMatchDate ? Math.max(0, daysBetween(referenceDate, projectedMatchDate) * -1 || daysBetween(projectedMatchDate, referenceDate)) : undefined;
  const projectionDays = projectedMatchDate ? Math.max(0, daysBetween(referenceDate, projectedMatchDate) * -1) : undefined;
  const actualDaysToMatch = projectedMatchDate ? Math.max(0, Math.round(((toDate(projectedMatchDate)?.getTime() ?? 0) - (toDate(referenceDate)?.getTime() ?? 0)) / MS_DAY)) : undefined;
  const projectedCtl = actualDaysToMatch !== undefined ? ctl * Math.exp(-actualDaysToMatch / 42) : undefined;
  const projectedAtl = actualDaysToMatch !== undefined ? atl * Math.exp(-actualDaysToMatch / 7) : undefined;
  const projectedTsb = projectedCtl !== undefined && projectedAtl !== undefined ? projectedCtl - projectedAtl : undefined;
  const alert = projectedTsb !== undefined ? projectedTsb < 0 : tsb < 0;
  const tone: BanisterMetrics['tone'] = alert ? (projectedTsb !== undefined && projectedTsb < -10 ? 'red' : 'amber') : 'green';
  const label = alert ? 'Llegaría con fatiga' : 'Forma adecuada';
  return { playerId: player.id, name: player.name, ctl: round(ctl), atl: round(atl), tsb: round(tsb), projectedMatchDate, daysToMatch: actualDaysToMatch, projectedCtl: projectedCtl !== undefined ? round(projectedCtl) : undefined, projectedAtl: projectedAtl !== undefined ? round(projectedAtl) : undefined, projectedTsb: projectedTsb !== undefined ? round(projectedTsb) : undefined, alert, tone, label };
};

export interface AdherencePlayerMetrics {
  playerId: string;
  name: string;
  dates: Array<{ date: string; registered: boolean }>;
  registeredDays: number;
  totalDays: number;
  adherencePct: number;
  missingDates: string[];
  alert: boolean;
  confidenceScore: number;
  confidenceLabel: 'Alta' | 'Media' | 'Baja';
  tone: 'green' | 'amber' | 'red';
}

export const computeWellnessAdherence = (data: AppData, player: Player, referenceDate: string, days = 28): AdherencePlayerMetrics => {
  const dates = Array.from({ length: days }, (_, index) => dateMinusDays(referenceDate, days - 1 - index));
  const records = new Set(data.wellness.filter((record) => record.playerId === player.id).map((record) => record.date));
  const mapped = dates.map((date) => ({ date, registered: records.has(date) }));
  const registeredDays = mapped.filter((item) => item.registered).length;
  const adherencePct = dates.length ? Math.round((registeredDays / dates.length) * 100) : 0;
  const alert = adherencePct < 70;
  const confidenceScore = clamp(Math.round(adherencePct), 0, 100);
  const confidenceLabel: AdherencePlayerMetrics['confidenceLabel'] = confidenceScore >= 85 ? 'Alta' : confidenceScore >= 70 ? 'Media' : 'Baja';
  const tone: AdherencePlayerMetrics['tone'] = confidenceScore >= 85 ? 'green' : confidenceScore >= 70 ? 'amber' : 'red';
  return { playerId: player.id, name: player.name, dates: mapped, registeredDays, totalDays: dates.length, adherencePct, missingDates: mapped.filter((item) => !item.registered).map((item) => item.date), alert, confidenceScore, confidenceLabel, tone };
};

export const buildAdherenceDashboard = (data: AppData, referenceDate: string, category: string = 'all') =>
  data.players
    .filter((player) => category === 'all' || player.category === category)
    .map((player) => computeWellnessAdherence(data, player, referenceDate))
    .sort((a, b) => a.adherencePct - b.adherencePct || a.name.localeCompare(b.name));
