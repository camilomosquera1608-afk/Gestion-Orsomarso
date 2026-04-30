'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initialData } from '@/lib/mock-data';
import { fetchRemoteAppState, hasSupabaseConfig, legacyAppStateSyncEnabled, saveRemoteAppState, supabase, tableSchemaSyncEnabled } from '@/lib/supabase';
import { deleteSupabaseTableRowByLegacyId, fetchSupabaseTablesAppData, saveSupabaseTablesAppData } from '@/lib/supabase-table-sync';
import { createLocalBackup, getLocalBackupPayload, listLocalBackups, readLocalAppData, saveLocalAppData } from '@/lib/app-storage';
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
  updateMicrocycle: (record: Microcycle) => void;
  deleteMicrocycle: (microcycleId: string) => void;
  backendMode: 'supabase' | 'local';
  syncStatus: 'idle' | 'syncing' | 'ready' | 'error';
  localBackups: LocalBackupMeta[];
  createLocalSnapshot: (label?: string) => void;
  restoreLocalSnapshot: (backupId: string) => boolean;
  importAppDataJson: (rawJson: string) => boolean;
  exportAppDataJson: () => string;
  forceSync: () => Promise<void>;
  pushLocalToRemote: () => Promise<void>;
  canEdit: boolean;
  permissionMessage: string;
}

