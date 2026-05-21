import type { AppData, CompetitionRecord, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord, Player } from './types';
import type { BodyMapRecord } from './body-map';
import { BODY_REGION_RISK } from './body-map';
import {
  averageWellness,
  calculateCompetitionRecordLoad,
  calculateExternalLoad,
  calculateInternalLoad,
  externalLoadHasInternalPair,
  getPlayerDayLoad,
  isCompetitionExternalLoad,
} from './utils';

const MS_DAY = 24 * 60 * 60 * 1000;

export type LoadRiskTone = 'green' | 'amber' | 'red';
export type DataConfidenceLabel = 'Alta' | 'Media' | 'Baja';
export type RiskDomain = 'fatigue' | 'overload' | 'underexposure' | 'muscleTendon' | 'dataQuality';
export type LoadVariable = 'srpe' | 'minutes' | 'hsr' | 'sprint' | 'accDec' | 'neuromuscular' | 'distance' | 'playerLoad';
export type DailyLoadDecisionState = 'Carga completa' | 'Control preventivo' | 'Carga reducida' | 'Trabajo modificado' | 'No campo' | 'Compensatorio';

export interface DayLoadBreakdown {
  date: string;
  effectiveLoad: number;
  internalLoad: number;
  externalLoad: number;
  competitionLoad: number;
  minutes: number;
  distance: number;
  hsr: number;
  sprint: number;
  sprintCount: number;
  accDec: number;
  neuromuscular: number;
  playerLoad: number;
  maxVelocity: number;
  hasInternal: boolean;
  hasExternal: boolean;
  hasCompetition: boolean;
  gpsLikeRecords: number;
}

export interface VariableAcwrMetric {
  variable: LoadVariable;
  label: string;
  acute: number;
  chronic: number;
  rolling: number;
  ewmaAcute: number;
  ewmaChronic: number;
  ewma: number;
  zone: 'target' | 'low' | 'caution' | 'danger' | 'no_data';
  zoneLabel: string;
  historyDays: number;
  weeklyLoads: number[];
}

export interface MonotonyStrainMetric {
  dailyLoads: number[];
  totalLoad: number;
  meanLoad: number;
  stdDev: number;
  monotony: number;
  strain: number;
  tone: LoadRiskTone;
  label: string;
}

export interface DynamicPlayerMetric {
  variable: LoadVariable | 'wellness' | 'rpe';
  label: string;
  count: number;
  p10?: number;
  p90?: number;
  mean?: number;
  sd?: number;
  today?: number;
  zScore?: number;
  outsideNormal: boolean;
  tone: LoadRiskTone | 'neutral';
  message: string;
}

export interface WellnessProfileMetric {
  today?: number;
  baseline?: number;
  delta?: number;
  streakBelowBaseline: number;
  subscales: Record<'sleep' | 'fatigue' | 'stress' | 'musclePain' | 'mood', { today?: number; baseline?: number; delta?: number }>;
  adherence7d: number;
  adherence28d: number;
  tone: LoadRiskTone | 'neutral';
}

export interface VelocityExposureMetric {
  todayHsr: number;
  todaySprint: number;
  todayMaxVelocity: number;
  daysSinceHighSpeed?: number;
  daysSinceSprint?: number;
  prior28HsrAvg: number;
  prior28SprintAvg: number;
  abruptHighSpeedReturn: boolean;
  abruptSprintReturn: boolean;
  subexposedToSpeed: boolean;
}

export interface DataConfidenceMetric {
  score: number;
  label: DataConfidenceLabel;
  loadDays28: number;
  chronicWeeks: number;
  wellnessAdherence28d: number;
  gpsDays28: number;
  flags: string[];
}

export interface RiskContribution {
  key: string;
  domain: RiskDomain;
  label: string;
  points: number;
  tone: LoadRiskTone | 'neutral';
}

export interface LoadRiskProfile {
  playerId: string;
  date: string;
  riskScore: number;
  riskTone: LoadRiskTone;
  riskLabel: 'Bajo' | 'Moderado' | 'Alto';
  decision: DailyLoadDecisionState;
  decisionPercent: string;
  load: {
    today: DayLoadBreakdown;
    last7: DayLoadBreakdown[];
    last28: DayLoadBreakdown[];
  };
  acwr: {
    byVariable: Record<LoadVariable, VariableAcwrMetric>;
    primary: VariableAcwrMetric;
  };
  monotony: MonotonyStrainMetric;
  thresholds: Record<'wellness' | 'rpe' | 'srpe' | 'hsr' | 'sprint' | 'neuromuscular', DynamicPlayerMetric>;
  wellness: WellnessProfileMetric;
  velocity: VelocityExposureMetric;
  dataConfidence: DataConfidenceMetric;
  contributions: RiskContribution[];
  alerts: string[];
  recommendations: string[];
  domainScores: Record<RiskDomain, number>;
}

