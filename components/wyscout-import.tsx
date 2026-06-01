'use client';

import React, { useState } from 'react';
import { Download, CheckCircle, AlertCircle, Loader2, Trophy } from 'lucide-react';
import { useScoutingStore } from '@/stores/scouting-store';
import { AccessibleButton } from './accessible-button';
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
        : [...prev, leagueId],
    );
  };

  const handleImport = async () => {
    if (selectedLeagues.length === 0) return;
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
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="toolbar">
          <div>
            <span className="section-eyebrow">Wyscout</span>
            <h3 style={{ margin: 0 }}>Importación masiva</h3>
            <p className="muted-line">
              Importa jugadores de múltiples ligas. Sin `WYSCOUT_API_KEY` en el servidor se usa respuesta mock.
            </p>
          </div>
          <div className="st-scouting-stat">
            <strong>{externalPlayers.length}</strong>
            <span>En base local</span>
          </div>
        </div>

        <div className="btn-row" style={{ marginTop: 16, alignItems: 'flex-end' }}>
          <label className="field" style={{ flex: 1, minWidth: 160 }}>
            <span className="field-label">Temporada</span>
            <select className="select" value={season} onChange={(e) => setSeason(e.target.value)}>
              <option value="2023-2024">2023-2024</option>
              <option value="2022-2023">2022-2023</option>
              <option value="2021-2022">2021-2022</option>
              <option value="2020-2021">2020-2021</option>
            </select>
          </label>
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={includeStats}
              onChange={(e) => setIncludeStats(e.target.checked)}
            />
            <span className="muted-line">Incluir métricas (más lento)</span>
          </label>
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Ligas</h4>
            <button type="button" className="btn secondary" onClick={handleSelectAll}>
              {selectedLeagues.length === leagues.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
            </button>
          </div>

          <LeagueTier title="Ligas top" leagues={topLeagues} selectedLeagues={selectedLeagues} onToggle={handleLeagueToggle} />
          <LeagueTier title="Ligas medias" leagues={midLeagues} selectedLeagues={selectedLeagues} onToggle={handleLeagueToggle} />
          <LeagueTier title="Ligas bajas" leagues={lowLeagues} selectedLeagues={selectedLeagues} onToggle={handleLeagueToggle} />
        </div>

        <div className="btn-row" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <AccessibleButton
            variant="primary"
            onClick={handleImport}
            isLoading={isImporting}
            disabled={selectedLeagues.length === 0}
            ariaLabel="Importar jugadores seleccionados"
          >
            <Download size={16} />
            Importar {selectedLeagues.length} {selectedLeagues.length === 1 ? 'liga' : 'ligas'}
          </AccessibleButton>
        </div>
      </div>

      {isImporting && (
        <FadeIn>
          <div className="card operational-alert-card">
            <div className="btn-row">
              <Loader2 size={22} className="spin" />
              <div>
                <strong>Importando jugadores…</strong>
                <p className="muted-line">Puede tardar varios minutos según las ligas elegidas.</p>
              </div>
            </div>
            <div className="session-progress-bar" style={{ marginTop: 12 }}>
              <div style={{ width: `${importProgress}%`, height: '100%', background: 'var(--blue)', borderRadius: 4 }} />
            </div>
            <p className="muted-line" style={{ textAlign: 'center', marginTop: 8 }}>
              {Math.round(importProgress)}% completado
            </p>
          </div>
        </FadeIn>
      )}

      {importError && (
        <FadeIn>
          <div className="card operational-alert-card" data-tone="red">
            <div className="btn-row">
              <AlertCircle size={20} />
              <div>
                <strong>Error en la importación</strong>
                <p className="muted-line">{importError}</p>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {!isImporting && !importError && importProgress === 100 && (
        <FadeIn>
          <div className="card operational-alert-card" data-tone="green">
            <div className="btn-row">
              <CheckCircle size={20} />
              <div>
                <strong>Importación completada</strong>
                <p className="muted-line">Los jugadores se guardaron en la base local de scouting (persistencia Zustand).</p>
              </div>
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

function LeagueTier({
  title,
  leagues,
  selectedLeagues,
  onToggle,
}: {
  title: string;
  leagues: Array<{ id: string; name: string; country: string }>;
  selectedLeagues: string[];
  onToggle: (id: string) => void;
}) {
  if (!leagues.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="btn-row" style={{ marginBottom: 8 }}>
        <Trophy size={16} />
        <span className="section-eyebrow">{title}</span>
      </div>
      <div className="grid st-league-grid">
        {leagues.map((league) => (
          <LeagueCheckbox
            key={league.id}
            league={league}
            isSelected={selectedLeagues.includes(league.id)}
            onToggle={() => onToggle(league.id)}
          />
        ))}
      </div>
    </div>
  );
}

function LeagueCheckbox({
  league,
  isSelected,
  onToggle,
}: {
  league: { id: string; name: string; country: string };
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <label className={`st-league-option${isSelected ? ' is-selected' : ''}`}>
      <input type="checkbox" checked={isSelected} onChange={onToggle} />
      <div>
        <strong>{league.name}</strong>
        <div className="muted-line">{league.country}</div>
      </div>
    </label>
  );
}
