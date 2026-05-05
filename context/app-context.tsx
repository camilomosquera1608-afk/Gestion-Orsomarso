'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState , type ReactNode } from 'react';
import { initialData } from '@/lib/mock-data';
import { fetchRemoteAppState, hasSupabaseConfig, legacyAppStateSyncEnabled, saveRemoteAppState, supabase, tableSchemaSyncEnabled } from '@/lib/supabase';
import { deleteSupabaseTableRowByLegacyId, deleteSupabaseTrainingSessionCascade, fetchSupabaseTablesAppData, saveSupabaseTablesAppData } from '@/lib/supabase-table-sync';
import { clearAutoBackups, clearLocalBackups, createLocalBackup, deleteLocalBackup, getLocalBackupPayload, listLocalBackups, readLocalAppData, saveLocalAppData } from '@/lib/app-storage';
import type { LocalBackupMeta } from '@/lib/app-storage';
import { getAllowedCategory, getStaffSession, isMasterRole } from '@/lib/auth';
import { canDeletePlayer, canWrite, filterAppDataForSession } from '@/lib/access-control';
import { findMicrocycleByDate, getMicrocyclesForCategory, microcycleBelongsToCategory } from '@/lib/utils';
import { findOverlappingMicrocycle } from '@/lib/operational-validation';
import { normalizeAppData } from '@/lib/performance-helpers';
import { AppData, CMJRecord, CompetitionMatchSummary, CompetitionRecord, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord, FMSRecord, GlobalFilters, Microcycle, NeuromuscularRecord, NutritionRecord, Player, TrainingSessionSummary } from '@/lib/types';

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
  deleteCompetitionMatchSummary: (matchId: string) => void;
  upsertTrainingSessionSummary: (record: TrainingSessionSummary) => void;
  deleteTrainingSessionSummary: (sessionId: string) => void;
  updateMicrocycle: (record: Microcycle) => void;
  deleteMicrocycle: (microcycleId: string) => void;
  backendMode: 'supabase' | 'local';
  syncStatus: 'idle' | 'syncing' | 'ready' | 'error';
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
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultFilters = (): GlobalFilters => ({
  date: getTodayInputDate(),
  microcycleId: '',
  playerId: 'all',
  position: 'all',
  status: 'all',
  category: 'all',
  actingCategory: 'all',
  movementType: 'all',
  sessionNumber: 1,
});

const defaultFilters: GlobalFilters = getDefaultFilters();

const AppContext = createContext<AppContextValue | undefined>(undefined);

const DEFAULT_CATEGORY = 'Sub20' as const;