const LOAD_VARIABLES: LoadVariable[] = ['srpe', 'minutes', 'hsr', 'sprint', 'accDec', 'neuromuscular', 'distance', 'playerLoad'];

const num = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round = (value: number, digits = 0) => Number(value.toFixed(digits));
const uniq = <T,>(items: T[]) => Array.from(new Set(items));
const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);
const mean = (values: number[]) => values.length ? sum(values) / values.length : 0;

const standardDeviation = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((acc, value) => acc + Math.pow(value - avg, 2), 0) / values.length;
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

export const toDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const dateMinusDays = (referenceDate: string, days: number) => {
  const parsed = toDate(referenceDate);
  if (!parsed) return referenceDate;
  return new Date(parsed.getTime() - days * MS_DAY).toISOString().slice(0, 10);
};

export const daysBetween = (date: string, referenceDate: string) => {
  const a = toDate(date);
  const b = toDate(referenceDate);
  if (!a || !b) return 9999;
  return Math.round((b.getTime() - a.getTime()) / MS_DAY);
};

const inWindow = (date: string, referenceDate: string, minDays: number, maxDays: number) => {
  const diff = daysBetween(date, referenceDate);
  return diff >= minDays && diff <= maxDays;
};

export const dateWindow = (referenceDate: string, minDays: number, maxDays: number) =>
  Array.from({ length: maxDays - minDays + 1 }, (_, index) => dateMinusDays(referenceDate, minDays + index));

const recordHsr = (record: Pick<DailyExternalLoadRecord | CompetitionRecord, 'highSpeedDistance' | 'hsr'>) =>
  num(record.highSpeedDistance ?? record.hsr);

const recordSprint = (record: Pick<DailyExternalLoadRecord | CompetitionRecord, 'sprintDistance' | 'sprints'>) =>
  num(record.sprintDistance) + (num(record.sprints) * 10);

const recordNeuromuscular = (record: Pick<DailyExternalLoadRecord | CompetitionRecord, 'acc' | 'dcc' | 'sprints' | 'rhie'>) =>
  num(record.acc) + num(record.dcc) + (num(record.sprints) * 4) + num(record.rhie);

const hasCompetitionExternal = (external: DailyExternalLoadRecord[]) => external.some(isCompetitionExternalLoad);

const addExternalMetrics = (target: DayLoadBreakdown, records: Array<DailyExternalLoadRecord | CompetitionRecord>) => {
  records.forEach((record) => {
    target.distance += num(record.totalDistance);
    target.hsr += recordHsr(record);
    target.sprint += recordSprint(record);
    target.sprintCount += num(record.sprints);
    target.accDec += num(record.acc) + num(record.dcc);
    target.neuromuscular += recordNeuromuscular(record);
    target.playerLoad += num(record.playerLoad);
    target.maxVelocity = Math.max(target.maxVelocity, num(record.maxVelocity));
    target.gpsLikeRecords += 1;
  });
};

export const computeDayLoadBreakdown = (data: AppData, playerId: string, date: string): DayLoadBreakdown => {
  const internal = data.internalLoads.filter((record) => record.playerId === playerId && record.date === date);
  const allExternal = data.externalLoads.filter((record) => record.playerId === playerId && record.date === date);
  const regularExternal = allExternal.filter((record) => !isCompetitionExternalLoad(record));
  const competitionExternal = allExternal.filter(isCompetitionExternalLoad);
  const externalOnly = regularExternal.filter((record) => !externalLoadHasInternalPair(record, internal));
  const competitionRecords = data.competitionRecords.filter((record) => record.playerId === playerId && record.date === date);
  const useCompetitionRecords = competitionExternal.length === 0;

  const internalLoad = internal.reduce((acc, record) => acc + calculateInternalLoad(record), 0);
  const externalOnlyLoad = externalOnly.reduce((acc, record) => acc + calculateExternalLoad(record), 0);
  const competitionExternalLoad = competitionExternal.reduce((acc, record) => acc + calculateExternalLoad(record), 0);
  const competitionRecordLoad = useCompetitionRecords ? competitionRecords.reduce((acc, record) => acc + calculateCompetitionRecordLoad(record), 0) : 0;

  const breakdown: DayLoadBreakdown = {
    date,
    effectiveLoad: getPlayerDayLoad(playerId, date, data, { includeCompetitionExternal: true, includeCompetitionRecords: true }),
    internalLoad,
    externalLoad: externalOnlyLoad,
    competitionLoad: competitionExternalLoad + competitionRecordLoad,
    minutes: internal.reduce((acc, record) => acc + num(record.duration), 0) + externalOnly.reduce((acc, record) => acc + num(record.min), 0) + competitionExternal.reduce((acc, record) => acc + num(record.min), 0) + (useCompetitionRecords ? competitionRecords.reduce((acc, record) => acc + num(record.minutesPlayed), 0) : 0),
    distance: 0,
    hsr: 0,
    sprint: 0,
    sprintCount: 0,
    accDec: 0,
    neuromuscular: 0,
    playerLoad: 0,
    maxVelocity: 0,
    hasInternal: internal.length > 0,
    hasExternal: allExternal.length > 0,
    hasCompetition: competitionExternal.length > 0 || competitionRecords.length > 0,
    gpsLikeRecords: 0,
  };

  addExternalMetrics(breakdown, allExternal);
  if (useCompetitionRecords) addExternalMetrics(breakdown, competitionRecords);

  return {
    ...breakdown,
    effectiveLoad: round(breakdown.effectiveLoad),
    internalLoad: round(breakdown.internalLoad),
    externalLoad: round(breakdown.externalLoad),
    competitionLoad: round(breakdown.competitionLoad),
    minutes: round(breakdown.minutes),
    distance: round(breakdown.distance),
    hsr: round(breakdown.hsr),
    sprint: round(breakdown.sprint),
    accDec: round(breakdown.accDec),
    neuromuscular: round(breakdown.neuromuscular),
    playerLoad: round(breakdown.playerLoad),
    maxVelocity: round(breakdown.maxVelocity, 1),
  };
};

