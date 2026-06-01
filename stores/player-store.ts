import { create } from 'zustand';
import { Player, DailyWellnessRecord, DailyInternalLoadRecord, DailyExternalLoadRecord } from '@/lib/schemas';

interface PlayerState {
  players: Player[];
  selectedPlayerId: string | null;
  setSelectedPlayer: (id: string | null) => void;
  addPlayer: (player: Player) => void;
  updatePlayer: (player: Player) => void;
  deletePlayer: (playerId: string) => void;
  getPlayerById: (id: string) => Player | undefined;
  getPlayersByCategory: (category: string) => Player[];
  getPlayersByPosition: (position: string) => Player[];
  getPlayersByStatus: (status: string) => Player[];
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  players: [],
  selectedPlayerId: null,
  
  setSelectedPlayer: (id) => set({ selectedPlayerId: id }),
  
  addPlayer: (player) => set((state) => ({ 
    players: [...state.players, player] 
  })),
  
  updatePlayer: (player) => set((state) => ({
    players: state.players.map((p) => p.id === player.id ? player : p)
  })),
  
  deletePlayer: (playerId) => set((state) => ({
    players: state.players.filter((p) => p.id !== playerId),
    selectedPlayerId: state.selectedPlayerId === playerId ? null : state.selectedPlayerId
  })),
  
  getPlayerById: (id) => get().players.find((p) => p.id === id),
  
  getPlayersByCategory: (category) => get().players.filter((p) => 
    category === 'all' || p.category === category
  ),
  
  getPlayersByPosition: (position) => get().players.filter((p) => 
    p.position === position || p.secondaryPosition === position
  ),
  
  getPlayersByStatus: (status) => get().players.filter((p) => 
    p.status === status
  ),
}));
