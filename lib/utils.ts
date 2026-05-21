import { AppData, CompetitionRecord, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord } from './types';
export { findMicrocycleByDate, getMicrocyclesForCategory, microcycleBelongsToCategory } from './performance-helpers';
import { findMicrocycleByDate } from './performance-helpers';

const safeLoadNumber = (value?: number) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const calculateInternalLoad = (record: DailyInternalLoadRecord) =>
  safeLoadNumber(record.rpe) * safeLoadNumber(record.duration);

export const isCompetitionExternalLoad = (record: DailyExternalLoadRecord) =>
  record.movementModule === 'competencia' ||
  String(record.id ?? '').startsWith('comp-load-') ||
  String(record.id ?? '').startsWith('competition-');

const externalLoadRpe = (record: DailyExternalLoadRecord) => {
  const rpe = safeLoadNumber(record.rpe);
  if (rpe > 0) return rpe;
  return isCompetitionExternalLoad(record) ? 8 : 0;
};

export const calculateExternalLoad = (record: DailyExternalLoadRecord) =>
  safeLoadNumber(record.min) * externalLoadRpe(record);

export const calculateCompetitionRecordLoad = (record: CompetitionRecord) =>
  safeLoadNumber(record.minutesPlayed) * 8;

const loadCategoryKey = (record: { category?: string; actingCategory?: string; baseCategory?: string }) =>
  String(record.category ?? record.actingCategory ?? record.baseCategory ?? '').trim();

const sameSessionLoad = (external: DailyExternalLoadRecord, internal: DailyInternalLoadRecord) => {
  if (external.sessionId && internal.sessionId) return external.sessionId === internal.sessionId;
  if (!external.date || !internal.date || external.date !== internal.date) return false;
  if (external.sessionNumber === undefined || internal.sessionNumber === undefined) return false;
  if (Number(external.sessionNumber) !== Number(internal.sessionNumber)) return false;
  const externalCategory = loadCategoryKey(external);
  const internalCategory = loadCategoryKey(internal);
  return !externalCategory || !internalCategory || externalCategory === internalCategory;
};

export const externalLoadHasInternalPair = (
  external: DailyExternalLoadRecord,
  internalLoads: DailyInternalLoadRecord[],
) =>
  !isCompetitionExternalLoad(external) &&
  internalLoads.some((internal) => sameSessionLoad(external, internal));

const clampWellnessItem = (value?: number) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.max(1, Math.min(5, numeric));
};

// Canonical wellness/readiness score: 1 = peor estado, 5 = mejor estado.
// All public-form answers are stored in the same direction: higher means better readiness.
// fatigue = energy/freshness, stress = calm/low stress, musclePain = muscular state/no pain.
export const computeWellnessScore = (record?: DailyWellnessRecord) => {
  if (!record) return 0;
  const sleep = clampWellnessItem(record.sleep);
  const fatigue = clampWellnessItem(record.fatigue);
  const stress = clampWellnessItem(record.stress);
  const musclePain = clampWellnessItem(record.musclePain);
  const mood = clampWellnessItem(record.mood);
  const values = [sleep, fatigue, stress, musclePain, mood].filter((value) => value > 0);
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
};

export const averageWellness = (record?: DailyWellnessRecord) => computeWellnessScore(record);

export const getPlayerDayLoad = (
  playerId: string,
  date: string,
  data: { internalLoads?: DailyInternalLoadRecord[]; externalLoads?: DailyExternalLoadRecord[]; competitionRecords?: CompetitionRecord[] },
  options: { includeCompetitionExternal?: boolean; includeCompetitionRecords?: boolean } = {},
) => {
  const internal = (data.internalLoads ?? []).filter((load) => load.playerId === playerId && load.date === date);
  const allExternalForDay = (data.externalLoads ?? []).filter((load) => load.playerId === playerId && load.date === date);
  const external = allExternalForDay.filter((load) => options.includeCompetitionExternal || !isCompetitionExternalLoad(load));

  const internalLoad = internal.reduce((sum, load) => sum + calculateInternalLoad(load), 0);
  const externalOnlyLoad = external
    .filter((load) => !externalLoadHasInternalPair(load, internal))
    .reduce((sum, load) => sum + calculateExternalLoad(load), 0);

  const hasCompetitionExternal = allExternalForDay.some(isCompetitionExternalLoad);
  const competitionRecordLoad = options.includeCompetitionRecords && !hasCompetitionExternal
    ? (data.competitionRecords ?? [])
      .filter((record) => record.playerId === playerId && record.date === date)
      .reduce((sum, record) => sum + calculateCompetitionRecordLoad(record), 0)
    : 0;

  return internalLoad + externalOnlyLoad + competitionRecordLoad;
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