const variableValue = (day: DayLoadBreakdown, variable: LoadVariable) => {
  switch (variable) {
    case 'srpe': return day.effectiveLoad;
    case 'minutes': return day.minutes;
    case 'hsr': return day.hsr;
    case 'sprint': return day.sprint;
    case 'accDec': return day.accDec;
    case 'neuromuscular': return day.neuromuscular;
    case 'distance': return day.distance;
    case 'playerLoad': return day.playerLoad;
    default: return 0;
  }
};

const variableLabel = (variable: LoadVariable) => ({
  srpe: 'Carga interna efectiva',
  minutes: 'Minutos',
  hsr: 'Alta velocidad',
  sprint: 'Sprint',
  accDec: 'Aceleraciones/deceleraciones',
  neuromuscular: 'Carga neuromuscular',
  distance: 'Distancia total',
  playerLoad: 'Player Load',
}[variable]);

const ewma = (values: number[], span: number) => {
  if (!values.length) return 0;
  const alpha = 2 / (span + 1);
  let current = values[0];
  values.slice(1).forEach((value) => {
    current = (alpha * value) + ((1 - alpha) * current);
  });
  return current;
};

const acwrZone = (ratio: number, chronic: number, acute: number): VariableAcwrMetric['zone'] => {
  if (chronic <= 0 || acute <= 0) return 'no_data';
  if (ratio > 1.5) return 'danger';
  if (ratio > 1.3) return 'caution';
  if (ratio < 0.8) return 'low';
  return 'target';
};

const acwrZoneLabel = (zone: VariableAcwrMetric['zone']) => ({
  target: 'Zona objetivo',
  low: 'Subcarga',
  caution: 'Precaucion',
  danger: 'Riesgo alto',
  no_data: 'Historial insuficiente',
}[zone]);

export const computeVariableAcwr = (days: DayLoadBreakdown[], variable: LoadVariable): VariableAcwrMetric => {
  const values = days.map((day) => variableValue(day, variable));
  const acuteValues = values.slice(-7);
  const chronicValues = values.slice(0, -7);
  const acute = sum(acuteValues);
  const weeklyLoads = [0, 1, 2, 3].map((week) => sum(chronicValues.slice(week * 7, week * 7 + 7)));
  const nonZeroWeeks = weeklyLoads.filter((value) => value > 0);
  const chronic = nonZeroWeeks.length >= 2 ? mean(nonZeroWeeks) : nonZeroWeeks.length === 1 ? nonZeroWeeks[0] / 4 : 0;
  const rolling = chronic > 0 ? acute / chronic : 0;
  const ewmaAcute = ewma(values, 7);
  const ewmaChronic = ewma(values, 28);
  const ewmaRatio = ewmaChronic > 0 ? ewmaAcute / ewmaChronic : 0;
  const zone = acwrZone(rolling, chronic, acute);
  return {
    variable,
    label: variableLabel(variable),
    acute: round(acute),
    chronic: round(chronic),
    rolling: round(rolling, 2),
    ewmaAcute: round(ewmaAcute, 1),
    ewmaChronic: round(ewmaChronic, 1),
    ewma: round(ewmaRatio, 2),
    zone,
    zoneLabel: acwrZoneLabel(zone),
    historyDays: values.filter((value) => value > 0).length,
    weeklyLoads: [...weeklyLoads.map((value) => round(value)), round(acute)],
  };
};

