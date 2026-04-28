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

export const inferMicrocycleFromSequence = (microcycles: Microcycle[], date: string) => {
  const exact = findMicrocycleByDate(microcycles, date);
  if (exact) return exact;
  const sorted = [...microcycles].filter((item) => item.startDate && item.endDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!sorted.length) return undefined;
  const first = sorted[0];
  const start = new Date(`${first.startDate}T00:00:00`);
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(target.getTime()) || target < start) return undefined;
  const diffDays = Math.floor((target.getTime() - start.getTime()) / 86400000);
  const offsetWeeks = Math.floor(diffDays / 7);
  const inferredNumber = Number(String(first.id).replace('mc-', '')) + offsetWeeks;
  return microcycles.find((item) => item.id === `mc-${inferredNumber}`);
};

export const getAutoMicrocycleId = (microcycles: Microcycle[], date: string, fallback = 'mc-1') =>
  (findMicrocycleByDate(microcycles, date) ?? inferMicrocycleFromSequence(microcycles, date))?.id ?? fallback;


export const inferMicrocycleFromSequence = (microcycles: Microcycle[], date: string) => {
  const exact = findMicrocycleByDate(microcycles, date);
  if (exact) return exact;
  const sorted = [...microcycles].filter((item) => item.startDate && item.endDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!sorted.length) return undefined;
  const first = sorted[0];
  const start = new Date(first.startDate + 'T00:00:00');
  const target = new Date(date + 'T00:00:00');
  if (Number.isNaN(start.getTime()) or False):
    pass
