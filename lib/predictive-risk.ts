import type { AppData, DailyExternalLoadRecord, Player } from './types';
import type { BodyMapRecord } from './body-map';
import { BODY_REGION_RISK } from './body-map';

export type PredictiveRiskTone = 'green' | 'amber' | 'red';

export interface PredictiveRiskFactor {
  key: string;
  label: string;
  points: number;
}

export interface PredictiveRiskResult {
  score: number;
  tone: PredictiveRiskTone;
  label: 'Bajo' | 'Moderado' | 'Alto';
  factors: PredictiveRiskFactor[];
  alerts: string[];
  metrics: {
    arc: number;
    negativeWellnessStreak: number;
    daysWithoutVelocityExposure?: number;
    abruptReturn: boolean;
    highPain?: number;
    highPainRegion?: string;
    neuromuscularToday: number;
    neuromuscularPreviousMax: number;
    readaptationHighNmWithoutProgression: boolean;
  };
}

const MS_DAY = 86400000;
const keyRegions = new Set(['Isquiotibial', 'Aductor', 'Gemelo/Sóleo', 'Aquiles', 'Rodilla', 'Tobillo', 'Cuádriceps', 'Cadera/Glúteo', 'Lumbar']);

const num = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const dayDiff = (date: string, referenceDate: string) => {
  const a = toDate(date);
  const b = toDate(referenceDate);
  if (!a || !b) return 9999;
  return Math.round((b.getTime() - a.getTime()) / MS_DAY);
};

const inWindow = (date: string, referenceDate: string, minDays: number, maxDays: number) => {
  const diff = dayDiff(date, referenceDate);
  return diff >= minDays && diff <= maxDays;
};

const dateMinus = (referenceDate: string, days: number) => {
  const base = toDate(referenceDate);
  if (!base) return referenceDate;
  const next = new Date(base.getTime() - days * MS_DAY);
  return next.toISOString().slice(0, 10);
};

const wellnessAverage = (record?: { sleep: number; fatigue: number; stress: number; musclePain: number; mood: number }) => {
  if (!record) return undefined;
  return (num(record.sleep) + num(record.fatigue) + num(record.stress) + num(record.musclePain) + num(record.mood)) / 5;
};

const internalLoad = (record: { duration: number; rpe: number }) => num(record.duration) * num(record.rpe);

const recordLoad = (record: DailyExternalLoadRecord) => {
  const rpeLoad = num(record.rpe) * num(record.min);
  if (rpeLoad > 0) return rpeLoad;
  return num(record.playerLoad) + (num(record.totalDistance) / 10) + num(record.acc) + num(record.dcc) + (num(record.sprints) * 4) + num(record.rhie);
};

export const neuromuscularLoad = (record?: Pick<DailyExternalLoadRecord, 'acc' | 'dcc' | 'sprints' | 'rhie'>) => {
  if (!record) return 0;
  return num(record.acc) + num(record.dcc) + (num(record.sprints) * 4) + num(record.rhie);
};

const weeklyLoad = (data: AppData, playerId: string, referenceDate: string, minDays: number, maxDays: number) => {
  const internal = data.internalLoads
    .filter((record) => record.playerId === playerId && inWindow(record.date, referenceDate, minDays, maxDays));
  if (internal.length) return internal.reduce((sum, record) => sum + internalLoad(record), 0);
  return data.externalLoads
    .filter((record) => record.playerId === playerId && inWindow(record.date, referenceDate, minDays, maxDays))
    .reduce((sum, record) => sum + recordLoad(record), 0);
};

export const computeArcRatio = (data: AppData, player: Player, date: string) => {
  const acute = weeklyLoad(data, player.id, date, 0, 6);
  const chronic4w = weeklyLoad(data, player.id, date, 7, 34);
  const chronicWeekly = chronic4w > 0 ? chronic4w / 4 : num(player.targetWeeklyLoad);
  return chronicWeekly > 0 ? Number((acute / chronicWeekly).toFixed(2)) : 0;
};

const baselineWellness = (data: AppData, player: Player, date: string) => {
  const values = data.wellness
    .filter((record) => record.playerId === player.id && inWindow(record.date, date, 1, 28))
    .map(wellnessAverage)
    .filter((value): value is number => Number.isFinite(value));
  if (values.length >= 5) return mean(values);
  return num(player.baselineWellness, 0);
};

const negativeWellnessStreak = (data: AppData, player: Player, date: string) => {
  const baseline = baselineWellness(data, player, date);
  if (!baseline) return 0;
  let streak = 0;
  for (let i = 0; i < 7; i += 1) {
    const target = dateMinus(date, i);
    const record = data.wellness.find((item) => item.playerId === player.id && item.date === target);
    const value = wellnessAverage(record);
    if (value === undefined || value >= baseline) break;
    streak += 1;
  }
  return streak;
};

