import type {
  AppData,
  CMJRecord,
  CompetitionMatchSummary,
  CompetitionRecord,
  DailyExternalLoadRecord,
  DailyInternalLoadRecord,
  DailyWellnessRecord,
  FMSRecord,
  Microcycle,
  NeuromuscularRecord,
  NutritionRecord,
  TrainingSessionSummary,
} from './types';
import {
  assertNoDuplicateMatch,
  assertNoDuplicateTrainingSession,
  assertNoOverlappingMicrocycle,
  prepareExternalLoadWrite,
  prepareInternalLoadWrite,
  prepareWellnessWrite,
  type DomainValidationResult,
} from './domain-validation';
import { recordMatchesTrainingSession } from './relational-data';

export type DomainCommandResult =
  | { ok: true; data: AppData }
  | { ok: false; message: string };

const fail = (message: string): DomainCommandResult => ({ ok: false, message });
const ok = (data: AppData): DomainCommandResult => ({ ok: true, data });

export const buildCompetitionExternalLoad = (
  match: CompetitionMatchSummary,
  record: CompetitionRecord,
): DailyExternalLoadRecord | null => {
  const hasGps =
    (record.playerLoad ?? 0) > 0 ||
    (record.totalDistance ?? 0) > 0 ||
    (record.highSpeedDistance ?? record.hsr ?? 0) > 0 ||
    (record.sprintDistance ?? 0) > 0 ||
    (record.acc ?? 0) > 0 ||
    (record.dcc ?? 0) > 0 ||
    (record.sprints ?? 0) > 0 ||
    (record.rhie ?? 0) > 0;
  if (!hasGps && (record.minutesPlayed ?? 0) <= 0) return null;
  return {
    id: `comp-load-${match.id}-${record.playerId}`,
    sessionId: match.id,
    playerId: record.playerId,
    date: match.date || record.date,
    min: record.minutesPlayed ?? 0,
    acc: record.acc ?? 0,
    dcc: record.dcc ?? 0,
    sprints: record.sprints ?? 0,
    rhie: record.rhie ?? 0,
    ima: record.ima ?? 0,
    rpe: 8,
    totalDistance: record.totalDistance,
    highSpeedDistance: record.highSpeedDistance ?? record.hsr,
    hsr: record.hsr ?? record.highSpeedDistance,
    sprintDistance: record.sprintDistance,
    maxVelocity: record.maxVelocity,
    playerLoad: record.playerLoad,
    participation: 'Completa',
    sessionType: 'MD',
    category: record.category ?? match.category,
    baseCategory: record.baseCategory,
    actingCategory: record.actingCategory ?? record.category ?? match.category,
    movementType: record.movementType ?? 'base',
    movementModule: 'competencia',
    loggedBy: record.loggedBy,
  };
};

export const upsertWellness = (
  data: AppData,
  record: DailyWellnessRecord,
  options: { excludeId?: string } = {},
): DomainCommandResult => {
  const prepared = prepareWellnessWrite(data, record, options);
  if (!prepared.ok) return fail(prepared.message);
  return ok({
    ...data,
    wellness: [
      prepared.data,
      ...data.wellness.filter((item) => item.id !== prepared.data.id),
    ],
  });
};

export const addWellness = (
  data: AppData,
  record: DailyWellnessRecord,
): DomainCommandResult => {
  const prepared = prepareWellnessWrite(data, record);
  if (!prepared.ok) return fail(prepared.message);
  return ok({
    ...data,
    wellness: [prepared.data, ...data.wellness],
  });
};

export const upsertInternalLoad = (
  data: AppData,
  record: DailyInternalLoadRecord,
  options: {
    excludeId?: string;
    microcycleId?: string;
    sessionNumber?: number;
  } = {},
): DomainCommandResult => {
  const normalizedRecord = {
    ...record,
    microcycleId: record.microcycleId ?? options.microcycleId,
    sessionNumber: record.sessionNumber ?? options.sessionNumber,
  };
  const prepared = prepareInternalLoadWrite(data, normalizedRecord, {
    excludeId: options.excludeId ?? record.id,
  });
  if (!prepared.ok) return fail(prepared.message);
  return ok({
    ...data,
    internalLoads: [
      prepared.data,
      ...data.internalLoads.filter((item) => item.id !== prepared.data.id),
    ],
  });
};

