'use client';

import React, { useState } from 'react';
import { Download, Upload, CheckCircle, AlertCircle, Loader2, Database, Trophy, Calendar } from 'lucide-react';
import { useScoutingStore } from '@/stores/scouting-store';
import { AccessibleButton } from './accessible-button';
import { cn } from '@/lib/utils';
import { FadeIn } from './animated-wrapper';

export function WyscoutImport() {
  const {
    leagues,
    importFromWyscout,
    isImporting,
    importProgress,
    importError,
    externalPlayers,
  } = useScoutingStore();

  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [season, setSeason] = useState('2023-2024');
  const [includeStats, setIncludeStats] = useState(true);

  const handleLeagueToggle = (leagueId: string) => {
    setSelectedLeagues((prev) =>
      prev.includes(leagueId)
        ? prev.filter((id) => id !== leagueId)
        : [...prev, leagueId]
    );
  };

  const handleImport = async () => {
    if (selectedLeagues.length === 0) {
      return;
    }

    await importFromWyscout({
      leagueIds: selectedLeagues,
      season,
      includeStats,
    });
  };

  const handleSelectAll = () => {
    if (selectedLeagues.length === leagues.length) {
      setSelectedLeagues([]);
    } else {
      setSelectedLeagues(leagues.map((l) => l.id));
    }
  };

  const topLeagues = leagues.filter((l) => l.tier === 'top');
  const midLeagues = leagues.filter((l) => l.tier === 'mid');
  const lowLeagues = leagues.filter((l) => l.tier === 'low');

  return (
    <div className="space-y-6">
      {/* Import Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Importación Masiva de Wyscout
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Importa jugadores de múltiples ligas para enriquecer tu base de scouting
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Jugadores en base: <span className="font-semibold text-gray-900 dark:text-gray-100">{externalPlayers.length}</span>
            </div>
          </div>
        </div>

        {/* Season Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Temporada
          </label>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="2023-2024">2023-2024</option>
            <option value="2022-2023">2022-2023</option>
            <option value="2021-2022">2021-2022</option>
            <option value="2020-2021">2020-2021</option>
          </select>
        </div>

        {/* Include Stats Toggle */}
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeStats}
              onChange={(e) => setIncludeStats(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Incluir métricas de rendimiento (más lento)
            </span>
          </label>
        </div>

        {/* League Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Selecciona las ligas a importar
            </h3>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {selectedLeagues.length === leagues.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
            </button>
          </div>

          {/* Top Tier Leagues */}
          {topLeagues.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={16} className="text-yellow-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ligas Top
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {topLeagues.map((league) => (
                  <LeagueCheckbox
                    key={league.id}
                    league={league}
                    isSelected={selectedLeagues.includes(league.id)}
                    onToggle={() => handleLeagueToggle(league.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Mid Tier Leagues */}
          {midLeagues.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ligas Medias
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {midLeagues.map((league) => (
                  <LeagueCheckbox
                    key={league.id}
                    league={league}
                    isSelected={selectedLeagues.includes(league.id)}
                    onToggle={() => handleLeagueToggle(league.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Low Tier Leagues */}
          {lowLeagues.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ligas Bajas
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {lowLeagues.map((league) => (
                  <LeagueCheckbox
                    key={league.id}
                    league={league}
                    isSelected={selectedLeagues.includes(league.id)}
                    onToggle={() => handleLeagueToggle(league.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Import Button */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <AccessibleButton
            variant="primary"
            onClick={handleImport}
            isLoading={isImporting}
            disabled={selectedLeagues.length === 0}
            className="w-full"
            ariaLabel="Importar jugadores seleccionados"
          >
            <Download size={16} className="mr-2" />
            Importar {selectedLeagues.length} {selectedLeagues.length === 1 ? 'liga' : 'ligas'}
          </AccessibleButton>
        </div>
      </div>

      {/* Import Progress */}
      {isImporting && (
        <FadeIn>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 size={24} className="text-blue-600 dark:text-blue-400 animate-spin" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Importando jugadores...
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Esto puede tomar varios minutos dependiendo de la cantidad de ligas seleccionadas
                </p>
              </div>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
              <div
                className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
              {Math.round(importProgress)}% completado
            </p>
          </div>
        </FadeIn>
      )}

      {/* Import Error */}
      {importError && (
        <FadeIn>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Error en la importación
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{importError}</p>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Import Success */}
      {!isImporting && !importError && importProgress === 100 && (
        <FadeIn>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Importación completada
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Los jugadores han sido agregados a tu base de scouting
                </p>
              </div>
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

interface LeagueCheckboxProps {
  league: any;
  isSelected: boolean;
  onToggle: () => void;
}

function LeagueCheckbox({ league, isSelected, onToggle }: LeagueCheckboxProps) {
  return (
    <label
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
      )}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />
      <div className="flex-1">
        <div className="font-medium text-gray-900 dark:text-gray-100">{league.name}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{league.country}</div>
      </div>
    </label>
  );
}
