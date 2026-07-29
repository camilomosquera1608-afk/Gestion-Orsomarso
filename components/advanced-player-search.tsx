'use client';

import { useState, useMemo } from 'react';
import { Search, X, Filter, Clock } from 'lucide-react';
import { useApp } from '@/context/app-context';
import { categoryLabel } from '@/lib/labels';

interface SearchFilters {
  name: string;
  position: string;
  category: string;
  status: string;
}

interface AdvancedPlayerSearchProps {
  onPlayerSelect: (playerId: string) => void;
  onClose?: () => void;
}

export function AdvancedPlayerSearch({ onPlayerSelect, onClose }: AdvancedPlayerSearchProps) {
  const { data } = useApp();
  const [filters, setFilters] = useState<SearchFilters>({
    name: '',
    position: '',
    category: '',
    status: '',
  });
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('recent-player-searches');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const positions = useMemo(() => {
    const posSet = new Set(data.players.map(p => p.position).filter(Boolean));
    return Array.from(posSet).sort();
  }, [data.players]);

  const categories = useMemo(() => {
    const catSet = new Set(data.players.map(p => p.category).filter(Boolean));
    return Array.from(catSet).sort();
  }, [data.players]);

  const statuses = useMemo(() => {
    const statusSet = new Set(data.players.map(p => p.status).filter(Boolean));
    return Array.from(statusSet).sort();
  }, [data.players]);

  const filteredPlayers = useMemo(() => {
    return data.players.filter(player => {
      const nameMatch = !filters.name || 
        player.name.toLowerCase().includes(filters.name.toLowerCase());
      const positionMatch = !filters.position || player.position === filters.position;
      const categoryMatch = !filters.category || player.category === filters.category;
      const statusMatch = !filters.status || player.status === filters.status;
      
      return nameMatch && positionMatch && categoryMatch && statusMatch;
    });
  }, [data.players, filters]);

  const handleSearch = (playerName: string) => {
    const newRecentSearches = [playerName, ...recentSearches.filter(s => s !== playerName)].slice(0, 5);
    setRecentSearches(newRecentSearches);
    localStorage.setItem('recent-player-searches', JSON.stringify(newRecentSearches));
  };

  const clearFilters = () => {
    setFilters({ name: '', position: '', category: '', status: '' });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="card fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Búsqueda avanzada</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar búsqueda"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={filters.name}
          onChange={(e) => setFilters({ ...filters, name: e.target.value })}
          className="input pl-10"
          aria-label="Buscar jugador"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-2 gap-3 mb-4">
        <div className="field">
          <label>Posición</label>
          <select
            value={filters.position}
            onChange={(e) => setFilters({ ...filters, position: e.target.value })}
            className="select"
          >
            <option value="">Todas</option>
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Categoría</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="select"
          >
            <option value="">Todas</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{categoryLabel(cat)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Estado</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="select"
          >
            <option value="">Todos</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="btn secondary w-full mb-4"
        >
          <Filter size={16} />
          Limpiar filtros
        </button>
      )}

      {/* Recent searches */}
      {recentSearches.length > 0 && !filters.name && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Clock size={14} />
            <span>Búsquedas recientes</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map(search => (
              <button
                key={search}
                onClick={() => setFilters({ ...filters, name: search })}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="max-h-96 overflow-y-auto">
        {filteredPlayers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Search size={32} className="mx-auto mb-2 opacity-50" />
            <p>No se encontraron jugadores</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredPlayers.map(player => (
              <button
                key={player.id}
                onClick={() => {
                  handleSearch(player.name);
                  onPlayerSelect(player.id);
                }}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                  {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{player.name}</p>
                  <p className="text-sm text-gray-500">
                    {player.position} · {categoryLabel(player.category)}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  player.status === 'Disponible' ? 'bg-green-100 text-green-700' :
                  player.status === 'Lesionado' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {player.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t text-sm text-gray-500">
        {filteredPlayers.length} jugador{filteredPlayers.length !== 1 ? 'es' : ''} encontrado{filteredPlayers.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