const defaultFilters: GlobalFilters = {
  date: '2026-04-23',
  microcycleId: 'mc-14',
  playerId: 'all',
  position: 'all',
  status: 'all',
  category: 'all',
  actingCategory: 'all',
  movementType: 'all',
  sessionNumber: 1,
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

const DEFAULT_CATEGORY = 'Sub20' as const;

const hydrateData = (stored: Partial<AppData> | null): AppData => normalizeAppData(stored, initialData);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
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
  const currentSession = getStaffSession();
  const canEdit = !currentSession.isAuthenticated || canWrite(currentSession);
  const permissionMessage = currentSession.isAuthenticated && !canWrite(currentSession) ? 'Solo lectura.' : 'Guardado.';

  const refreshFromSupabase = async (source: 'manual' | 'realtime' | 'poll' = 'manual') => {
    if (!hasSupabaseConfig || !tableSchemaSyncEnabled || !supabase) return;
    if (source !== 'manual' && Date.now() < skipRemoteRefreshUntilRef.current) return;

    setSyncStatus(source === 'manual' ? 'syncing' : 'ready');
    const remote = await fetchSupabaseTablesAppData(supabase);
    if (!remote.ok) {
      setSyncStatus('error');
      return;
    }

    const next = hydrateData(remote.data);
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
      skipRemoteRefreshUntilRef.current = Date.now() + 2500;
      setSyncStatus('syncing');
      const session = getStaffSession();
      const scopedData = filterAppDataForSession(nextData, session);
      const result = await saveSupabaseTablesAppData(supabase, scopedData);
      setSyncStatus(result.ok ? 'ready' : 'error');
      skipRemoteRefreshUntilRef.current = Date.now() + 1200;
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
      const session = getStaffSession();
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


  const deleteRemoteLegacy = async (table: string, legacyId: string) => {
    if (!hasSupabaseConfig || !tableSchemaSyncEnabled || !supabase) return;
    const session = getStaffSession();
    if (session.isAuthenticated && !canWrite(session)) return;
    skipRemoteRefreshUntilRef.current = Date.now() + 2500;
    const result = await deleteSupabaseTableRowByLegacyId(supabase, table, legacyId);
    setSyncStatus(result.ok ? 'ready' : 'error');
    skipRemoteRefreshUntilRef.current = Date.now() + 1200;
  };

  useEffect(() => {
    const init = async () => {
      if (hasSupabaseConfig && tableSchemaSyncEnabled && supabase) {
        setSyncStatus('syncing');
        const remote = await fetchSupabaseTablesAppData(supabase);
        if (remote.ok) {
          const next = hydrateData(remote.data);
          setData(next);
          dataRef.current = next;
          saveLocalAppData(next);
          setSyncStatus('ready');
        } else {
          const local = readLocalAppData();
          const hydrated = hydrateData(local ?? initialData);
          setData(hydrated);
          dataRef.current = hydrated;
          const remoteReason = remote.ok ? undefined : remote.reason;
          setSyncStatus(remoteReason === 'not_authenticated' ? 'error' : 'ready');
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
      setFiltersState((prev) => ({ ...prev, category: getAllowedCategory(session) }));
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
      if (remoteRefreshTimerRef.current) clearTimeout(remoteRefreshTimerRef.current);
      clearInterval(interval);
      void supabaseClient.removeChannel(channel);
    };
  }, [isHydrated]);

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
      const session = getStaffSession();
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
    const session = getStaffSession();
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
    const session = getStaffSession();
    const category = getAllowedCategory(session);
    const detected = findMicrocycleByDate(dataRef.current.microcycles, defaultFilters.date, defaultFilters.microcycleId, category);
    const fallbackMicrocycle = detected ?? getMicrocyclesForCategory(dataRef.current.microcycles, category)[0] ?? dataRef.current.microcycles[0];
    setFiltersState({
      ...defaultFilters,
      category,
      microcycleId: fallbackMicrocycle?.id ?? defaultFilters.microcycleId,
    });
  };

  const value = useMemo<AppContextValue>(() => ({
    data,
    filters,
    setFilters,
    resetFilters,
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
      const session = getStaffSession();
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
      void deleteRemoteLegacy('players', playerId);
    },
    addWellness: (record) => applyMutation((prev) => ({ ...prev, wellness: [record, ...prev.wellness] })),
    upsertWellness: (record) => applyMutation((prev) => ({
      ...prev,
      wellness: [record, ...prev.wellness.filter((item) => !(item.playerId === record.playerId && item.date === record.date))],
    })),
    addInternalLoad: (record) => applyMutation((prev) => ({ ...prev, internalLoads: [record, ...prev.internalLoads] })),
    upsertInternalLoad: (record) => applyMutation((prev) => ({
      ...prev,
      internalLoads: [{ ...record, microcycleId: record.microcycleId ?? filters.microcycleId, sessionNumber: record.sessionNumber ?? filters.sessionNumber }, ...prev.internalLoads.filter((item) => !(item.playerId === record.playerId && item.date === record.date && (item.sessionNumber ?? filters.sessionNumber) === (record.sessionNumber ?? filters.sessionNumber)))],
    })),
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
    addCMJRecord: (record) => applyMutation((prev) => ({ ...prev, cmjRecords: [record, ...prev.cmjRecords] })),
    updateCMJRecord: (record) => applyMutation((prev) => ({ ...prev, cmjRecords: prev.cmjRecords.map((item) => item.id === record.id ? record : item) })),
    deleteCMJRecord: (recordId) => {
      applyMutation((prev) => ({ ...prev, cmjRecords: prev.cmjRecords.filter((item) => item.id !== recordId) }));
      void deleteRemoteLegacy('cmj_records', recordId);
    },
    addNutritionRecord: (record) => applyMutation((prev) => ({ ...prev, nutritionRecords: [record, ...prev.nutritionRecords] })),
    updateNutritionRecord: (record) => applyMutation((prev) => ({ ...prev, nutritionRecords: prev.nutritionRecords.map((item) => item.id === record.id ? record : item) })),
    deleteNutritionRecord: (recordId) => {
      applyMutation((prev) => ({ ...prev, nutritionRecords: prev.nutritionRecords.filter((item) => item.id !== recordId) }));
      void deleteRemoteLegacy('nutrition_records', recordId);
    },
    addNeuromuscularRecord: (record) => applyMutation((prev) => ({ ...prev, neuromuscularRecords: [record, ...prev.neuromuscularRecords] })),
    updateNeuromuscularRecord: (record) => applyMutation((prev) => ({ ...prev, neuromuscularRecords: prev.neuromuscularRecords.map((item) => item.id === record.id ? record : item) })),
    deleteNeuromuscularRecord: (recordId) => {
      applyMutation((prev) => ({ ...prev, neuromuscularRecords: prev.neuromuscularRecords.filter((item) => item.id !== recordId) }));
      void deleteRemoteLegacy('neuromuscular_records', recordId);
    },
    addFMSRecord: (record) => applyMutation((prev) => ({ ...prev, fmsRecords: [record, ...prev.fmsRecords] })),
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
    upsertTrainingSessionSummary: (record) => applyMutation((prev) => ({ ...prev, trainingSessionSummaries: [record, ...prev.trainingSessionSummaries.filter((item) => !(item.id === record.id || (item.date === record.date && item.category === record.category)))] })),
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
      applyMutation((prev) => ({
        ...prev,
        microcycles: prev.microcycles.filter((item) => item.id !== microcycleId),
        trainingSessionSummaries: prev.trainingSessionSummaries.map((item) => item.microcycleId === microcycleId ? { ...item, microcycleId: "" } : item),
        internalLoads: prev.internalLoads.map((item) => item.microcycleId === microcycleId ? { ...item, microcycleId: "" } : item),
        externalLoads: prev.externalLoads.map((item) => item.microcycleId === microcycleId ? { ...item, microcycleId: "" } : item),
      }));
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
    restoreLocalSnapshot,
    importAppDataJson,
    exportAppDataJson,
    forceSync,
    pushLocalToRemote,
    canEdit,
    permissionMessage,
  }), [data, filters, backendMode, syncStatus, localBackups, canEdit, permissionMessage]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
