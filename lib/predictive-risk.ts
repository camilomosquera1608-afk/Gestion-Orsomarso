import type { AppData, DailyExternalLoadRecord, Player } from './types';
import type { BodyMapRecord } from './body-map';
import { BODY_REGION_RISK } from './body-map';
import { getPlayerDayLoad } from './utils';

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
    acwr: number;
    acuteLoad: number;
    chronicWeeklyLoad: number;
    monotony: number;
    strain: number;
    negativeWellnessStreak: number;
    wellnessToday?: number;
    wellnessBaseline?: number;
    wellnessDelta?: number;
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
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

const standardDeviation = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
};

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

const dateMinus = (referenceDate: string, days: number) => {
  const base = toDate(referenceDate);
  if (!base) return referenceDate;
  const next = new Date(base.getTime() - days * MS_DAY);
  return next.toISOString().slice(0, 10);
};

const inWindow = (date: string, referenceDate: string, minDays: number, maxDays: number) => {
  const diff = dayDiff(date, referenceDate);
  return diff >= minDays && diff <= maxDays;
};

const wellnessAverage = (record?: { sleep: number; fatigue: number; stress: number; musclePain: number; mood: number }) => {
  if (!record) return undefined;
  return (num(record.sleep) + num(record.fatigue) + num(record.stress) + num(record.musclePain) + num(record.mood)) / 5;
};

const playerDailyLoad = (data: AppData, playerId: string, date: string) =>
  getPlayerDayLoad(playerId, date, data, { includeCompetitionExternal: true, includeCompetitionRecords: true });

const windowDates = (referenceDate: string, minDays: number, maxDays: number) =>
  Array.from({ length: maxDays - minDays + 1 }, (_, index) => dateMinus(referenceDate, minDays + index));

const loadWindow = (data: AppData, playerId: string, referenceDate: string, minDays: number, maxDays: number) =>
  windowDates(referenceDate, minDays, maxDays)
    .reduce((sum, date) => sum + playerDailyLoad(data, playerId, date), 0);

const dailyLoadWindow = (data: AppData, playerId: string, referenceDate: string, days: number) =>
  Array.from({ length: days }, (_, index) => playerDailyLoad(data, playerId, dateMinus(referenceDate, days - 1 - index)));

const computeAcwrMetrics = (data: AppData, player: Player, date: string) => {
  const acuteLoad = loadWindow(data, player.id, date, 0, 6);
  const priorWeeks = [
    loadWindow(data, player.id, date, 7, 13),
    loadWindow(data, player.id, date, 14, 20),
    loadWindow(data, player.id, date, 21, 27),
    loadWindow(data, player.id, date, 28, 34),
  ].filter((value) => value > 0);
  const prior28 = priorWeeks.reduce((sum, value) => sum + value, 0);
  const chronicWeeklyLoad = priorWeeks.length >= 2
    ? mean(priorWeeks)
    : prior28 > 0
      ? prior28 / 4
      : num(player.targetWeeklyLoad);
  const acwr = chronicWeeklyLoad > 0 ? round(acuteLoad / chronicWeeklyLoad, 2) : 0;
  return { acuteLoad: round(acuteLoad, 0), chronicWeeklyLoad: round(chronicWeeklyLoad, 0), acwr };
};

export const computeArcRatio = (data: AppData, player: Player, date: string) =>
  computeAcwrMetrics(data, player, date).acwr;

