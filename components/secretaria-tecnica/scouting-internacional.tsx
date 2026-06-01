'use client';

import React, { useState } from 'react';
import { Search, Database, BarChart3, Globe, Users, TrendingUp } from 'lucide-react';
import { TechnicalAccessGate, TechnicalModuleNav } from './technical-ui';
import { GlobalPlayerSearch } from '@/components/global-player-search';
import { WyscoutImport } from '@/components/wyscout-import';
import { PlayerComparison } from '@/components/player-comparison';
import { useScoutingStore } from '@/stores/scouting-store';
import { StatusBadge } from '@/components/pro-ui';
import type { ExternalPlayer } from '@/lib/schemas';

type ScoutingTab = 'search' | 'import' | 'comparison' | 'database';

const statusTone = (status: ExternalPlayer['scoutStatus']) => {
  if (status === 'contacted') return 'green' as const;
  if (status === 'shortlisted') return 'amber' as const;
  if (status === 'watching') return 'blue' as const;
  if (status === 'rejected') return 'red' as const;
  return 'neutral' as const;
};

export function ScoutingInternacional() {
  const [activeTab, setActiveTab] = useState<ScoutingTab>('search');
  const { externalPlayers, getShortlistedPlayers, getContactedPlayers } = useScoutingStore();

  const shortlistedCount = getShortlistedPlayers().length;
  const contactedCount = getContactedPlayers().length;

  const tabs = [
    { id: 'search' as ScoutingTab, label: 'Búsqueda global', icon: Search },
    { id: 'import' as ScoutingTab, label: 'Importar Wyscout', icon: Database },
    { id: 'comparison' as ScoutingTab, label: 'Comparativas', icon: BarChart3 },
    { id: 'database' as ScoutingTab, label: 'Base de datos', icon: Users },
  ];

  return (
    <TechnicalAccessGate permission="secretaria_tecnica.view">
      <div className="grid st-scouting-page">
        <TechnicalModuleNav />

        <div className="card">
          <div className="toolbar">
            <div>
              <span className="section-eyebrow">Scouting internacional</span>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Globe size={28} />
                Wyscout y base externa
              </h2>
              <p className="muted-line">Búsqueda, importación y seguimiento de jugadores fuera del plantel.</p>
            </div>
            <div className="btn-row">
              <div className="st-scouting-stat">
                <strong>{externalPlayers.length}</strong>
                <span>En base</span>
              </div>
              <div className="st-scouting-stat">
                <strong>{shortlistedCount}</strong>
                <span>Lista corta</span>
              </div>
              <div className="st-scouting-stat">
                <strong>{contactedCount}</strong>
                <span>Contactados</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="btn-row st-scouting-tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`btn ${activeTab === tab.id ? '' : 'secondary'}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 16 }}>
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
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedPlayer, setSelectedPlayer] = useState<ExternalPlayer | null>(null);

  const filteredPlayers = filterExternalPlayers({
    name: filters.name,
    position: filters.position
      ? [filters.position as ExternalPlayer['position']]
      : undefined,
    scoutStatus: filters.scoutStatus
      ? [filters.scoutStatus as ExternalPlayer['scoutStatus']]
      : undefined,
  });

  return (
    <div className="grid">
      <div className="toolbar card" style={{ padding: 12 }}>
        <input
          type="text"
          className="input"
          placeholder="Filtrar por nombre..."
          value={filters.name || ''}
          onChange={(e) => setFilters({ ...filters, name: e.target.value })}
        />
        <select
          className="input"
          value={filters.position || ''}
          onChange={(e) => setFilters({ ...filters, position: e.target.value })}
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
          className="input"
          value={filters.scoutStatus || ''}
          onChange={(e) => setFilters({ ...filters, scoutStatus: e.target.value })}
        >
          <option value="">Todos los estados</option>
          <option value="none">Sin seguimiento</option>
          <option value="watching">En observación</option>
          <option value="shortlisted">En lista corta</option>
          <option value="contacted">Contactado</option>
          <option value="rejected">Rechazado</option>
        </select>
      </div>

      <div className="table-wrap">
        <table className="professional-table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Posición</th>
              <th>Club</th>
              <th>Edad</th>
              <th>Valor</th>
              <th>Estado</th>
              <th>Rating</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((player) => (
              <tr key={player.id}>
                <td>
                  <div className="btn-row" style={{ alignItems: 'center' }}>
                    {player.photoUrl ? (
                      <img src={player.photoUrl} alt={player.name} className="st-scouting-avatar" />
                    ) : null}
                    <div>
                      <strong>{player.name}</strong>
                      <div className="muted-line">{player.nationality}</div>
                    </div>
                  </div>
                </td>
                <td>{player.position}</td>
                <td>{player.currentClub}</td>
                <td>{player.age}</td>
                <td>{player.marketValue ? `€${(player.marketValue / 1_000_000).toFixed(1)}M` : 'N/A'}</td>
                <td><StatusBadge text={player.scoutStatus} tone={statusTone(player.scoutStatus)} /></td>
                <td>{player.scoutRating ? `${player.scoutRating}/10` : '—'}</td>
                <td>
                  <div className="btn-row">
                    <select
                      className="input"
                      value={player.scoutStatus}
                      onChange={(e) => setScoutStatus(player.id, e.target.value as ExternalPlayer['scoutStatus'])}
                    >
                      <option value="none">Sin seguimiento</option>
                      <option value="watching">En observación</option>
                      <option value="shortlisted">En lista corta</option>
                      <option value="contacted">Contactado</option>
                      <option value="rejected">Rechazado</option>
                    </select>
                    <button type="button" className="btn secondary btn-compact" onClick={() => setSelectedPlayer(player)}>
                      <TrendingUp size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!filteredPlayers.length ? (
        <div className="empty">
          <Users size={40} />
          <h3>No hay jugadores en la base</h3>
          <p>Importa desde Wyscout o usa la búsqueda global.</p>
        </div>
      ) : null}

      {selectedPlayer ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedPlayer(null)}>
          <div className="card modal-panel" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="toolbar">
              <h3 style={{ margin: 0 }}>{selectedPlayer.name}</h3>
              <button type="button" className="btn secondary" onClick={() => setSelectedPlayer(null)}>Cerrar</button>
            </div>
            <div className="grid grid-2">
              <label className="field">
                <span>Estado</span>
                <select
                  className="input"
                  value={selectedPlayer.scoutStatus}
                  onChange={(e) => {
                    const status = e.target.value as ExternalPlayer['scoutStatus'];
                    setScoutStatus(selectedPlayer.id, status);
                    setSelectedPlayer({ ...selectedPlayer, scoutStatus: status });
                  }}
                >
                  <option value="none">Sin seguimiento</option>
                  <option value="watching">En observación</option>
                  <option value="shortlisted">En lista corta</option>
                  <option value="contacted">Contactado</option>
                  <option value="rejected">Rechazado</option>
                </select>
              </label>
              <label className="field">
                <span>Rating (1-10)</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="input"
                  value={selectedPlayer.scoutRating || ''}
                  onChange={(e) => {
                    const rating = parseInt(e.target.value, 10);
                    setScoutRating(selectedPlayer.id, rating);
                    setSelectedPlayer({ ...selectedPlayer, scoutRating: rating });
                  }}
                />
              </label>
            </div>
            <label className="field">
              <span>Notas</span>
              <textarea
                className="input"
                rows={4}
                value={selectedPlayer.scoutNotes || ''}
                onChange={(e) => {
                  setScoutNotes(selectedPlayer.id, e.target.value);
                  setSelectedPlayer({ ...selectedPlayer, scoutNotes: e.target.value });
                }}
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