export const addInternalLoad = (
  data: AppData,
  record: DailyInternalLoadRecord,
  options: { microcycleId?: string; sessionNumber?: number } = {},
): DomainCommandResult => {
  const normalizedRecord = {
    ...record,
    microcycleId: record.microcycleId ?? options.microcycleId,
    sessionNumber: record.sessionNumber ?? options.sessionNumber,
  };
  const prepared = prepareInternalLoadWrite(data, normalizedRecord);
  if (!prepared.ok) return fail(prepared.message);
  return ok({
    ...data,
    internalLoads: [prepared.data, ...data.internalLoads],
  });
};

export const saveTrainingSessionBundle = (
  data: AppData,
  record: TrainingSessionSummary,
  externalLoads: DailyExternalLoadRecord[],
  internalLoads: DailyInternalLoadRecord[],
): DomainCommandResult => {
  const matchesSession = (item: {
    sessionId?: string;
    date?: string;
    category?: string;
    actingCategory?: string;
    sessionNumber?: number;
    movementModule?: string;
  }) => recordMatchesTrainingSession(item, record);

  const dataWithoutSession: AppData = {
    ...data,
    internalLoads: data.internalLoads.filter((item) => !matchesSession(item)),
    externalLoads: data.externalLoads.filter((item) => !matchesSession(item)),
  };

  for (const load of internalLoads) {
    const prepared = prepareInternalLoadWrite(dataWithoutSession, load, {
      excludeId: load.id,
    });
    if (!prepared.ok) return fail(prepared.message);
  }
  for (const load of externalLoads) {
    const prepared = prepareExternalLoadWrite(load);
    if (!prepared.ok) return fail(prepared.message);
  }

  return ok({
    ...data,
    trainingSessionSummaries: [
      record,
      ...data.trainingSessionSummaries.filter(
        (item) =>
          !(
            item.id === record.id ||
            (item.date === record.date &&
              item.category === record.category &&
              item.sessionNumber === record.sessionNumber)
          ),
      ),
    ],
    externalLoads: [
      ...externalLoads,
      ...data.externalLoads.filter((item) => !matchesSession(item)),
    ],
    internalLoads: [
      ...internalLoads,
      ...data.internalLoads.filter((item) => !matchesSession(item)),
    ],
  });
};

export const upsertCompetitionMatchSummary = (
  data: AppData,
  record: CompetitionMatchSummary,
): DomainCommandResult => {
  const duplicate = assertNoDuplicateMatch(data.competitionMatchSummaries, {
    id: record.id,
    date: record.date,
    category: record.category,
    opponent: record.opponent,
  });
  if (!duplicate.ok) return fail(duplicate.message);
  return ok({
    ...data,
    competitionMatchSummaries: [
      record,
      ...data.competitionMatchSummaries.filter(
        (item) =>
          !(
            item.id === record.id ||
            (item.date === record.date &&
              item.category === record.category &&
              item.opponent.trim().toLowerCase() === record.opponent.trim().toLowerCase())
          ),
      ),
    ],
  });
};

