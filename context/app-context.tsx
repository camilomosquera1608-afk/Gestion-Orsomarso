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
import {
  recoverCompetitionData,
  hasAvailableBackups,
  emergencyClearLocalStorage,
} from "@/lib/app-storage";
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
import {
  addExternalLoad as commandAddExternalLoad,
  addInternalLoad as commandAddInternalLoad,
  addWellness as commandAddWellness,
  deleteCMJRecord as commandDeleteCMJRecord,
  deleteExternalLoad as commandDeleteExternalLoad,
  deleteFMSRecord as commandDeleteFMSRecord,
  deleteNeuromuscularRecord as commandDeleteNeuromuscularRecord,
  deleteNutritionRecord as commandDeleteNutritionRecord,
  saveCompetitionMatchBundle as commandSaveCompetitionMatchBundle,
  saveTrainingSessionBundle as commandSaveTrainingSessionBundle,
  updateCMJRecord as commandUpdateCMJRecord,
  updateExternalLoad as commandUpdateExternalLoad,
  updateFMSRecord as commandUpdateFMSRecord,
  updateMicrocycleInData,
  updateNeuromuscularRecord as commandUpdateNeuromuscularRecord,
  updateNutritionRecord as commandUpdateNutritionRecord,
  upsertCMJRecord as commandUpsertCMJRecord,
  upsertCompetitionMatchSummary as commandUpsertCompetitionMatchSummary,
  upsertFMSRecord as commandUpsertFMSRecord,
  upsertInternalLoad as commandUpsertInternalLoad,
  upsertNeuromuscularRecord as commandUpsertNeuromuscularRecord,
  upsertNutritionRecord as commandUpsertNutritionRecord,
  upsertTrainingSessionSummary as commandUpsertTrainingSessionSummary,
  upsertWellness as commandUpsertWellness,
} from "@/lib/domain-commands";
import {
  computeSyncMergeConflicts,
  type SyncMergeConflictNote,
} from "@/lib/sync-merge-summary";
import { todayInputDate } from "@/lib/dates";
import {
  normalizeSharedDataLinks,
  recordMatchesTrainingSession,
} from "@/lib/relational-data";
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
  writeValidationMessage: string | null;
  clearWriteValidationMessage: () => void;
  syncMergeConflicts: SyncMergeConflictNote[];
  // FIX: Emergency recovery functions
  recoverCompetitionData: () => { recovered: boolean; message: string; data?: Partial<AppData> };
  hasAvailableBackups: () => { hasBackups: boolean; count: number; details: string };
  emergencyClearLocalStorage: () => { cleared: boolean; message: string };
}

const getDefaultFilters = (): GlobalFilters => ({
  date: todayInputDate(),
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
  normalizeSharedDataLinks(normalizeAppData(stored, initialData));

const isMeaningfulValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
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

const isPlainObjectRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const mergeByKeys = <T extends Record<string, unknown>>(
  remote: T[] | undefined,
  local: T[] | undefined,
  keyFns: Array<(item: T) => string | null | undefined>,
): T[] => {
  const remoteRows = (Array.isArray(remote) ? remote : []).filter(
    isPlainObjectRecord,
  ) as T[];
  const localRows = (Array.isArray(local) ? local : []).filter(
    isPlainObjectRecord,
  ) as T[];
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
    (local?.length ? remote : local) as unknown as
      | Record<string, unknown>[]
      | undefined,
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
    (local?.length ? remote : local) as unknown as
      | Record<string, unknown>[]
      | undefined,
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
      if (isMeaningfulValue(value) || !isMeaningfulValue(merged[key]))
        merged[key] = value;
    });
    byId.set(item.id, merged as T);
  });
  return Array.from(byId.values());
};

const normalizePlayerMergeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const playerMergeKeys = (player: Player) =>
  [
    player.id ? `id:${player.id}` : "",
    player.documentId
      ? `doc:${normalizePlayerMergeText(player.documentId)}`
      : "",
    player.name
      ? `name:${normalizePlayerMergeText(player.category)}:${normalizePlayerMergeText(player.name)}`
      : "",
  ].filter(Boolean);