const highPainRecord = (bodyRecords: BodyMapRecord[], playerId: string, date: string) =>
  bodyRecords
    .filter((record) => record.playerId === playerId && record.status !== 'Cerrado' && record.date <= date)
    .filter((record) => num(record.intensity) > 6 && (keyRegions.has(record.region) || BODY_REGION_RISK[record.region] === 'alto'))
    .sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`))[0];

const hasVelocityExposure = (record: DailyExternalLoadRecord, player: Player) => {
  const vmax = num(player.maxVelocityReference);
  const hsr = num(record.highSpeedDistance ?? record.hsr);
  const sprintDistance = num(record.sprintDistance);
  const sprintCount = num(record.sprints);
  const maxVelocity = num(record.maxVelocity);
  if (hsr > 0 || sprintDistance > 0 || sprintCount > 0) return true;
  if (vmax > 0 && maxVelocity >= vmax * 0.85) return true;
  return false;
};

const velocityAbsenceAndReturn = (data: AppData, player: Player, date: string) => {
  const today = data.externalLoads.find((record) => record.playerId === player.id && record.date === date);
  const prior = data.externalLoads
    .filter((record) => record.playerId === player.id && record.date < date)
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastExposure = prior.find((record) => hasVelocityExposure(record, player));
  const daysWithoutVelocityExposure = lastExposure ? dayDiff(lastExposure.date, date) - 1 : undefined;
  const todayExposure = today ? hasVelocityExposure(today, player) : false;
  const todayHs = num(today?.highSpeedDistance ?? today?.hsr) + num(today?.sprintDistance) + (num(today?.sprints) * 10);
  const prior28 = prior.filter((record) => inWindow(record.date, date, 1, 28));
  const priorExposureAvg = mean(prior28.map((record) => num(record.highSpeedDistance ?? record.hsr) + num(record.sprintDistance) + (num(record.sprints) * 10)).filter((value) => value > 0));
  const abruptByVolume = priorExposureAvg > 0 ? todayHs >= priorExposureAvg * 1.5 : todayHs > 0;
  const abruptReturn = Boolean(daysWithoutVelocityExposure !== undefined && daysWithoutVelocityExposure > 7 && todayExposure && abruptByVolume);
  return { daysWithoutVelocityExposure, abruptReturn };
};

const readaptationProgression = (data: AppData, player: Player, date: string) => {
  const today = data.externalLoads.find((record) => record.playerId === player.id && record.date === date);
  const neuromuscularToday = neuromuscularLoad(today);
  const previous14 = data.externalLoads
    .filter((record) => record.playerId === player.id && inWindow(record.date, date, 1, 14))
    .map(neuromuscularLoad)
    .filter((value) => value > 0);
  const neuromuscularPreviousMax = previous14.length ? Math.max(...previous14) : 0;
  const previousAvg = mean(previous14);
  const highAbsolute = neuromuscularToday >= 90;
  const highRelative = previousAvg > 0 ? neuromuscularToday >= previousAvg * 1.5 : neuromuscularToday >= 60;
  const documentedGradualProgression = previous14.length >= 2 && previous14.some((value) => value > 0 && value < neuromuscularToday && neuromuscularToday <= value * 1.35);
  const readaptationHighNmWithoutProgression = player.status === 'Readaptación' && neuromuscularToday > 0 && (highAbsolute || highRelative) && !documentedGradualProgression;
  return { neuromuscularToday, neuromuscularPreviousMax, readaptationHighNmWithoutProgression };
};

export const computePredictiveRisk = (args: {
  data: AppData;
  player: Player;
  date: string;
  bodyRecords?: BodyMapRecord[];
}): PredictiveRiskResult => {
  const { data, player, date, bodyRecords = [] } = args;
  const factors: PredictiveRiskFactor[] = [];
  const alerts: string[] = [];

  const arc = computeArcRatio(data, player, date);
  if (arc > 1.5) {
    factors.push({ key: 'arc-high', label: `ARC ${arc.toFixed(2)} > 1.5`, points: 25 });
    alerts.push('Carga aguda alta frente a su carga habitual.');
  }

  const streak = negativeWellnessStreak(data, player, date);
  if (streak >= 3) {
    factors.push({ key: 'wellness-streak', label: `${streak} días con wellness bajo su línea base`, points: 20 });
    alerts.push('Tendencia negativa de recuperación subjetiva.');
  }

  const pain = highPainRecord(bodyRecords, player.id, date);
  if (pain) {
    factors.push({ key: 'high-pain', label: `${pain.region} ${pain.intensity}/10`, points: pain.intensity >= 8 ? 30 : 25 });
    alerts.push('Dolor alto en región clave del mapa corporal.');
  }

  const velocity = velocityAbsenceAndReturn(data, player, date);
  if (velocity.abruptReturn) {
    factors.push({ key: 'abrupt-velocity-return', label: `Retorno a HSR/sprint tras ${velocity.daysWithoutVelocityExposure} días sin exposición`, points: 20 });
    alerts.push('Ausencia de velocidad seguida de retorno abrupto de carga.');
  }

  const readaptation = readaptationProgression(data, player, date);
  if (readaptation.readaptationHighNmWithoutProgression) {
    factors.push({ key: 'readaptation-nm', label: 'Readaptación + carga neuromuscular alta sin progresión documentada', points: 30 });
    alerts.push('Readaptación con estímulo neuromuscular alto sin progresión gradual registrada.');
  }

  const score = clamp(factors.reduce((sum, factor) => sum + factor.points, 0), 0, 100);
  const tone: PredictiveRiskTone = score >= 60 ? 'red' : score >= 30 ? 'amber' : 'green';
  const label: PredictiveRiskResult['label'] = tone === 'red' ? 'Alto' : tone === 'amber' ? 'Moderado' : 'Bajo';

  return {
    score,
    tone,
    label,
    factors,
    alerts,
    metrics: {
      arc,
      negativeWellnessStreak: streak,
      daysWithoutVelocityExposure: velocity.daysWithoutVelocityExposure,
      abruptReturn: velocity.abruptReturn,
      highPain: pain?.intensity,
      highPainRegion: pain?.region,
      neuromuscularToday: readaptation.neuromuscularToday,
      neuromuscularPreviousMax: readaptation.neuromuscularPreviousMax,
      readaptationHighNmWithoutProgression: readaptation.readaptationHighNmWithoutProgression,
    },
  };
};

export const riskToneLabel = (tone: PredictiveRiskTone) => tone === 'red' ? 'Rojo' : tone === 'amber' ? 'Ámbar' : 'Verde';