export const saveCompetitionMatchBundle = (
  data: AppData,
  record: CompetitionMatchSummary,
  records: CompetitionRecord[],
): DomainCommandResult => {
  const duplicate = assertNoDuplicateMatch(data.competitionMatchSummaries, {
    id: record.id,
    date: record.date,
    category: record.category,
    opponent: record.opponent,
  });
  if (!duplicate.ok) return fail(duplicate.message);

  const sameMatch = (item: CompetitionRecord) => {
    if (item.matchId === record.id) return true;
    return (
      item.date === record.date &&
      item.category === record.category &&
      item.opponent.trim().toLowerCase() === record.opponent.trim().toLowerCase()
    );
  };
  const normalizedRecords = records.map((item) => ({
    ...item,
    matchId: record.id,
    date: record.date,
    opponent: record.opponent,
    competitionName: record.competitionName,
    category: item.category ?? record.category,
    movementModule: 'competencia' as const,
  }));
  const competitionExternalLoads = normalizedRecords
    .map((item) => buildCompetitionExternalLoad(record, item))
    .filter(Boolean) as DailyExternalLoadRecord[];
  const competitionLoadIds = new Set(competitionExternalLoads.map((item) => item.id));
  const sameCompetitionLoad = (item: DailyExternalLoadRecord) => {
    if (competitionLoadIds.has(item.id)) return true;
    if (item.movementModule !== 'competencia' && !item.id.startsWith('comp-load-')) return false;
    return (
      item.sessionId === record.id ||
      (item.date === record.date &&
        normalizedRecords.some((row) => row.playerId === item.playerId))
    );
  };

  return ok({
    ...data,
    competitionMatchSummaries: [
      record,
      ...data.competitionMatchSummaries.filter(
        (item) =>
          !(
            item.id === record.id ||
            (item.date === record.date &&
              item.category === record.category &&
              item.opponent.trim().toLowerCase() === record.opponent.trim().toLowerCase())
          ),
      ),
    ],
    competitionRecords: [
      ...normalizedRecords,
      ...data.competitionRecords.filter((item) => !sameMatch(item)),
    ],
    externalLoads: [
      ...competitionExternalLoads,
      ...data.externalLoads.filter((item) => !sameCompetitionLoad(item)),
    ],
  });
};

export const applyMicrocycleWrite = (
  data: AppData,
  record: Microcycle,
): DomainValidationResult<Microcycle> => {
  const overlap = assertNoOverlappingMicrocycle(data.microcycles, {
    id: record.id,
    category: record.category,
    name: record.name,
    startDate: record.startDate,
    endDate: record.endDate,
  });
  if (!overlap.ok) return overlap;
  return { ok: true, data: record };
};

export const updateMicrocycleInData = (
  data: AppData,
  record: Microcycle,
): DomainCommandResult => {
  const prepared = applyMicrocycleWrite(data, record);
  if (!prepared.ok) return fail(prepared.message);
  const exists = data.microcycles.some((item) => item.id === prepared.data.id);
  return ok({
    ...data,
    microcycles: exists
      ? data.microcycles.map((item) =>
          item.id === prepared.data.id ? { ...item, ...prepared.data } : item,
        )
      : [...data.microcycles, prepared.data].sort((a, b) =>
          (a.startDate || a.id).localeCompare(b.startDate || b.id),
        ),
  });
};

export type ExternalLoadWriteDefaults = {
  microcycleId?: string;
  sessionNumber?: number;
  sessionType?: DailyExternalLoadRecord['sessionType'];
  participation?: DailyExternalLoadRecord['participation'];
};

const normalizeExternalLoadRecord = (
  record: DailyExternalLoadRecord,
  defaults: ExternalLoadWriteDefaults = {},
): DailyExternalLoadRecord => ({
  ...record,
  microcycleId: record.microcycleId ?? defaults.microcycleId,
  sessionNumber: record.sessionNumber ?? defaults.sessionNumber,
  sessionType: record.sessionType ?? defaults.sessionType ?? 'MD-3',
  participation: record.participation ?? defaults.participation ?? 'Completa',
});

export const addExternalLoad = (
  data: AppData,
  record: DailyExternalLoadRecord,
  defaults: ExternalLoadWriteDefaults = {},
): DomainCommandResult => {
  const prepared = prepareExternalLoadWrite(normalizeExternalLoadRecord(record, defaults));
  if (!prepared.ok) return fail(prepared.message);
  return ok({
    ...data,
    externalLoads: [prepared.data, ...data.externalLoads],
  });
};

export const updateExternalLoad = (
  data: AppData,
  record: DailyExternalLoadRecord,
): DomainCommandResult => {
  const prepared = prepareExternalLoadWrite(record);
  if (!prepared.ok) return fail(prepared.message);
  return ok({
    ...data,
    externalLoads: data.externalLoads.map((item) =>
      item.id === prepared.data.id ? prepared.data : item,
    ),
  });
};

