'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initialData } from '@/lib/mock-data';
import { fetchRemoteAppState, hasSupabaseConfig, saveRemoteAppState } from '@/lib/supabase';
import { getAllowedCategory, getStaffSession, isMasterRole } from '@/lib/auth';
import { findMicrocycleByDate, inferMicrocycleFromSequence } from '@/lib/utils';
import { AppData, CMJRecord, ClubCategory, CompetitionRecord, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord, FMSRecord, GlobalFilters, NeuromuscularRecord, NutritionRecord, Player, TrainingSessionSummary } from '@/lib/types';

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
  upsertTrainingSessionSummary: (record: TrainingSessionSummary) => void;
  backendMode: 'supabase' | 'local';
  syncStatus: 'idle' | 'syncing' | 'ready' | 'error';
  forceSync: () => Promise<void>;
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
const STORAGE_KEY = 'orsomarso-performance-hub';

const DEFAULT_CATEGORY: ClubCategory = 'Sub20';

const hydrateData = (stored: Partial<AppData> | null): AppData => ({
  ...initialData,
  ...stored,
  players: (stored?.players ?? initialData.players).map((player) => ({ ...player, category: player.category ?? DEFAULT_CATEGORY, categoryHistory: player.categoryHistory ?? [player.category ?? DEFAULT_CATEGORY] })),
  wellness: stored?.wellness ?? initialData.wellness,
  internalLoads: (stored?.internalLoads ?? initialData.internalLoads).map((record) => ({
    ...record,
    microcycleId: record.microcycleId ?? initialData.microcycles[0].id,
    sessionNumber: record.sessionNumber ?? 1,
  })),
  externalLoads: (stored?.externalLoads ?? initialData.externalLoads).map((record) => ({
    ...record,
    microcycleId: record.microcycleId ?? initialData.microcycles[0].id,
    sessionNumber: record.sessionNumber ?? 1,
    sessionType: record.sessionType ?? 'cdEf',
    participation: record.participation ?? 'Completa',
    sprints: record.sprints ?? 0,
    ima: record.ima ?? 0,
    baseCategory: record.baseCategory ?? record.category,
    actingCategory: record.actingCategory ?? record.category,
    movementType: record.movementType ?? 'base',
    movementModule: record.movementModule ?? 'sesion',
  })),
  cmjRecords: stored?.cmjRecords ?? initialData.cmjRecords,
  nutritionRecords: stored?.nutritionRecords ?? initialData.nutritionRecords,
  neuromuscularRecords: stored?.neuromuscularRecords ?? initialData.neuromuscularRecords,
  fmsRecords: stored?.fmsRecords ?? initialData.fmsRecords,
  competitionRecords: (stored?.competitionRecords ?? initialData.competitionRecords).map((record) => ({ ...record, baseCategory: record.baseCategory ?? record.category, actingCategory: record.actingCategory ?? record.category, movementType: record.movementType ?? 'base', movementModule: record.movementModule ?? 'competencia' })),
  trainingSessionSummaries: stored?.trainingSessionSummaries ?? initialData.trainingSessionSummaries,
  microcycles: Array.from(new Map([...(initialData.microcycles ?? []), ...((stored?.microcycles ?? []) as any[])].map((item: any) => [item.id, item])).values()),
});

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<AppData>(initialData);
  const [filters, setFiltersState] = useState<GlobalFilters>(defaultFilters);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ready' | 'error'>('idle');
  const dataRef = useRef<AppData>(initialData);
  const backendMode: 'supabase' | 'local' = hasSupabaseConfig ? 'supabase' : 'local';

  const persistData = async (nextData: AppData) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    }
    if (hasSupabaseConfig) {
      setSyncStatus('syncing');
      const result = await saveRemoteAppState(nextData);
      setSyncStatus(result.ok ? 'ready' : 'error');
    } else {
      setSyncStatus('ready');
    }
  };

  const applyMutation = (updater: (prev: AppData) => AppData) => {
    setData((prev) => {
      const next = updater(prev);
      dataRef.current = next;
      void persistData(next);
      return next;
    });
  };

  useEffect(() => {
    const init = async () => {
      if (hasSupabaseConfig) {
        setSyncStatus('syncing');
        const remote = await fetchRemoteAppState();
        if (remote?.payload && Object.keys(remote.payload).length) {
          const next = hydrateData(remote.payload as Partial<AppData>);
          setData(next);
          dataRef.current = next;
        } else {
          const local = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
          const hydrated = hydrateData(local ? JSON.parse(local) : initialData);
          setData(hydrated);
          dataRef.current = hydrated;
          await saveRemoteAppState(hydrated);
        }
        setSyncStatus('ready');
      } else {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        const next = stored ? hydrateData(JSON.parse(stored)) : initialData;
        setData(next);
        dataRef.current = next;
        setSyncStatus('ready');
      }
      const session = getStaffSession();
      setFiltersState((prev) => ({ ...prev, category: getAllowedCategory(session) }));
      setIsHydrated(true);
    };

    init();
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !isHydrated) return;

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

  const forceSync = async () => {
    if (!hasSupabaseConfig) return;
    setSyncStatus('syncing');
    const remote = await fetchRemoteAppState();
    const payload = remote?.payload as Partial<AppData> | undefined;
    if (payload) {
      const next = hydrateData(payload);
      setData(next);
      dataRef.current = next;
    }
    setSyncStatus('ready');
  };

  const setFilters = (next: Partial<GlobalFilters>) => setFiltersState((prev) => {
    const session = getStaffSession();
    const allowedCategory = getAllowedCategory(session);
    const merged = { ...prev, ...next };
    if (!isMasterRole(session)) {
      merged.category = allowedCategory;
    }
    if (next.date) {
      const detected = findMicrocycleByDate(dataRef.current.microcycles, next.date) ?? inferMicrocycleFromSequence(dataRef.current.microcycles, next.date);
      if (detected) merged.microcycleId = detected.id;
    }
    return merged;
  });
  const resetFilters = () => {
    const session = getStaffSession();
    setFiltersState({ ...defaultFilters, category: getAllowedCategory(session), microcycleId: dataRef.current.microcycles.find((item) => item.id === 'mc-14') ? 'mc-14' : 'mc-1' });
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
    deletePlayer: (playerId) => applyMutation((prev) => ({
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
    })),
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
    deleteInternalLoad: (recordId) => applyMutation((prev) => ({ ...prev, internalLoads: prev.internalLoads.filter((item) => item.id !== recordId) })),
    addExternalLoad: (record) => applyMutation((prev) => ({ ...prev, externalLoads: [{ ...record, microcycleId: record.microcycleId ?? filters.microcycleId, sessionNumber: record.sessionNumber ?? filters.sessionNumber, sessionType: record.sessionType ?? 'cdEf', participation: record.participation ?? 'Completa' }, ...prev.externalLoads] })),
    updateExternalLoad: (record) => applyMutation((prev) => ({ ...prev, externalLoads: prev.externalLoads.map((item) => item.id === record.id ? record : item) })),
    deleteExternalLoad: (recordId) => applyMutation((prev) => ({ ...prev, externalLoads: prev.externalLoads.filter((item) => item.id !== recordId) })),
    addCMJRecord: (record) => applyMutation((prev) => ({ ...prev, cmjRecords: [record, ...prev.cmjRecords] })),
    updateCMJRecord: (record) => applyMutation((prev) => ({ ...prev, cmjRecords: prev.cmjRecords.map((item) => item.id === record.id ? record : item) })),
    deleteCMJRecord: (recordId) => applyMutation((prev) => ({ ...prev, cmjRecords: prev.cmjRecords.filter((item) => item.id !== recordId) })),
    addNutritionRecord: (record) => applyMutation((prev) => ({ ...prev, nutritionRecords: [record, ...prev.nutritionRecords] })),
    updateNutritionRecord: (record) => applyMutation((prev) => ({ ...prev, nutritionRecords: prev.nutritionRecords.map((item) => item.id === record.id ? record : item) })),
    deleteNutritionRecord: (recordId) => applyMutation((prev) => ({ ...prev, nutritionRecords: prev.nutritionRecords.filter((item) => item.id !== recordId) })),
    addNeuromuscularRecord: (record) => applyMutation((prev) => ({ ...prev, neuromuscularRecords: [record, ...prev.neuromuscularRecords] })),
    updateNeuromuscularRecord: (record) => applyMutation((prev) => ({ ...prev, neuromuscularRecords: prev.neuromuscularRecords.map((item) => item.id === record.id ? record : item) })),
    deleteNeuromuscularRecord: (recordId) => applyMutation((prev) => ({ ...prev, neuromuscularRecords: prev.neuromuscularRecords.filter((item) => item.id !== recordId) })),
    addFMSRecord: (record) => applyMutation((prev) => ({ ...prev, fmsRecords: [record, ...prev.fmsRecords] })),
    updateFMSRecord: (record) => applyMutation((prev) => ({ ...prev, fmsRecords: prev.fmsRecords.map((item) => item.id === record.id ? record : item) })),
    deleteFMSRecord: (recordId) => applyMutation((prev) => ({ ...prev, fmsRecords: prev.fmsRecords.filter((item) => item.id !== recordId) })),
    addCompetitionRecord: (record) => applyMutation((prev) => ({ ...prev, competitionRecords: [record, ...prev.competitionRecords] })),
    updateCompetitionRecord: (record) => applyMutation((prev) => ({ ...prev, competitionRecords: prev.competitionRecords.map((item) => item.id === record.id ? record : item) })),
    deleteCompetitionRecord: (recordId) => applyMutation((prev) => ({ ...prev, competitionRecords: prev.competitionRecords.filter((item) => item.id !== recordId) })),
    upsertTrainingSessionSummary: (record) => applyMutation((prev) => ({ ...prev, trainingSessionSummaries: [record, ...prev.trainingSessionSummaries.filter((item) => !(item.date === record.date && item.microcycleId === record.microcycleId && item.sessionNumber === record.sessionNumber))] })),
    backendMode,
    syncStatus,
    forceSync,
  }), [data, filters, backendMode, syncStatus]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
