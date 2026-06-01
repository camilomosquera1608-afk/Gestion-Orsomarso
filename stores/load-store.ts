import { create } from 'zustand';
import { DailyInternalLoadRecord, DailyExternalLoadRecord } from '@/lib/schemas';

interface LoadState {
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  
  // Internal Load Actions
  addInternalLoad: (record: DailyInternalLoadRecord) => void;
  upsertInternalLoad: (record: DailyInternalLoadRecord) => void;
  updateInternalLoad: (record: DailyInternalLoadRecord) => void;
  deleteInternalLoad: (recordId: string) => void;
  
  // External Load Actions
  addExternalLoad: (record: DailyExternalLoadRecord) => void;
  updateExternalLoad: (record: DailyExternalLoadRecord) => void;
  deleteExternalLoad: (recordId: string) => void;
  
  // Getters
  getInternalLoadsByPlayerId: (playerId: string) => DailyInternalLoadRecord[];
  getExternalLoadsByPlayerId: (playerId: string) => DailyExternalLoadRecord[];
  getInternalLoadsByDate: (date: string) => DailyInternalLoadRecord[];
  getExternalLoadsByDate: (date: string) => DailyExternalLoadRecord[];
  getInternalLoadByPlayerAndDate: (playerId: string, date: string) => DailyInternalLoadRecord | undefined;
  getExternalLoadByPlayerAndDate: (playerId: string, date: string) => DailyExternalLoadRecord | undefined;
}

export const useLoadStore = create<LoadState>((set, get) => ({
  internalLoads: [],
  externalLoads: [],
  
  addInternalLoad: (record) => set((state) => ({ 
    internalLoads: [...state.internalLoads, record] 
  })),
  
  upsertInternalLoad: (record) => set((state) => {
    const exists = state.internalLoads.some((r) => r.id === record.id);
    if (exists) {
      return {
        internalLoads: state.internalLoads.map((r) => 
          r.id === record.id ? record : r
        )
      };
    }
    return {
      internalLoads: [...state.internalLoads, record]
    };
  }),
  
  updateInternalLoad: (record) => set((state) => ({
    internalLoads: state.internalLoads.map((r) => 
      r.id === record.id ? record : r
    )
  })),
  
  deleteInternalLoad: (recordId) => set((state) => ({
    internalLoads: state.internalLoads.filter((r) => r.id !== recordId)
  })),
  
  addExternalLoad: (record) => set((state) => ({ 
    externalLoads: [...state.externalLoads, record] 
  })),
  
  updateExternalLoad: (record) => set((state) => ({
    externalLoads: state.externalLoads.map((r) => 
      r.id === record.id ? record : r
    )
  })),
  
  deleteExternalLoad: (recordId) => set((state) => ({
    externalLoads: state.externalLoads.filter((r) => r.id !== recordId)
  })),
  
  getInternalLoadsByPlayerId: (playerId) => get().internalLoads.filter((r) => 
    r.playerId === playerId
  ),
  
  getExternalLoadsByPlayerId: (playerId) => get().externalLoads.filter((r) => 
    r.playerId === playerId
  ),
  
  getInternalLoadsByDate: (date) => get().internalLoads.filter((r) => 
    r.date === date
  ),
  
  getExternalLoadsByDate: (date) => get().externalLoads.filter((r) => 
    r.date === date
  ),
  
  getInternalLoadByPlayerAndDate: (playerId, date) => get().internalLoads.find((r) => 
    r.playerId === playerId && r.date === date
  ),
  
  getExternalLoadByPlayerAndDate: (playerId, date) => get().externalLoads.find((r) => 
    r.playerId === playerId && r.date === date
  ),
}));