export const deleteExternalLoad = (
  data: AppData,
  recordId: string,
): DomainCommandResult =>
  ok({
    ...data,
    externalLoads: data.externalLoads.filter((item) => item.id !== recordId),
  });

export const upsertTrainingSessionSummary = (
  data: AppData,
  record: TrainingSessionSummary,
): DomainCommandResult => {
  const duplicate = assertNoDuplicateTrainingSession(data.trainingSessionSummaries, {
    id: record.id,
    date: record.date,
    category: record.category,
    sessionNumber: record.sessionNumber,
  });
  if (!duplicate.ok) return fail(duplicate.message);
  return ok({
    ...data,
    trainingSessionSummaries: [
      record,
      ...data.trainingSessionSummaries.filter(
        (item) =>
          !(
            item.id === record.id ||
            (item.date === record.date &&
              item.category === record.category &&
              item.sessionNumber === record.sessionNumber)
          ),
      ),
    ],
  });
};

type PlayerDatedRecord = { id: string; playerId: string; date: string };

const upsertPlayerDateRecord = <T extends PlayerDatedRecord>(
  records: T[],
  record: T,
): T[] => [
  record,
  ...records.filter(
    (item) =>
      !(
        item.id !== record.id &&
        item.playerId === record.playerId &&
        item.date === record.date
      ),
  ),
];

const updatePlayerDateRecord = <T extends PlayerDatedRecord & { id: string }>(
  records: T[],
  record: T,
): T[] => records.map((item) => (item.id === record.id ? record : item));

const deleteById = <T extends { id: string }>(records: T[], recordId: string): T[] =>
  records.filter((item) => item.id !== recordId);

export const upsertCMJRecord = (data: AppData, record: CMJRecord): DomainCommandResult =>
  ok({ ...data, cmjRecords: upsertPlayerDateRecord(data.cmjRecords, record) });

export const updateCMJRecord = (data: AppData, record: CMJRecord): DomainCommandResult =>
  ok({ ...data, cmjRecords: updatePlayerDateRecord(data.cmjRecords, record) });

export const deleteCMJRecord = (data: AppData, recordId: string): DomainCommandResult =>
  ok({ ...data, cmjRecords: deleteById(data.cmjRecords, recordId) });

export const upsertNutritionRecord = (
  data: AppData,
  record: NutritionRecord,
): DomainCommandResult =>
  ok({ ...data, nutritionRecords: upsertPlayerDateRecord(data.nutritionRecords, record) });

export const updateNutritionRecord = (
  data: AppData,
  record: NutritionRecord,
): DomainCommandResult =>
  ok({ ...data, nutritionRecords: updatePlayerDateRecord(data.nutritionRecords, record) });

export const deleteNutritionRecord = (data: AppData, recordId: string): DomainCommandResult =>
  ok({ ...data, nutritionRecords: deleteById(data.nutritionRecords, recordId) });

export const upsertNeuromuscularRecord = (
  data: AppData,
  record: NeuromuscularRecord,
): DomainCommandResult =>
  ok({
    ...data,
    neuromuscularRecords: upsertPlayerDateRecord(data.neuromuscularRecords, record),
  });

export const updateNeuromuscularRecord = (
  data: AppData,
  record: NeuromuscularRecord,
): DomainCommandResult =>
  ok({
    ...data,
    neuromuscularRecords: updatePlayerDateRecord(data.neuromuscularRecords, record),
  });

export const deleteNeuromuscularRecord = (
  data: AppData,
  recordId: string,
): DomainCommandResult =>
  ok({ ...data, neuromuscularRecords: deleteById(data.neuromuscularRecords, recordId) });

export const upsertFMSRecord = (data: AppData, record: FMSRecord): DomainCommandResult =>
  ok({ ...data, fmsRecords: upsertPlayerDateRecord(data.fmsRecords, record) });

export const updateFMSRecord = (data: AppData, record: FMSRecord): DomainCommandResult =>
  ok({ ...data, fmsRecords: updatePlayerDateRecord(data.fmsRecords, record) });

export const deleteFMSRecord = (data: AppData, recordId: string): DomainCommandResult =>
  ok({ ...data, fmsRecords: deleteById(data.fmsRecords, recordId) });
