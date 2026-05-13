import type { AppData } from './types';

export const STORAGE_KEY = 'orsomarso-performance-hub';
export const STORAGE_BACKUPS_KEY = 'orsomarso-performance-hub-backups-v1';

const MAX_BACKUPS = 8;
const FALLBACK_MAX_BACKUPS = 2;
const AUTO_BACKUP_MIN_INTERVAL_MS = 60 * 60 * 1000; // 1 hora — suficiente para datos en Supabase

export type LocalBackupKind = 'manual' | 'auto' | 'import' | 'restore';

export interface LocalBackupMeta {
  id: string;
  createdAt: string;
  label: string;
  kind: LocalBackupKind;
  sizeKb: number;
  playersCount: number;
  recordsCount: number;
  microcyclesCount: number;
  gpsRecordsCount: number;
  sessionsCount: number;
  matchesCount: number;
}

interface LocalBackup extends LocalBackupMeta {
  payload: Partial<AppData>;
}

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeJsonParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const readBackups = (): LocalBackup[] => {
  if (!isBrowser()) return [];
  const parsed = safeJsonParse<LocalBackup[]>(localStorage.getItem(STORAGE_BACKUPS_KEY));
  return Array.isArray(parsed) ? parsed : [];
};

const writeBackups = (backups: LocalBackup[]) => {
  if (!isBrowser()) return;

  const limited = backups.slice(0, MAX_BACKUPS);
  const budgetKb = 800; // Con registros compactados son ~40% más pequeños
  const withinBudget: LocalBackup[] = [];
  for (const backup of limited) {
    const test = [...withinBudget, backup];
    const sizeKb = Math.round(JSON.stringify(test).length / 1024);
    if (sizeKb <= budgetKb || withinBudget.length === 0) withinBudget.push(backup);
  }

  try {
    localStorage.setItem(STORAGE_BACKUPS_KEY, JSON.stringify(withinBudget));
  } catch {
    try {
      localStorage.setItem(STORAGE_BACKUPS_KEY, JSON.stringify(withinBudget.slice(0, FALLBACK_MAX_BACKUPS)));
    } catch {
      localStorage.removeItem(STORAGE_BACKUPS_KEY);
    }
  }
};

const asArray = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const gpsRecordsCount = (payload: Partial<AppData> | null | undefined) =>
  asArray(payload?.externalLoads).filter((record) =>
    Number(record.totalDistance ?? 0) > 0 ||
    Number(record.playerLoad ?? 0) > 0 ||
    Number(record.highSpeedDistance ?? 0) > 0 ||
    Number(record.sprintDistance ?? 0) > 0 ||
    Number(record.maxVelocity ?? 0) > 0
  ).length;

const recordsCount = (payload: Partial<AppData> | null | undefined) =>
  asArray(payload?.wellness).length +
  asArray(payload?.internalLoads).length +
  asArray(payload?.externalLoads).length +
  asArray(payload?.cmjRecords).length +
  asArray(payload?.nutritionRecords).length +
  asArray(payload?.neuromuscularRecords).length +
  asArray(payload?.fmsRecords).length +
  asArray(payload?.competitionRecords).length +
  asArray(payload?.competitionMatchSummaries).length +
  asArray(payload?.trainingSessionSummaries).length +
  asArray(payload?.strengthSessions).length;

