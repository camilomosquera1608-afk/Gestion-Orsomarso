import type { AppData } from "./types";

export const STORAGE_KEY = "orsomarso-performance-hub";
export const STORAGE_BACKUPS_KEY = "orsomarso-performance-hub-backups-v1";
export const STORAGE_COMPETITION_SAFETY_KEY =
  "orsomarso-competition-safety-cache-v1";
export const STORAGE_EVALUATIONS_SAFETY_KEY =
  "orsomarso-evaluations-safety-cache-v1";

const MAX_BACKUPS = 8;
const FALLBACK_MAX_BACKUPS = 2;
const AUTO_BACKUP_MIN_INTERVAL_MS = 60 * 60 * 1000; // 1 hora — suficiente para datos en Supabase

export type LocalBackupKind = "manual" | "auto" | "import" | "restore";

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

const isBrowser = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

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
  const parsed = safeJsonParse<LocalBackup[]>(
    localStorage.getItem(STORAGE_BACKUPS_KEY),
  );
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
    if (sizeKb <= budgetKb || withinBudget.length === 0)
      withinBudget.push(backup);
  }

  try {
    localStorage.setItem(STORAGE_BACKUPS_KEY, JSON.stringify(withinBudget));
  } catch {
    try {
      localStorage.setItem(
        STORAGE_BACKUPS_KEY,
        JSON.stringify(withinBudget.slice(0, FALLBACK_MAX_BACKUPS)),
      );
    } catch {
      localStorage.removeItem(STORAGE_BACKUPS_KEY);
    }
  }
};

const asArray = <T>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];

