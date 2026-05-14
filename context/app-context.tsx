"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { initialData } from "@/lib/mock-data";
import {
  fetchRemoteAppState,
  hasSupabaseConfig,
  legacyAppStateSyncEnabled,
  saveRemoteAppState,
  supabase,
  tableSchemaSyncEnabled,
} from "@/lib/supabase";
import {
  deleteSupabaseTableRowByLegacyId,
  deleteSupabaseTrainingSessionCascade,
  fetchSupabaseTablesAppData,
  saveSupabaseCompetitionAppData,
  saveSupabaseEvaluationsAppData,
  saveSupabasePlayersAppData,
  saveSupabaseTablesAppData,
} from "@/lib/supabase-table-sync";
import {
  clearAutoBackups,
  clearLocalBackups,
  createLocalBackup,
  deleteLocalBackup,
  getLocalBackupPayload,
  listLocalBackups,
  readLocalAppData,
  saveLocalAppData,
  sanitizeLegacyMockLocalData,
} from "@/lib/app-storage";
import type { LocalBackupMeta } from "@/lib/app-storage";
import { getAllowedCategory, getStaffSession, isMasterRole } from "@/lib/auth";
import {
  canDeletePlayer,
  canWrite,
  filterAppDataForSession,
} from "@/lib/access-control";
import {
  findMicrocycleByDate,
  getMicrocyclesForCategory,
  microcycleBelongsToCategory,
} from "@/lib/utils";
import { findOverlappingMicrocycle } from "@/lib/operational-validation";
import { normalizeAppData } from "@/lib/performance-helpers";
import {
  AppData,
  CMJRecord,
  CompetitionMatchSummary,
  CompetitionRecord,
  DailyExternalLoadRecord,
  DailyInternalLoadRecord,
  DailyWellnessRecord,
  FMSRecord,
  GlobalFilters,
  Microcycle,
  NeuromuscularRecord,
  NutritionRecord,
  Player,
  TrainingSessionSummary,
  StrengthSession,
  StrengthPlayerResponse,
} from "@/lib/types";

interface AppContextValue {
  data: AppData;
  filters: GlobalFilters;
  setFilters: (next: Partial<GlobalFilters>) => void;
  resetFilters: () => void;
  addPlayer: (player: Player) => void;
  updatePlayer: (player: Player) => void;
  deletePlayer: (playerId: string) => void;
  addWellness: (record: DailyWellnessRecord) => void;
  upsertWellness: (record: DailyWellnessRecord) => void;
  addInternalLoad: (record: DailyInternalLoadRecord) => void;
  upsertInternalLoad: (record: DailyInternalLoadRecord) => void;
  updateInternalLoad: (record: DailyInternalLoadRecord) => void;
  deleteInternalLoad: (recordId: string) => void;
  addExternalLoad: (record: DailyExternalLoadRecord) => void;
  updateExternalLoad: (record: DailyExternalLoadRecord) => void;
  deleteExternalLoad: (recordId: string) => void;
  addCMJRecord: (record: CMJRecord) => void;
  updateCMJRecord: (record: CMJRecord) => void;
  deleteCMJRecord: (recordId: string) => void;
  addNutritionRecord: (record: NutritionRecord) => void;
  updateNutritionRecord: (record: NutritionRecord) => void;
  deleteNutritionRecord: (recordId: string) => void;
  addNeuromuscularRecord: (record: NeuromuscularRecord) => void;
  updateNeuromuscularRecord: (record: NeuromuscularRecord) => void;
  deleteNeuromuscularRecord: (recordId: string) => void;
  addFMSRecord: (record: FMSRecord) => void;
  updateFMSRecord: (record: FMSRecord) => void;
  deleteFMSRecord: (recordId: string) => void;
  addCompetitionRecord: (record: CompetitionRecord) => void;
  updateCompetitionRecord: (record: CompetitionRecord) => void;
  deleteCompetitionRecord: (recordId: string) => void;
  upsertCompetitionMatchSummary: (record: CompetitionMatchSummary) => void;
  saveCompetitionMatchBundle: (
    record: CompetitionMatchSummary,
    records: CompetitionRecord[],
  ) => void;
  deleteCompetitionMatchSummary: (matchId: string) => void;
  upsertTrainingSessionSummary: (record: TrainingSessionSummary) => void;
  saveTrainingSessionBundle: (
    record: TrainingSessionSummary,
    externalLoads: DailyExternalLoadRecord[],
    internalLoads: DailyInternalLoadRecord[],
  ) => void;
  deleteTrainingSessionSummary: (sessionId: string) => void;
  upsertStrengthSession: (record: StrengthSession) => void;
  updateStrengthResponse: (
    sessionId: string,
    response: StrengthPlayerResponse,
  ) => void;
  deleteStrengthSession: (sessionId: string) => void;
  updateMicrocycle: (record: Microcycle) => void;
  deleteMicrocycle: (microcycleId: string) => void;
  backendMode: "supabase" | "local";
  syncStatus: "idle" | "syncing" | "ready" | "error";
  // FIX #3: isLoading expuesto para que la UI pueda mostrar estado de carga
  // en lugar de mostrar datos vacíos/de ejemplo mientras llegan los datos reales.
  isLoading: boolean;
  localBackups: LocalBackupMeta[];
  createLocalSnapshot: (label?: string) => void;
  clearLocalSnapshots: () => void;
  deleteLocalBackupById: (backupId: string) => boolean;
  clearAllAutoBackups: () => number;
  restoreLocalSnapshot: (backupId: string) => boolean;
  importAppDataJson: (rawJson: string) => boolean;
  exportAppDataJson: () => string;
  forceSync: () => Promise<void>;
  pushLocalToRemote: () => Promise<void>;
  canEdit: boolean;
  permissionMessage: string;
}

const getTodayInputDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultFilters = (): GlobalFilters => ({
  date: getTodayInputDate(),
  microcycleId: "",
  playerId: "all",
  position: "all",
  status: "all",
  category: "all",
  actingCategory: "all",
  movementType: "all",
  sessionNumber: 1,
});

const defaultFilters: GlobalFilters = getDefaultFilters();

const AppContext = createContext<AppContextValue | undefined>(undefined);

const DEFAULT_CATEGORY = "Sub20" as const;

const hydrateData = (stored: Partial<AppData> | null): AppData =>
  normalizeAppData(stored, initialData);

const isMeaningfulValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

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

const normalizedKeyPart = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();
const buildMergeKey = (...parts: unknown[]) =>
  parts.map(normalizedKeyPart).join("::");

const isPlainObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const mergeByKeys = <T extends Record<string, unknown>>(
  remote: T[] | undefined,
  local: T[] | undefined,
  keyFns: Array<(item: T) => string | null | undefined>,
): T[] => {
  const remoteRows = (Array.isArray(remote) ? remote : []).filter(isPlainObjectRecord) as T[];
  const localRows = (Array.isArray(local) ? local : []).filter(isPlainObjectRecord) as T[];
  if (!localRows.length) return remoteRows;
  const localByKey = new Map<string, T>();
  localRows.forEach((item) => {
    keyFns.forEach((fn) => {
      const key = fn(item);
      if (key) localByKey.set(key, item);
    });
  });

  const usedLocal = new Set<T>();
  const merged = remoteRows.map((item) => {
    const match = keyFns
      .map((fn) => fn(item))
      .filter(Boolean)
      .map((key) => localByKey.get(key as string))
      .find(Boolean) as T | undefined;
    if (match) usedLocal.add(match);
    return mergeObjectWithLocalFallback(item, match);
  });

  localRows.forEach((item) => {
    if (usedLocal.has(item)) return;
    const itemKeys = keyFns.map((fn) => fn(item)).filter(Boolean);
    const exists = remoteRows.some((remoteItem) =>
      keyFns
        .map((fn) => fn(remoteItem))
        .filter(Boolean)
        .some((key) => itemKeys.includes(key)),
    );
    if (!exists) merged.push(item);
  });

  return merged;
};