const computeMonotonyMetrics = (data: AppData, player: Player, date: string) => {
  const dailyLoads = dailyLoadWindow(data, player.id, date, 7);
  const totalLoad = dailyLoads.reduce((sum, value) => sum + value, 0);
  const avg = mean(dailyLoads);
  const sd = standardDeviation(dailyLoads);
  const monotony = sd > 0 ? avg / sd : totalLoad > 0 ? 9.99 : 0;
  const strain = totalLoad * monotony;
  return { monotony: round(monotony, 2), strain: round(strain, 0) };
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

const velocityDose = (record: DailyExternalLoadRecord) =>
  num(record.highSpeedDistance ?? record.hsr) + num(record.sprintDistance) + (num(record.sprints) * 10);

const velocityAbsenceAndReturn = (data: AppData, player: Player, date: string) => {
  const todayRecords = data.externalLoads.filter((record) => record.playerId === player.id && record.date === date);
  const prior = data.externalLoads
    .filter((record) => record.playerId === player.id && record.date < date)
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastExposure = prior.find((record) => hasVelocityExposure(record, player));
  const daysWithoutVelocityExposure = lastExposure ? dayDiff(lastExposure.date, date) - 1 : undefined;
  const todayExposure = todayRecords.some((record) => hasVelocityExposure(record, player));
  const todayHs = todayRecords.reduce((sum, record) => sum + velocityDose(record), 0);
  const prior28ByDate = new Map<string, number>();
  prior
    .filter((record) => inWindow(record.date, date, 1, 28))
    .forEach((record) => prior28ByDate.set(record.date, (prior28ByDate.get(record.date) ?? 0) + velocityDose(record)));
  const priorExposureAvg = mean(Array.from(prior28ByDate.values()).filter((value) => value > 0));
  const abruptByVolume = priorExposureAvg > 0 ? todayHs >= priorExposureAvg * 1.5 : todayHs > 0;
  const abruptReturn = Boolean(daysWithoutVelocityExposure !== undefined && daysWithoutVelocityExposure > 7 && todayExposure && abruptByVolume);
  return { daysWithoutVelocityExposure, abruptReturn };
};

export const neuromuscularLoad = (record?: Pick<DailyExternalLoadRecord, 'acc' | 'dcc' | 'sprints' | 'rhie'>) => {
  if (!record) return 0;
  return num(record.acc) + num(record.dcc) + (num(record.sprints) * 4) + num(record.rhie);
};

const readaptationProgression = (data: AppData, player: Player, date: string) => {
  const neuromuscularToday = data.externalLoads
    .filter((record) => record.playerId === player.id && record.date === date)
    .reduce((sum, record) => sum + neuromuscularLoad(record), 0);
  const previous14 = windowDates(date, 1, 14)
    .map((day) => data.externalLoads
      .filter((record) => record.playerId === player.id && record.date === day)
      .reduce((sum, record) => sum + neuromuscularLoad(record), 0))
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

  const acwrMetrics = computeAcwrMetrics(data, player, date);
  const arc = acwrMetrics.acwr;
  if (arc > 1.5) {
    factors.push({ key: 'acwr-high', label: `ACWR ${arc.toFixed(2)} > 1.50`, points: 25 });
    alerts.push('Carga aguda muy alta frente a su carga habitual.');
  } else if (arc > 1.3) {
    factors.push({ key: 'acwr-caution', label: `ACWR ${arc.toFixed(2)} entre 1.31 y 1.50`, points: 12 });
    alerts.push('Incremento relevante de carga aguda frente a su base.');
  } else if (arc > 0 && arc < 0.8) {
    factors.push({ key: 'acwr-low', label: `ACWR ${arc.toFixed(2)} < 0.80`, points: 8 });
    alerts.push('Carga reciente baja: vigilar subexposición si se acerca competencia.');
  }

  const monotonyMetrics = computeMonotonyMetrics(data, player, date);
  if (monotonyMetrics.monotony >= 2.5 || monotonyMetrics.strain >= 6000) {
    factors.push({ key: 'monotony-strain-high', label: `Monotonía ${monotonyMetrics.monotony.toFixed(2)} · strain ${monotonyMetrics.strain}`, points: 18 });
    alerts.push('Distribución semanal monótona o strain alto: posible acumulación de fatiga.');
  } else if (monotonyMetrics.monotony >= 2 || monotonyMetrics.strain >= 4000) {
    factors.push({ key: 'monotony-strain-caution', label: `Monotonía ${monotonyMetrics.monotony.toFixed(2)} · strain ${monotonyMetrics.strain}`, points: 10 });
    alerts.push('Monotonía/strain semanal en zona de control.');
  }

  const baseline = baselineWellness(data, player, date);
  const todayWellness = wellnessAverage(data.wellness.find((item) => item.playerId === player.id && item.date === date));
  const wellnessDelta = todayWellness !== undefined && baseline ? round(todayWellness - baseline, 1) : undefined;
  if (todayWellness !== undefined && todayWellness < 3) {
    factors.push({ key: 'wellness-low-today', label: `Wellness ${todayWellness.toFixed(1)}/5`, points: 15 });
    alerts.push('Readiness subjetivo bajo en el día.');
  } else if (wellnessDelta !== undefined && wellnessDelta <= -0.7) {
    factors.push({ key: 'wellness-drop', label: `Wellness ${wellnessDelta.toFixed(1)} vs línea base`, points: 10 });
    alerts.push('Caída relevante de wellness frente a su línea base.');
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
      acwr: arc,
      acuteLoad: acwrMetrics.acuteLoad,
      chronicWeeklyLoad: acwrMetrics.chronicWeeklyLoad,
      monotony: monotonyMetrics.monotony,
      strain: monotonyMetrics.strain,
      negativeWellnessStreak: streak,
      wellnessToday: todayWellness !== undefined ? round(todayWellness, 1) : undefined,
      wellnessBaseline: baseline ? round(baseline, 1) : undefined,
      wellnessDelta,
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
