'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { ToneBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { SessionParticipation, TrainingSessionType } from '@/lib/types';
import { groupAverage } from '@/lib/utils';

const sessionTypeOptions: { value: TrainingSessionType; label: string }[] = [
  { value: 'cdef', label: 'cdef · Recuperación' },
  { value: 'cdEf', label: 'cdEf · Ejecución' },
  { value: 'cdeF', label: 'cdeF · Condición física' },
  { value: 'Cdef', label: 'Cdef · Comunicación' },
];

const participationOptions: SessionParticipation[] = ['Completa', 'Parcial', 'No participa', 'Gimnasio', 'Readaptación'];

type RowState = {
  selected: boolean;
  participation: SessionParticipation;
  min: number;
  rpe: number;
  acc: number;
  dcc: number;
  sprints: number;
  rhie: number;
  ima: number;
};

const renderNumberInput = (value: number) => (value === 0 ? '' : String(value));

export default function SesionEntrenamientoPage() {
  const { data, filters, setFilters, addExternalLoad, updateExternalLoad, deleteExternalLoad, upsertInternalLoad, upsertTrainingSessionSummary } = useApp();
  const [message, setMessage] = useState('');
  const summaryRecord = data.trainingSessionSummaries.find((item) => item.microcycleId === filters.microcycleId && item.sessionNumber === filters.sessionNumber && item.date === filters.date);
  const [sessionType, setSessionType] = useState<TrainingSessionType>(summaryRecord?.sessionType ?? 'cdEf');
  const [objective, setObjective] = useState(summaryRecord?.objective ?? '');
  const [observation, setObservation] = useState(summaryRecord?.observation ?? '');

  const sessionPlayers = useMemo(
    () =>
      data.players.filter(
        (player) =>
          (filters.category === 'all' || player.category === filters.category) &&
          (filters.position === 'all' || player.position === filters.position) &&
          (filters.status === 'all' || player.status === filters.status),
      ),
    [data.players, filters.position, filters.status],
  );

  const existingRecords = useMemo(
    () =>
      data.externalLoads
        .filter((record) => {
          const player = data.players.find((p) => p.id === record.playerId);
          return !!player && (record.microcycleId ?? filters.microcycleId) === filters.microcycleId && (record.sessionNumber ?? 1) === filters.sessionNumber && record.date === filters.date;
        })
        .sort((a, b) => a.playerId.localeCompare(b.playerId)),
    [data.externalLoads, data.players, filters.microcycleId, filters.sessionNumber, filters.date],
  );

  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  useEffect(() => {
    const next: Record<string, RowState> = {};
    sessionPlayers.forEach((player) => {
      const existing = existingRecords.find((item) => item.playerId === player.id);
      next[player.id] = {
        selected: !!existing,
        participation: existing?.participation ?? 'Completa',
        min: existing?.min ?? 0,
        rpe: existing?.rpe ?? 0,
        acc: existing?.acc ?? 0,
        dcc: existing?.dcc ?? 0,
        sprints: existing?.sprints ?? 0,
        rhie: existing?.rhie ?? 0,
        ima: existing?.ima ?? 0,
      };
    });
    setRowStates(next);
    setSessionType(summaryRecord?.sessionType ?? 'cdEf');
    setObjective(summaryRecord?.objective ?? '');
    setObservation(summaryRecord?.observation ?? '');
  }, [summaryRecord?.id, summaryRecord?.sessionType, summaryRecord?.objective, summaryRecord?.observation, sessionPlayers, existingRecords]);

  const rows = sessionPlayers.map((player) => {
    const state = rowStates[player.id] ?? { selected: false, participation: 'Completa', min: 0, rpe: 0, acc: 0, dcc: 0, sprints: 0, rhie: 0, ima: 0 };
    return { player, ...state };
  });

  const selectedRows = rows.filter((row) => row.selected);
  const activeMicrocycle = data.microcycles.find((item) => item.id === filters.microcycleId);

  const updateRow = (playerId: string, patch: Partial<RowState>) => {
    setRowStates((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? { selected: false, participation: 'Completa', min: 0, rpe: 0, acc: 0, dcc: 0, sprints: 0, rhie: 0, ima: 0 }),
        ...patch,
      },
    }));
  };

  const saveSession = () => {
    upsertTrainingSessionSummary({
      id: summaryRecord?.id ?? crypto.randomUUID(),
      date: filters.date,
      microcycleId: filters.microcycleId,
      sessionNumber: filters.sessionNumber,
      sessionType,
      objective,
      observation,
    });

    selectedRows.forEach((row) => {
      const existing = existingRecords.find((item) => item.playerId === row.player.id);
      const externalRecord = {
        id: existing?.id ?? crypto.randomUUID(),
        playerId: row.player.id,
        date: filters.date,
        min: row.min,
        rpe: row.rpe,
        acc: row.acc,
        dcc: row.dcc,
        sprints: row.sprints,
        rhie: row.rhie,
        ima: row.ima,
        participation: row.participation,
        microcycleId: filters.microcycleId,
        sessionNumber: filters.sessionNumber,
        sessionType,
        category: row.player.category,
      };
      if (existing) updateExternalLoad(externalRecord);
      else addExternalLoad(externalRecord);

      upsertInternalLoad({
        id: crypto.randomUUID(),
        playerId: row.player.id,
        date: filters.date,
        rpe: row.rpe,
        duration: row.min,
        microcycleId: filters.microcycleId,
        sessionNumber: filters.sessionNumber,
        category: row.player.category,
      });
    });

    existingRecords.filter((record) => !selectedRows.find((row) => row.player.id === record.playerId)).forEach((record) => deleteExternalLoad(record.id));
    setMessage('Sesión guardada correctamente.');
  };

  const availability = {
    disponibles: data.players.filter((p) => p.status === 'Disponible').length,
    molestia: data.players.filter((p) => p.status === 'Molestia').length,
    readaptacion: data.players.filter((p) => p.status === 'Readaptación').length,
    lesionados: data.players.filter((p) => p.status === 'Lesionado').length,
  };

  return (
    <div className="grid">
      <AppHero title="Sesión de entrenamiento" />

      <div className="card operational-card session-hero-card">
        <div className="operational-card-header">
          <div>
            <div className="kpi-label">Control operativo</div>
            <div className="operational-title">Microciclo, número y tipo de sesión</div>
          </div>
          <div className="btn secondary">{activeMicrocycle?.name ?? 'Microciclo'}</div>
        </div>

        <div className="grid grid-4 session-top-grid">
          <div className="field">
            <label>Fecha</label>
            <input className="input" type="date" value={filters.date} onChange={(e) => setFilters({ date: e.target.value })} />
          </div>
          <div className="field">
            <label>Microciclo</label>
            <input className="input" type="number" min="1" max="51" value={Number(String(filters.microcycleId).replace('mc-', '')) || 1} onChange={(e) => {
              const next = Math.max(1, Math.min(51, Number(e.target.value) || 1));
              setFilters({ microcycleId: `mc-${next}` });
            }} />
          </div>
          <div className="field">
            <label>Número de sesión</label>
            <input className="input" type="number" min="1" value={filters.sessionNumber} onChange={(e) => setFilters({ sessionNumber: Number(e.target.value) || 1 })} />
          </div>
          <div className="field">
            <label>Tipo de sesión</label>
            <select className="select" value={sessionType} onChange={(e) => setSessionType(e.target.value as TrainingSessionType)}>
              {sessionTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-2 session-detail-grid" style={{ marginTop: 14 }}>
          <div className="field">
            <label>Objetivo de la sesión</label>
            <input className="input" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Objetivo táctico o físico" />
          </div>
          <div className="field">
            <label>Observación del staff</label>
            <input className="input" value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Observación breve" />
          </div>
        </div>
      </div>

      <GlobalFiltersBar />

      <div className="grid grid-5">
        <KpiCard label="Jugadores seleccionados" value={String(selectedRows.length)} />
        <KpiCard label="MIN promedio" value={groupAverage(selectedRows.map((r) => r.min)).toFixed(0)} />
        <KpiCard label="ACC promedio" value={groupAverage(selectedRows.map((r) => r.acc)).toFixed(1)} />
        <KpiCard label="SPRINTS promedio" value={groupAverage(selectedRows.map((r) => r.sprints)).toFixed(1)} />
        <KpiCard label="IMA promedio" value={groupAverage(selectedRows.map((r) => r.ima)).toFixed(1)} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Resumen de sesión</h3>
            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                downloadCsv(
                  `sesion-${filters.microcycleId}-${filters.sessionNumber}.csv`,
                  selectedRows.map((r) => ({
                    fecha: filters.date,
                    jugador: r.player.name,
                    participacion: r.participation,
                    min_sesion: r.min,
                    rpe: r.rpe,
                    acc: r.acc,
                    dcc: r.dcc,
                    sprints: r.sprints,
                    rhie: r.rhie,
                    ima: r.ima,
                    tipo: sessionType,
                    objetivo: objective,
                    observacion: observation,
                  })),
                )
              }
            >
              Exportar CSV
            </button>
          </div>
          <div className="session-metrics-strip">
            <div className="session-metric-pill">MIN sesión</div>
            <div className="session-metric-pill">RPE individual</div>
            <div className="session-metric-pill">ACC</div>
            <div className="session-metric-pill">DCC</div>
            <div className="session-metric-pill">SPRINTS</div>
            <div className="session-metric-pill">RHIE</div>
            <div className="session-metric-pill">IMA</div>
          </div>
        </div>

        <div className="card">
          <h3>Disponibilidad diaria</h3>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <div className="mini-stat-card"><strong>Disponibles</strong><div className="muted-line">{availability.disponibles}</div></div>
            <div className="mini-stat-card"><strong>Molestia</strong><div className="muted-line">{availability.molestia}</div></div>
            <div className="mini-stat-card"><strong>Readaptación</strong><div className="muted-line">{availability.readaptacion}</div></div>
            <div className="mini-stat-card"><strong>Lesionados</strong><div className="muted-line">{availability.lesionados}</div></div>
          </div>
        </div>
      </div>

      {message ? <div className="card"><strong>{message}</strong></div> : null}

      <div className="card session-table-card">
        <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Plantilla de sesión</h3>
          <button type="button" className="btn" onClick={saveSession}>Guardar sesión</button>
        </div>

        <div className="session-player-grid mobile-clean-grid">
          {rows.map((row) => (
            <div key={row.player.id} className="session-player-card clean-mobile-card">
              <div className="session-player-header">
                <div>
                  <strong>{row.player.name}</strong>
                  <div className="muted-line">{row.player.position}</div>
                </div>
                <div className="btn-row">
                  <label className="session-checkbox">
                    <input type="checkbox" checked={row.selected} onChange={(e) => updateRow(row.player.id, { selected: e.target.checked })} />
                    <span>Incluir</span>
                  </label>
                  <ToneBadge text={row.player.status} tone={row.player.status === 'Disponible' ? 'green' : row.player.status === 'Molestia' ? 'yellow' : row.player.status === 'Readaptación' ? 'orange' : 'red'} />
                </div>
              </div>

              <div className="grid session-fields-grid session-metrics-grid">
                <div className="field"><label>Participación</label><select className="select session-input-large" value={row.participation} onChange={(e) => updateRow(row.player.id, { participation: e.target.value as SessionParticipation })}>{participationOptions.map((option) => <option key={option}>{option}</option>)}</select></div>
                <div className="field"><label>MIN sesión</label><input className="input session-input-large" type="number" placeholder="Vacío" value={renderNumberInput(row.min)} onChange={(e) => updateRow(row.player.id, { min: Number(e.target.value) || 0 })} /></div>
                <div className="field"><label>RPE</label><input className="input session-input-large" type="number" min="1" max="10" placeholder="Vacío" value={renderNumberInput(row.rpe)} onChange={(e) => updateRow(row.player.id, { rpe: Number(e.target.value) || 0 })} /></div>
                <div className="field"><label>ACC</label><input className="input session-input-large" type="number" placeholder="Vacío" value={renderNumberInput(row.acc)} onChange={(e) => updateRow(row.player.id, { acc: Number(e.target.value) || 0 })} /></div>
                <div className="field"><label>DCC</label><input className="input session-input-large" type="number" placeholder="Vacío" value={renderNumberInput(row.dcc)} onChange={(e) => updateRow(row.player.id, { dcc: Number(e.target.value) || 0 })} /></div>
                <div className="field"><label>SPRINTS</label><input className="input session-input-large" type="number" placeholder="Vacío" value={renderNumberInput(row.sprints)} onChange={(e) => updateRow(row.player.id, { sprints: Number(e.target.value) || 0 })} /></div>
                <div className="field"><label>RHIE</label><input className="input session-input-large" type="number" placeholder="Vacío" value={renderNumberInput(row.rhie)} onChange={(e) => updateRow(row.player.id, { rhie: Number(e.target.value) || 0 })} /></div>
                <div className="field"><label>IMA</label><input className="input session-input-large" type="number" placeholder="Vacío" value={renderNumberInput(row.ima)} onChange={(e) => updateRow(row.player.id, { ima: Number(e.target.value) || 0 })} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