export const computeMonotonyStrain = (dailyLoads: number[]): MonotonyStrainMetric => {
  const totalLoad = sum(dailyLoads);
  const meanLoad = mean(dailyLoads);
  const stdDev = standardDeviation(dailyLoads);
  const monotony = stdDev > 0 ? meanLoad / stdDev : totalLoad > 0 ? 9.99 : 0;
  const strain = totalLoad * monotony;
  const tone: LoadRiskTone = monotony >= 2.5 || strain >= 6000 ? 'red' : monotony >= 2 || strain >= 4000 ? 'amber' : 'green';
  const label = totalLoad === 0 ? 'Sin carga' : tone === 'red' ? 'Monotonia/strain alto' : tone === 'amber' ? 'Distribucion a controlar' : 'Distribucion adecuada';
  return {
    dailyLoads: dailyLoads.map((value) => round(value)),
    totalLoad: round(totalLoad),
    meanLoad: round(meanLoad),
    stdDev: round(stdDev),
    monotony: round(monotony, 2),
    strain: round(strain),
    tone,
    label,
  };
};

const buildDynamicMetric = (variable: DynamicPlayerMetric['variable'], label: string, values: number[], today?: number, minCount = 5): DynamicPlayerMetric => {
  const clean = values.filter((value) => Number.isFinite(value));
  const p10 = percentile(clean, 10);
  const p90 = percentile(clean, 90);
  const avg = mean(clean);
  const sd = standardDeviation(clean);
  const zScore = today !== undefined && sd > 0 ? (today - avg) / sd : undefined;
  const outsideNormal = today !== undefined && clean.length >= minCount && ((p10 !== undefined && today < p10) || (p90 !== undefined && today > p90) || Math.abs(zScore ?? 0) >= 1.5);
  const tone: DynamicPlayerMetric['tone'] = clean.length < minCount ? 'neutral' : !outsideNormal ? 'green' : Math.abs(zScore ?? 0) >= 2 ? 'red' : 'amber';
  return {
    variable,
    label,
    count: clean.length,
    p10: p10 !== undefined ? round(p10, 1) : undefined,
    p90: p90 !== undefined ? round(p90, 1) : undefined,
    mean: clean.length ? round(avg, 1) : undefined,
    sd: clean.length ? round(sd, 1) : undefined,
    today: today !== undefined ? round(today, 1) : undefined,
    zScore: zScore !== undefined ? round(zScore, 2) : undefined,
    outsideNormal,
    tone,
    message: clean.length < minCount ? 'Historial insuficiente' : outsideNormal ? 'Fuera del rango individual habitual' : 'Dentro del rango individual',
  };
};

const wellnessSubscaleValue = (record: DailyWellnessRecord | undefined, key: keyof Pick<DailyWellnessRecord, 'sleep' | 'fatigue' | 'stress' | 'musclePain' | 'mood'>) => {
  const value = num(record?.[key]);
  return value > 0 ? clamp(value, 1, 5) : undefined;
};

const computeWellnessProfile = (data: AppData, player: Player, date: string): WellnessProfileMetric => {
  const todayRecord = data.wellness.find((record) => record.playerId === player.id && record.date === date);
  const history = data.wellness.filter((record) => record.playerId === player.id && inWindow(record.date, date, 1, 28));
  const wellnessValues = history.map(averageWellness).filter((value) => value > 0);
  const today = averageWellness(todayRecord) || undefined;
  const baseline = wellnessValues.length >= 5 ? mean(wellnessValues) : num(player.baselineWellness) || undefined;
  const delta = today !== undefined && baseline !== undefined ? today - baseline : undefined;

  let streakBelowBaseline = 0;
  if (baseline !== undefined) {
    for (let index = 0; index < 7; index += 1) {
      const target = dateMinusDays(date, index);
      const value = averageWellness(data.wellness.find((record) => record.playerId === player.id && record.date === target));
      if (!value || value >= baseline) break;
      streakBelowBaseline += 1;
    }
  }

  const keys: Array<keyof WellnessProfileMetric['subscales']> = ['sleep', 'fatigue', 'stress', 'musclePain', 'mood'];
  const subscales = keys.reduce((acc, key) => {
    const todayValue = wellnessSubscaleValue(todayRecord, key);
    const values = history.map((record) => wellnessSubscaleValue(record, key)).filter((value): value is number => value !== undefined);
    const base = values.length >= 5 ? mean(values) : undefined;
    acc[key] = {
      today: todayValue !== undefined ? round(todayValue, 1) : undefined,
      baseline: base !== undefined ? round(base, 1) : undefined,
      delta: todayValue !== undefined && base !== undefined ? round(todayValue - base, 1) : undefined,
    };
    return acc;
  }, {} as WellnessProfileMetric['subscales']);

  const adherence = (days: number) => {
    const present = dateWindow(date, 0, days - 1).filter((target) => data.wellness.some((record) => record.playerId === player.id && record.date === target)).length;
    return days > 0 ? Math.round((present / days) * 100) : 0;
  };

  const tone: WellnessProfileMetric['tone'] = today === undefined ? 'neutral' : today < 3 || (delta !== undefined && delta <= -1) || streakBelowBaseline >= 3 ? 'red' : today <= 3.3 || (delta !== undefined && delta <= -0.6) ? 'amber' : 'green';
  return {
    today: today !== undefined ? round(today, 1) : undefined,
    baseline: baseline !== undefined ? round(baseline, 1) : undefined,
    delta: delta !== undefined ? round(delta, 1) : undefined,
    streakBelowBaseline,
    subscales,
    adherence7d: adherence(7),
    adherence28d: adherence(28),
    tone,
  };
};