const mergeByIdWithLocalFallback = <T extends { id: string }>(
  remote: T[] | undefined,
  local: T[] | undefined,
): T[] =>
  mergeByKeys(
    remote as unknown as Record<string, unknown>[],
    local as unknown as Record<string, unknown>[] | undefined,
    [(item) => (item.id ? String(item.id) : null)],
  ) as unknown as T[];

const mergeCompetitionMatches = (
  remote: CompetitionMatchSummary[],
  local: CompetitionMatchSummary[] | undefined,
): CompetitionMatchSummary[] =>
  mergeByKeys(
    (local?.length ? local : remote) as unknown as Record<string, unknown>[],
    (local?.length ? remote : local) as unknown as Record<string, unknown>[] | undefined,
    [
      (item) => (item.id ? String(item.id) : null),
      (item) =>
        item.date && item.category && item.opponent
          ? buildMergeKey(item.date, item.category, item.opponent)
          : null,
    ],
  ) as unknown as CompetitionMatchSummary[];

const mergeCompetitionRecords = (
  remote: CompetitionRecord[],
  local: CompetitionRecord[] | undefined,
): CompetitionRecord[] =>
  mergeByKeys(
    (local?.length ? local : remote) as unknown as Record<string, unknown>[],
    (local?.length ? remote : local) as unknown as Record<string, unknown>[] | undefined,
    [
      (item) => (item.id ? String(item.id) : null),
      (item) =>
        item.matchId && item.playerId
          ? buildMergeKey(item.matchId, item.playerId)
          : null,
      (item) =>
        item.date && item.opponent && item.playerId
          ? buildMergeKey(item.date, item.opponent, item.playerId)
          : null,
    ],
  ) as unknown as CompetitionRecord[];

const mergeByIdPreferLocal = <T extends { id: string }>(
  remote: T[] | undefined,
  local: T[] | undefined,
): T[] => {
  const remoteRows = Array.isArray(remote) ? remote : [];
  const localRows = Array.isArray(local) ? local : [];
  const byId = new Map<string, T>();
  remoteRows.forEach((item) => item?.id && byId.set(item.id, item));
  localRows.forEach((item) => {
    if (!item?.id) return;
    const current = (byId.get(item.id) ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...current };
    Object.entries(item as Record<string, unknown>).forEach(([key, value]) => {
      if (isMeaningfulValue(value) || !isMeaningfulValue(merged[key])) merged[key] = value;
    });
    byId.set(item.id, merged as T);
  });
  return Array.from(byId.values());
};

