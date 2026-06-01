'use client';

import React, { useState } from 'react';
import { Search, Database, BarChart3, Globe, Filter, Users, TrendingUp } from 'lucide-react';
import { TechnicalAccessGate, TechnicalModuleNav } from './technical-ui';
import { GlobalPlayerSearch } from '@/components/global-player-search';
import { WyscoutImport } from '@/components/wyscout-import';
import { PlayerComparison } from '@/components/player-comparison';
import { useScoutingStore } from '@/stores/scouting-store';
import { AccessibleButton } from '@/components/accessible-button';
import { cn } from '@/lib/utils';

type ScoutingTab = 'search' | 'import' | 'comparison' | 'database';

export function ScoutingInternacional() {
  const [activeTab, setActiveTab] = useState<ScoutingTab>('search');
  const { externalPlayers, getShortlistedPlayers, getContactedPlayers } = useScoutingStore();

  const shortlistedCount = getShortlistedPlayers().length;
  const contactedCount = getContactedPlayers().length;

  const tabs = [
    { id: 'search' as ScoutingTab, label: 'Búsqueda Global', icon: Search },
    { id: 'import' as ScoutingTab, label: 'Importar Wyscout', icon: Database },
    { id: 'comparison' as ScoutingTab, label: 'Comparativas', icon: BarChart3 },
    { id: 'database' as ScoutingTab, label: 'Base de Datos', icon: Users },
  ];

  return (
    <TechnicalAccessGate permission="secretaria_tecnica.view">
      <div className="space-y-6">
        {/* Navigation */}
        <TechnicalModuleNav />

        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <Globe size={32} className="text-blue-600" />
                Scouting Internacional
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Busca y analiza jugadores de todo el mundo usando datos de Wyscout
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{externalPlayers.length}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Jugadores en base</div>
              </div>
              <div className="h-12 w-px bg-gray-200 dark:bg-gray-700" />
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{shortlistedCount}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">En lista corta</div>
              </div>
              <div className="h-12 w-px bg-gray-200 dark:bg-gray-700" />
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{contactedCount}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Contactados</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-6 py-4 font-medium transition-colors',
                    activeTab === tab.id
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {activeTab === 'search' && <GlobalPlayerSearch />}
            {activeTab === 'import' && <WyscoutImport />}
            {activeTab === 'comparison' && <PlayerComparison />}
            {activeTab === 'database' && <ScoutingDatabase />}
          </div>
        </div>
      </div>
    </TechnicalAccessGate>
  );
}

function ScoutingDatabase() {
  const { externalPlayers, filterExternalPlayers, setScoutStatus, setScoutRating, setScoutNotes } = useScoutingStore();
  const [filters, setFilters] = useState<any>({});
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  const filteredPlayers = filterExternalPlayers(filters);

  const statusColors = {
    none: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    watching: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    shortlisted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    contacted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Filtrar por nombre..."
            value={filters.name || ''}
            onChange={(e) => setFilters({ ...filters, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filters.position || ''}
          onChange={(e) => setFilters({ ...filters, position: e.target.value ? [e.target.value] : undefined })}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las posiciones</option>
          <option value="Portero">Portero</option>
          <option value="Defensa central">Defensa central</option>
          <option value="Lateral">Lateral</option>
          <option value="Mediocampista">Mediocampista</option>
          <option value="Extremo">Extremo</option>
          <option value="Delantero">Delantero</option>
        </select>
        <select
          value={filters.scoutStatus || ''}
          onChange={(e) => setFilters({ ...filters, scoutStatus: e.target.value ? [e.target.value] : undefined })}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="none">Sin seguimiento</option>
          <option value="watching">En observación</option>
          <option value="shortlisted">En lista corta</option>
          <option value="contacted">Contactado</option>
          <option value="rejected">Rechazado</option>
        </select>
      </div>

      {/* Players Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Jugador
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Posición
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Club
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Edad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Valor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Rating
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredPlayers.map((player) => (
              <tr key={player.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {player.photoUrl && (
                      <img
                        src={player.photoUrl}
                        alt={player.name}
                        className="h-10 w-10 rounded-full object-cover mr-3"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/40';
                        }}
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{player.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{player.nationality}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {player.position}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {player.currentClub}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {player.age}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {player.marketValue ? `€${(player.marketValue / 1000000).toFixed(1)}M` : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={cn('px-2 py-1 text-xs font-medium rounded', statusColors[player.scoutStatus])}>
                    {player.scoutStatus}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {player.scoutRating ? `${player.scoutRating}/10` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    <select
                      value={player.scoutStatus}
                      onChange={(e) => setScoutStatus(player.id, e.target.value as any)}
                      className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="none">Sin seguimiento</option>
                      <option value="watching">En observación</option>
                      <option value="shortlisted">En lista corta</option>
                      <option value="contacted">Contactado</option>
                      <option value="rejected">Rechazado</option>
                    </select>
                    <button
                      onClick={() => setSelectedPlayer(player)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      <TrendingUp size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No hay jugadores en la base
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Importa jugadores de Wyscout o busca jugadores globales para comenzar
            </p>
          </div>
        )}
      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedPlayer.name}</h3>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Estado de Scouting
                  </label>
                  <select
                    value={selectedPlayer.scoutStatus}
                    onChange={(e) => {
                      setScoutStatus(selectedPlayer.id, e.target.value as any);
                      setSelectedPlayer({ ...selectedPlayer, scoutStatus: e.target.value });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="none">Sin seguimiento</option>
                    <option value="watching">En observación</option>
                    <option value="shortlisted">En lista corta</option>
                    <option value="contacted">Contactado</option>
                    <option value="rejected">Rechazado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rating (1-10)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={selectedPlayer.scoutRating || ''}
                    onChange={(e) => {
                      const rating = parseInt(e.target.value);
                      setScoutRating(selectedPlayer.id, rating);
                      setSelectedPlayer({ ...selectedPlayer, scoutRating: rating });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notas de Scouting
                </label>
                <textarea
                  value={selectedPlayer.scoutNotes || ''}
                  onChange={(e) => {
                    setScoutNotes(selectedPlayer.id, e.target.value);
                    setSelectedPlayer({ ...selectedPlayer, scoutNotes: e.target.value });
                  }}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Añade notas sobre este jugador..."
                />
              </div>
              
              {/* Performance Metrics */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Métricas de Rendimiento</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Partidos</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedPlayer.matchesPlayed || 0}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Goles</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedPlayer.goals || 0}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Asistencias</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedPlayer.assists || 0}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