const gpsRecordsCount = (payload: Partial<AppData> | null | undefined) =>
  asArray(payload?.externalLoads).filter(
    (record) =>
      Number(record.totalDistance ?? 0) > 0 ||
      Number(record.playerLoad ?? 0) > 0 ||
      Number(record.highSpeedDistance ?? 0) > 0 ||
      Number(record.sprintDistance ?? 0) > 0 ||
      Number(record.maxVelocity ?? 0) > 0,
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

const makeBackup = (
  payload: Partial<AppData>,
  label: string,
  kind: LocalBackupKind,
): LocalBackup => {
  // Strip derived fields from backup too — saves significant space
  const stripped: Partial<AppData> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (Array.isArray(v)) {
      (stripped as Record<string, unknown>)[k] = v.map((r: unknown) =>
        r && typeof r === "object"
          ? stripRecord(r as Record<string, unknown>)
          : r,
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
  const auto = backups.find((item) => item.kind === "auto");
  return auto ? new Date(auto.createdAt).getTime() : 0;
};

const isMeaningfulValue = (value: unknown) =>
  value !== null && value !== undefined && value !== "";

const mergeObjectWithLocalFallback = <T extends Record<string, unknown>>(
  remoteItem: T,
  localItem?: T,
): T => {
  if (!localItem) return remoteItem;
  const merged: Record<string, unknown> = { ...localItem, ...remoteItem };
  Object.entries(localItem).forEach(([key, value]) => {
    if (!isMeaningfulValue(value)) return;
    if (!isMeaningfulValue(merged[key])) merged[key] = value;
  });
  return merged as T;
};

const normalizedText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();
const compactKey = (...parts: unknown[]) =>
  parts.map((part) => normalizedText(part)).join("::");

const mergeByKeys = <T extends Record<string, unknown>>(
  primary: T[] | undefined,
  secondary: T[] | undefined,
  keyFns: Array<(item: T) => string | null | undefined>,
): T[] => {
  const base = Array.isArray(primary) ? primary : [];
  const extra = Array.isArray(secondary) ? secondary : [];
  if (!extra.length) return base;

  const extraByKey = new Map<string, T>();
  extra.forEach((item) => {
    keyFns.forEach((fn) => {
      const key = fn(item);
      if (key) extraByKey.set(key, item);
    });
  });

  const used = new Set<T>();
  const merged = base.map((item) => {
    const match = keyFns
      .map((fn) => fn(item))
      .filter(Boolean)
      .map((key) => extraByKey.get(key as string))
      .find(Boolean) as T | undefined;
    if (match) used.add(match);
    return mergeObjectWithLocalFallback(item, match);
  });

  extra.forEach((item) => {
    if (used.has(item)) return;
    const exists = keyFns
      .map((fn) => fn(item))
      .filter(Boolean)
      .some((key) =>
        base.some((baseItem) =>
          keyFns
            .map((fn) => fn(baseItem))
            .filter(Boolean)
            .includes(key),
        ),
      );
    if (!exists) merged.push(item);
  });

  return merged;
};

const mergeCompetitionPayload = (
  payload: Partial<AppData> | null,
  safety: Partial<AppData> | null,
): Partial<AppData> | null => {
  if (!payload && !safety) return null;
  const primary = payload ?? {};
  const fallback = safety ?? {};
  return {
    ...fallback,
    ...primary,
    competitionMatchSummaries: mergeByKeys(
      primary.competitionMatchSummaries as unknown as
        | Record<string, unknown>[]
        | undefined,
      fallback.competitionMatchSummaries as unknown as
        | Record<string, unknown>[]
        | undefined,
      [
        (item) => (item.id ? String(item.id) : null),
        (item) =>
          item.date && item.category && item.opponent
            ? compactKey(item.date, item.category, item.opponent)
            : null,
      ],
    ) as unknown as AppData["competitionMatchSummaries"],
    competitionRecords: mergeByKeys(
      primary.competitionRecords as unknown as
        | Record<string, unknown>[]
        | undefined,
      fallback.competitionRecords as unknown as
        | Record<string, unknown>[]
        | undefined,
      [
        (item) => (item.id ? String(item.id) : null),
        (item) =>
          item.matchId && item.playerId
            ? compactKey(item.matchId, item.playerId)
            : null,
        (item) =>
          item.date && item.opponent && item.playerId
            ? compactKey(item.date, item.opponent, item.playerId)
            : null,
      ],
    ) as unknown as AppData["competitionRecords"],
  };
};


const mergeEvaluationsPayload = (
  payload: Partial<AppData> | null,
  safety: Partial<AppData> | null,
): Partial<AppData> | null => {
  if (!payload && !safety) return null;
  const primary = payload ?? {};
  const fallback = safety ?? {};
  return {
    ...fallback,
    ...primary,
    nutritionRecords: mergeByKeys(
      primary.nutritionRecords as unknown as
        | Record<string, unknown>[]
        | undefined,
      fallback.nutritionRecords as unknown as
        | Record<string, unknown>[]
        | undefined,
      [
        (item) => (item.id ? String(item.id) : null),
        (item) =>
          item.playerId && item.date
            ? compactKey(item.playerId, item.date, 'nutrition')
            : null,
      ],
    ) as unknown as AppData['nutritionRecords'],
    cmjRecords: mergeByKeys(
      primary.cmjRecords as unknown as Record<string, unknown>[] | undefined,
      fallback.cmjRecords as unknown as Record<string, unknown>[] | undefined,
      [
        (item) => (item.id ? String(item.id) : null),
        (item) =>
          item.playerId && item.date ? compactKey(item.playerId, item.date, 'cmj') : null,
      ],
    ) as unknown as AppData['cmjRecords'],
    neuromuscularRecords: mergeByKeys(
      primary.neuromuscularRecords as unknown as
        | Record<string, unknown>[]
        | undefined,
      fallback.neuromuscularRecords as unknown as
        | Record<string, unknown>[]
        | undefined,
      [
        (item) => (item.id ? String(item.id) : null),
        (item) =>
          item.playerId && item.date ? compactKey(item.playerId, item.date, 'neuro') : null,
      ],
    ) as unknown as AppData['neuromuscularRecords'],
    fmsRecords: mergeByKeys(
      primary.fmsRecords as unknown as Record<string, unknown>[] | undefined,
      fallback.fmsRecords as unknown as Record<string, unknown>[] | undefined,
      [
        (item) => (item.id ? String(item.id) : null),
        (item) =>
          item.playerId && item.date ? compactKey(item.playerId, item.date, 'fms') : null,
      ],
    ) as unknown as AppData['fmsRecords'],
  };
};

const readCompetitionSafetyCache = (): Partial<AppData> | null => {
  if (!isBrowser()) return null;
  return safeJsonParse<Partial<AppData>>(
    localStorage.getItem(STORAGE_COMPETITION_SAFETY_KEY),
  );
};

const writeCompetitionSafetyCache = (payload: Partial<AppData>) => {
  if (!isBrowser()) return;
  const competitionMatchSummaries = asArray(payload.competitionMatchSummaries);
  const competitionRecords = asArray(payload.competitionRecords);
  if (!competitionMatchSummaries.length && !competitionRecords.length) return;

  const safetyPayload: Partial<AppData> & { updatedAt: string } = {
    updatedAt: new Date().toISOString(),
    competitionMatchSummaries: competitionMatchSummaries.map(
      (r) =>
        stripCompetitionRecord(
          r as unknown as Record<string, unknown>,
        ) as unknown as AppData["competitionMatchSummaries"][number],
    ),
    competitionRecords: competitionRecords.map(
      (r) =>
        stripCompetitionRecord(
          r as unknown as Record<string, unknown>,
        ) as unknown as AppData["competitionRecords"][number],
    ),
  };

  try {
    localStorage.setItem(
      STORAGE_COMPETITION_SAFETY_KEY,
      JSON.stringify(safetyPayload),
    );
  } catch {
    // Si el navegador está al límite, no bloqueamos el guardado principal.
  }
};


const readEvaluationsSafetyCache = (): Partial<AppData> | null => {
  if (!isBrowser()) return null;
  return safeJsonParse<Partial<AppData>>(
    localStorage.getItem(STORAGE_EVALUATIONS_SAFETY_KEY),
  );
};

const writeEvaluationsSafetyCache = (payload: Partial<AppData>) => {
  if (!isBrowser()) return;
  const nutritionRecords = asArray(payload.nutritionRecords);
  const cmjRecords = asArray(payload.cmjRecords);
  const neuromuscularRecords = asArray(payload.neuromuscularRecords);
  const fmsRecords = asArray(payload.fmsRecords);
  if (
    !nutritionRecords.length &&
    !cmjRecords.length &&
    !neuromuscularRecords.length &&
    !fmsRecords.length
  )
    return;

  const safetyPayload: Partial<AppData> & { updatedAt: string } = {
    updatedAt: new Date().toISOString(),
    nutritionRecords,
    cmjRecords,
    neuromuscularRecords,
    fmsRecords,
  };

  try {
    localStorage.setItem(
      STORAGE_EVALUATIONS_SAFETY_KEY,
      JSON.stringify(safetyPayload),
    );
  } catch {
    // Si el navegador está al límite, no bloqueamos el guardado principal.
  }
};

const LEGACY_MOCK_ID_PATTERNS = [
  /^p\d+$/i,
  /^i\d+$/i,
  /^e\d+$/i,
  /^w\d+$/i,
  /^n\d+$/i,
  /^cmj\d+$/i,
  /^neuro\d+$/i,
  /^fms\d+$/i,
];
const isLegacyMockId = (id: unknown) =>
  typeof id === "string" &&
  LEGACY_MOCK_ID_PATTERNS.some((pattern) => pattern.test(id));

export const sanitizeLegacyMockLocalData = (): boolean => {
  if (!isBrowser()) return false;
  const parsed = safeJsonParse<Partial<AppData>>(
    localStorage.getItem(STORAGE_KEY),
  );
  if (!parsed) return false;

  const hasLegacyMockData =
    asArray(parsed.players).some((item) => isLegacyMockId(item.id)) ||
    asArray(parsed.internalLoads).some((item) => isLegacyMockId(item.id)) ||
    asArray(parsed.externalLoads).some((item) => isLegacyMockId(item.id)) ||
    asArray(parsed.wellness).some((item) => isLegacyMockId(item.id));

  if (!hasLegacyMockData) return false;

  const sanitized: Partial<AppData> = {
    ...parsed,
    players: asArray(parsed.players).filter((item) => !isLegacyMockId(item.id)),
    internalLoads: asArray(parsed.internalLoads).filter(
      (item) => !isLegacyMockId(item.id),
    ),
    externalLoads: asArray(parsed.externalLoads).filter(
      (item) => !isLegacyMockId(item.id),
    ),
    wellness: asArray(parsed.wellness).filter(
      (item) => !isLegacyMockId(item.id),
    ),
    cmjRecords: asArray(parsed.cmjRecords).filter(
      (item) => !isLegacyMockId(item.id),
    ),
    nutritionRecords: asArray(parsed.nutritionRecords).filter(
      (item) => !isLegacyMockId(item.id),
    ),
    neuromuscularRecords: asArray(parsed.neuromuscularRecords).filter(
      (item) => !isLegacyMockId(item.id),
    ),
    fmsRecords: asArray(parsed.fmsRecords).filter(
      (item) => !isLegacyMockId(item.id),
    ),
  };

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        mergeEvaluationsPayload(
          mergeCompetitionPayload(sanitized, readCompetitionSafetyCache()),
          readEvaluationsSafetyCache(),
        ) ?? sanitized,
      ),
    );
    return true;
  } catch {
    return false;
  }
};

