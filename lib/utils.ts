import { AppData, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord } from './types';
export { findMicrocycleByDate, getMicrocyclesForCategory, microcycleBelongsToCategory } from './performance-helpers';
import { findMicrocycleByDate } from './performance-helpers';

export const calculateInternalLoad = (record: DailyInternalLoadRecord) => record.rpe * record.duration;

const clampWellnessItem = (value?: number) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.max(1, Math.min(5, numeric));
};

// Canonical wellness score: 1 = pésimo, 5 = óptimo.
// sleep and mood are positive; fatigue, stress and musclePain are negative and must be inverted.
export const computeWellnessScore = (record?: DailyWellnessRecord) => {
  if (!record) return 0;
  const sleep = clampWellnessItem(record.sleep);
  const mood = clampWellnessItem(record.mood);
  const fatigue = clampWellnessItem(record.fatigue);
  const stress = clampWellnessItem(record.stress);
  const musclePain = clampWellnessItem(record.musclePain);
  const values = [sleep, mood, fatigue ? 6 - fatigue : 0, stress ? 6 - stress : 0, musclePain ? 6 - musclePain : 0].filter((value) => value > 0);
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
};

export const averageWellness = (record?: DailyWellnessRecord) => computeWellnessScore(record);

export const getPlayerDayLoad = (
  playerId: string,
  date: string,
  data: { internalLoads?: DailyInternalLoadRecord[]; externalLoads?: DailyExternalLoadRecord[] },
  options: { includeCompetitionExternal?: boolean } = {},
) => {
  const internal = (data.internalLoads ?? []).filter((load) => load.playerId === playerId && load.date === date);
  if (internal.length) return internal.reduce((sum, load) => sum + calculateInternalLoad(load), 0);
  const external = (data.externalLoads ?? []).filter((load) =>
    load.playerId === playerId
    && load.date === date
    && (options.includeCompetitionExternal || load.movementModule !== 'competencia')
  );
  if (external.length) return external.reduce((sum, load) => sum + ((load.min ?? 0) * (load.rpe ?? 0)), 0);
  return 0;
};

export const getUniqueDates = (data: AppData) => {
  const dates = new Set<string>();
  data.wellness.forEach((x) => dates.add(x.date));
  data.internalLoads.forEach((x) => dates.add(x.date));
  data.externalLoads.forEach((x) => dates.add(x.date));
  data.cmjRecords.forEach((x) => dates.add(x.date));
  return Array.from(dates).sort();
};

export const groupAverage = (values: number[]) => {
  if (!values.length) return 0;
  return Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(1));
};

export const getAutoMicrocycleId = (microcycles: AppData['microcycles'], date: string, fallback = '', category?: string) =>
  findMicrocycleByDate(microcycles, date, fallback, category)?.id ?? fallback;