const makeBackup = (payload: Partial<AppData>, label: string, kind: LocalBackupKind): LocalBackup => {
  // Strip derived fields from backup too — saves significant space
  const stripped: Partial<AppData> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (Array.isArray(v)) {
      (stripped as Record<string, unknown>)[k] = v.map((r: unknown) =>
        r && typeof r === 'object' ? stripRecord(r as Record<string, unknown>) : r
      );
    } else {
      (stripped as Record<string, unknown>)[k] = v;
    }
  }
  const safePayload = stripped;
  const raw = JSON.stringify(safePayload);
  const createdAt = new Date().toISOString();

  return {
    id: `${kind}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    label,
    kind,
    sizeKb: Math.max(1, Math.round(raw.length / 1024)),
    playersCount: asArray(safePayload.players).length,
    recordsCount: recordsCount(safePayload),
    microcyclesCount: asArray(safePayload.microcycles).length,
    gpsRecordsCount: gpsRecordsCount(safePayload),
    sessionsCount: asArray(safePayload.trainingSessionSummaries).length,
    matchesCount: asArray(safePayload.competitionMatchSummaries).length,
    payload: safePayload,
  };
};

const lastAutoBackupAt = (backups: LocalBackup[]) => {
  const auto = backups.find((item) => item.kind === 'auto');
  return auto ? new Date(auto.createdAt).getTime() : 0;
};


// Fix #15: Calcular uso aproximado del localStorage para advertir antes de que explote.
export const getLocalStorageUsageKb = (): { usedKb: number; totalKb: number; pct: number } => {
  if (typeof window === 'undefined') return { usedKb: 0, totalKb: 5120, pct: 0 };
  let usedKb = 0;
  try {
    const mainRaw = localStorage.getItem(STORAGE_KEY) ?? '';
    const backupsRaw = localStorage.getItem(STORAGE_BACKUPS_KEY) ?? '';
    usedKb = Math.round((mainRaw.length + backupsRaw.length) / 1024);
  } catch { usedKb = 0; }
  const totalKb = 5120; // 5MB — límite conservador cross-browser
  return { usedKb, totalKb, pct: Math.round((usedKb / totalKb) * 100) };
};

export const getLocalStorageWarning = (): 'ok' | 'warn' | 'danger' => {
  const { pct } = getLocalStorageUsageKb();
  if (pct >= 80) return 'danger';
  if (pct >= 60) return 'warn';
  return 'ok';
};


// ─── Compact serialization — keeps localStorage under ~1.5MB ─────────────────
// Remove derived, redundant, zero and empty fields before storing locally.
// Data is fully recoverable from Supabase; localStorage is just a fast cache.

const DERIVED_FIELDS = new Set([
  'distancePerMin',    // derived: totalDistance / min
  'playerLoadPerMin',  // derived: playerLoad / min
  'hsr',               // removed field
  'highSpeedDistance', // removed field
  'sprintDistance',    // removed field
  'ima',               // removed field
  'actingCategory',    // almost always === category
]);

// Fields where zero IS meaningful and must be kept
const KEEP_ZERO = new Set([
  'rpe', 'goals', 'assists', 'yellowCards', 'redCards',
  'minutesPlayed', 'min', 'acc', 'dcc', 'sprints', 'rhie',
  'goalsConceded', 'goalsPrevented', 'penaltiesSaved', 'crossesDefended', 'footworkActions',
]);

const stripRecord = (obj: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (DERIVED_FIELDS.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (v === '') continue;
    if (typeof v === 'number' && v === 0 && !KEEP_ZERO.has(k)) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      out[k] = stripRecord(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
};

const DAYS_90 = 90 * 24 * 60 * 60 * 1000;
const cutoffDate = () => new Date(Date.now() - DAYS_90).toISOString().slice(0, 10);

const compactForLocal = (data: AppData): Partial<AppData> => {
  const cutoff = cutoffDate();
  const isRecent = (r: { date?: string }) => !r.date || r.date >= cutoff;

  return {
    ...data,
    // High-volume arrays: keep only last 90 days, strip derived fields
    externalLoads: data.externalLoads
      .filter(isRecent)
      .map(r => stripRecord(r as unknown as Record<string, unknown>) as unknown as typeof r),
    internalLoads: data.internalLoads
      .filter(isRecent)
      .map(r => stripRecord(r as unknown as Record<string, unknown>) as unknown as typeof r),
    wellness: data.wellness
      .filter(isRecent),
    nutritionRecords: data.nutritionRecords
      .filter(isRecent),
    // These must be kept complete — small arrays
    players: data.players,
    microcycles: data.microcycles,
    trainingSessionSummaries: data.trainingSessionSummaries,
    strengthSessions: data.strengthSessions,
    competitionMatchSummaries: data.competitionMatchSummaries,
    competitionRecords: data.competitionRecords
      .map(r => stripRecord(r as unknown as Record<string, unknown>) as unknown as typeof r),
  };
};

export const readLocalAppData = (): Partial<AppData> | null => {
  if (!isBrowser()) return null;
  return safeJsonParse<Partial<AppData>>(localStorage.getItem(STORAGE_KEY));
};

export const saveLocalAppData = (nextData: AppData) => {
  if (!isBrowser()) return;

  const previousRaw = localStorage.getItem(STORAGE_KEY);
  // Use compact representation — strips derived fields and 90-day window
  const compacted = compactForLocal(nextData);
  const nextRaw = JSON.stringify(compacted);

  if (previousRaw && previousRaw !== nextRaw) {
    const previousPayload = safeJsonParse<Partial<AppData>>(previousRaw);
    const backups = readBackups();
    const now = Date.now();

    if (previousPayload && now - lastAutoBackupAt(backups) > AUTO_BACKUP_MIN_INTERVAL_MS) {
      writeBackups([
        makeBackup(previousPayload, 'Copia automática antes de guardar cambios', 'auto'),
        ...backups,
      ]);
    }
  }

  // Robust save — never throws QuotaExceededError to caller
  const trySave = (raw: string): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY, raw);
      return true;
    } catch {
      return false;
    }
  };

  // Attempt 1: compact data
  if (!trySave(nextRaw)) {
    // Attempt 2: clear backups and retry
    localStorage.removeItem(STORAGE_BACKUPS_KEY);
    if (!trySave(nextRaw)) {
      // Attempt 3: save only players, sessions and microcycles (no loads)
      // This is a last resort — data is recoverable from Supabase
      const minimal = JSON.stringify({
        players: compacted.players ?? [],
        microcycles: compacted.microcycles ?? [],
        trainingSessionSummaries: compacted.trainingSessionSummaries ?? [],
        competitionMatchSummaries: compacted.competitionMatchSummaries ?? [],
        externalLoads: [],
        internalLoads: [],
        wellness: [],
        nutritionRecords: [],
        competitionRecords: [],
        fmsRecords: [],
      });
      trySave(minimal);
      // Don't throw — Supabase is the source of truth
      console.warn('[Orsomarso] localStorage lleno — guardando solo estructura mínima. Los datos de carga están en Supabase.');
    }
  }
};

export const createLocalBackup = (payload: AppData, label = 'Copia manual', kind: LocalBackupKind = 'manual') => {
  if (!isBrowser()) return null;
  const backups = readBackups();
  const backup = makeBackup(payload, label, kind);
  writeBackups([backup, ...backups]);
  return backup;
};

export const listLocalBackups = (): LocalBackupMeta[] =>
  readBackups().map(({ payload: _payload, ...meta }) => ({
    ...meta,
    playersCount: Number.isFinite(meta.playersCount) ? meta.playersCount : 0,
    recordsCount: Number.isFinite(meta.recordsCount) ? meta.recordsCount : 0,
    microcyclesCount: Number.isFinite(meta.microcyclesCount) ? meta.microcyclesCount : 0,
    gpsRecordsCount: Number.isFinite(meta.gpsRecordsCount) ? meta.gpsRecordsCount : 0,
    sessionsCount: Number.isFinite(meta.sessionsCount) ? meta.sessionsCount : 0,
    matchesCount: Number.isFinite(meta.matchesCount) ? meta.matchesCount : 0,
  }));

export const getLocalBackupPayload = (backupId: string): Partial<AppData> | null => {
  const backup = readBackups().find((item) => item.id === backupId);
  return backup?.payload ?? null;
};

export const clearLocalBackups = () => {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_BACKUPS_KEY);
};

export const deleteLocalBackup = (backupId: string): boolean => {
  if (!isBrowser()) return false;
  const backups = readBackups();
  const next = backups.filter((b) => b.id !== backupId);
  if (next.length === backups.length) return false;
  writeBackups(next);
  return true;
};

export const clearAutoBackups = (): number => {
  if (!isBrowser()) return 0;
  const backups = readBackups();
  const manual = backups.filter((b) => b.kind !== 'auto');
  const removed = backups.length - manual.length;
  writeBackups(manual);
  return removed;
};