// Fix #15: Calcular uso aproximado del localStorage para advertir antes de que explote.
export const getLocalStorageUsageKb = (): {
  usedKb: number;
  totalKb: number;
  pct: number;
} => {
  if (typeof window === "undefined")
    return { usedKb: 0, totalKb: 5120, pct: 0 };
  let usedKb = 0;
  try {
    const mainRaw = localStorage.getItem(STORAGE_KEY) ?? "";
    const backupsRaw = localStorage.getItem(STORAGE_BACKUPS_KEY) ?? "";
    usedKb = Math.round((mainRaw.length + backupsRaw.length) / 1024);
  } catch {
    usedKb = 0;
  }
  const totalKb = 5120; // 5MB — límite conservador cross-browser
  return { usedKb, totalKb, pct: Math.round((usedKb / totalKb) * 100) };
};

export const getLocalStorageWarning = (): "ok" | "warn" | "danger" => {
  const { pct } = getLocalStorageUsageKb();
  if (pct >= 80) return "danger";
  if (pct >= 60) return "warn";
  return "ok";
};

// ─── Compact serialization — keeps localStorage under ~1.5MB ─────────────────
// Remove derived, redundant, zero and empty fields before storing locally.
// Data is fully recoverable from Supabase; localStorage is just a fast cache.

