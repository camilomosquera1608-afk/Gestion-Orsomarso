import { AppData, DailyInternalLoadRecord, DailyWellnessRecord, Microcycle } from './types';

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


export const findMicrocycleByDate = (microcycles: Microcycle[], date: string) =>
  microcycles.find((microcycle) => microcycle.startDate && microcycle.endDate && date >= microcycle.startDate && date <= microcycle.endDate);

export const getAutoMicrocycleId = (microcycles: Microcycle[], date: string, fallback = 'mc-1') =>
  findMicrocycleByDate(microcycles, date)?.id ?? fallback;
