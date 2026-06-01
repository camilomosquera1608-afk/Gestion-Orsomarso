import type {
  AppData,
  CompetitionRecord,
  DailyExternalLoadRecord,
  DailyInternalLoadRecord,
} from './types';

export const isCompetitionExternalLoad = (record: DailyExternalLoadRecord) =>
  record.movementModule === 'competencia' ||
  String(record.id ?? '').startsWith('comp-load-') ||
  String(record.id ?? '').startsWith('competition-');

const num = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

/** Carga interna: RPE × duración (min). */
export const calculateInternalLoad = (record: DailyInternalLoadRecord) =>
  num(record.rpe) * num(record.duration);

const externalLoadRpe = (record: DailyExternalLoadRecord) => {
  const rpe = num(record.rpe);
  if (rpe > 0) return rpe;
  return isCompetitionExternalLoad(record) ? 8 : 0;
};

/**
 * Carga externa canónica para AU diarios.
 * Prioridad: min×RPE; si no hay RPE, estimación GPS/neuromuscular.
 */
export const calculateExternalLoad = (record: DailyExternalLoadRecord) => {
  const rpeLoad = num(record.min) * externalLoadRpe(record);
  if (rpeLoad > 0) return rpeLoad;
  return (
    num(record.playerLoad) +
    num(record.totalDistance) / 10 +
    num(record.acc) +
    num(record.dcc) +
    num(record.sprints) * 4 +
    num(record.rhie)
  );
};

export const calculateCompetitionRecordLoad = (record: CompetitionRecord) =>
  num(record.minutesPlayed) * 8;

export const neuromuscularLoad = (
  record?: Pick<DailyExternalLoadRecord | CompetitionRecord, 'acc' | 'dcc' | 'sprints' | 'rhie'>,
) => {
  if (!record) return 0;
  return num(record.acc) + num(record.dcc) + num(record.sprints) * 4 + num(record.rhie);
};

const loadCategoryKey = (record: {
  category?: string;
  actingCategory?: string;
  baseCategory?: string;
}) => String(record.category ?? record.actingCategory ?? record.baseCategory ?? '').trim();

const sameSessionLoad = (
  external: DailyExternalLoadRecord,
  internal: DailyInternalLoadRecord,
) => {
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

export const getPlayerDayLoad = (
  playerId: string,
  date: string,
  data: {
    internalLoads?: DailyInternalLoadRecord[];
    externalLoads?: DailyExternalLoadRecord[];
    competitionRecords?: CompetitionRecord[];
  },
  options: { includeCompetitionExternal?: boolean; includeCompetitionRecords?: boolean } = {},
) => {
  const internal = (data.internalLoads ?? []).filter(
    (load) => load.playerId === playerId && load.date === date,
  );
  const allExternalForDay = (data.externalLoads ?? []).filter(
    (load) => load.playerId === playerId && load.date === date,
  );
  const external = allExternalForDay.filter(
    (load) => options.includeCompetitionExternal || !isCompetitionExternalLoad(load),
  );

  const internalLoad = internal.reduce((sum, load) => sum + calculateInternalLoad(load), 0);
  const externalOnlyLoad = external
    .filter((load) => !externalLoadHasInternalPair(load, internal))
    .reduce((sum, load) => sum + calculateExternalLoad(load), 0);

  const hasCompetitionExternal = allExternalForDay.some(isCompetitionExternalLoad);
  const competitionRecordLoad =
    options.includeCompetitionRecords && !hasCompetitionExternal
      ? (data.competitionRecords ?? [])
          .filter((record) => record.playerId === playerId && record.date === date)
          .reduce((sum, record) => sum + calculateCompetitionRecordLoad(record), 0)
      : 0;

  return internalLoad + externalOnlyLoad + competitionRecordLoad;
};

/** Alias usado en sport-science y análisis dinámico. */
export const externalLoadValue = (record?: DailyExternalLoadRecord) =>
  record ? calculateExternalLoad(record) : 0;

export const internalLoadValue = (record?: Pick<DailyInternalLoadRecord, 'duration' | 'rpe'>) =>
  record ? calculateInternalLoad(record as DailyInternalLoadRecord) : 0;

export const playerDayLoad = (
  data: Pick<AppData, 'internalLoads' | 'externalLoads'> & Partial<Pick<AppData, 'competitionRecords'>>,
  playerId: string,
  date: string,
) =>
  getPlayerDayLoad(playerId, date, data, {
    includeCompetitionExternal: true,
    includeCompetitionRecords: true,
  });