const hasHighSpeedExposure = (record: Pick<DailyExternalLoadRecord | CompetitionRecord, 'highSpeedDistance' | 'hsr' | 'maxVelocity'>, player: Player) => {
  const vmax = num(player.maxVelocityReference);
  return recordHsr(record) > 0 || (vmax > 0 && num(record.maxVelocity) >= vmax * 0.85);
};

const hasSprintExposure = (record: Pick<DailyExternalLoadRecord | CompetitionRecord, 'sprintDistance' | 'sprints' | 'maxVelocity'>, player: Player) => {
  const vmax = num(player.maxVelocityReference);
  return recordSprint(record) > 0 || (vmax > 0 && num(record.maxVelocity) >= vmax * 0.9);
};

const allExternalLikeRecords = (data: AppData, playerId: string) => [
  ...data.externalLoads.filter((record) => record.playerId === playerId),
  ...data.competitionRecords.filter((record) => record.playerId === playerId),
];

const computeVelocityExposure = (data: AppData, player: Player, date: string, today: DayLoadBreakdown, last28: DayLoadBreakdown[]): VelocityExposureMetric => {
  const prior = allExternalLikeRecords(data, player.id).filter((record) => record.date < date).sort((a, b) => b.date.localeCompare(a.date));
  const lastHighSpeed = prior.find((record) => hasHighSpeedExposure(record, player));
  const lastSprint = prior.find((record) => hasSprintExposure(record, player));
  const daysSinceHighSpeed = lastHighSpeed ? Math.max(0, daysBetween(lastHighSpeed.date, date) - 1) : undefined;
  const daysSinceSprint = lastSprint ? Math.max(0, daysBetween(lastSprint.date, date) - 1) : undefined;
  const previousDays = last28.slice(0, -1);
  const previousHsr = previousDays.map((day) => day.hsr).filter((value) => value > 0);
  const previousSprint = previousDays.map((day) => day.sprint).filter((value) => value > 0);
  const prior28HsrAvg = mean(previousHsr);
  const prior28SprintAvg = mean(previousSprint);
  const abruptHighSpeedReturn = Boolean(daysSinceHighSpeed !== undefined && daysSinceHighSpeed >= 8 && today.hsr > 0 && (prior28HsrAvg === 0 || today.hsr >= prior28HsrAvg * 1.5));
  const abruptSprintReturn = Boolean(daysSinceSprint !== undefined && daysSinceSprint >= 10 && today.sprint > 0 && (prior28SprintAvg === 0 || today.sprint >= prior28SprintAvg * 1.5));
  const subexposedToSpeed = Boolean((daysSinceHighSpeed !== undefined && daysSinceHighSpeed >= 8) || (daysSinceSprint !== undefined && daysSinceSprint >= 10));
  return {
    todayHsr: today.hsr,
    todaySprint: today.sprint,
    todayMaxVelocity: today.maxVelocity,
    daysSinceHighSpeed,
    daysSinceSprint,
    prior28HsrAvg: round(prior28HsrAvg),
    prior28SprintAvg: round(prior28SprintAvg),
    abruptHighSpeedReturn,
    abruptSprintReturn,
    subexposedToSpeed,
  };
};