const DERIVED_FIELDS = new Set([
  "distancePerMin", // derived: totalDistance / min
  "playerLoadPerMin", // derived: playerLoad / min
  "hsr", // removed field in daily training cache
  "highSpeedDistance", // removed field in daily training cache
  "sprintDistance", // removed field in daily training cache
  "ima", // removed field in daily training cache
  "actingCategory", // almost always === category
]);

const COMPETITION_DERIVED_FIELDS = new Set([
  "distancePerMin",
  "playerLoadPerMin",
  "actingCategory",
]);

// Fields where zero IS meaningful and must be kept
const KEEP_ZERO = new Set([
  "rpe",
  "goals",
  "assists",
  "yellowCards",
  "redCards",
  "minutesPlayed",
  "min",
  "acc",
  "dcc",
  "sprints",
  "rhie",
  "goalsConceded",
  "goalsPrevented",
  "penaltiesSaved",
  "crossesDefended",
  "footworkActions",
]);

const stripRecordWithDerivedFields = (
  obj: Record<string, unknown>,
  derivedFields: Set<string>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (derivedFields.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (v === "") continue;
    if (typeof v === "number" && v === 0 && !KEEP_ZERO.has(k)) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      out[k] = stripRecordWithDerivedFields(
        v as Record<string, unknown>,
        derivedFields,
      );
    } else {
      out[k] = v;
    }
  }
  return out;
};

const stripRecord = (obj: Record<string, unknown>): Record<string, unknown> =>
  stripRecordWithDerivedFields(obj, DERIVED_FIELDS);

const stripCompetitionRecord = (
  obj: Record<string, unknown>,
): Record<string, unknown> =>
  stripRecordWithDerivedFields(obj, COMPETITION_DERIVED_FIELDS);

const DAYS_90 = 90 * 24 * 60 * 60 * 1000;
const cutoffDate = () =>
  new Date(Date.now() - DAYS_90).toISOString().slice(0, 10);

