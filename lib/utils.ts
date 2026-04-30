import { AppData, DailyInternalLoadRecord, DailyWellnessRecord } from './types';
export { findMicrocycleByDate, getMicrocyclesForCategory, microcycleBelongsToCategory } from './performance-helpers';
import { findMicrocycleByDate } from './performance-helpers';

export const calculateInternalLoad = (record: DailyInternalLoadRecord) => record.rpe * record.duration;

export const averageWellness = (record?: DailyWellnessRecord) => {
  if (!record) return 0;
  const total = record.sleep + record.fatigue + record.stress + record.musclePain + record.mood;
  return Number((total / 5).toFixed(1));
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