const hydrateData = (stored: Partial<AppData> | null): AppData => normalizeAppData(stored, initialData);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<AppData>(initialData);
  const [filters, setFiltersState] = useState<GlobalFilters>(defaultFilters);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ready' | 'error'>('idle');
  const [localBackups, setLocalBackups] = useState<LocalBackupMeta[]>([]);
  const dataRef = useRef<AppData>(initialData);
  const remoteRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipRemoteRefreshUntilRef = useRef(0);
  const lastRemotePullRef = useRef(0);
  const backendMode: 'supabase' | 'local' = hasSupabaseConfig ? 'supabase' : 'local';

  // FIX #10: Cachear la sesión en un ref para no releer localStorage en cada mutación.
  // getStaffSession() puede leer cookies/localStorage y fallar silenciosamente en SSR.
  const sessionRef = useRef(getStaffSession());
  useEffect(() => {
    sessionRef.current = getStaffSession();
  }, [isHydrated]);

  const currentSession = sessionRef.current;
  const canEdit = !currentSession.isAuthenticated || canWrite(currentSession);
  const permissionMessage = currentSession.isAuthenticated && !canWrite(currentSession) ? 'Solo lectura.' : 'Guardado.';

  const keepLocalDataAfterReadIssue = (reason?: string) => {
    console.warn('[Orsomarso] Lectura remota no disponible, usando cache local:', reason ?? 'sin detalle');
    setSyncStatus('ready');
  };

  const refreshFromSupabase = async (source: 'manual' | 'realtime' | 'poll' = 'manual') => {
    if (!hasSupabaseConfig || !tableSchemaSyncEnabled || !supabase) return;
    if (source !== 'manual' && Date.now() < skipRemoteRefreshUntilRef.current) return;

    setSyncStatus(source === 'manual' ? 'syncing' : 'ready');
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
    const remoteIds = new Set(remoteHydrated.trainingSessionSummaries.map((r: { id: string }) => r.id));
    const remoteDateCatKeys = new Set(
      remoteHydrated.trainingSessionSummaries.map((r: { date: string; category?: string }) => `${r.date}::${r.category ?? ''}`)
    );
    const localOnlySessions = current.trainingSessionSummaries.filter(
      (r) => !remoteIds.has(r.id) && !remoteDateCatKeys.has(`${r.date}::${r.category ?? ''}`)
    );
    const remoteInternalIds = new Set(remoteHydrated.internalLoads.map((r: { id: string }) => r.id));
    const localOnlyInternal = current.internalLoads.filter((r) => !remoteInternalIds.has(r.id));
    const remoteExternalIds = new Set(remoteHydrated.externalLoads.map((r: { id: string }) => r.id));
    const localOnlyExternal = current.externalLoads.filter((r) => !remoteExternalIds.has(r.id));
    
    const next: AppData = {
      ...remoteHydrated,
      trainingSessionSummaries: [...remoteHydrated.trainingSessionSummaries, ...localOnlySessions],
      internalLoads: [...remoteHydrated.internalLoads, ...localOnlyInternal],
      externalLoads: [...remoteHydrated.externalLoads, ...localOnlyExternal],
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
    setSyncStatus('ready');
  };

  const scheduleRemoteRefresh = (source: 'realtime' | 'poll') => {
    if (remoteRefreshTimerRef.current) clearTimeout(remoteRefreshTimerRef.current);
    remoteRefreshTimerRef.current = setTimeout(() => {
      void refreshFromSupabase(source);
    }, source === 'realtime' ? 650 : 0);
  };

  const persistData = async (nextData: AppData) => {
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
      const blockUntil = Date.now() + 8000;
      // Only extend the block — never shorten it (another save may be in flight).
      if (blockUntil > skipRemoteRefreshUntilRef.current) {
        skipRemoteRefreshUntilRef.current = blockUntil;
      }
      setSyncStatus('syncing');
      const session = getStaffSession();
      const scopedData = filterAppDataForSession(nextData, session);
      // Add 30s timeout so syncStatus never gets stuck on 'syncing'
      const saveWithTimeout = Promise.race([
        saveSupabaseTablesAppData(supabase, scopedData),
        new Promise<{ ok: false; reason: string }>((resolve) =>
          setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 30000)
        ),
      ]);
      const result = await saveWithTimeout;
      // After save completes, keep blocking for 3 more seconds so the
      // realtime echo from Supabase doesn't overwrite our local state.
      const postSaveBlock = Date.now() + 3000;
      if (postSaveBlock > skipRemoteRefreshUntilRef.current) {
        skipRemoteRefreshUntilRef.current = postSaveBlock;
      }
      setSyncStatus(result.ok ? 'ready' : 'error');
    } else if (hasSupabaseConfig && legacyAppStateSyncEnabled) {
      setSyncStatus('syncing');
      const result = await saveRemoteAppState(nextData);
      setSyncStatus(result.ok ? 'ready' : 'error');
    } else {
      setSyncStatus('ready');
    }
  };

  const applyMutation = (updater: (prev: AppData) => AppData) => {
    setData((prev) => {
      // FIX #10: Usar el ref cacheado en lugar de llamar getStaffSession() en cada mutación
      const session = sessionRef.current;
      if (session.isAuthenticated && !canWrite(session)) {
        setSyncStatus('error');
        return prev;
      }
      const next = updater(prev);
      dataRef.current = next;
      void persistData(next);
      return next;
    });
  };

  // Fix #20: loggedBy helper — rellena automáticamente quién hizo el cambio
  const currentUserLabel = () => sessionRef.current.email ?? sessionRef.current.displayName ?? 'Sistema';


  const deleteRemoteLegacy = async (table: string, legacyId: string) => {
    if (!hasSupabaseConfig || !tableSchemaSyncEnabled || !supabase) return;
    const session = sessionRef.current;
    if (session.isAuthenticated && !canWrite(session)) return;
    // FIX #6: mismo patrón — calcular blockUntil antes del await
    const blockUntil = Date.now() + 8000;
    if (blockUntil > skipRemoteRefreshUntilRef.current) {
      skipRemoteRefreshUntilRef.current = blockUntil;
    }
    const result = await deleteSupabaseTableRowByLegacyId(supabase, table, legacyId);
    const postBlock = Date.now() + 3000;
    if (postBlock > skipRemoteRefreshUntilRef.current) {
      skipRemoteRefreshUntilRef.current = postBlock;
    }
    setSyncStatus(result.ok ? 'ready' : 'error');
  };

  useEffect(() => {
    const init = async () => {
      if (hasSupabaseConfig && tableSchemaSyncEnabled && supabase) {
        // LIMPIEZA DE DATOS MOCK: Si el localStorage tiene datos con IDs de
        // ejemplo (p1, p2, e1, i1...) que venían del mock-data anterior,
        // los eliminamos para que Supabase sea siempre la fuente de verdad.
        try {
          const raw = localStorage.getItem('orsomarso-performance-hub');
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<AppData>;
            const hasMockPlayers = parsed.players?.some((p) => /^p\d+$/.test(p.id));
            const hasMockLoads = parsed.internalLoads?.some((x) => /^i\d+$/.test(x.id));
            const hasMockExternal = parsed.externalLoads?.some((x) => /^e\d+$/.test(x.id));
            if (hasMockPlayers || hasMockLoads || hasMockExternal) {
              localStorage.removeItem('orsomarso-performance-hub');
              console.info('[Orsomarso] Datos de ejemplo eliminados del cache local. Cargando desde Supabase.');
            }
          }
        } catch {
          // Si falla la lectura del localStorage, ignorar y continuar
        }

        setSyncStatus('syncing');
        // 20s timeout so init never hangs on 'syncing'
        const remote = await Promise.race([
          fetchSupabaseTablesAppData(supabase),
          new Promise<{ ok: false; reason: string }>((resolve) =>
            setTimeout(() => resolve({ ok: false, reason: 'timeout-init' }), 20000)
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
          ): T[] => {
            if (!local?.length) return remote;
            const remoteIds = new Set(remote.map((r) => r.id));
            const localOnly = local.filter((r) => !remoteIds.has(r.id));
            return [...remote, ...localOnly];
          };

          // Special merge for sessions: also match by date+category key
          // because Supabase may have stored with a different legacy_id
          const mergeSessionsWithDateKey = (
            remote: typeof remoteData.trainingSessionSummaries,
            local: typeof remoteData.trainingSessionSummaries | undefined,
          ) => {
            if (!local?.length) return remote;
            const remoteIds = new Set(remote.map((r) => r.id));
            const remoteDateCat = new Set(remote.map((r) => `${r.date}::${r.category ?? ''}`));
            const localOnly = local.filter(
              (r) => !remoteIds.has(r.id) && !remoteDateCat.has(`${r.date}::${r.category ?? ''}`)
            );
            return [...remote, ...localOnly];
          };
          
          const merged: AppData = {
            ...remoteData,
            // Critical: merge sessions and loads that may not be in Supabase yet
            trainingSessionSummaries: mergeSessionsWithDateKey(
              remoteData.trainingSessionSummaries,
              localData?.trainingSessionSummaries,
            ),
            internalLoads: mergeArrays(remoteData.internalLoads, localData?.internalLoads),
            externalLoads: mergeArrays(remoteData.externalLoads, localData?.externalLoads),
            // Players, wellness, microcycles: always use Supabase as source of truth
            players: remoteData.players.length > 0 ? remoteData.players : (localData?.players ?? remoteData.players),
            wellness: remoteData.wellness,
            microcycles: remoteData.microcycles,
          };
          
          setData(merged);
          dataRef.current = merged;
          saveLocalAppData(merged);
          setSyncStatus('ready');
        } else {
          const local = readLocalAppData();
          const hydrated = hydrateData(local ?? initialData);
          setData(hydrated);
          dataRef.current = hydrated;
          keepLocalDataAfterReadIssue(remote.reason);
        }
      } else if (hasSupabaseConfig && legacyAppStateSyncEnabled) {
        setSyncStatus('syncing');
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
        setSyncStatus('ready');
      } else {
        const stored = readLocalAppData();
        const next = stored ? hydrateData(stored) : initialData;
        setData(next);
        dataRef.current = next;
        setSyncStatus('ready');
      }

      const session = getStaffSession();
      sessionRef.current = session;
      const today = getTodayInputDate();
      const category = getAllowedCategory(session);
      const activeCategory = isMasterRole(session) ? 'all' : category;
      const currentMicrocycles = dataRef.current.microcycles;
      const todayMicrocycle = findMicrocycleByDate(currentMicrocycles, today, undefined, activeCategory);
      const fallbackMicrocycle = todayMicrocycle ?? getMicrocyclesForCategory(currentMicrocycles, activeCategory)[0] ?? currentMicrocycles[0];
      setFiltersState((prev) => ({
        ...prev,
        date: today,
        category: activeCategory,
        microcycleId: fallbackMicrocycle?.id ?? '',
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
    if (!hasSupabaseConfig || !tableSchemaSyncEnabled || !supabase || !isHydrated) return;

    const syncOnResume = () => {
      if (document.visibilityState === 'visible') {
        // Use 'poll' so the skipRemoteRefresh timer is respected after saves.
        scheduleRemoteRefresh('poll');
      }
    };

    const syncOnFocus = () => {
      scheduleRemoteRefresh('poll');
    };

    const syncOnOnline = () => {
      scheduleRemoteRefresh('poll');
    };

    document.addEventListener('visibilitychange', syncOnResume);
    window.addEventListener('focus', syncOnFocus);
    window.addEventListener('online', syncOnOnline);

    const supabaseClient = supabase;

    const realtimeTables = [
      'players',
      'microcycles',
      'daily_wellness',
      'daily_internal_loads',
      'daily_external_loads',
      'training_sessions',
      'competition_matches',
      'competition_players',
      'nutrition_records',
      'cmj_records',
      'neuromuscular_records',
      'fms_records',
      'medical_notes',
    ];

    let channel = supabaseClient.channel('orsomarso-v99-live-sync');
    realtimeTables.forEach((table) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => scheduleRemoteRefresh('realtime'),
      );
    });

    channel.subscribe();

    const interval = setInterval(() => {
      const shouldPoll = Date.now() - lastRemotePullRef.current > 12000;
      if (shouldPoll) scheduleRemoteRefresh('poll');
    }, 15000);

    return () => {
      document.removeEventListener('visibilitychange', syncOnResume);
      window.removeEventListener('focus', syncOnFocus);
      window.removeEventListener('online', syncOnOnline);
      if (remoteRefreshTimerRef.current) clearTimeout(remoteRefreshTimerRef.current);
      clearInterval(interval);
      void supabaseClient.removeChannel(channel);
    };
  }, [isHydrated]);


  // Fix #14: Detectar expiración de sesión Supabase mientras la pestaña está abierta.
  // Si el token expira o se cierra sesión desde otro lado, mostrar aviso y redirigir.
  useEffect(() => {
    if (!supabase || !hasSupabaseConfig) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (event === 'SIGNED_OUT') {
          setSyncStatus('error');
          if (typeof window !== 'undefined') {
            setTimeout(() => window.location.assign('/login'), 1200);
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const forceSync = async () => {
    if (!hasSupabaseConfig) return;
    setSyncStatus('syncing');
    if (tableSchemaSyncEnabled && supabase) {
      await refreshFromSupabase('manual');
      return;
    }

    const remote = await fetchRemoteAppState();
    const payload = remote?.payload as Partial<AppData> | undefined;
    if (payload) {
      const next = hydrateData(payload);
      setData(next);
      dataRef.current = next;
    }
    setSyncStatus('ready');
  };


  const pushLocalToRemote = async () => {
    if (!hasSupabaseConfig) return;
    setSyncStatus('syncing');
    if (tableSchemaSyncEnabled && supabase) {
      const session = sessionRef.current;
      const scopedData = filterAppDataForSession(dataRef.current, session);
      const result = await saveSupabaseTablesAppData(supabase, scopedData);
      setSyncStatus(result.ok ? 'ready' : 'error');
      return;
    }
    if (legacyAppStateSyncEnabled) {
      const result = await saveRemoteAppState(dataRef.current);
      setSyncStatus(result.ok ? 'ready' : 'error');
      return;
    }
    setSyncStatus('ready');
  };

  const createLocalSnapshot = (label = 'Copia manual') => {
    createLocalBackup(dataRef.current, label, 'manual');
    setLocalBackups(listLocalBackups());
  };

  const clearLocalSnapshots = () => {
    clearLocalBackups();
    setLocalBackups([]);
    setSyncStatus('ready');
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

    createLocalBackup(dataRef.current, 'Copia antes de restaurar respaldo', 'restore');
    const next = hydrateData(payload);
    setData(next);
    dataRef.current = next;
    saveLocalAppData(next);
    setLocalBackups(listLocalBackups());
    setSyncStatus('ready');
    return true;
  };

  const importAppDataJson = (rawJson: string) => {
    try {
      const parsed = JSON.parse(rawJson) as Partial<AppData>;

      // FIX #9: Validación básica del JSON importado antes de aplicarlo.
      // Si el JSON no tiene ninguna de las claves esperadas de AppData,
      // se rechaza para evitar cargar datos corruptos silenciosamente.
      const knownKeys: (keyof AppData)[] = ['players', 'wellness', 'internalLoads', 'externalLoads', 'microcycles', 'trainingSessionSummaries', 'competitionMatchSummaries'];
      const hasAnyKnownKey = knownKeys.some((key) => Array.isArray(parsed[key]));
      if (!hasAnyKnownKey) {
        console.warn('[Orsomarso] JSON importado no contiene datos reconocidos de AppData.');
        setSyncStatus('error');
        return false;
      }

      createLocalBackup(dataRef.current, 'Copia antes de importar JSON', 'import');
      const next = hydrateData(parsed);
      setData(next);
      dataRef.current = next;
      saveLocalAppData(next);
      setLocalBackups(listLocalBackups());
      setSyncStatus('ready');
      return true;
    } catch {
      setSyncStatus('error');
      return false;
    }
  };

  const exportAppDataJson = () => JSON.stringify(dataRef.current, null, 2);

  const setFilters = (next: Partial<GlobalFilters>) => setFiltersState((prev) => {
    const session = sessionRef.current;
    const allowedCategory = getAllowedCategory(session);
    const merged = { ...prev, ...next };
    const microcycles = dataRef.current.microcycles;

    if (!isMasterRole(session)) {
      merged.category = allowedCategory;
    }

    const activeCategory = merged.category || allowedCategory;
    const scopedMicrocycles = getMicrocyclesForCategory(microcycles, activeCategory);
    const selected = microcycles.find((item) => item.id === merged.microcycleId);
    const categoryChanged = next.category !== undefined && next.category !== prev.category;

    if (categoryChanged || (selected && !microcycleBelongsToCategory(selected, activeCategory))) {
      const detected = merged.date ? findMicrocycleByDate(microcycles, merged.date, undefined, activeCategory) : undefined;
      const fallback = detected ?? scopedMicrocycles[0];
      if (fallback) merged.microcycleId = fallback.id;
    }

    if (next.microcycleId !== undefined) {
      const current = microcycles.find((item) => item.id === next.microcycleId);
      if (current?.startDate && current?.endDate) {
        const currentDate = merged.date;
        if (!currentDate || currentDate < current.startDate || currentDate > current.endDate) {
          merged.date = current.startDate;
        }
      } else if (current && next.date === undefined) {
        merged.date = '';
      }
    }

    if (next.date !== undefined && next.date) {
      const detected = findMicrocycleByDate(microcycles, next.date, merged.microcycleId, activeCategory);
      if (detected) merged.microcycleId = detected.id;
    }

    return merged;
  });

  const resetFilters = () => {
    const session = sessionRef.current;
    const category = getAllowedCategory(session);
    const activeCategory = isMasterRole(session) ? 'all' : category;
    const nextDefaults = getDefaultFilters();
    const detected = findMicrocycleByDate(dataRef.current.microcycles, nextDefaults.date, undefined, activeCategory);
    const fallbackMicrocycle = detected ?? getMicrocyclesForCategory(dataRef.current.microcycles, activeCategory)[0] ?? dataRef.current.microcycles[0];
    setFiltersState({
      ...nextDefaults,
      category: activeCategory,
      microcycleId: fallbackMicrocycle?.id ?? '',
    });
  };

  const value = useMemo<AppContextValue>(() => ({
    data,
    filters,
    setFilters,
    resetFilters,
    // FIX #3: isLoading derivado de isHydrated — true mientras los datos aún no cargaron
    isLoading: !isHydrated,
    addPlayer: (player) => applyMutation((prev) => {
      const normalizedName = player.name.trim().toLowerCase();
      const normalizedPlayer = { ...player, category: player.category ?? DEFAULT_CATEGORY, categoryHistory: Array.from(new Set([...(player.categoryHistory ?? []), player.category ?? DEFAULT_CATEGORY])) };
      const exists = prev.players.find((item) => item.id === normalizedPlayer.id || item.name.trim().toLowerCase() === normalizedName);
      const nextPlayers = exists
        ? prev.players.map((item) => item.id === exists.id ? { ...item, ...normalizedPlayer, id: exists.id, categoryHistory: Array.from(new Set([...(item.categoryHistory ?? []), ...(normalizedPlayer.categoryHistory ?? []), normalizedPlayer.category ?? DEFAULT_CATEGORY])) } : item)
        : [normalizedPlayer, ...prev.players];
      return { ...prev, players: nextPlayers.sort((a, b) => a.name.localeCompare(b.name)) };
    }),
    updatePlayer: (player) => applyMutation((prev) => ({
      ...prev,
      players: prev.players
        .map((item) =>
          item.id === player.id
            ? {
                ...player,
                category: player.category ?? item.category ?? DEFAULT_CATEGORY,
                categoryHistory: Array.from(
                  new Set([...(item.categoryHistory ?? []), ...(player.categoryHistory ?? []), player.category ?? item.category ?? DEFAULT_CATEGORY]),
                ),
              }
            : item,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    })),
    deletePlayer: (playerId) => {
      const session = sessionRef.current;
      const player = dataRef.current.players.find((item) => item.id === playerId);
      if (!canDeletePlayer(session, player)) {
        setSyncStatus('error');
        return;
      }
      applyMutation((prev) => ({
        ...prev,
        players: prev.players.filter((p) => p.id !== playerId),
        wellness: prev.wellness.filter((x) => x.playerId !== playerId),
        internalLoads: prev.internalLoads.filter((x) => x.playerId !== playerId),
        externalLoads: prev.externalLoads.filter((x) => x.playerId !== playerId),
        cmjRecords: prev.cmjRecords.filter((x) => x.playerId !== playerId),
        nutritionRecords: prev.nutritionRecords.filter((x) => x.playerId !== playerId),
        neuromuscularRecords: prev.neuromuscularRecords.filter((x) => x.playerId !== playerId),
        fmsRecords: prev.fmsRecords.filter((x) => x.playerId !== playerId),
        competitionRecords: prev.competitionRecords.filter((x) => x.playerId !== playerId),
      }));
      // FIX #4: Borrar también los registros hijo del jugador en Supabase.
      // Antes solo se borraba el jugador, dejando registros huérfanos en la BD.
      // Nota: si tus tablas en Supabase tienen ON DELETE CASCADE configurado,
      // estas llamadas son redundantes pero inofensivas. Si no lo tienen,
      // son necesarias para mantener la consistencia.
      void deleteRemoteLegacy('players', playerId);
      const current = dataRef.current;
      current.wellness.filter((x) => x.playerId === playerId).forEach((x) => { void deleteRemoteLegacy('daily_wellness', x.id); });
      current.internalLoads.filter((x) => x.playerId === playerId).forEach((x) => { void deleteRemoteLegacy('daily_internal_loads', x.id); });
      current.externalLoads.filter((x) => x.playerId === playerId).forEach((x) => { void deleteRemoteLegacy('daily_external_loads', x.id); });
      current.cmjRecords.filter((x) => x.playerId === playerId).forEach((x) => { void deleteRemoteLegacy('cmj_records', x.id); });
      current.nutritionRecords.filter((x) => x.playerId === playerId).forEach((x) => { void deleteRemoteLegacy('nutrition_records', x.id); });
      current.neuromuscularRecords.filter((x) => x.playerId === playerId).forEach((x) => { void deleteRemoteLegacy('neuromuscular_records', x.id); });
      current.fmsRecords.filter((x) => x.playerId === playerId).forEach((x) => { void deleteRemoteLegacy('fms_records', x.id); });
      current.competitionRecords.filter((x) => x.playerId === playerId).forEach((x) => { void deleteRemoteLegacy('competition_players', x.id); });
    },
    addWellness: (record) => applyMutation((prev) => ({ ...prev, wellness: [record, ...prev.wellness] })),
    upsertWellness: (record) => applyMutation((prev) => ({
      ...prev,
      wellness: [record, ...prev.wellness.filter((item) => !(item.playerId === record.playerId && item.date === record.date))],
    })),
    addInternalLoad: (record) => applyMutation((prev) => ({ ...prev, internalLoads: [record, ...prev.internalLoads] })),
    upsertInternalLoad: (record) => applyMutation((prev) => {
      const normalizedRecord = { ...record, microcycleId: record.microcycleId ?? filters.microcycleId, sessionNumber: record.sessionNumber ?? filters.sessionNumber };
      return {
        ...prev,
        internalLoads: [
          normalizedRecord,
          ...prev.internalLoads.filter((item) => {
            const sameId = item.id === normalizedRecord.id;
            const sameSessionPlayer = !!normalizedRecord.sessionId && item.sessionId === normalizedRecord.sessionId && item.playerId === normalizedRecord.playerId;
            const sameDatePlayerSession = item.playerId === normalizedRecord.playerId
              && item.date === normalizedRecord.date
              && (item.category ?? item.actingCategory) === (normalizedRecord.category ?? normalizedRecord.actingCategory)
              && (item.sessionNumber ?? filters.sessionNumber) === (normalizedRecord.sessionNumber ?? filters.sessionNumber);
            return !(sameId || sameSessionPlayer || sameDatePlayerSession);
          }),
        ],
      };
    }),
    updateInternalLoad: (record) => applyMutation((prev) => ({ ...prev, internalLoads: prev.internalLoads.map((item) => item.id === record.id ? record : item) })),
    deleteInternalLoad: (recordId) => {
      applyMutation((prev) => ({ ...prev, internalLoads: prev.internalLoads.filter((item) => item.id !== recordId) }));
      void deleteRemoteLegacy('daily_internal_loads', recordId);
    },
    addExternalLoad: (record) => applyMutation((prev) => ({ ...prev, externalLoads: [{ ...record, microcycleId: record.microcycleId ?? filters.microcycleId, sessionNumber: record.sessionNumber ?? filters.sessionNumber, sessionType: record.sessionType ?? 'cdEf', participation: record.participation ?? 'Completa' }, ...prev.externalLoads] })),
    updateExternalLoad: (record) => applyMutation((prev) => ({ ...prev, externalLoads: prev.externalLoads.map((item) => item.id === record.id ? record : item) })),
    deleteExternalLoad: (recordId) => {
      applyMutation((prev) => ({ ...prev, externalLoads: prev.externalLoads.filter((item) => item.id !== recordId) }));
      void deleteRemoteLegacy('daily_external_loads', recordId);
    },

    // FIX #1: addCMJRecord ahora es un upsert — evita duplicados por jugador+fecha.
    // Antes hacía [record, ...prev] sin filtrar, creando registros repetidos
    // si el usuario guardaba dos veces en el mismo día.
    addCMJRecord: (record) => applyMutation((prev) => ({
      ...prev,
      cmjRecords: [
        record,
        ...prev.cmjRecords.filter((item) => !(item.id !== record.id && item.playerId === record.playerId && item.date === record.date)),
      ],
    })),
    updateCMJRecord: (record) => applyMutation((prev) => ({ ...prev, cmjRecords: prev.cmjRecords.map((item) => item.id === record.id ? record : item) })),
    deleteCMJRecord: (recordId) => {
      applyMutation((prev) => ({ ...prev, cmjRecords: prev.cmjRecords.filter((item) => item.id !== recordId) }));
      void deleteRemoteLegacy('cmj_records', recordId);
    },

    // FIX #1: addNutritionRecord ahora es un upsert — evita duplicados por jugador+fecha.
    addNutritionRecord: (record) => applyMutation((prev) => ({
      ...prev,
      nutritionRecords: [
        record,
        ...prev.nutritionRecords.filter((item) => !(item.id !== record.id && item.playerId === record.playerId && item.date === record.date)),
      ],
    })),
    updateNutritionRecord: (record) => applyMutation((prev) => ({ ...prev, nutritionRecords: prev.nutritionRecords.map((item) => item.id === record.id ? record : item) })),
    deleteNutritionRecord: (recordId) => {
      applyMutation((prev) => ({ ...prev, nutritionRecords: prev.nutritionRecords.filter((item) => item.id !== recordId) }));
      void deleteRemoteLegacy('nutrition_records', recordId);
    },

    // FIX #1: addNeuromuscularRecord ahora es un upsert — evita duplicados por jugador+fecha.
    addNeuromuscularRecord: (record) => applyMutation((prev) => ({
      ...prev,
      neuromuscularRecords: [
        record,
        ...prev.neuromuscularRecords.filter((item) => !(item.id !== record.id && item.playerId === record.playerId && item.date === record.date)),
      ],
    })),
    updateNeuromuscularRecord: (record) => applyMutation((prev) => ({ ...prev, neuromuscularRecords: prev.neuromuscularRecords.map((item) => item.id === record.id ? record : item) })),
    deleteNeuromuscularRecord: (recordId) => {
      applyMutation((prev) => ({ ...prev, neuromuscularRecords: prev.neuromuscularRecords.filter((item) => item.id !== recordId) }));
      void deleteRemoteLegacy('neuromuscular_records', recordId);
    },

    // FIX #1: addFMSRecord ahora es un upsert — evita duplicados por jugador+fecha.
    addFMSRecord: (record) => applyMutation((prev) => ({
      ...prev,
      fmsRecords: [
        record,
        ...prev.fmsRecords.filter((item) => !(item.id !== record.id && item.playerId === record.playerId && item.date === record.date)),
      ],
    })),
    updateFMSRecord: (record) => applyMutation((prev) => ({ ...prev, fmsRecords: prev.fmsRecords.map((item) => item.id === record.id ? record : item) })),
    deleteFMSRecord: (recordId) => {
      applyMutation((prev) => ({ ...prev, fmsRecords: prev.fmsRecords.filter((item) => item.id !== recordId) }));
      void deleteRemoteLegacy('fms_records', recordId);
    },
    addCompetitionRecord: (record) => applyMutation((prev) => ({ ...prev, competitionRecords: [record, ...prev.competitionRecords] })),
    updateCompetitionRecord: (record) => applyMutation((prev) => ({ ...prev, competitionRecords: prev.competitionRecords.map((item) => item.id === record.id ? record : item) })),
    deleteCompetitionRecord: (recordId) => {
      applyMutation((prev) => ({ ...prev, competitionRecords: prev.competitionRecords.filter((item) => item.id !== recordId) }));
      void deleteRemoteLegacy('competition_players', recordId);
    },
    upsertCompetitionMatchSummary: (record) => applyMutation((prev) => ({ ...prev, competitionMatchSummaries: [record, ...prev.competitionMatchSummaries.filter((item) => !(item.id === record.id || (item.date === record.date && item.category === record.category && item.opponent.trim().toLowerCase() === record.opponent.trim().toLowerCase())))] })),
    deleteCompetitionMatchSummary: (matchId) => {
      applyMutation((prev) => ({ ...prev, competitionMatchSummaries: prev.competitionMatchSummaries.filter((item) => item.id !== matchId), competitionRecords: prev.competitionRecords.filter((item) => item.matchId !== matchId) }));
      void deleteRemoteLegacy('competition_matches', matchId);
    },

    // FIX #7: upsertTrainingSessionSummary ahora respeta el sessionNumber al deduplicar.
    // Antes filtraba solo por date+category, borrando cualquier sesión de ese día/categoría
    // aunque fuera una sesión distinta (ej: doble jornada con sessionNumber diferente).
    upsertTrainingSessionSummary: (record) => applyMutation((prev) => ({
      ...prev,
      trainingSessionSummaries: [
        record,
        ...prev.trainingSessionSummaries.filter((item) =>
          !(item.id === record.id ||
            (item.date === record.date &&
             item.category === record.category &&
             item.sessionNumber === record.sessionNumber)),
        ),
      ],
    })),
    deleteTrainingSessionSummary: (sessionId) => {
      const current = dataRef.current;
      const target = current.trainingSessionSummaries.find((item) => item.id === sessionId);
      const matchesSession = (item: { sessionId?: string; date: string; category?: string; actingCategory?: string; sessionNumber?: number }) => {
        if (item.sessionId === sessionId) return true;
        if (!target) return false;
        return item.date === target.date
          && (item.category ?? item.actingCategory) === target.category
          && (item.sessionNumber ?? target.sessionNumber) === target.sessionNumber;
      };
      applyMutation((prev) => ({
        ...prev,
        trainingSessionSummaries: prev.trainingSessionSummaries.filter((item) => item.id !== sessionId),
        externalLoads: prev.externalLoads.filter((item) => !matchesSession(item)),
        internalLoads: prev.internalLoads.filter((item) => !matchesSession(item)),
      }));
      if (target && hasSupabaseConfig && tableSchemaSyncEnabled && supabase) {
        const blockUntil = Date.now() + 10000;
        if (blockUntil > skipRemoteRefreshUntilRef.current) skipRemoteRefreshUntilRef.current = blockUntil;
        void deleteSupabaseTrainingSessionCascade(supabase, {
          legacyId: sessionId,
          date: target.date,
          category: target.category,
          sessionNumber: target.sessionNumber,
        }).then((result) => {
          setSyncStatus(result.ok ? 'ready' : 'error');
          const postBlock = Date.now() + 3000;
          if (postBlock > skipRemoteRefreshUntilRef.current) skipRemoteRefreshUntilRef.current = postBlock;
        });
      } else {
        void deleteRemoteLegacy('training_sessions', sessionId);
        current.externalLoads.filter((item) => matchesSession(item)).forEach((item) => { void deleteRemoteLegacy('daily_external_loads', item.id); });
        current.internalLoads.filter((item) => matchesSession(item)).forEach((item) => { void deleteRemoteLegacy('daily_internal_loads', item.id); });
      }
    },
    updateMicrocycle: (record) => {
      const normalizedRecord = { ...record, category: record.category ?? (filters.category === 'all' ? 'Sub20' : filters.category as any) };
      applyMutation((prev) => {
        const duplicated = findOverlappingMicrocycle(prev.microcycles, normalizedRecord);
        if (duplicated) return prev;
        return {
          ...prev,
        microcycles: prev.microcycles.some((item) => item.id === normalizedRecord.id)
          ? prev.microcycles.map((item) => item.id === normalizedRecord.id ? { ...item, ...normalizedRecord } : item)
          : [...prev.microcycles, normalizedRecord].sort((a, b) => (a.startDate || a.id).localeCompare(b.startDate || b.id)),
        };
      });

      if (normalizedRecord.id === filters.microcycleId) {
        setFiltersState((prev) => {
          if (normalizedRecord.startDate && normalizedRecord.endDate) {
            if (prev.date >= normalizedRecord.startDate && prev.date <= normalizedRecord.endDate) return { ...prev, microcycleId: normalizedRecord.id };
            return { ...prev, date: normalizedRecord.startDate, microcycleId: normalizedRecord.id };
          }

          return { ...prev, date: '', microcycleId: normalizedRecord.id };
        });
      }
    },
    deleteMicrocycle: (microcycleId) => {
      const microcycle = dataRef.current.microcycles.find((item) => item.id === microcycleId);
      if (!microcycle) return;

      // FIX #5: Al borrar un microciclo, persistir en Supabase el cambio en los registros hijo.
      // Antes solo se actualizaba localmente (microcycleId → ""), pero esa actualización
      // nunca se enviaba a Supabase. En el próximo sync, los registros hijo volvían a
      // apuntar al microciclo borrado. Ahora se llama persistData explícitamente
      // después de la mutación para asegurar que Supabase recibe el estado actualizado.
      applyMutation((prev) => ({
        ...prev,
        microcycles: prev.microcycles.filter((item) => item.id !== microcycleId),
        trainingSessionSummaries: prev.trainingSessionSummaries.map((item) => item.microcycleId === microcycleId ? { ...item, microcycleId: "" } : item),
        internalLoads: prev.internalLoads.map((item) => item.microcycleId === microcycleId ? { ...item, microcycleId: "" } : item),
        externalLoads: prev.externalLoads.map((item) => item.microcycleId === microcycleId ? { ...item, microcycleId: "" } : item),
      }));
      // La llamada a applyMutation ya llama a persistData internamente,
      // por lo que los registros hijo con microcycleId="" quedan guardados en Supabase.
      void deleteRemoteLegacy("microcycles", microcycleId);
      if (filters.microcycleId === microcycleId) {
        const fallback = dataRef.current.microcycles.find((item) => item.id !== microcycleId && item.category === microcycle.category);
        setFiltersState((prev) => ({ ...prev, microcycleId: fallback?.id ?? "" }));
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
  }), [data, filters, backendMode, syncStatus, isHydrated, localBackups, canEdit, permissionMessage]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