const compactForLocal = (data: AppData): Partial<AppData> => {
  const cutoff = cutoffDate();
  const isRecent = (r: { date?: string }) => !r.date || r.date >= cutoff;

  return {
    ...data,
    // High-volume arrays: keep only last 90 days, strip derived fields
    externalLoads: data.externalLoads
      .filter(isRecent)
      .map(
        (r) =>
          stripRecord(
            r as unknown as Record<string, unknown>,
          ) as unknown as typeof r,
      ),
    internalLoads: data.internalLoads
      .filter(isRecent)
      .map(
        (r) =>
          stripRecord(
            r as unknown as Record<string, unknown>,
          ) as unknown as typeof r,
      ),
    // FIX: Keep all wellness records locally for better persistence without Supabase
    wellness: data.wellness,
    nutritionRecords: data.nutritionRecords.filter(isRecent),
    // These must be kept complete — small arrays
    players: data.players,
    microcycles: data.microcycles,
    trainingSessionSummaries: data.trainingSessionSummaries,
    strengthSessions: data.strengthSessions,
    // FIX: Keep all competition data locally for persistence without Supabase
    competitionMatchSummaries: data.competitionMatchSummaries,
    competitionRecords: data.competitionRecords,
    cmjRecords: data.cmjRecords,
    neuromuscularRecords: data.neuromuscularRecords,
    fmsRecords: data.fmsRecords,
  };
};

export const readLocalAppData = (): Partial<AppData> | null => {
  if (!isBrowser()) return null;
  const mainPayload = safeJsonParse<Partial<AppData>>(
    localStorage.getItem(STORAGE_KEY),
  );
  return mergeEvaluationsPayload(
    mergeCompetitionPayload(mainPayload, readCompetitionSafetyCache()),
    readEvaluationsSafetyCache(),
  );
};

export const saveLocalAppData = (nextData: AppData) => {
  if (!isBrowser()) return;

  writeCompetitionSafetyCache(nextData);
  writeEvaluationsSafetyCache(nextData);

  const previousRaw = localStorage.getItem(STORAGE_KEY);
  // Use compact representation — strips derived fields and 90-day window
  const compacted = compactForLocal(nextData);
  const nextRaw = JSON.stringify(compacted);

  console.log("[Orsomarso] Guardando datos localmente:", {
    players: compacted.players?.length || 0,
    wellness: compacted.wellness?.length || 0,
    competitionMatchSummaries: compacted.competitionMatchSummaries?.length || 0,
    competitionRecords: compacted.competitionRecords?.length || 0,
    size: Math.round(nextRaw.length / 1024) + 'KB'
  });

  // FIX: Auto-clear if localStorage is nearly full (>75%)
  const usage = getLocalStorageUsageKb();
  if (usage.pct > 75) {
    console.warn(`[Orsomarso] localStorage casi lleno (${usage.pct}%), limpiando backups automáticos...`);
    const removed = clearAutoBackups();
    console.log(`[Orsomarso] ${removed} backups eliminados`);
  }

  if (previousRaw && previousRaw !== nextRaw) {
    const previousPayload = safeJsonParse<Partial<AppData>>(previousRaw);
    const backups = readBackups();
    const now = Date.now();

    if (
      previousPayload &&
      now - lastAutoBackupAt(backups) > AUTO_BACKUP_MIN_INTERVAL_MS
    ) {
      writeBackups([
        makeBackup(
          previousPayload,
          "Copia automática antes de guardar cambios",
          "auto",
        ),
        ...backups,
      ]);
    }
  }

  // Robust save — never throws QuotaExceededError to caller
  const trySave = (raw: string): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY, raw);
      console.log("[Orsomarso] Datos guardados exitosamente en localStorage");
      return true;
    } catch (error) {
      console.error("[Orsomarso] Error guardando en localStorage:", error);
      return false;
    }
  };

  // Attempt 1: compact data
  if (!trySave(nextRaw)) {
    // Attempt 2: clear backups and retry
    console.warn("[Orsomarso] Espacio insuficiente, limpiando backups...");
    localStorage.removeItem(STORAGE_BACKUPS_KEY);
    if (!trySave(nextRaw)) {
      // Attempt 3: clear safety caches and retry
      console.warn("[Orsomarso] Todavía sin espacio, limpiando caches de seguridad...");
      localStorage.removeItem(STORAGE_COMPETITION_SAFETY_KEY);
      localStorage.removeItem(STORAGE_EVALUATIONS_SAFETY_KEY);
      if (!trySave(nextRaw)) {
        // Attempt 4: save only players, sessions and microcycles (no loads)
        // This is a last resort — data is recoverable from Supabase
        console.error("[Orsomarso] localStorage críticamente lleno, guardando estructura mínima");
        const competitionSafety = readCompetitionSafetyCache();
        const evaluationsSafety = readEvaluationsSafetyCache();
        const minimal = JSON.stringify(
          mergeEvaluationsPayload(
            mergeCompetitionPayload(
              {
                players: compacted.players ?? [],
                microcycles: compacted.microcycles ?? [],
                trainingSessionSummaries: compacted.trainingSessionSummaries ?? [],
                competitionMatchSummaries:
                  compacted.competitionMatchSummaries ?? [],
                externalLoads: [],
                internalLoads: [],
                wellness: [],
                nutritionRecords: compacted.nutritionRecords ?? [],
                cmjRecords: compacted.cmjRecords ?? [],
                neuromuscularRecords: compacted.neuromuscularRecords ?? [],
                competitionRecords: compacted.competitionRecords ?? [],
                fmsRecords: compacted.fmsRecords ?? [],
              },
              competitionSafety,
            ),
            evaluationsSafety,
          ),
        );
        trySave(minimal);
        // Don't throw — Supabase is the source of truth
        console.warn(
          "[Orsomarso] localStorage lleno — guardando solo estructura mínima. Los datos de carga están en Supabase.",
        );
      }
    }
  }
};