const computeDataConfidence = (days35: DayLoadBreakdown[], wellness: WellnessProfileMetric): DataConfidenceMetric => {
  const last28 = days35.slice(-28);
  const loadDays28 = last28.filter((day) => day.effectiveLoad > 0).length;
  const gpsDays28 = last28.filter((day) => day.gpsLikeRecords > 0).length;
  const chronicWeeks = [0, 1, 2, 3].map((week) => sum(days35.slice(week * 7, week * 7 + 7).map((day) => day.effectiveLoad))).filter((value) => value > 0).length;
  const loadHistoryScore = clamp((loadDays28 / 12) * 35, 0, 35);
  const chronicScore = clamp((chronicWeeks / 4) * 25, 0, 25);
  const wellnessScore = clamp((wellness.adherence28d / 100) * 25, 0, 25);
  const gpsScore = clamp((gpsDays28 / Math.max(loadDays28, 1)) * 15, 0, 15);
  const score = Math.round(loadHistoryScore + chronicScore + wellnessScore + gpsScore);
  const flags: string[] = [];
  if (loadDays28 < 8) flags.push('Pocos dias de carga en 28d');
  if (chronicWeeks < 3) flags.push('Base cronica incompleta');
  if (wellness.adherence28d < 70) flags.push('Baja adherencia wellness');
  if (gpsDays28 === 0) flags.push('Sin GPS/carga externa reciente');
  return {
    score: clamp(score, 0, 100),
    label: score >= 80 ? 'Alta' : score >= 55 ? 'Media' : 'Baja',
    loadDays28,
    chronicWeeks,
    wellnessAdherence28d: wellness.adherence28d,
    gpsDays28,
    flags,
  };
};

