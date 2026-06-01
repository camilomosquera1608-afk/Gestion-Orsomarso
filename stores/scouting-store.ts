import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ExternalPlayer, ScoutingSearchFilters, PlayerComparison, League } from '@/lib/schemas';
import { getWyscoutClientOrMock } from '@/lib/wyscout-client';
import { emitAlertTriggered } from '@/lib/event-bus';

interface ScoutingState {
  // External players database
  externalPlayers: ExternalPlayer[];
  leagues: League[];
  
  // Search state
  searchFilters: ScoutingSearchFilters;
  searchResults: ExternalPlayer[];
  isSearching: boolean;
  searchError: string | null;
  
  // Import state
  isImporting: boolean;
  importProgress: number;
  importError: string | null;
  
  // Comparisons
  comparisons: PlayerComparison[];
  
  // Actions
  setSearchFilters: (filters: ScoutingSearchFilters) => void;
  searchPlayers: () => Promise<void>;
  clearSearchResults: () => void;
  
  addExternalPlayer: (player: ExternalPlayer) => void;
  updateExternalPlayer: (id: string, updates: Partial<ExternalPlayer>) => void;
  removeExternalPlayer: (id: string) => void;
  getExternalPlayerById: (id: string) => ExternalPlayer | undefined;
  
  importFromWyscout: (config: { leagueIds: string[]; season: string; includeStats?: boolean }) => Promise<void>;
  
  setScoutStatus: (playerId: string, status: ExternalPlayer['scoutStatus']) => void;
  setScoutRating: (playerId: string, rating: number) => void;
  setScoutNotes: (playerId: string, notes: string) => void;
  
  addComparison: (comparison: PlayerComparison) => void;
  removeComparison: (id: string) => void;
  getComparisonsForPlayer: (externalPlayerId: string) => PlayerComparison[];
  
  loadLeagues: () => Promise<void>;
  
  // Filter helpers
  filterExternalPlayers: (filters: Partial<ScoutingSearchFilters>) => ExternalPlayer[];
  getShortlistedPlayers: () => ExternalPlayer[];
  getContactedPlayers: () => ExternalPlayer[];
}

