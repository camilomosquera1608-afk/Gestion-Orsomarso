import type { AppData } from './types';

export const STORAGE_KEY = 'orsomarso-performance-hub';
export const STORAGE_BACKUPS_KEY = 'orsomarso-performance-hub-backups-v1';

const MAX_BACKUPS = 25;
const FALLBACK_MAX_BACKUPS = 5;
const AUTO_BACKUP_MIN_INTERVAL_MS = 10 * 60 * 1000;

export type LocalBackupKind = 'manual' | 'auto' | 'import' | 'restore';

export interface LocalBackupMeta {
  id: string;
  createdAt: string;
  label: string;
  kind: LocalBackupKind;
  sizeKb: number;
  playersCount: number;
  recordsCount: number;
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

  try {
    localStorage.setItem(STORAGE_BACKUPS_KEY, JSON.stringify(backups.slice(0, MAX_BACKUPS)));
  } catch {
    try {
      localStorage.setItem(STORAGE_BACKUPS_KEY, JSON.stringify(backups.slice(0, FALLBACK_MAX_BACKUPS)));
    } catch {
      localStorage.removeItem(STORAGE_BACKUPS_KEY);
    }
  }
};

const asArray = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

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
  asArray(payload?.trainingSessionSummaries).length;

const makeBackup = (payload: Partial<AppData>, label: string, kind: LocalBackupKind): LocalBackup => {
  const safePayload = payload ?? {};
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
    payload: safePayload,
  };
};

const lastAutoBackupAt = (backups: LocalBackup[]) => {
  const auto = backups.find((item) => item.kind === 'auto');
  return auto ? new Date(auto.createdAt).getTime() : 0;
};

export const readLocalAppData = (): Partial<AppData> | null => {
  if (!isBrowser()) return null;
  return safeJsonParse<Partial<AppData>>(localStorage.getItem(STORAGE_KEY));
};

export const saveLocalAppData = (nextData: AppData) => {
  if (!isBrowser()) return;

  const previousRaw = localStorage.getItem(STORAGE_KEY);
  const nextRaw = JSON.stringify(nextData);

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

  try {
    localStorage.setItem(STORAGE_KEY, nextRaw);
  } catch {
    localStorage.removeItem(STORAGE_BACKUPS_KEY);
    localStorage.setItem(STORAGE_KEY, nextRaw);
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
  }));

export const getLocalBackupPayload = (backupId: string): Partial<AppData> | null => {
  const backup = readBackups().find((item) => item.id === backupId);
  return backup?.payload ?? null;
};

export const clearLocalBackups = () => {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_BACKUPS_KEY);
};
