import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DailyWellnessRecord } from '@/lib/schemas';

const WELLNESS_STORAGE_KEY = 'orsomarso-wellness-records';

interface WellnessState {
  wellnessRecords: DailyWellnessRecord[];
  addWellness: (record: DailyWellnessRecord) => void;
  upsertWellness: (record: DailyWellnessRecord) => void;
  deleteWellness: (recordId: string) => void;
  getWellnessByPlayerId: (playerId: string) => DailyWellnessRecord[];
  getWellnessByDate: (date: string) => DailyWellnessRecord[];
  getWellnessByPlayerAndDate: (playerId: string, date: string) => DailyWellnessRecord | undefined;
}

export const useWellnessStore = create<WellnessState>()(
  persist(
    (set, get) => ({
      wellnessRecords: [],
      
      addWellness: (record) => set((state) => ({ 
        wellnessRecords: [...state.wellnessRecords, record] 
      })),
      
      upsertWellness: (record) => set((state) => {
        const exists = state.wellnessRecords.some((r) => r.id === record.id);
        if (exists) {
          return {
            wellnessRecords: state.wellnessRecords.map((r) => 
              r.id === record.id ? record : r
            )
          };
        }
        return {
          wellnessRecords: [...state.wellnessRecords, record]
        };
      }),
      
      deleteWellness: (recordId) => set((state) => ({
        wellnessRecords: state.wellnessRecords.filter((r) => r.id !== recordId)
      })),
      
      getWellnessByPlayerId: (playerId) => get().wellnessRecords.filter((r) => 
        r.playerId === playerId
      ),
      
      getWellnessByDate: (date) => get().wellnessRecords.filter((r) => 
        r.date === date
      ),
      
      getWellnessByPlayerAndDate: (playerId, date) => get().wellnessRecords.find((r) => 
        r.playerId === playerId && r.date === date
      ),
    }),
    {
      name: WELLNESS_STORAGE_KEY,
      partialize: (state) => ({ wellnessRecords: state.wellnessRecords }),
    }
  )
);