const activeBodyRecord = (records: BodyMapRecord[], playerId: string, date: string) => records
  .filter((record) => record.playerId === playerId && record.status !== 'Cerrado' && record.date <= date)
  .sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`))[0];

const hasSameAreaHistory = (player: Player, area?: string, date?: string) => {
  const target = String(area ?? '').toLowerCase();
  if (!target) return false;
  return (player.injuryHistory ?? []).some((item) => {
    const candidate = String(item.area ?? item.injuryType ?? '').toLowerCase();
    const same = candidate.length > 0 && (candidate.includes(target) || target.includes(candidate));
    if (!same) return false;
    if (!date || !item.date) return true;
    return daysBetween(item.date, date) <= 365;
  });
};

const pushContribution = (items: RiskContribution[], contribution: RiskContribution) => {
  if (contribution.points <= 0) return;
  items.push(contribution);
};

const decisionFromProfile = (score: number, player: Player, body?: BodyMapRecord, dataConfidence?: DataConfidenceMetric): Pick<LoadRiskProfile, 'decision' | 'decisionPercent'> => {
  if (player.status === 'Lesionado' || (body?.limitation && num(body.intensity) >= 7)) return { decision: 'No campo', decisionPercent: '0-30%' };
  if (player.status === 'Readaptación') return { decision: score >= 65 ? 'Trabajo modificado' : 'Carga reducida', decisionPercent: '30-60%' };
  if (body && (body.limitation || num(body.intensity) >= 6)) return { decision: 'Trabajo modificado', decisionPercent: '40-60%' };
  if (score >= 60) return { decision: 'Carga reducida', decisionPercent: '60-75%' };
  if (score >= 30 || dataConfidence?.label === 'Baja') return { decision: 'Control preventivo', decisionPercent: '75-90%' };
  return { decision: 'Carga completa', decisionPercent: '90-100%' };
};

export const computePlayerLoadRiskProfile = (args: { data: AppData; player: Player; date: string; bodyRecords?: BodyMapRecord[] }): LoadRiskProfile => {
  const { data, player, date, bodyRecords = [] } = args;
  const days35 = dateWindow(date, 0, 34).reverse().map((day) => computeDayLoadBreakdown(data, player.id, day));
  const last7 = days35.slice(-7);
  const last28 = days35.slice(-28);
  const today = days35[days35.length - 1] ?? computeDayLoadBreakdown(data, player.id, date);
  const wellness = computeWellnessProfile(data, player, date);
  const velocity = computeVelocityExposure(data, player, date, today, last28);
  const dataConfidence = computeDataConfidence(days35, wellness);

  const acwrByVariable = LOAD_VARIABLES.reduce((acc, variable) => {
    acc[variable] = computeVariableAcwr(days35, variable);
    return acc;
  }, {} as Record<LoadVariable, VariableAcwrMetric>);
  const monotony = computeMonotonyStrain(last7.map((day) => day.effectiveLoad));

  const thresholdValues = (variable: LoadVariable) => days35.slice(0, -1).map((day) => variableValue(day, variable)).filter((value) => value > 0);
  const rpeHistory = data.internalLoads.filter((record) => record.playerId === player.id && inWindow(record.date, date, 1, 56)).map((record) => num(record.rpe)).filter((value) => value > 0);
  const todayRpe = data.internalLoads.filter((record) => record.playerId === player.id && record.date === date).map((record) => num(record.rpe)).filter((value) => value > 0).sort((a, b) => b - a)[0];
  const thresholds: LoadRiskProfile['thresholds'] = {
    wellness: buildDynamicMetric('wellness', 'Wellness', data.wellness.filter((record) => record.playerId === player.id && inWindow(record.date, date, 1, 56)).map(averageWellness).filter((value) => value > 0), wellness.today),
    rpe: buildDynamicMetric('rpe', 'RPE', rpeHistory, todayRpe),
    srpe: buildDynamicMetric('srpe', 'Carga interna efectiva', thresholdValues('srpe'), today.effectiveLoad || undefined),
    hsr: buildDynamicMetric('hsr', 'Alta velocidad', thresholdValues('hsr'), today.hsr || undefined),
    sprint: buildDynamicMetric('sprint', 'Sprint', thresholdValues('sprint'), today.sprint || undefined),
    neuromuscular: buildDynamicMetric('neuromuscular', 'Carga neuromuscular', thresholdValues('neuromuscular'), today.neuromuscular || undefined),
  };

  const contributions: RiskContribution[] = [];
  const primary = acwrByVariable.srpe;
  if (primary.zone === 'danger') pushContribution(contributions, { key: 'acwr-srpe-danger', domain: 'overload', label: `ACWR carga ${primary.rolling.toFixed(2)} > 1.50`, points: 25, tone: 'red' });
  else if (primary.zone === 'caution') pushContribution(contributions, { key: 'acwr-srpe-caution', domain: 'overload', label: `ACWR carga ${primary.rolling.toFixed(2)} entre 1.31 y 1.50`, points: 12, tone: 'amber' });
  else if (primary.zone === 'low') pushContribution(contributions, { key: 'acwr-srpe-low', domain: 'underexposure', label: `ACWR carga ${primary.rolling.toFixed(2)} < 0.80`, points: 8, tone: 'amber' });

  (['hsr', 'sprint', 'neuromuscular'] as LoadVariable[]).forEach((variable) => {
    const metric = acwrByVariable[variable];
    if (metric.historyDays < 3 || metric.zone === 'no_data') return;
    if (metric.zone === 'danger') pushContribution(contributions, { key: `acwr-${variable}-danger`, domain: 'muscleTendon', label: `${metric.label} ACWR ${metric.rolling.toFixed(2)} > 1.50`, points: variable === 'sprint' ? 18 : 14, tone: 'red' });
    else if (metric.zone === 'caution') pushContribution(contributions, { key: `acwr-${variable}-caution`, domain: 'muscleTendon', label: `${metric.label} ACWR ${metric.rolling.toFixed(2)} en precaucion`, points: variable === 'sprint' ? 10 : 8, tone: 'amber' });
  });

  if (monotony.tone === 'red') pushContribution(contributions, { key: 'monotony-strain-red', domain: 'fatigue', label: `Monotonia ${monotony.monotony.toFixed(2)} · strain ${monotony.strain}`, points: 18, tone: 'red' });
  else if (monotony.tone === 'amber') pushContribution(contributions, { key: 'monotony-strain-amber', domain: 'fatigue', label: `Monotonia ${monotony.monotony.toFixed(2)} · strain ${monotony.strain}`, points: 10, tone: 'amber' });

  if (wellness.today !== undefined && wellness.today < 3) pushContribution(contributions, { key: 'wellness-low', domain: 'fatigue', label: `Wellness ${wellness.today.toFixed(1)}/5`, points: 15, tone: 'red' });
  else if (wellness.delta !== undefined && wellness.delta <= -0.7) pushContribution(contributions, { key: 'wellness-drop', domain: 'fatigue', label: `Wellness ${wellness.delta.toFixed(1)} vs linea base`, points: 10, tone: 'amber' });
  if (wellness.streakBelowBaseline >= 3) pushContribution(contributions, { key: 'wellness-streak', domain: 'fatigue', label: `${wellness.streakBelowBaseline} dias con wellness bajo su linea base`, points: 18, tone: 'red' });
  if (wellness.subscales.musclePain.today !== undefined && wellness.subscales.musclePain.today <= 2.5) pushContribution(contributions, { key: 'muscle-pain-low-subscale', domain: 'muscleTendon', label: `Dolor muscular wellness ${wellness.subscales.musclePain.today.toFixed(1)}/5`, points: 10, tone: 'amber' });

  const body = activeBodyRecord(bodyRecords, player.id, date);
  if (body) {
    const risk = BODY_REGION_RISK[body.region] ?? 'medio';
    if (body.limitation || num(body.intensity) >= 8 || body.type === 'Lesión confirmada') pushContribution(contributions, { key: 'body-map-red', domain: 'muscleTendon', label: `${body.region} ${body.intensity}/10 con limitacion`, points: 30, tone: 'red' });
    else if (num(body.intensity) >= 6 || risk === 'alto') pushContribution(contributions, { key: 'body-map-amber', domain: 'muscleTendon', label: `${body.region} ${body.intensity}/10`, points: 18, tone: 'amber' });
    if (hasSameAreaHistory(player, body.region, date)) pushContribution(contributions, { key: 'same-area-history', domain: 'muscleTendon', label: `Antecedente lesional en ${body.region}`, points: 10, tone: 'amber' });
  }

  if (velocity.abruptSprintReturn) pushContribution(contributions, { key: 'abrupt-sprint-return', domain: 'muscleTendon', label: `Retorno abrupto a sprint tras ${velocity.daysSinceSprint} dias`, points: 20, tone: 'red' });
  else if (velocity.abruptHighSpeedReturn) pushContribution(contributions, { key: 'abrupt-hsr-return', domain: 'muscleTendon', label: `Retorno abrupto a alta velocidad tras ${velocity.daysSinceHighSpeed} dias`, points: 14, tone: 'amber' });
  if (velocity.subexposedToSpeed && today.hasCompetition) pushContribution(contributions, { key: 'speed-underexposed-match', domain: 'underexposure', label: 'Competencia con baja exposicion reciente a velocidad', points: 12, tone: 'amber' });

  const previousNmMax = Math.max(0, ...last28.slice(0, -1).map((day) => day.neuromuscular));
  const readaptationVelocitySpike = player.status === 'Readaptación' && today.neuromuscular > 0 && (today.sprint > 0 || today.hsr > 0) && today.neuromuscular > Math.max(previousNmMax * 1.35, 60);
  if (readaptationVelocitySpike) pushContribution(contributions, { key: 'readaptation-velocity-spike', domain: 'muscleTendon', label: 'Readaptacion con velocidad/carga neuromuscular alta sin progresion', points: 20, tone: 'red' });

  if (player.status === 'Lesionado') pushContribution(contributions, { key: 'player-injured', domain: 'muscleTendon', label: 'Estado del jugador: lesionado', points: 50, tone: 'red' });
  else if (player.status === 'Readaptación') pushContribution(contributions, { key: 'player-rtp', domain: 'muscleTendon', label: 'Estado del jugador: readaptacion', points: 22, tone: 'amber' });
  else if (player.status === 'Molestia') pushContribution(contributions, { key: 'player-discomfort', domain: 'muscleTendon', label: 'Estado del jugador: molestia', points: 12, tone: 'amber' });

  if (player.maxTrainingPercent && player.maxTrainingPercent < 100) pushContribution(contributions, { key: 'training-cap', domain: 'muscleTendon', label: `Ficha limita entrenamiento a ${player.maxTrainingPercent}%`, points: player.maxTrainingPercent <= 60 ? 18 : 10, tone: player.maxTrainingPercent <= 60 ? 'red' : 'amber' });

  if (dataConfidence.label === 'Baja') pushContribution(contributions, { key: 'low-data-confidence', domain: 'dataQuality', label: 'Historial insuficiente: no declarar verde fuerte', points: 8, tone: 'neutral' });

  const rawScore = sum(contributions.map((item) => item.points));
  const riskScore = clamp(rawScore, 0, 100);
  const riskTone: LoadRiskTone = riskScore >= 60 ? 'red' : riskScore >= 30 ? 'amber' : 'green';
  const riskLabel: LoadRiskProfile['riskLabel'] = riskTone === 'red' ? 'Alto' : riskTone === 'amber' ? 'Moderado' : 'Bajo';
  const decision = decisionFromProfile(riskScore, player, body, dataConfidence);

  const domainScores = contributions.reduce((acc, item) => {
    acc[item.domain] += item.points;
    return acc;
  }, { fatigue: 0, overload: 0, underexposure: 0, muscleTendon: 0, dataQuality: 0 } as Record<RiskDomain, number>);

  const alerts = contributions.filter((item) => item.tone !== 'neutral').map((item) => item.label);
  const recommendations: string[] = [];
  if (domainScores.muscleTendon >= 20) recommendations.push('Restringir sprint/COD/contacto segun zona y reevaluar dolor antes de campo.');
  if (domainScores.overload >= 15 || domainScores.fatigue >= 15) recommendations.push('Reducir volumen o intensidad y controlar respuesta 24h.');
  if (domainScores.underexposure >= 8) recommendations.push('Planificar estimulo progresivo; evitar pasar de subcarga a competencia completa.');
  if (dataConfidence.label === 'Baja') recommendations.push('Tomar decision conservadora: falta historial suficiente para una alerta verde confiable.');
  if (!recommendations.length) recommendations.push('Mantener plan y seguir monitoreo individual diario.');

  return {
    playerId: player.id,
    date,
    riskScore,
    riskTone,
    riskLabel,
    decision: decision.decision,
    decisionPercent: decision.decisionPercent,
    load: { today, last7, last28 },
    acwr: { byVariable: acwrByVariable, primary },
    monotony,
    thresholds,
    wellness,
    velocity,
    dataConfidence,
    contributions,
    alerts: uniq(alerts),
    recommendations: uniq(recommendations),
    domainScores,
  };
};