const mergePlayersPreferLocal = (
  remote: Player[] | undefined,
  local: Player[] | undefined,
): Player[] => {
  const rows = [
    ...(Array.isArray(remote) ? remote : []),
    ...(Array.isArray(local) ? local : []),
  ];
  const groups = new Map<string, Player>();
  const aliases = new Map<string, string>();

  rows.forEach((player) => {
    if (!player?.id) return;
    const keys = playerMergeKeys(player);
    const groupKey =
      keys.map((key) => aliases.get(key)).find(Boolean) ??
      keys[0] ??
      `id:${player.id}`;
    const existing = groups.get(groupKey);
    const merged = existing
      ? (mergeObjectWithLocalFallback(
          player as unknown as Record<string, unknown>,
          existing as unknown as Record<string, unknown>,
        ) as unknown as Player)
      : player;
    groups.set(groupKey, merged);
    keys.forEach((key) => aliases.set(key, groupKey));
  });

  return Array.from(groups.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<AppData>(initialData);
  const [filters, setFiltersState] = useState<GlobalFilters>(defaultFilters);
  const [isHydrated, setIsHydrated] = useState(false);
  const [writeValidationMessage, setWriteValidationMessage] = useState<string | null>(null);
  const [syncMergeConflicts, setSyncMergeConflicts] = useState<SyncMergeConflictNote[]>([]);
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
    const remote = await Promise.race([
      fetchSupabaseTablesAppData(supabase),
      new Promise<{ ok: false; reason: string }>((resolve) =>
        setTimeout(
          () => resolve({ ok: false, reason: `timeout-${source}` }),
          source === "manual" ? 9000 : 6500,
        ),
      ),
    ]);
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
      players: mergePlayersPreferLocal(remoteHydrated.players, current.players),
    };

    const normalizedNext = normalizeSharedDataLinks(next);
    setSyncMergeConflicts(computeSyncMergeConflicts(remoteHydrated, current));
    const currentSnapshot = JSON.stringify(dataRef.current);
    const nextSnapshot = JSON.stringify(normalizedNext);
    if (currentSnapshot !== nextSnapshot) {
      setData(normalizedNext);
      dataRef.current = normalizedNext;
      saveLocalAppData(normalizedNext);
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
    // FIX: Always save local first as primary backup
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
      // Local-first: los guardados pequeños no deben bloquear la interfaz ni
      // dejar visible el estado "sincronizando" por varios segundos.
      setSyncStatus(scope === "all" ? "syncing" : "ready");
      const releaseSyncIndicator = setTimeout(
        () => {
          setSyncStatus((current) =>
            current === "syncing" ? "ready" : current,
          );
        },
        scope === "all" ? 3200 : 900,
      );
      const session = getStaffSession();
      const scopedData = filterAppDataForSession(nextData, session);
      const saveOperation =
        scope === "players"
          ? saveSupabasePlayersAppData(supabase, scopedData, {
              onlyPlayerIds: options.playerIds,
            })
          : scope === "evaluations"
            ? saveSupabaseEvaluationsAppData(supabase, scopedData)
            : scope === "competition"
              ? saveSupabaseCompetitionAppData(supabase, scopedData)
              : saveSupabaseTablesAppData(supabase, scopedData);
      // Los guardados pequeños (ficha / valoraciones) no deben quedar bloqueados
      // por el guardado completo de entrenamientos y competencia.
      const timeoutMs = scope === "all" ? 18000 : 6500;
      const saveWithTimeout = Promise.race([
        saveOperation,
        new Promise<{ ok: false; reason: string }>((resolve) =>
          setTimeout(
            () => resolve({ ok: false, reason: "timeout" }),
            timeoutMs,
          ),
        ),
      ]);
      const result = await saveWithTimeout;
      clearTimeout(releaseSyncIndicator);
      // After save completes, keep blocking for 20 more seconds so the
      // realtime echo from Supabase doesn't overwrite our local state.
      const postSaveBlock = Date.now() + 20000;
      if (postSaveBlock > skipRemoteRefreshUntilRef.current) {
        skipRemoteRefreshUntilRef.current = postSaveBlock;
      }
      if (!result.ok) {
        console.warn(
          "[Orsomarso] Guardado remoto no confirmado; se conserva respaldo local.",
          result.reason,
        );
      }
      setSyncStatus(
        result.ok || result.reason === "timeout" ? "ready" : "error",
      );
    } else if (hasSupabaseConfig && legacyAppStateSyncEnabled) {
      setSyncStatus("syncing");
      const result = await saveRemoteAppState(nextData);
      setSyncStatus(result.ok ? "ready" : "error");
    } else {
      console.log("[Orsomarso] Modo local: datos guardados en localStorage");
      setSyncStatus("ready");
    }
  };

  const rejectDomainWrite = (message: string) => {
    setWriteValidationMessage(message);
    setSyncStatus("error");
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
      const next = normalizeSharedDataLinks(updater(prev));
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

        const localSnapshot = readLocalAppData();
        if (localSnapshot) {
          const localHydrated = hydrateData(localSnapshot);
          setData(localHydrated);
          dataRef.current = localHydrated;
          setSyncStatus("ready");
          setIsHydrated(true);
        } else {
          setSyncStatus("syncing");
        }
        // Lectura remota en segundo plano: la app queda usable con cache local
        // y Supabase actualiza cuando responda.
        const remote = await Promise.race([
          fetchSupabaseTablesAppData(supabase),
          new Promise<{ ok: false; reason: string }>((resolve) =>
            setTimeout(
              () => resolve({ ok: false, reason: "timeout-init" }),
              8000,
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
            players: mergePlayersPreferLocal(
              remoteData.players,
              localData?.players,
            ),
          };

          const normalizedMerged = normalizeSharedDataLinks(merged);
          setData(normalizedMerged);
          dataRef.current = normalizedMerged;
          saveLocalAppData(normalizedMerged);
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
        saveLocalAppData(next); // Ensure data is persisted on initial load
        setSyncStatus("ready");
      }

      const session = getStaffSession();
      sessionRef.current = session;
      const today = todayInputDate();
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
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRemotePullRef.current > 45000
      ) {
        // Use 'poll' so the skipRemoteRefresh timer is respected after saves.
        scheduleRemoteRefresh("poll");
      }
    };

    const syncOnFocus = () => {
      if (Date.now() - lastRemotePullRef.current > 45000)
        scheduleRemoteRefresh("poll");
    };

    const syncOnOnline = () => {
      if (Date.now() - lastRemotePullRef.current > 45000)
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
      const shouldPoll = Date.now() - lastRemotePullRef.current > 45000;
      if (shouldPoll) scheduleRemoteRefresh("poll");
    }, 60000);

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
      addWellness: (record) => {
        const result = commandAddWellness(dataRef.current, record);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data);
      },
      upsertWellness: (record) => {
        const result = commandUpsertWellness(dataRef.current, record, {
          excludeId: record.id,
        });
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data);
      },
      addInternalLoad: (record) => {
        const result = commandAddInternalLoad(dataRef.current, record, {
          microcycleId: filters.microcycleId,
          sessionNumber: filters.sessionNumber,
        });
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data);
      },
      upsertInternalLoad: (record) => {
        const result = commandUpsertInternalLoad(dataRef.current, record, {
          excludeId: record.id,
          microcycleId: filters.microcycleId,
          sessionNumber: filters.sessionNumber,
        });
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data);
      },
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
      addExternalLoad: (record) => {
        const result = commandAddExternalLoad(dataRef.current, record, {
          microcycleId: filters.microcycleId,
          sessionNumber: filters.sessionNumber,
        });
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data);
      },
      updateExternalLoad: (record) => {
        const result = commandUpdateExternalLoad(dataRef.current, record);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data);
      },
      deleteExternalLoad: (recordId) => {
        const result = commandDeleteExternalLoad(dataRef.current, recordId);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data);
        void deleteRemoteLegacy("daily_external_loads", recordId);
      },

      addCMJRecord: (record) => {
        const result = commandUpsertCMJRecord(dataRef.current, record);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "evaluations");
      },
      updateCMJRecord: (record) => {
        const result = commandUpdateCMJRecord(dataRef.current, record);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "evaluations");
      },
      deleteCMJRecord: (recordId) => {
        const result = commandDeleteCMJRecord(dataRef.current, recordId);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "evaluations");
        void deleteRemoteLegacy("cmj_records", recordId);
      },

      addNutritionRecord: (record) => {
        const result = commandUpsertNutritionRecord(dataRef.current, record);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "evaluations");
      },
      updateNutritionRecord: (record) => {
        const result = commandUpdateNutritionRecord(dataRef.current, record);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "evaluations");
      },
      deleteNutritionRecord: (recordId) => {
        const result = commandDeleteNutritionRecord(dataRef.current, recordId);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "evaluations");
        void deleteRemoteLegacy("nutrition_records", recordId);
      },

      addNeuromuscularRecord: (record) => {
        const result = commandUpsertNeuromuscularRecord(dataRef.current, record);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "evaluations");
      },
      updateNeuromuscularRecord: (record) => {
        const result = commandUpdateNeuromuscularRecord(dataRef.current, record);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "evaluations");
      },
      deleteNeuromuscularRecord: (recordId) => {
        const result = commandDeleteNeuromuscularRecord(dataRef.current, recordId);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "evaluations");
        void deleteRemoteLegacy("neuromuscular_records", recordId);
      },

      addFMSRecord: (record) => {
        const result = commandUpsertFMSRecord(dataRef.current, record);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "evaluations");
      },
      updateFMSRecord: (record) => {
        const result = commandUpdateFMSRecord(dataRef.current, record);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "evaluations");
      },
      deleteFMSRecord: (recordId) => {
        const result = commandDeleteFMSRecord(dataRef.current, recordId);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "evaluations");
        void deleteRemoteLegacy("fms_records", recordId);
      },
      addCompetitionRecord: (record) =>
        applyMutation(
          (prev) => ({
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
          }),
          "competition",
        ),
      updateCompetitionRecord: (record) =>
        applyMutation(
          (prev) => ({
            ...prev,
            competitionRecords: prev.competitionRecords.map((item) =>
              item.id === record.id ? record : item,
            ),
          }),
          "competition",
        ),
      deleteCompetitionRecord: (recordId) => {
        const currentRecord = dataRef.current.competitionRecords.find(
          (item) => item.id === recordId,
        );
        applyMutation(
          (prev) => ({
            ...prev,
            competitionRecords: prev.competitionRecords.filter(
              (item) => item.id !== recordId,
            ),
            externalLoads: prev.externalLoads.filter(
              (item) =>
                item.id !==
                `comp-load-${currentRecord?.matchId ?? ""}-${currentRecord?.playerId ?? ""}`,
            ),
          }),
          "competition",
        );
        void deleteRemoteLegacy("competition_players", recordId);
      },
      upsertCompetitionMatchSummary: (record) => {
        const result = commandUpsertCompetitionMatchSummary(dataRef.current, record);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "competition");
      },

      saveCompetitionMatchBundle: (record, records) => {
        const result = commandSaveCompetitionMatchBundle(
          dataRef.current,
          record,
          records,
        );
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data, "competition");
      },
      deleteCompetitionMatchSummary: (matchId) => {
        applyMutation(
          (prev) => ({
            ...prev,
            competitionMatchSummaries: prev.competitionMatchSummaries.filter(
              (item) => item.id !== matchId,
            ),
            competitionRecords: prev.competitionRecords.filter(
              (item) => item.matchId !== matchId,
            ),
            externalLoads: prev.externalLoads.filter(
              (item) =>
                !(
                  item.sessionId === matchId &&
                  (item.movementModule === "competencia" ||
                    item.id.startsWith("comp-load-"))
                ),
            ),
          }),
          "competition",
        );
        void deleteRemoteLegacy("competition_matches", matchId);
      },

      // FIX #7: upsertTrainingSessionSummary ahora respeta el sessionNumber al deduplicar.
      // Antes filtraba solo por date+category, borrando cualquier sesión de ese día/categoría
      // aunque fuera una sesión distinta (ej: doble jornada con sessionNumber diferente).
      upsertTrainingSessionSummary: (record) => {
        const result = commandUpsertTrainingSessionSummary(
          dataRef.current,
          record,
        );
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data);
      },

      // Guarda una sesion completa en una sola mutacion local/remota.
      // Evita que Supabase reciba primero solo el encabezado de la sesion
      // y despues se pierdan las cargas por carreras de sincronizacion.
      saveTrainingSessionBundle: (record, externalLoads, internalLoads) => {
        const result = commandSaveTrainingSessionBundle(
          dataRef.current,
          record,
          externalLoads,
          internalLoads,
        );
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data);
      },
      deleteTrainingSessionSummary: (sessionId) => {
        const current = dataRef.current;
        const target = current.trainingSessionSummaries.find(
          (item) => item.id === sessionId,
        );
        const matchesSession = (item: {
          sessionId?: string;
          date?: string;
          category?: string;
          actingCategory?: string;
          sessionNumber?: number;
          movementModule?: string;
        }) => Boolean(target && recordMatchesTrainingSession(item, target));
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
          competitionRecords: prev.competitionRecords.filter(
            (item) => item.matchId !== sessionId,
          ),
          competitionMatchSummaries: prev.competitionMatchSummaries.filter(
            (item) => item.id !== sessionId,
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
          current.competitionRecords
            .filter((item) => item.matchId === sessionId)
            .forEach((item) => {
              void deleteRemoteLegacy("competition_records", item.id);
            });
          current.competitionMatchSummaries
            .filter((item) => item.id === sessionId)
            .forEach((item) => {
              void deleteRemoteLegacy("competition_matches", item.id);
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
      upsertTechnicalProfile: undefined,
      upsertTechnicalReport: undefined,
      upsertScoutFollowUp: undefined,
      upsertSelectionCallRecord: undefined,
      upsertPlayerCaptureLocation: undefined,
      upsertTechnicalDecision: undefined,
      updateMicrocycle: (record) => {
        const normalizedRecord = {
          ...record,
          category:
            record.category ??
            (filters.category === "all" ? "Sub20" : (filters.category as any)),
        };
        const result = updateMicrocycleInData(dataRef.current, normalizedRecord);
        if (!result.ok) {
          rejectDomainWrite(result.message);
          return;
        }
        setWriteValidationMessage(null);
        applyMutation(() => result.data);

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
      writeValidationMessage,
      clearWriteValidationMessage: () => setWriteValidationMessage(null),
      syncMergeConflicts,
      // FIX: Emergency recovery functions
      recoverCompetitionData,
      hasAvailableBackups,
      emergencyClearLocalStorage,
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
      writeValidationMessage,
      syncMergeConflicts,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