export const createLocalBackup = (
  payload: AppData,
  label = "Copia manual",
  kind: LocalBackupKind = "manual",
) => {
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
    microcyclesCount: Number.isFinite(meta.microcyclesCount)
      ? meta.microcyclesCount
      : 0,
    gpsRecordsCount: Number.isFinite(meta.gpsRecordsCount)
      ? meta.gpsRecordsCount
      : 0,
    sessionsCount: Number.isFinite(meta.sessionsCount) ? meta.sessionsCount : 0,
    matchesCount: Number.isFinite(meta.matchesCount) ? meta.matchesCount : 0,
  }));

export const getLocalBackupPayload = (
  backupId: string,
): Partial<AppData> | null => {
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
  const manual = backups.filter((b) => b.kind !== "auto");
  const removed = backups.length - manual.length;
  writeBackups(manual);
  return removed;
};

// FIX: Emergency function to clear localStorage when full
export const emergencyClearLocalStorage = (): { cleared: boolean; message: string } => {
  if (!isBrowser()) return { cleared: false, message: "Not in browser" };
  
  try {
    localStorage.clear();
    return { cleared: true, message: "LocalStorage limpiado completamente" };
  } catch (error) {
    return { cleared: false, message: `Error: ${error}` };
  }
};

// FIX: Emergency function to recover lost competition data from safety cache
export const recoverCompetitionData = (): { recovered: boolean; message: string; data?: Partial<AppData> } => {
  if (!isBrowser()) return { recovered: false, message: "Not in browser" };
  
  try {
    const safetyCache = readCompetitionSafetyCache();
    if (!safetyCache) {
      return { recovered: false, message: "No hay datos de competición en caché de seguridad" };
    }
    
    const matchesCount = safetyCache.competitionMatchSummaries?.length || 0;
    const recordsCount = safetyCache.competitionRecords?.length || 0;
    
    if (matchesCount === 0 && recordsCount === 0) {
      return { recovered: false, message: "Caché de seguridad vacía" };
    }
    
    return { 
      recovered: true, 
      message: `Recuperados ${matchesCount} partidos y ${recordsCount} registros de competición`,
      data: safetyCache 
    };
  } catch (error) {
    return { recovered: false, message: `Error: ${error}` };
  }
};

// FIX: Function to check if there are any backups available
export const hasAvailableBackups = (): { hasBackups: boolean; count: number; details: string } => {
  if (!isBrowser()) return { hasBackups: false, count: 0, details: "Not in browser" };
  
  try {
    const backups = readBackups();
    const count = backups.length;
    
    if (count === 0) {
      return { hasBackups: false, count: 0, details: "No hay respaldos disponibles" };
    }
    
    const latest = backups[0];
    const details = `${count} respaldos disponibles. Más reciente: ${latest.label} (${new Date(latest.createdAt).toLocaleString()})`;
    
    return { hasBackups: true, count, details };
  } catch (error) {
    return { hasBackups: false, count: 0, details: `Error: ${error}` };
  }
};
