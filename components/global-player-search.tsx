'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, X, Plus, Star, Eye, Mail, UserPlus, Globe, MapPin, Calendar, TrendingUp } from 'lucide-react';
import { useScoutingStore } from '@/stores/scouting-store';
import { ExternalPlayer, PositionSchema, DominantFootSchema } from '@/lib/schemas';
import { AccessibleButton } from './accessible-button';
import { AccessibleInput } from './accessible-input';
import { cn } from '@/lib/utils';
import { FadeIn, StaggerContainer, StaggerItem } from './animated-wrapper';
import { Skeleton } from './loading-skeleton';

export function GlobalPlayerSearch() {
  const {
    searchFilters,
    setSearchFilters,
    searchPlayers,
    searchResults,
    isSearching,
    searchError,
    clearSearchResults,
    leagues,
    loadLeagues,
    addExternalPlayer,
    setScoutStatus,
    setScoutRating,
  } = useScoutingStore();

  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<ExternalPlayer | null>(null);

  useEffect(() => {
    loadLeagues();
  }, [loadLeagues]);

  const handleSearch = () => {
    searchPlayers();
  };

  const handleClearFilters = () => {
    setSearchFilters({});
    clearSearchResults();
  };

  const handleAddToDatabase = (player: ExternalPlayer) => {
    addExternalPlayer(player);
    setScoutStatus(player.id, 'watching');
  };

  const positions = ['Portero', 'Defensa central', 'Lateral', 'Mediocampista', 'Extremo', 'Delantero'];
  const feet = ['Derecha', 'Izquierda', 'Ambidiestro'];
  const scoutStatuses = ['none', 'watching', 'shortlisted', 'contacted', 'rejected'];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="toolbar">
          <div>
            <span className="section-eyebrow">Scouting</span>
            <h3 style={{ margin: 0 }}>Búsqueda global de jugadores</h3>
          </div>
          <div className="btn-row">
            <AccessibleButton
              variant="secondary"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              ariaLabel="Mostrar filtros avanzados"
            >
              <Filter size={16} className="mr-2" />
              Filtros
            </AccessibleButton>
            {Object.keys(searchFilters).length > 0 && (
              <AccessibleButton
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                ariaLabel="Limpiar filtros"
              >
                <X size={16} className="mr-2" />
                Limpiar
              </AccessibleButton>
            )}
          </div>
        </div>

        {/* Main Search Bar */}
        <div className="btn-row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <AccessibleInput
              label="Nombre del jugador"
              value={searchFilters.name || ''}
              onChange={(e) => setSearchFilters({ ...searchFilters, name: e.target.value })}
              placeholder="Ej: Messi, Haaland, Mbappé..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
          </div>
          <AccessibleButton
            variant="primary"
            onClick={handleSearch}
            isLoading={isSearching}
            className="mt-6"
            ariaLabel="Buscar jugadores"
          >
            <Search size={16} className="mr-2" />
            Buscar
          </AccessibleButton>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <FadeIn>
            <div className="grid" style={{ marginTop: 16, gap: 12, paddingTop: 16, borderTop: '1px solid var(--border)', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {/* Position Filter */}
              <div>
                <label className="field">
                  <span className="field-label">Posición</span>
                  <select
                  value={searchFilters.position?.[0] || ''}
                  onChange={(e) =>
                    setSearchFilters({
                      ...searchFilters,
                      position: e.target.value ? [e.target.value as any] : undefined,
                    })
                  }
                  className="select"
                >
                  <option value="">Todas las posiciones</option>
                  {positions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
                </label>
              </div>

              {/* Age Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Edad mínima
                  </label>
                  <input
                    type="number"
                    min="14"
                    max="40"
                    value={searchFilters.ageMin || ''}
                    onChange={(e) =>
                      setSearchFilters({
                        ...searchFilters,
                        ageMin: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="14"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Edad máxima
                  </label>
                  <input
                    type="number"
                    min="14"
                    max="40"
                    value={searchFilters.ageMax || ''}
                    onChange={(e) =>
                      setSearchFilters({
                        ...searchFilters,
                        ageMax: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="40"
                  />
                </div>
              </div>

              {/* Nationality */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nacionalidad
                </label>
                <input
                  type="text"
                  value={searchFilters.nationality?.[0] || ''}
                  onChange={(e) =>
                    setSearchFilters({
                      ...searchFilters,
                      nationality: e.target.value ? [e.target.value] : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Argentina, Brasil..."
                />
              </div>

              {/* League */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Liga
                </label>
                <select
                  value={searchFilters.league?.[0] || ''}
                  onChange={(e) =>
                    setSearchFilters({
                      ...searchFilters,
                      league: e.target.value ? [e.target.value] : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas las ligas</option>
                  {leagues.map((league) => (
                    <option key={league.id} value={league.name}>
                      {league.name} ({league.country})
                    </option>
                  ))}
                </select>
              </div>

              {/* Market Value Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Valor mínimo (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000000"
                    value={searchFilters.marketValueMin || ''}
                    onChange={(e) =>
                      setSearchFilters({
                        ...searchFilters,
                        marketValueMin: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Valor máximo (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000000"
                    value={searchFilters.marketValueMax || ''}
                    onChange={(e) =>
                      setSearchFilters({
                        ...searchFilters,
                        marketValueMax: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Sin límite"
                  />
                </div>
              </div>

              {/* Dominant Foot */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pie dominante
                </label>
                <select
                  value={searchFilters.dominantFoot?.[0] || ''}
                  onChange={(e) =>
                    setSearchFilters({
                      ...searchFilters,
                      dominantFoot: e.target.value ? [e.target.value as any] : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Cualquiera</option>
                  {feet.map((foot) => (
                    <option key={foot} value={foot}>
                      {foot}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </FadeIn>
        )}
      </div>

      {/* Search Error */}
      {searchError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {searchError}
        </div>
      )}

      {/* Search Results */}
      {isSearching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-64" />
          ))}
        </div>
      ) : searchResults.length > 0 ? (
        <StaggerContainer>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((player) => (
              <StaggerItem key={player.id}>
                <PlayerCard
                  player={player}
                  onAdd={() => handleAddToDatabase(player)}
                  onSelect={() => setSelectedPlayer(player)}
                />
              </StaggerItem>
            ))}
          </div>
        </StaggerContainer>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Globe size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Busca jugadores de todo el mundo
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Usa los filtros para encontrar jugadores por posición, edad, liga y más
          </p>
        </div>
      )}
    </div>
  );
}

interface PlayerCardProps {
  player: ExternalPlayer;
  onAdd: () => void;
  onSelect: () => void;
}

function PlayerCard({ player, onAdd, onSelect }: PlayerCardProps) {
  const { setScoutStatus, setScoutRating } = useScoutingStore();

  const formatMarketValue = (value?: number) => {
    if (!value) return 'N/A';
    if (value >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `€${(value / 1000).toFixed(0)}K`;
    return `€${value}`;
  };

  const statusColors = {
    none: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    watching: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    shortlisted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    contacted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
      {/* Player Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {player.photoUrl ? (
              <img
                src={player.photoUrl}
                alt={player.name}
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/48';
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <UserPlus size={20} className="text-gray-400" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{player.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{player.position}</span>
                <span>•</span>
                <span>{player.age} años</span>
              </div>
            </div>
          </div>
          <span className={cn('px-2 py-1 text-xs font-medium rounded', statusColors[player.scoutStatus])}>
            {player.scoutStatus}
          </span>
        </div>
      </div>

      {/* Player Details */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <MapPin size={14} />
            <span className="truncate">{player.currentClub}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Globe size={14} />
            <span className="truncate">{player.league}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Calendar size={14} />
            <span>{player.nationality}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <TrendingUp size={14} />
            <span>{formatMarketValue(player.marketValue)}</span>
          </div>
        </div>

        {/* Performance Metrics */}
        {player.matchesPlayed && (
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {player.matchesPlayed}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Partidos</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {player.goals || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Goles</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {player.assists || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Asistencias</div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
        <AccessibleButton
          variant="primary"
          size="sm"
          onClick={onAdd}
          className="flex-1"
          ariaLabel="Agregar a base de scouting"
        >
          <Plus size={14} className="mr-2" />
          Agregar
        </AccessibleButton>
        <AccessibleButton
          variant="secondary"
          size="sm"
          onClick={onSelect}
          ariaLabel="Ver detalles"
        >
          <Eye size={14} />
        </AccessibleButton>
      </div>
    </div>
  );
}
