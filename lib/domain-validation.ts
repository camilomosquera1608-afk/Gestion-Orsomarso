import type { AppData, ClubCategory, CompetitionMatchSummary, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord, Microcycle, TrainingSessionSummary } from './types';
import {
  DailyExternalLoadRecordSchema,
  DailyInternalLoadRecordSchema,
  DailyWellnessRecordSchema,
} from './schemas';
import { findDuplicateMatch, findDuplicateTrainingSession, findOverlappingMicrocycle } from './operational-validation';
import { wellnessNaturalKey } from './wellness-metrics';

export type DomainValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

const formatZodError = (error: { issues: Array<{ path: (string | number)[]; message: string }> }) =>
  error.issues.map((issue) => `${issue.path.join('.') || 'registro'}: ${issue.message}`).join(' · ');

export const validateWellnessRecord = (record: DailyWellnessRecord): DomainValidationResult<DailyWellnessRecord> => {
  const parsed = DailyWellnessRecordSchema.safeParse(record);
  if (!parsed.success) return { ok: false, message: formatZodError(parsed.error) };
  return { ok: true, data: parsed.data as DailyWellnessRecord };
};

export const validateInternalLoadRecord = (
  record: DailyInternalLoadRecord,
): DomainValidationResult<DailyInternalLoadRecord> => {
  const parsed = DailyInternalLoadRecordSchema.safeParse(record);
  if (!parsed.success) return { ok: false, message: formatZodError(parsed.error) };
  return { ok: true, data: parsed.data as DailyInternalLoadRecord };
};

export const validateExternalLoadRecord = (
  record: DailyExternalLoadRecord,
): DomainValidationResult<DailyExternalLoadRecord> => {
  const parsed = DailyExternalLoadRecordSchema.safeParse(record);
  if (!parsed.success) return { ok: false, message: formatZodError(parsed.error) };
  return { ok: true, data: parsed.data as DailyExternalLoadRecord };
};

export const assertNoDuplicateWellness = (
  data: AppData,
  record: DailyWellnessRecord,
  options: { excludeId?: string } = {},
): DomainValidationResult<DailyWellnessRecord> => {
  const key = wellnessNaturalKey(record);
  const duplicate = data.wellness.find(
    (item) =>
      item.id !== options.excludeId &&
      wellnessNaturalKey(item) === key,
  );
  if (duplicate) {
    return {
      ok: false,
      message: `Ya existe wellness para este jugador en ${record.date}${record.category ? ` (${record.category})` : ''}.`,
    };
  }
  return { ok: true, data: record };
};

export const assertNoDuplicateInternalLoad = (
  data: AppData,
  record: DailyInternalLoadRecord,
  options: { excludeId?: string } = {},
): DomainValidationResult<DailyInternalLoadRecord> => {
  const duplicate = data.internalLoads.find((item) => {
    if (item.id === options.excludeId) return false;
    if (record.sessionId && item.sessionId === record.sessionId && item.playerId === record.playerId) return true;
    return (
      item.playerId === record.playerId &&
      item.date === record.date &&
      Number(item.sessionNumber ?? 1) === Number(record.sessionNumber ?? 1) &&
      String(item.category ?? item.actingCategory ?? '') ===
        String(record.category ?? record.actingCategory ?? '')
    );
  });
  if (duplicate) {
    return { ok: false, message: 'Ya existe carga interna para esta sesión o fecha.' };
  }
  return { ok: true, data: record };
};

export const assertNoDuplicateTrainingSession = (
  sessions: TrainingSessionSummary[],
  params: { id?: string; date: string; category?: ClubCategory; sessionNumber?: number },
): DomainValidationResult<null> => {
  const dup = findDuplicateTrainingSession(sessions, params);
  if (dup) return { ok: false, message: 'Ya existe una sesión con la misma fecha, categoría y número.' };
  return { ok: true, data: null };
};

export const assertNoOverlappingMicrocycle = (
  microcycles: Microcycle[],
  params: { id?: string; category?: ClubCategory; name?: string; startDate?: string; endDate?: string },
): DomainValidationResult<null> => {
  const overlap = findOverlappingMicrocycle(microcycles, params);
  if (overlap) return { ok: false, message: 'El microciclo se solapa o repite nombre con otro existente.' };
  return { ok: true, data: null };
};

export const assertNoDuplicateMatch = (
  matches: CompetitionMatchSummary[],
  params: { id?: string; date: string; category: ClubCategory; opponent: string },
): DomainValidationResult<null> => {
  const dup = findDuplicateMatch(matches, params);
  if (dup) return { ok: false, message: 'Ya existe un partido con la misma fecha, categoría y rival.' };
  return { ok: true, data: null };
};

export const prepareWellnessWrite = (
  data: AppData,
  record: DailyWellnessRecord,
  options: { excludeId?: string } = {},
): DomainValidationResult<DailyWellnessRecord> => {
  const schema = validateWellnessRecord(record);
  if (!schema.ok) return schema;
  return assertNoDuplicateWellness(data, schema.data, options);
};

export const prepareInternalLoadWrite = (
  data: AppData,
  record: DailyInternalLoadRecord,
  options: { excludeId?: string } = {},
): DomainValidationResult<DailyInternalLoadRecord> => {
  const schema = validateInternalLoadRecord(record);
  if (!schema.ok) return schema;
  return assertNoDuplicateInternalLoad(data, schema.data, options);
};

export const prepareExternalLoadWrite = (
  record: DailyExternalLoadRecord,
): DomainValidationResult<DailyExternalLoadRecord> => validateExternalLoadRecord(record);