export const useScoutingStore = create<ScoutingState>()(
  persist(
    (set, get) => ({
      externalPlayers: [],
      leagues: [],
      searchFilters: {},
      searchResults: [],
      isSearching: false,
      searchError: null,
      isImporting: false,
      importProgress: 0,
      importError: null,
      comparisons: [],

      setSearchFilters: (filters) => {
        set({ searchFilters: filters });
      },

      searchPlayers: async () => {
        set({ isSearching: true, searchError: null });
        
        try {
          const client = getWyscoutClientOrMock();
          const filters = get().searchFilters;
          
          const response = await client.searchPlayers({
            name: filters.name,
            position: filters.position?.[0],
            ageMin: filters.ageMin,
            ageMax: filters.ageMax,
            nationality: filters.nationality?.[0],
            league: filters.league?.[0],
            marketValueMin: filters.marketValueMin,
            marketValueMax: filters.marketValueMax,
            pageSize: 50,
          });

          const convertedPlayers = response.players.map((player: any) =>
            client.convertToExternalPlayer(player)
          );

          set({
            searchResults: convertedPlayers,
            isSearching: false,
          });

          emitAlertTriggered(
            'search-complete',
            'info',
            `Se encontraron ${response.total} jugadores`
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al buscar jugadores';
          set({ searchError: errorMessage, isSearching: false });
          emitAlertTriggered('search-error', 'error', errorMessage);
        }
      },

      clearSearchResults: () => {
        set({ searchResults: [], searchFilters: {} });
      },

      addExternalPlayer: (player) => {
        set((state) => ({
          externalPlayers: [...state.externalPlayers, player],
        }));
        emitAlertTriggered(
          `player-${player.id}`,
          'success',
          `Jugador ${player.name} agregado a la base de scouting`
        );
      },

      updateExternalPlayer: (id, updates) => {
        set((state) => ({
          externalPlayers: state.externalPlayers.map((p) =>
            p.id === id ? { ...p, ...updates, lastUpdated: new Date().toISOString() } : p
          ),
        }));
      },

      removeExternalPlayer: (id) => {
        set((state) => ({
          externalPlayers: state.externalPlayers.filter((p) => p.id !== id),
        }));
      },

      getExternalPlayerById: (id) => {
        return get().externalPlayers.find((p) => p.id === id);
      },

      importFromWyscout: async (config) => {
        set({ isImporting: true, importProgress: 0, importError: null });

        try {
          const client = getWyscoutClientOrMock();
          const totalLeagues = config.leagueIds.length;
          let allPlayers: ExternalPlayer[] = [];

          for (let i = 0; i < totalLeagues; i++) {
            const leagueId = config.leagueIds[i];
            
            try {
              const players = await client.importLeaguePlayers(
                leagueId,
                config.season,
                {
                  includeStats: config.includeStats,
                }
              );

              const convertedPlayers = players.map((player: any) =>
                client.convertToExternalPlayer(player)
              );

              allPlayers = [...allPlayers, ...convertedPlayers];
              
              set({
                importProgress: ((i + 1) / totalLeagues) * 100,
              });
            } catch (error) {
              console.error(`Error importing league ${leagueId}:`, error);
            }
          }

          // Remove duplicates based on wyscoutId
          const uniquePlayers = allPlayers.filter(
            (player, index, self) =>
              index === self.findIndex((p) => p.wyscoutId === player.wyscoutId)
          );

          set((state) => ({
            externalPlayers: [...state.externalPlayers, ...uniquePlayers],
            isImporting: false,
            importProgress: 100,
          }));

          emitAlertTriggered(
            'import-complete',
            'success',
            `Se importaron ${uniquePlayers.length} jugadores de Wyscout`
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al importar jugadores';
          set({ importError: errorMessage, isImporting: false, importProgress: 0 });
          emitAlertTriggered('import-error', 'error', errorMessage);
        }
      },

      setScoutStatus: (playerId, status) => {
        get().updateExternalPlayer(playerId, { scoutStatus: status });
      },

      setScoutRating: (playerId, rating) => {
        get().updateExternalPlayer(playerId, { scoutRating: rating });
      },

      setScoutNotes: (playerId, notes) => {
        get().updateExternalPlayer(playerId, { scoutNotes: notes });
      },

      addComparison: (comparison) => {
        set((state) => ({
          comparisons: [...state.comparisons, comparison],
        }));
      },

      removeComparison: (id) => {
        set((state) => ({
          comparisons: state.comparisons.filter((c) => c.id !== id),
        }));
      },

      getComparisonsForPlayer: (externalPlayerId) => {
        return get().comparisons.filter((c) => c.externalPlayerId === externalPlayerId);
      },

      loadLeagues: async () => {
        try {
          const client = getWyscoutClientOrMock();
          const leagues = await client.getLeagues();
          
          const convertedLeagues: League[] = leagues.map((league: any) => ({
            id: league.leagueId,
            name: league.name,
            country: league.country,
            tier: league.tier as 'top' | 'mid' | 'low',
            wyscoutId: league.leagueId,
          }));

          set({ leagues: convertedLeagues });
        } catch (error) {
          console.error('Error loading leagues:', error);
        }
      },

      filterExternalPlayers: (filters) => {
        const players = get().externalPlayers;
        
        return players.filter((player) => {
          if (filters.name && !player.name.toLowerCase().includes(filters.name.toLowerCase())) {
            return false;
          }
          if (filters.position && filters.position.length > 0 && !filters.position.includes(player.position)) {
            return false;
          }
          if (filters.ageMin && player.age < filters.ageMin) {
            return false;
          }
          if (filters.ageMax && player.age > filters.ageMax) {
            return false;
          }
          if (filters.nationality && filters.nationality.length > 0 && !filters.nationality.includes(player.nationality)) {
            return false;
          }
          if (filters.league && filters.league.length > 0 && !filters.league.includes(player.league)) {
            return false;
          }
          if (filters.scoutStatus && filters.scoutStatus.length > 0 && !filters.scoutStatus.includes(player.scoutStatus)) {
            return false;
          }
          if (filters.marketValueMin && player.marketValue && player.marketValue < filters.marketValueMin) {
            return false;
          }
          if (filters.marketValueMax && player.marketValue && player.marketValue > filters.marketValueMax) {
            return false;
          }
          if (filters.minMatchesPlayed && player.matchesPlayed && player.matchesPlayed < filters.minMatchesPlayed) {
            return false;
          }
          if (filters.minMinutesPlayed && player.minutesPlayed && player.minutesPlayed < filters.minMinutesPlayed) {
            return false;
          }
          return true;
        });
      },

      getShortlistedPlayers: () => {
        return get().externalPlayers.filter((p) => p.scoutStatus === 'shortlisted');
      },

      getContactedPlayers: () => {
        return get().externalPlayers.filter((p) => p.scoutStatus === 'contacted');
      },
    }),
    {
      name: 'scouting-storage',
      partialize: (state) => ({
        externalPlayers: state.externalPlayers,
        leagues: state.leagues,
        comparisons: state.comparisons,
      }),
    }
  )
);