const buildCompetitionExternalLoad = (
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

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<AppData>(initialData);
  const [filters, setFiltersState] = useState<GlobalFilters>(defaultFilters);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "ready" | "error"
  >("idle");
  const [localBackups, setLocalBackups] = useState<LocalBackupMeta[]>([]);
  const dataRef = useRef<AppData>(initialData);
  const remoteRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const skipRemoteRefreshUntilRef = useRef(0);
  const lastRemotePullRef = useRef(0);
  const backendMode: "supabase" | "local" = hasSupabaseConfig
    ? "supabase"
    : "local";

  // FIX #10: Cachear la sesión en un ref para no releer localStorage en cada mutación.
  // getStaffSession() puede leer cookies/localStorage y fallar silenciosamente en SSR.
  const sessionRef = useRef(getStaffSession());
  useEffect(() => {
    sessionRef.current = getStaffSession();
  }, [isHydrated]);

  const currentSession = sessionRef.current;
  const canEdit = !currentSession.isAuthenticated || canWrite(currentSession);
  const permissionMessage =
    currentSession.isAuthenticated && !canWrite(currentSession)
      ? "Solo lectura."
      : "Guardado.";

  const keepLocalDataAfterReadIssue = (reason?: string) => {
    console.warn(
      "[Orsomarso] Lectura remota no disponible, usando cache local:",
      reason ?? "sin detalle",
    );
    setSyncStatus("ready");
  };

  const refreshFromSupabase = async (
    source: "manual" | "realtime" | "poll" = "manual",
  ) => {
    if (!hasSupabaseConfig || !tableSchemaSyncEnabled || !supabase) return;
    if (source !== "manual" && Date.now() < skipRemoteRefreshUntilRef.current)
      return;

    setSyncStatus(source === "manual" ? "syncing" : "ready");
    const remote = await fetchSupabaseTablesAppData(supabase);
    if (!remote.ok) {
      keepLocalDataAfterReadIssue(remote.reason);
      return;
    }

    const remoteHydrated = hydrateData(remote.data);

    // MERGE FIX: Keep locally-saved sessions that haven't synced to Supabase yet.
    // Match by both id AND by (category+date) to handle the case where Supabase
    // stored the session with a different legacy_id (category+date conflict path).
    const current = dataRef.current;

    const next: AppData = {
      ...remoteHydrated,
      // Mezcla remota + cache local sin pisar datos locales que Supabase todavía
      // no confirmó o que no puede guardar por columnas pendientes de SQL.
      trainingSessionSummaries: mergeByKeys(
        remoteHydrated.trainingSessionSummaries as unknown as Record<
          string,
          unknown
        >[],
        current.trainingSessionSummaries as unknown as Record<
          string,
          unknown
        >[],
        [
          (item) => (item.id ? String(item.id) : null),
          (item) =>
            item.date && item.category
              ? buildMergeKey(item.date, item.category, item.sessionNumber ?? 1)
              : null,
        ],
      ) as unknown as AppData["trainingSessionSummaries"],
      internalLoads: mergeByIdWithLocalFallback(
        remoteHydrated.internalLoads,
        current.internalLoads,
      ),
      externalLoads: mergeByIdWithLocalFallback(
        remoteHydrated.externalLoads,
        current.externalLoads,
      ),
      microcycles: mergeByIdWithLocalFallback(
        remoteHydrated.microcycles,
        current.microcycles,
      ),
      competitionRecords: mergeCompetitionRecords(
        remoteHydrated.competitionRecords,
        current.competitionRecords,
      ),
      competitionMatchSummaries: mergeCompetitionMatches(
        remoteHydrated.competitionMatchSummaries,
        current.competitionMatchSummaries,
      ),
      wellness: mergeByIdWithLocalFallback(
        remoteHydrated.wellness,
        current.wellness,
      ),
      nutritionRecords: mergeByIdWithLocalFallback(
        remoteHydrated.nutritionRecords,
        current.nutritionRecords,
      ),
      cmjRecords: mergeByIdWithLocalFallback(
        remoteHydrated.cmjRecords,
        current.cmjRecords,
      ),
      neuromuscularRecords: mergeByIdWithLocalFallback(
        remoteHydrated.neuromuscularRecords,
        current.neuromuscularRecords,
      ),
      fmsRecords: mergeByIdWithLocalFallback(
        remoteHydrated.fmsRecords,
        current.fmsRecords,
      ),
      strengthSessions: mergeByIdWithLocalFallback(
        remoteHydrated.strengthSessions ?? [],
        current.strengthSessions ?? [],
      ),
      // Players: merge remote + local to avoid losing ficha edits if Supabase
      // has not persisted a newer column yet. Remote fields stay primary,
      // local fills gaps and preserves local-only players.
      players: mergeByIdPreferLocal(
        remoteHydrated.players,
        current.players,
      ),
    };

    const currentSnapshot = JSON.stringify(dataRef.current);
    const nextSnapshot = JSON.stringify(next);
    if (currentSnapshot !== nextSnapshot) {
      setData(next);
      dataRef.current = next;
      saveLocalAppData(next);
      setLocalBackups(listLocalBackups());
    }
    lastRemotePullRef.current = Date.now();
    setSyncStatus("ready");
  };

  const scheduleRemoteRefresh = (source: "realtime" | "poll") => {
    if (remoteRefreshTimerRef.current)
      clearTimeout(remoteRefreshTimerRef.current);
    remoteRefreshTimerRef.current = setTimeout(
      () => {
        void refreshFromSupabase(source);
      },
      source === "realtime" ? 650 : 0,
    );
  };

  const persistData = async (
    nextData: AppData,
    scope: "all" | "players" | "evaluations" | "competition" = "all",
    options: { playerIds?: string[] } = {},
  ) => {
    saveLocalAppData(nextData);
    setLocalBackups(listLocalBackups());
    if (hasSupabaseConfig && tableSchemaSyncEnabled && supabase) {
      // FIX #6: Calcular el tiempo de bloqueo ANTES del await, no después.
      // Si se seteaba después del await, el segundo set aplastaba al primero
      // con un valor menor, permitiendo que el realtime hiciera refresh
      // antes de que terminara de llegar la respuesta del servidor.
      // FIX DATA LOSS: Block remote refresh for 8s before AND after save.
      // The realtime event fires when Supabase receives our write (~500ms-2s).
      // Without a long enough block the realtime refresh overwrites local state
      // with stale data that hasn't propagated yet.
      // Block remote refresh for 30s before save starts —
      // Supabase can take 10-20s to propagate writes with heavy load.
      const blockUntil = Date.now() + 30000;
      // Only extend the block — never shorten it (another save may be in flight).
      if (blockUntil > skipRemoteRefreshUntilRef.current) {
        skipRemoteRefreshUntilRef.current = blockUntil;
      }
      setSyncStatus("syncing");
      const session = getStaffSession();
      const scopedData = filterAppDataForSession(nextData, session);
      const saveOperation =
        scope === "players"
          ? saveSupabasePlayersAppData(supabase, scopedData, { onlyPlayerIds: options.playerIds })
          : scope === "evaluations"
            ? saveSupabaseEvaluationsAppData(supabase, scopedData)
            : scope === "competition"
              ? saveSupabaseCompetitionAppData(supabase, scopedData)
              : saveSupabaseTablesAppData(supabase, scopedData);
      // Los guardados pequeños (ficha / valoraciones) no deben quedar bloqueados
      // por el guardado completo de entrenamientos y competencia.
      const timeoutMs = scope === "all" ? 30000 : 12000;
      const saveWithTimeout = Promise.race([
        saveOperation,
        new Promise<{ ok: false; reason: string }>((resolve) =>
          setTimeout(() => resolve({ ok: false, reason: "timeout" }), timeoutMs),
        ),
      ]);
      const result = await saveWithTimeout;
      // After save completes, keep blocking for 20 more seconds so the
      // realtime echo from Supabase doesn't overwrite our local state.
      const postSaveBlock = Date.now() + 20000;
      if (postSaveBlock > skipRemoteRefreshUntilRef.current) {
        skipRemoteRefreshUntilRef.current = postSaveBlock;
      }
      setSyncStatus(result.ok ? "ready" : "error");
    } else if (hasSupabaseConfig && legacyAppStateSyncEnabled) {
      setSyncStatus("syncing");
      const result = await saveRemoteAppState(nextData);
      setSyncStatus(result.ok ? "ready" : "error");
    } else {
      setSyncStatus("ready");
    }
  };

  const applyMutation = (
    updater: (prev: AppData) => AppData,
    scope: "all" | "players" | "evaluations" | "competition" = "all",
    options: { playerIds?: string[] } = {},
  ) => {
    setData((prev) => {
      // FIX #10: Usar el ref cacheado en lugar de llamar getStaffSession() en cada mutación
      const session = sessionRef.current;
      if (session.isAuthenticated && !canWrite(session)) {
        setSyncStatus("error");
        return prev;
      }
      const next = updater(prev);
      dataRef.current = next;
      void persistData(next, scope, options);
      return next;
    });
  };

  // Fix #20: loggedBy helper — rellena automáticamente quién hizo el cambio
  const currentUserLabel = () =>
    sessionRef.current.email ?? sessionRef.current.displayName ?? "Sistema";

  const deleteRemoteLegacy = async (table: string, legacyId: string) => {
    if (!hasSupabaseConfig || !tableSchemaSyncEnabled || !supabase) return;
    const session = sessionRef.current;
    if (session.isAuthenticated && !canWrite(session)) return;
    // FIX #6: mismo patrón — calcular blockUntil antes del await
    const blockUntil = Date.now() + 30000;
    if (blockUntil > skipRemoteRefreshUntilRef.current) {
      skipRemoteRefreshUntilRef.current = blockUntil;
    }
    const result = await deleteSupabaseTableRowByLegacyId(
      supabase,
      table,
      legacyId,
    );
    const postBlock = Date.now() + 20000;
    if (postBlock > skipRemoteRefreshUntilRef.current) {
      skipRemoteRefreshUntilRef.current = postBlock;
    }
    setSyncStatus(result.ok ? "ready" : "error");
  };

  useEffect(() => {
    const init = async () => {
      if (hasSupabaseConfig && tableSchemaSyncEnabled && supabase) {
        // Limpieza segura de datos mock antiguos.
        // Antes se borraba todo localStorage si detectaba ids p1/e1/i1, y eso podía
        // llevarse partidos guardados localmente si Supabase todavía no había confirmado.
        // Ahora solo se eliminan esos registros de ejemplo y se preserva competencia.
        sanitizeLegacyMockLocalData();

        setSyncStatus("syncing");
        // 20s timeout so init never hangs on 'syncing'
        const remote = await Promise.race([
          fetchSupabaseTablesAppData(supabase),
          new Promise<{ ok: false; reason: string }>((resolve) =>
            setTimeout(
              () => resolve({ ok: false, reason: "timeout-init" }),
              20000,
            ),
          ),
        ]);
        if (remote.ok) {
          const remoteData = hydrateData(remote.data);

          // MERGE FIX: Supabase may not have all records if upserts failed.
          // Read local data and keep any records that exist locally but not remotely.
          // This prevents page refresh from wiping locally-saved sessions.
          const local = readLocalAppData();
          const localData = local ? hydrateData(local) : null;

          const mergeArrays = <T extends { id: string }>(
            remote: T[],
            local: T[] | undefined,
          ): T[] => mergeByIdWithLocalFallback(remote, local);

          // Special merge for sessions: also match by date+category+sessionNumber.
          const mergeSessionsWithDateKey = (
            remote: typeof remoteData.trainingSessionSummaries,
            local: typeof remoteData.trainingSessionSummaries | undefined,
          ) =>
            mergeByKeys(
              remote as unknown as Record<string, unknown>[],
              local as unknown as Record<string, unknown>[] | undefined,
              [
                (item) => (item.id ? String(item.id) : null),
                (item) =>
                  item.date && item.category
                    ? buildMergeKey(
                        item.date,
                        item.category,
                        item.sessionNumber ?? 1,
                      )
                    : null,
              ],
            ) as unknown as typeof remoteData.trainingSessionSummaries;

          const merged: AppData = {
            ...remoteData,
            // Merge ALL arrays — remote (committed) + local-only (not yet propagated)
            trainingSessionSummaries: mergeSessionsWithDateKey(
              remoteData.trainingSessionSummaries,
              localData?.trainingSessionSummaries,
            ),
            internalLoads: mergeArrays(
              remoteData.internalLoads,
              localData?.internalLoads,
            ),
            externalLoads: mergeArrays(
              remoteData.externalLoads,
              localData?.externalLoads,
            ),
            microcycles: mergeArrays(
              remoteData.microcycles,
              localData?.microcycles,
            ),
            competitionRecords: mergeCompetitionRecords(
              remoteData.competitionRecords,
              localData?.competitionRecords,
            ),
            competitionMatchSummaries: mergeCompetitionMatches(
              remoteData.competitionMatchSummaries,
              localData?.competitionMatchSummaries,
            ),
            wellness: mergeArrays(remoteData.wellness, localData?.wellness),
            nutritionRecords: mergeArrays(
              remoteData.nutritionRecords,
              localData?.nutritionRecords,
            ),
            cmjRecords: mergeArrays(
              remoteData.cmjRecords,
              localData?.cmjRecords,
            ),
            neuromuscularRecords: mergeArrays(
              remoteData.neuromuscularRecords,
              localData?.neuromuscularRecords,
            ),
            fmsRecords: mergeArrays(
              remoteData.fmsRecords,
              localData?.fmsRecords,
            ),
            strengthSessions: mergeArrays(
              remoteData.strengthSessions ?? [],
              localData?.strengthSessions,
            ),
            // Players: merge remote + local to avoid wiping ficha edits
            // while new Supabase columns are being added.
            players: mergeByIdPreferLocal(remoteData.players, localData?.players),
          };

          setData(merged);
          dataRef.current = merged;
          saveLocalAppData(merged);
          setSyncStatus("ready");
        } else {
          const local = readLocalAppData();
          const hydrated = hydrateData(local ?? initialData);
          setData(hydrated);
          dataRef.current = hydrated;
          keepLocalDataAfterReadIssue(remote.reason);
        }
      } else if (hasSupabaseConfig && legacyAppStateSyncEnabled) {
        setSyncStatus("syncing");
        const remote = await fetchRemoteAppState();
        if (remote?.payload && Object.keys(remote.payload).length) {
          const next = hydrateData(remote.payload as Partial<AppData>);
          setData(next);
          dataRef.current = next;
        } else {
          const local = readLocalAppData();
          const hydrated = hydrateData(local ?? initialData);
          setData(hydrated);
          dataRef.current = hydrated;
        }
        setSyncStatus("ready");
      } else {
        const stored = readLocalAppData();
        const next = stored ? hydrateData(stored) : initialData;
        setData(next);
        dataRef.current = next;
        setSyncStatus("ready");
      }

      const session = getStaffSession();
      sessionRef.current = session;
      const today = getTodayInputDate();
      const category = getAllowedCategory(session);
      const activeCategory = isMasterRole(session) ? "all" : category;
      const currentMicrocycles = dataRef.current.microcycles;
      const todayMicrocycle = findMicrocycleByDate(
        currentMicrocycles,
        today,
        undefined,
        activeCategory,
      );
      const fallbackMicrocycle =
        todayMicrocycle ??
        getMicrocyclesForCategory(currentMicrocycles, activeCategory)[0] ??
        currentMicrocycles[0];
      setFiltersState((prev) => ({
        ...prev,
        date: today,
        category: activeCategory,
        microcycleId: fallbackMicrocycle?.id ?? "",
      }));
      setLocalBackups(listLocalBackups());
      setIsHydrated(true);
    };

    init();
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !legacyAppStateSyncEnabled || !isHydrated) return;

    const interval = setInterval(async () => {
      const remote = await fetchRemoteAppState();
      const payload = remote?.payload as Partial<AppData> | undefined;
      if (!payload) return;

      const current = JSON.stringify(dataRef.current);
      const nextData = hydrateData(payload);
      const next = JSON.stringify(nextData);
      if (current !== next) {
        setData(nextData);
        dataRef.current = nextData;
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isHydrated]);

  useEffect(() => {
    if (
      !hasSupabaseConfig ||
      !tableSchemaSyncEnabled ||
      !supabase ||
      !isHydrated
    )
      return;

    const syncOnResume = () => {
      if (document.visibilityState === "visible") {
        // Use 'poll' so the skipRemoteRefresh timer is respected after saves.
        scheduleRemoteRefresh("poll");
      }
    };

    const syncOnFocus = () => {
      scheduleRemoteRefresh("poll");
    };

    const syncOnOnline = () => {
      scheduleRemoteRefresh("poll");
    };

    document.addEventListener("visibilitychange", syncOnResume);
    window.addEventListener("focus", syncOnFocus);
    window.addEventListener("online", syncOnOnline);

    const supabaseClient = supabase;

    const realtimeTables = [
      "players",
      "microcycles",
      "daily_wellness",
      "daily_internal_loads",
      "daily_external_loads",
      "training_sessions",
      "competition_matches",
      "competition_players",
      "nutrition_records",
      "cmj_records",
      "neuromuscular_records",
      "fms_records",
      "medical_notes",
      "strength_sessions",
    ];

    let channel = supabaseClient.channel("orsomarso-v99-live-sync");
    realtimeTables.forEach((table) => {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => scheduleRemoteRefresh("realtime"),
      );
    });

    channel.subscribe();

    const interval = setInterval(() => {
      const shouldPoll = Date.now() - lastRemotePullRef.current > 12000;
      if (shouldPoll) scheduleRemoteRefresh("poll");
    }, 15000);

    return () => {
      document.removeEventListener("visibilitychange", syncOnResume);
      window.removeEventListener("focus", syncOnFocus);
      window.removeEventListener("online", syncOnOnline);
      if (remoteRefreshTimerRef.current)
        clearTimeout(remoteRefreshTimerRef.current);
      clearInterval(interval);
      void supabaseClient.removeChannel(channel);
    };
  }, [isHydrated]);

  // Fix #14: Detectar expiración de sesión Supabase mientras la pestaña está abierta.
  // Si el token expira o se cierra sesión desde otro lado, mostrar aviso y redirigir.
  useEffect(() => {
    if (!supabase || !hasSupabaseConfig) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        if (event === "SIGNED_OUT") {
          setSyncStatus("error");
          if (typeof window !== "undefined") {
            setTimeout(() => window.location.assign("/login"), 1200);
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const forceSync = async () => {
    if (!hasSupabaseConfig) return;
    setSyncStatus("syncing");
    if (tableSchemaSyncEnabled && supabase) {
      await refreshFromSupabase("manual");
      return;
    }

    const remote = await fetchRemoteAppState();
    const payload = remote?.payload as Partial<AppData> | undefined;
    if (payload) {
      const next = hydrateData(payload);
      setData(next);
      dataRef.current = next;
    }
    setSyncStatus("ready");
  };

  const pushLocalToRemote = async () => {
    if (!hasSupabaseConfig) return;
    setSyncStatus("syncing");
    if (tableSchemaSyncEnabled && supabase) {
      const session = sessionRef.current;
      const scopedData = filterAppDataForSession(dataRef.current, session);
      const result = await saveSupabaseTablesAppData(supabase, scopedData);
      setSyncStatus(result.ok ? "ready" : "error");
      return;
    }
    if (legacyAppStateSyncEnabled) {
      const result = await saveRemoteAppState(dataRef.current);
      setSyncStatus(result.ok ? "ready" : "error");
      return;
    }
    setSyncStatus("ready");
  };

  const createLocalSnapshot = (label = "Copia manual") => {
    createLocalBackup(dataRef.current, label, "manual");
    setLocalBackups(listLocalBackups());
  };

  const clearLocalSnapshots = () => {
    clearLocalBackups();
    setLocalBackups([]);
    setSyncStatus("ready");
  };

  const deleteLocalBackupById = (backupId: string): boolean => {
    const ok = deleteLocalBackup(backupId);
    if (ok) setLocalBackups(listLocalBackups());
    return ok;
  };

  const clearAllAutoBackups = (): number => {
    const removed = clearAutoBackups();
    setLocalBackups(listLocalBackups());
    return removed;
  };

  const restoreLocalSnapshot = (backupId: string) => {
    const payload = getLocalBackupPayload(backupId);
    if (!payload) return false;

    createLocalBackup(
      dataRef.current,
      "Copia antes de restaurar respaldo",
      "restore",
    );
    const next = hydrateData(payload);
    setData(next);
    dataRef.current = next;
    saveLocalAppData(next);
    setLocalBackups(listLocalBackups());
    setSyncStatus("ready");
    return true;
  };

  const importAppDataJson = (rawJson: string) => {
    try {
      const parsed = JSON.parse(rawJson) as Partial<AppData>;

      // FIX #9: Validación básica del JSON importado antes de aplicarlo.
      // Si el JSON no tiene ninguna de las claves esperadas de AppData,
      // se rechaza para evitar cargar datos corruptos silenciosamente.
      const knownKeys: (keyof AppData)[] = [
        "players",
        "wellness",
        "internalLoads",
        "externalLoads",
        "microcycles",
        "trainingSessionSummaries",
        "competitionMatchSummaries",
      ];
      const hasAnyKnownKey = knownKeys.some((key) =>
        Array.isArray(parsed[key]),
      );
      if (!hasAnyKnownKey) {
        console.warn(
          "[Orsomarso] JSON importado no contiene datos reconocidos de AppData.",
        );
        setSyncStatus("error");
        return false;
      }

      createLocalBackup(
        dataRef.current,
        "Copia antes de importar JSON",
        "import",
      );
      const next = hydrateData(parsed);
      setData(next);
      dataRef.current = next;
      saveLocalAppData(next);
      setLocalBackups(listLocalBackups());
      setSyncStatus("ready");
      return true;
    } catch {
      setSyncStatus("error");
      return false;
    }
  };

  const exportAppDataJson = () => JSON.stringify(dataRef.current, null, 2);

  const setFilters = (next: Partial<GlobalFilters>) =>
    setFiltersState((prev) => {
      const session = sessionRef.current;
      const allowedCategory = getAllowedCategory(session);
      const merged = { ...prev, ...next };
      const microcycles = dataRef.current.microcycles;

      if (!isMasterRole(session)) {
        merged.category = allowedCategory;
      }

      const activeCategory = merged.category || allowedCategory;
      const scopedMicrocycles = getMicrocyclesForCategory(
        microcycles,
        activeCategory,
      );
      const selected = microcycles.find(
        (item) => item.id === merged.microcycleId,
      );
      const categoryChanged =
        next.category !== undefined && next.category !== prev.category;

      if (
        categoryChanged ||
        (selected && !microcycleBelongsToCategory(selected, activeCategory))
      ) {
        const detected = merged.date
          ? findMicrocycleByDate(
              microcycles,
              merged.date,
              undefined,
              activeCategory,
            )
          : undefined;
        const fallback = detected ?? scopedMicrocycles[0];
        if (fallback) merged.microcycleId = fallback.id;
      }

      if (next.microcycleId !== undefined) {
        const current = microcycles.find(
          (item) => item.id === next.microcycleId,
        );
        if (current?.startDate && current?.endDate) {
          const currentDate = merged.date;
          if (
            !currentDate ||
            currentDate < current.startDate ||
            currentDate > current.endDate
          ) {
            merged.date = current.startDate;
          }
        } else if (current && next.date === undefined) {
          merged.date = "";
        }
      }

      if (next.date !== undefined && next.date) {
        const detected = findMicrocycleByDate(
          microcycles,
          next.date,
          merged.microcycleId,
          activeCategory,
        );
        if (detected) merged.microcycleId = detected.id;
      }

      return merged;
    });

  const resetFilters = () => {
    const session = sessionRef.current;
    const category = getAllowedCategory(session);
    const activeCategory = isMasterRole(session) ? "all" : category;
    const nextDefaults = getDefaultFilters();
    const detected = findMicrocycleByDate(
      dataRef.current.microcycles,
      nextDefaults.date,
      undefined,
      activeCategory,
    );
    const fallbackMicrocycle =
      detected ??
      getMicrocyclesForCategory(
        dataRef.current.microcycles,
        activeCategory,
      )[0] ??
      dataRef.current.microcycles[0];
    setFiltersState({
      ...nextDefaults,
      category: activeCategory,
      microcycleId: fallbackMicrocycle?.id ?? "",
    });
  };

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      filters,
      setFilters,
      resetFilters,
      // FIX #3: isLoading derivado de isHydrated — true mientras los datos aún no cargaron
      isLoading: !isHydrated,
      addPlayer: (player) =>
        applyMutation((prev) => {
          const normalizedName = player.name.trim().toLowerCase();
          const normalizedPlayer = {
            ...player,
            category: player.category ?? DEFAULT_CATEGORY,
            categoryHistory: Array.from(
              new Set([
                ...(player.categoryHistory ?? []),
                player.category ?? DEFAULT_CATEGORY,
              ]),
            ),
          };
          const exists = prev.players.find(
            (item) =>
              item.id === normalizedPlayer.id ||
              item.name.trim().toLowerCase() === normalizedName,
          );
          const nextPlayers = exists
            ? prev.players.map((item) =>
                item.id === exists.id
                  ? {
                      ...item,
                      ...normalizedPlayer,
                      id: exists.id,
                      categoryHistory: Array.from(
                        new Set([
                          ...(item.categoryHistory ?? []),
                          ...(normalizedPlayer.categoryHistory ?? []),
                          normalizedPlayer.category ?? DEFAULT_CATEGORY,
                        ]),
                      ),
                    }
                  : item,
              )
            : [normalizedPlayer, ...prev.players];
          return {
            ...prev,
            players: nextPlayers.sort((a, b) => a.name.localeCompare(b.name)),
          };
        }),
      updatePlayer: (player) =>
        applyMutation(
          (prev) => ({
            ...prev,
            players: prev.players
              .map((item) =>
                item.id === player.id
                  ? {
                      ...player,
                      category:
                        player.category ?? item.category ?? DEFAULT_CATEGORY,
                      categoryHistory: Array.from(
                        new Set([
                          ...(item.categoryHistory ?? []),
                          ...(player.categoryHistory ?? []),
                          player.category ?? item.category ?? DEFAULT_CATEGORY,
                        ]),
                      ),
                    }
                  : item,
              )
              .sort((a, b) => a.name.localeCompare(b.name)),
          }),
          "players",
          { playerIds: [player.id] },
        ),
      deletePlayer: (playerId) => {
        const session = sessionRef.current;
        const player = dataRef.current.players.find(
          (item) => item.id === playerId,
        );
        if (!canDeletePlayer(session, player)) {
          setSyncStatus("error");
          return;
        }
        applyMutation((prev) => ({
          ...prev,
          players: prev.players.filter((p) => p.id !== playerId),
          wellness: prev.wellness.filter((x) => x.playerId !== playerId),
          internalLoads: prev.internalLoads.filter(
            (x) => x.playerId !== playerId,
          ),
          externalLoads: prev.externalLoads.filter(
            (x) => x.playerId !== playerId,
          ),
          cmjRecords: prev.cmjRecords.filter((x) => x.playerId !== playerId),
          nutritionRecords: prev.nutritionRecords.filter(
            (x) => x.playerId !== playerId,
          ),
          neuromuscularRecords: prev.neuromuscularRecords.filter(
            (x) => x.playerId !== playerId,
          ),
          fmsRecords: prev.fmsRecords.filter((x) => x.playerId !== playerId),
          competitionRecords: prev.competitionRecords.filter(
            (x) => x.playerId !== playerId,
          ),
          strengthSessions: (prev.strengthSessions ?? []).map((session) => ({
            ...session,
            playerIds: session.playerIds.filter((id) => id !== playerId),
            excludedPlayerIds: session.excludedPlayerIds?.filter(
              (id) => id !== playerId,
            ),
            adjustments: session.adjustments?.filter(
              (item) => item.playerId !== playerId,
            ),
            responses: session.responses?.filter(
              (item) => item.playerId !== playerId,
            ),
          })),
        }));
        // FIX #4: Borrar también los registros hijo del jugador en Supabase.
        // Antes solo se borraba el jugador, dejando registros huérfanos en la BD.
        // Nota: si tus tablas en Supabase tienen ON DELETE CASCADE configurado,
        // estas llamadas son redundantes pero inofensivas. Si no lo tienen,
        // son necesarias para mantener la consistencia.
        void deleteRemoteLegacy("players", playerId);
        const current = dataRef.current;
        current.wellness
          .filter((x) => x.playerId === playerId)
          .forEach((x) => {
            void deleteRemoteLegacy("daily_wellness", x.id);
          });
        current.internalLoads
          .filter((x) => x.playerId === playerId)
          .forEach((x) => {
            void deleteRemoteLegacy("daily_internal_loads", x.id);
          });
        current.externalLoads
          .filter((x) => x.playerId === playerId)
          .forEach((x) => {
            void deleteRemoteLegacy("daily_external_loads", x.id);
          });
        current.cmjRecords
          .filter((x) => x.playerId === playerId)
          .forEach((x) => {
            void deleteRemoteLegacy("cmj_records", x.id);
          });
        current.nutritionRecords
          .filter((x) => x.playerId === playerId)
          .forEach((x) => {
            void deleteRemoteLegacy("nutrition_records", x.id);
          });
        current.neuromuscularRecords
          .filter((x) => x.playerId === playerId)
          .forEach((x) => {
            void deleteRemoteLegacy("neuromuscular_records", x.id);
          });
        current.fmsRecords
          .filter((x) => x.playerId === playerId)
          .forEach((x) => {
            void deleteRemoteLegacy("fms_records", x.id);
          });
        current.competitionRecords
          .filter((x) => x.playerId === playerId)
          .forEach((x) => {
            void deleteRemoteLegacy("competition_players", x.id);
          });
      },
      addWellness: (record) =>
        applyMutation((prev) => ({
          ...prev,
          wellness: [record, ...prev.wellness],
        })),
      upsertWellness: (record) =>
        applyMutation((prev) => ({
          ...prev,
          wellness: [
            record,
            ...prev.wellness.filter(
              (item) =>
                !(
                  item.playerId === record.playerId && item.date === record.date
                ),
            ),
          ],
        })),
      addInternalLoad: (record) =>
        applyMutation((prev) => ({
          ...prev,
          internalLoads: [record, ...prev.internalLoads],
        })),
      upsertInternalLoad: (record) =>
        applyMutation((prev) => {
          const normalizedRecord = {
            ...record,
            microcycleId: record.microcycleId ?? filters.microcycleId,
            sessionNumber: record.sessionNumber ?? filters.sessionNumber,
          };
          return {
            ...prev,
            internalLoads: [
              normalizedRecord,
              ...prev.internalLoads.filter((item) => {
                const sameId = item.id === normalizedRecord.id;
                const sameSessionPlayer =
                  !!normalizedRecord.sessionId &&
                  item.sessionId === normalizedRecord.sessionId &&
                  item.playerId === normalizedRecord.playerId;
                const sameDatePlayerSession =
                  item.playerId === normalizedRecord.playerId &&
                  item.date === normalizedRecord.date &&
                  (item.category ?? item.actingCategory) ===
                    (normalizedRecord.category ??
                      normalizedRecord.actingCategory) &&
                  (item.sessionNumber ?? filters.sessionNumber) ===
                    (normalizedRecord.sessionNumber ?? filters.sessionNumber);
                return !(sameId || sameSessionPlayer || sameDatePlayerSession);
              }),
            ],
          };
        }),
      updateInternalLoad: (record) =>
        applyMutation((prev) => ({
          ...prev,
          internalLoads: prev.internalLoads.map((item) =>
            item.id === record.id ? record : item,
          ),
        })),
      deleteInternalLoad: (recordId) => {
        applyMutation((prev) => ({
          ...prev,
          internalLoads: prev.internalLoads.filter(
            (item) => item.id !== recordId,
          ),
        }));
        void deleteRemoteLegacy("daily_internal_loads", recordId);
      },
      addExternalLoad: (record) =>
        applyMutation((prev) => ({
          ...prev,
          externalLoads: [
            {
              ...record,
              microcycleId: record.microcycleId ?? filters.microcycleId,
              sessionNumber: record.sessionNumber ?? filters.sessionNumber,
              sessionType: record.sessionType ?? "MD-3",
              participation: record.participation ?? "Completa",
            },
            ...prev.externalLoads,
          ],
        })),
      updateExternalLoad: (record) =>
        applyMutation((prev) => ({
          ...prev,
          externalLoads: prev.externalLoads.map((item) =>
            item.id === record.id ? record : item,
          ),
        })),
      deleteExternalLoad: (recordId) => {
        applyMutation((prev) => ({
          ...prev,
          externalLoads: prev.externalLoads.filter(
            (item) => item.id !== recordId,
          ),
        }));
        void deleteRemoteLegacy("daily_external_loads", recordId);
      },

      // FIX #1: addCMJRecord ahora es un upsert — evita duplicados por jugador+fecha.
      // Antes hacía [record, ...prev] sin filtrar, creando registros repetidos
      // si el usuario guardaba dos veces en el mismo día.
      addCMJRecord: (record) =>
        applyMutation(
          (prev) => ({
            ...prev,
            cmjRecords: [
              record,
              ...prev.cmjRecords.filter(
                (item) =>
                  !(
                    item.id !== record.id &&
                    item.playerId === record.playerId &&
                    item.date === record.date
                  ),
              ),
            ],
          }),
          "evaluations",
        ),
      updateCMJRecord: (record) =>
        applyMutation(
          (prev) => ({
            ...prev,
            cmjRecords: prev.cmjRecords.map((item) =>
              item.id === record.id ? record : item,
            ),
          }),
          "evaluations",
        ),
      deleteCMJRecord: (recordId) => {
        applyMutation(
          (prev) => ({
            ...prev,
            cmjRecords: prev.cmjRecords.filter((item) => item.id !== recordId),
          }),
          "evaluations",
        );
        void deleteRemoteLegacy("cmj_records", recordId);
      },

      // FIX #1: addNutritionRecord ahora es un upsert — evita duplicados por jugador+fecha.
      addNutritionRecord: (record) =>
        applyMutation(
          (prev) => ({
            ...prev,
            nutritionRecords: [
              record,
              ...prev.nutritionRecords.filter(
                (item) =>
                  !(
                    item.id !== record.id &&
                    item.playerId === record.playerId &&
                    item.date === record.date
                  ),
              ),
            ],
          }),
          "evaluations",
        ),
      updateNutritionRecord: (record) =>
        applyMutation(
          (prev) => ({
            ...prev,
            nutritionRecords: prev.nutritionRecords.map((item) =>
              item.id === record.id ? record : item,
            ),
          }),
          "evaluations",
        ),
      deleteNutritionRecord: (recordId) => {
        applyMutation(
          (prev) => ({
            ...prev,
            nutritionRecords: prev.nutritionRecords.filter(
              (item) => item.id !== recordId,
            ),
          }),
          "evaluations",
        );
        void deleteRemoteLegacy("nutrition_records", recordId);
      },

      // FIX #1: addNeuromuscularRecord ahora es un upsert — evita duplicados por jugador+fecha.
      addNeuromuscularRecord: (record) =>
        applyMutation(
          (prev) => ({
            ...prev,
            neuromuscularRecords: [
              record,
              ...prev.neuromuscularRecords.filter(
                (item) =>
                  !(
                    item.id !== record.id &&
                    item.playerId === record.playerId &&
                    item.date === record.date
                  ),
              ),
            ],
          }),
          "evaluations",
        ),
      updateNeuromuscularRecord: (record) =>
        applyMutation(
          (prev) => ({
            ...prev,
            neuromuscularRecords: prev.neuromuscularRecords.map((item) =>
              item.id === record.id ? record : item,
            ),
          }),
          "evaluations",
        ),
      deleteNeuromuscularRecord: (recordId) => {
        applyMutation(
          (prev) => ({
            ...prev,
            neuromuscularRecords: prev.neuromuscularRecords.filter(
              (item) => item.id !== recordId,
            ),
          }),
          "evaluations",
        );
        void deleteRemoteLegacy("neuromuscular_records", recordId);
      },

      // FIX #1: addFMSRecord ahora es un upsert — evita duplicados por jugador+fecha.
      addFMSRecord: (record) =>
        applyMutation(
          (prev) => ({
            ...prev,
            fmsRecords: [
              record,
              ...prev.fmsRecords.filter(
                (item) =>
                  !(
                    item.id !== record.id &&
                    item.playerId === record.playerId &&
                    item.date === record.date
                  ),
              ),
            ],
          }),
          "evaluations",
        ),
      updateFMSRecord: (record) =>
        applyMutation(
          (prev) => ({
            ...prev,
            fmsRecords: prev.fmsRecords.map((item) =>
              item.id === record.id ? record : item,
            ),
          }),
          "evaluations",
        ),
      deleteFMSRecord: (recordId) => {
        applyMutation(
          (prev) => ({
            ...prev,
            fmsRecords: prev.fmsRecords.filter((item) => item.id !== recordId),
          }),
          "evaluations",
        );
        void deleteRemoteLegacy("fms_records", recordId);
      },
      addCompetitionRecord: (record) =>
        applyMutation((prev) => ({
          ...prev,
          competitionRecords: [
            record,
            ...prev.competitionRecords.filter(
              (item) =>
                !(
                  item.id === record.id ||
                  (item.matchId === record.matchId &&
                    item.playerId === record.playerId)
                ),
            ),
          ],
        }), 'competition'),
      updateCompetitionRecord: (record) =>
        applyMutation((prev) => ({
          ...prev,
          competitionRecords: prev.competitionRecords.map((item) =>
            item.id === record.id ? record : item,
          ),
        }), 'competition'),
      deleteCompetitionRecord: (recordId) => {
        const currentRecord = dataRef.current.competitionRecords.find((item) => item.id === recordId);
        applyMutation((prev) => ({
          ...prev,
          competitionRecords: prev.competitionRecords.filter(
            (item) => item.id !== recordId,
          ),
          externalLoads: prev.externalLoads.filter(
            (item) => item.id !== `comp-load-${currentRecord?.matchId ?? ''}-${currentRecord?.playerId ?? ''}`,
          ),
        }), 'competition');
        void deleteRemoteLegacy("competition_players", recordId);
      },
      upsertCompetitionMatchSummary: (record) =>
        applyMutation((prev) => ({
          ...prev,
          competitionMatchSummaries: [
            record,
            ...prev.competitionMatchSummaries.filter(
              (item) =>
                !(
                  item.id === record.id ||
                  (item.date === record.date &&
                    item.category === record.category &&
                    item.opponent.trim().toLowerCase() ===
                      record.opponent.trim().toLowerCase())
                ),
            ),
          ],
        }), 'competition'),

      // Guarda el partido y toda su planilla en una sola mutacion.
      // Evita que Supabase devuelva primero solo el encabezado del partido
      // y la UI pierda temporalmente los jugadores/GPS al refrescar.
      saveCompetitionMatchBundle: (record, records) =>
        applyMutation((prev) => {
          const sameMatch = (item: CompetitionRecord) => {
            if (item.matchId === record.id) return true;
            return (
              item.date === record.date &&
              item.category === record.category &&
              item.opponent.trim().toLowerCase() ===
                record.opponent.trim().toLowerCase()
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
            return item.sessionId === record.id || (item.date === record.date && normalizedRecords.some((row) => row.playerId === item.playerId));
          };
          return {
            ...prev,
            competitionMatchSummaries: [
              record,
              ...prev.competitionMatchSummaries.filter(
                (item) =>
                  !(
                    item.id === record.id ||
                    (item.date === record.date &&
                      item.category === record.category &&
                      item.opponent.trim().toLowerCase() ===
                        record.opponent.trim().toLowerCase())
                  ),
              ),
            ],
            competitionRecords: [
              ...normalizedRecords,
              ...prev.competitionRecords.filter((item) => !sameMatch(item)),
            ],
            externalLoads: [
              ...competitionExternalLoads,
              ...prev.externalLoads.filter((item) => !sameCompetitionLoad(item)),
            ],
          };
        }, 'competition'),
      deleteCompetitionMatchSummary: (matchId) => {
        applyMutation((prev) => ({
          ...prev,
          competitionMatchSummaries: prev.competitionMatchSummaries.filter(
            (item) => item.id !== matchId,
          ),
          competitionRecords: prev.competitionRecords.filter(
            (item) => item.matchId !== matchId,
          ),
          externalLoads: prev.externalLoads.filter(
            (item) => !(item.sessionId === matchId && (item.movementModule === 'competencia' || item.id.startsWith('comp-load-'))),
          ),
        }), 'competition');
        void deleteRemoteLegacy("competition_matches", matchId);
      },

      // FIX #7: upsertTrainingSessionSummary ahora respeta el sessionNumber al deduplicar.
      // Antes filtraba solo por date+category, borrando cualquier sesión de ese día/categoría
      // aunque fuera una sesión distinta (ej: doble jornada con sessionNumber diferente).
      upsertTrainingSessionSummary: (record) =>
        applyMutation((prev) => ({
          ...prev,
          trainingSessionSummaries: [
            record,
            ...prev.trainingSessionSummaries.filter(
              (item) =>
                !(
                  item.id === record.id ||
                  (item.date === record.date &&
                    item.category === record.category &&
                    item.sessionNumber === record.sessionNumber)
                ),
            ),
          ],
        })),

      // Guarda una sesion completa en una sola mutacion local/remota.
      // Evita que Supabase reciba primero solo el encabezado de la sesion
      // y despues se pierdan las cargas por carreras de sincronizacion.
      saveTrainingSessionBundle: (record, externalLoads, internalLoads) =>
        applyMutation((prev) => {
          const matchesSession = (item: {
            sessionId?: string;
            date: string;
            category?: string;
            actingCategory?: string;
            sessionNumber?: number;
          }) => {
            if (item.sessionId === record.id) return true;
            return (
              item.date === record.date &&
              (item.category ?? item.actingCategory) === record.category &&
              (item.sessionNumber ?? record.sessionNumber) ===
                record.sessionNumber
            );
          };

          return {
            ...prev,
            trainingSessionSummaries: [
              record,
              ...prev.trainingSessionSummaries.filter(
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
              ...prev.externalLoads.filter((item) => !matchesSession(item)),
            ],
            internalLoads: [
              ...internalLoads,
              ...prev.internalLoads.filter((item) => !matchesSession(item)),
            ],
          };
        }),
      deleteTrainingSessionSummary: (sessionId) => {
        const current = dataRef.current;
        const target = current.trainingSessionSummaries.find(
          (item) => item.id === sessionId,
        );
        const matchesSession = (item: {
          sessionId?: string;
          date: string;
          category?: string;
          actingCategory?: string;
          sessionNumber?: number;
        }) => {
          if (item.sessionId === sessionId) return true;
          if (!target) return false;
          return (
            item.date === target.date &&
            (item.category ?? item.actingCategory) === target.category &&
            (item.sessionNumber ?? target.sessionNumber) ===
              target.sessionNumber
          );
        };
        applyMutation((prev) => ({
          ...prev,
          trainingSessionSummaries: prev.trainingSessionSummaries.filter(
            (item) => item.id !== sessionId,
          ),
          externalLoads: prev.externalLoads.filter(
            (item) => !matchesSession(item),
          ),
          internalLoads: prev.internalLoads.filter(
            (item) => !matchesSession(item),
          ),
        }));
        if (target && hasSupabaseConfig && tableSchemaSyncEnabled && supabase) {
          const blockUntil = Date.now() + 30000;
          if (blockUntil > skipRemoteRefreshUntilRef.current)
            skipRemoteRefreshUntilRef.current = blockUntil;
          void deleteSupabaseTrainingSessionCascade(supabase, {
            legacyId: sessionId,
            date: target.date,
            category: target.category,
            sessionNumber: target.sessionNumber,
          }).then((result) => {
            setSyncStatus(result.ok ? "ready" : "error");
            const postBlock = Date.now() + 20000;
            if (postBlock > skipRemoteRefreshUntilRef.current)
              skipRemoteRefreshUntilRef.current = postBlock;
          });
        } else {
          void deleteRemoteLegacy("training_sessions", sessionId);
          current.externalLoads
            .filter((item) => matchesSession(item))
            .forEach((item) => {
              void deleteRemoteLegacy("daily_external_loads", item.id);
            });
          current.internalLoads
            .filter((item) => matchesSession(item))
            .forEach((item) => {
              void deleteRemoteLegacy("daily_internal_loads", item.id);
            });
        }
      },
      upsertStrengthSession: (record) =>
        applyMutation((prev) => ({
          ...prev,
          strengthSessions: [
            record,
            ...(prev.strengthSessions ?? []).filter(
              (item) => item.id !== record.id,
            ),
          ],
        })),
      updateStrengthResponse: (sessionId, response) =>
        applyMutation((prev) => ({
          ...prev,
          strengthSessions: (prev.strengthSessions ?? []).map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  status: "En respuestas",
                  responses: [
                    response,
                    ...(session.responses ?? []).filter(
                      (item) => item.playerId !== response.playerId,
                    ),
                  ],
                }
              : session,
          ),
        })),
      deleteStrengthSession: (sessionId) => {
        const current = dataRef.current;
        const target = (current.strengthSessions ?? []).find(
          (item) => item.id === sessionId,
        );
        applyMutation((prev) => ({
          ...prev,
          strengthSessions: (prev.strengthSessions ?? []).filter(
            (item) => item.id !== sessionId,
          ),
        }));
        if (target) {
          void deleteRemoteLegacy("strength_sessions", sessionId);
        }
      },
      updateMicrocycle: (record) => {
        const normalizedRecord = {
          ...record,
          category:
            record.category ??
            (filters.category === "all" ? "Sub20" : (filters.category as any)),
        };
        applyMutation((prev) => {
          const duplicated = findOverlappingMicrocycle(
            prev.microcycles,
            normalizedRecord,
          );
          if (duplicated) return prev;
          return {
            ...prev,
            microcycles: prev.microcycles.some(
              (item) => item.id === normalizedRecord.id,
            )
              ? prev.microcycles.map((item) =>
                  item.id === normalizedRecord.id
                    ? { ...item, ...normalizedRecord }
                    : item,
                )
              : [...prev.microcycles, normalizedRecord].sort((a, b) =>
                  (a.startDate || a.id).localeCompare(b.startDate || b.id),
                ),
          };
        });

        if (normalizedRecord.id === filters.microcycleId) {
          setFiltersState((prev) => {
            if (normalizedRecord.startDate && normalizedRecord.endDate) {
              if (
                prev.date >= normalizedRecord.startDate &&
                prev.date <= normalizedRecord.endDate
              )
                return { ...prev, microcycleId: normalizedRecord.id };
              return {
                ...prev,
                date: normalizedRecord.startDate,
                microcycleId: normalizedRecord.id,
              };
            }

            return { ...prev, date: "", microcycleId: normalizedRecord.id };
          });
        }
      },
      deleteMicrocycle: (microcycleId) => {
        const microcycle = dataRef.current.microcycles.find(
          (item) => item.id === microcycleId,
        );
        if (!microcycle) return;

        // FIX #5: Al borrar un microciclo, persistir en Supabase el cambio en los registros hijo.
        // Antes solo se actualizaba localmente (microcycleId → ""), pero esa actualización
        // nunca se enviaba a Supabase. En el próximo sync, los registros hijo volvían a
        // apuntar al microciclo borrado. Ahora se llama persistData explícitamente
        // después de la mutación para asegurar que Supabase recibe el estado actualizado.
        applyMutation((prev) => ({
          ...prev,
          microcycles: prev.microcycles.filter(
            (item) => item.id !== microcycleId,
          ),
          trainingSessionSummaries: prev.trainingSessionSummaries.map((item) =>
            item.microcycleId === microcycleId
              ? { ...item, microcycleId: "" }
              : item,
          ),
          internalLoads: prev.internalLoads.map((item) =>
            item.microcycleId === microcycleId
              ? { ...item, microcycleId: "" }
              : item,
          ),
          externalLoads: prev.externalLoads.map((item) =>
            item.microcycleId === microcycleId
              ? { ...item, microcycleId: "" }
              : item,
          ),
        }));
        // La llamada a applyMutation ya llama a persistData internamente,
        // por lo que los registros hijo con microcycleId="" quedan guardados en Supabase.
        void deleteRemoteLegacy("microcycles", microcycleId);
        if (filters.microcycleId === microcycleId) {
          const fallback = dataRef.current.microcycles.find(
            (item) =>
              item.id !== microcycleId && item.category === microcycle.category,
          );
          setFiltersState((prev) => ({
            ...prev,
            microcycleId: fallback?.id ?? "",
          }));
        }
      },
      backendMode,
      syncStatus,
      localBackups,
      createLocalSnapshot,
      clearLocalSnapshots,
      deleteLocalBackupById,
      clearAllAutoBackups,
      restoreLocalSnapshot,
      importAppDataJson,
      exportAppDataJson,
      forceSync,
      pushLocalToRemote,
      canEdit,
      permissionMessage,
    }),
    [
      data,
      filters,
      backendMode,
      syncStatus,
      isHydrated,
      localBackups,
      canEdit,
      permissionMessage,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
