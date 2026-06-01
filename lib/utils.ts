import { AppData } from './types';
export { findMicrocycleByDate, getMicrocyclesForCategory, microcycleBelongsToCategory } from './performance-helpers';
import { findMicrocycleByDate } from './performance-helpers';
export {
  averageWellness,
  computeWellnessScore,
  wellnessNaturalKey,
  wellnessSubscaleDeltas,
} from './wellness-metrics';
export {
  calculateCompetitionRecordLoad,
  calculateExternalLoad,
  calculateInternalLoad,
  externalLoadHasInternalPair,
  externalLoadValue,
  getPlayerDayLoad,
  internalLoadValue,
  isCompetitionExternalLoad,
  neuromuscularLoad,
  playerDayLoad,
} from './load-metrics';

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

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
