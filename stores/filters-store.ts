import { create } from 'zustand';
import { GlobalFilters } from '@/lib/schemas';

interface FiltersState {
  filters: GlobalFilters;
  setFilters: (filters: Partial<GlobalFilters>) => void;
  resetFilters: () => void;
  setDate: (date: string) => void;
  setCategory: (category: string) => void;
  setMicrocycleId: (microcycleId: string) => void;
}

const defaultFilters: GlobalFilters = {
  date: new Date().toISOString().slice(0, 10),
  category: 'all',
  microcycleId: undefined,
};

export const useFiltersStore = create<FiltersState>((set) => ({
  filters: defaultFilters,
  
  setFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters }
  })),
  
  resetFilters: () => set({ filters: defaultFilters }),
  
  setDate: (date) => set((state) => ({
    filters: { ...state.filters, date }
  })),
  
  setCategory: (category) => set((state) => ({
    filters: { ...state.filters, category: category as any }
  })),
  
  setMicrocycleId: (microcycleId) => set((state) => ({
    filters: { ...state.filters, microcycleId }
  })),
}));
