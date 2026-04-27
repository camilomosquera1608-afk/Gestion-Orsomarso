'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { ToneBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { ClubCategory, MovementType, SessionParticipation, TrainingSessionType } from '@/lib/types';
import { groupAverage } from '@/lib/utils';

const sessionTypeOptions: { value: TrainingSessionType; label: string }[] = [
  { value: 'cdef', label: 'cdef · Recuperación' },
  { value: 'cdEf', label: 'cdEf · Ejecución' },
  { value: 'cdeF', label: 'cdeF · Condición física' },
  { value: 'Cdef', label: 'Cdef · Comunicación' },
];

const participationOptions: SessionParticipation[] = ['Completa', 'Parcial', 'No participa', 'Gimnasio', 'Readaptación'];
const categories: ClubCategory[] = ['Sub15', 'Sub17', 'Sub20'];
const movementOptions: Array<{ value: MovementType; label: string }> = [
  { value: 'base', label: 'Categoría base' },
  { value: 'subio_a_entrenar', label: 'Subió a entrenar' },
  { value: 'bajo_a_entrenar', label: 'Bajó a entrenar' },
];

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
  actingCategory: ClubCategory;
  movementType: MovementType;
  movementNote: string;
};

const renderNumberInput = (value: number) => (value === 0 ? '' : String(value));

export default function SesionEntrenamientoPage() {
  const { data, filters, setFilters, addExternalLoad, updateExternalLoad, deleteExternalLoad, upsertInternalLoad, upsertTrainingSessionSummary } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = (master ? (filters.category === 'all' ? 'Sub20' : filters.category) : session.category) as ClubCategory;
  const youthSimple = activeCategory !== 'Sub20';
  const [message, setMessage] = useState('');
  const summaryRecord = data.trainingSessionSummaries.find((item) => item.microcycleId === filters.microcycleId && item.sessionNumber === filters.sessionNumber && item.date === filters.date);
  const [sessionType, setSessionType] = useState<TrainingSessionType>(summaryRecord?.sessionType ?? 'cdEf');
  const [objective, setObjective] = useState(summaryRecord?.objective ?? '');
  const [observation, setObservation] = useState(summaryRecord?.observation ?? '');

  const sessionPlayers = useMemo(
    () => data.players.filter((player) => player.category === activeCategory && (filters.position === 'all' || player.position === filters.position) && (filters.status === 'all' || player.status === filters.status)),
    [data.players, filters.position, filters.status, activeCategory],
  );

  const existingRecords = useMemo(
    () =>
      data.externalLoads
        .filter((record) => {
          const player = data.players.find((p) => p.id === record.playerId);
          return (
            !!player &&
            player.category === activeCategory &&
            (record.microcycleId ?? filters.microcycleId) === filters.microcycleId &&
            (record.sessionNumber ?? 1) === filters.sessionNumber &&
            record.date === filters.date &&
            (filters.actingCategory === 'all' || (record.actingCategory ?? record.category ?? player.category) === filters.actingCategory) &&
            (filters.movementType === 'all' || (record.movementType ?? 'base') === filters.movementType)
          );
        })
        .sort((a, b) => a.playerId.localeCompare(b.playerId)),
    [data.externalLoads, data.players, filters.microcycleId, filters.sessionNumber, filters.date, filters.actingCategory, filters.movementType, activeCategory],
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
        actingCategory: (existing?.actingCategory ?? player.category ?? activeCategory) as ClubCategory,
        movementType: existing?.movementType ?? 'base',
        movementNote: existing?.movementNote ?? '',
      };
    });
    setRowStates(next);
    setSessionType(summaryRecord?.sessionType ?? 'cdEf');
    setObjective(summaryRecord?.objective ?? '');
    setObservation(summaryRecord?.observation ?? '');
  }, [summaryRecord?.id, summaryRecord?.sessionType, summaryRecord?.objective, summaryRecord?.observation, sessionPlayers, existingRecords, activeCategory]);

  const rows = sessionPlayers.map((player) => ({
    player,
    ...(rowStates[player.id] ?? {
      selected: false,
      participation: 'Completa',
      min: 0,
      rpe: 0,
      acc: 0,
      dcc: 0,
      sprints: 0,
      rhie: 0,
      ima: 0,
      actingCategory: player.category ?? activeCategory,
      movementType: 'base',
      movementNote: '',
    }),
  }));
  const selectedRows = rows.filter((row) => row.selected);

  const updateRow = (playerId: string, patch: Partial<RowState>) =>
    setRowStates((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? {
          selected: false, participation: 'Completa', min: 0, rpe: 0, acc: 0, dcc: 0, sprints: 0, rhie: 0, ima: 0, actingCategory: activeCategory, movementType: 'base', movementNote: '',
        }),
        ...patch,
      },
    }));

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
      const movementType = row.actingCategory === (row.player.category ?? activeCategory) ? 'base' : row.movementType;
      const externalRecord = {
        id: existing?.id ?? crypto.randomUUID(),
        playerId: row.player.id,
        date: filters.date,
        min: row.min,
        rpe: row.rpe,
        acc: youthSimple ? 0 : row.acc,
        dcc: youthSimple ? 0 : row.dcc,
        sprints: youthSimple ? 0 : row.sprints,
        rhie: youthSimple ? 0 : row.rhie,
        ima: youthSimple ? 0 : row.ima,
        participation: row.participation,
        microcycleId: filters.microcycleId,
        sessionNumber: filters.sessionNumber,
        sessionType,
        category: activeCategory,
        baseCategory: row.player.category ?? activeCategory,
        actingCategory: row.actingCategory,
        movementType,
        movementNote: row.movementNote,
        movementModule: 'sesion',
        loggedBy: session.displayName,
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
        category: activeCategory,
        baseCategory: row.player.category ?? activeCategory,
        actingCategory: row.actingCategory,
        movementType,
        movementNote: row.movementNote,
        movementModule: 'sesion',
        loggedBy: session.displayName,
      });
    });

    existingRecords.filter((record) => !selectedRows.find((row) => row.player.id === record.playerId)).forEach((record) => deleteExternalLoad(record.id));
    setMessage('Sesión guardada correctamente.');
  };

  return (
    <div className="grid">
      <AppHero title="Sesión de entrenamiento" subtitle={youthSimple ? `Interfaz simplificada ${activeCategory}: solo minutos y RPE.` : 'Interfaz avanzada Sub20 con métricas GPS.'} />
      <div className="card operational-card session-hero-card">
        <div className="operational-card-header">
          <div><div className="kpi-label">Control operativo</div><div className="operational-title">Microciclo, número y tipo de sesión</div></div>
          <div className="btn secondary">{activeCategory}</div>
        </div>
        <div className="grid grid-4 session-top-grid">
          <div className="field"><label>Fecha</label><input className="input" type="date" value={filters.date} onChange={(e) => setFilters({ date: e.target.value })} /></div>
          <div className="field"><label>Microciclo</label><input className="input" type="number" min="1" max="51" value={Number(String(filters.microcycleId).replace('mc-', '')) || 1} onChange={(e) => setFilters({ microcycleId: `mc-${Math.max(1, Math.min(51, Number(e.target.value) || 1))}` })} /></div>
          <div className="field"><label>Número de sesión</label><input className="input" type="number" min="1" value={filters.sessionNumber} onChange={(e) => setFilters({ sessionNumber: Number(e.target.value) || 1 })} /></div>
          <div className="field"><label>Tipo de sesión</label><select className="select" value={sessionType} onChange={(e) => setSessionType(e.target.value as TrainingSessionType)}>{sessionTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        </div>
      </div>
      <GlobalFiltersBar />

      <div className="grid grid-4">
        <KpiCard label="Jugadores seleccionados" value={String(selectedRows.length)} />
        <KpiCard label="MIN promedio" value={groupAverage(selectedRows.map((r) => r.min)).toFixed(0)} />
        <KpiCard label="RPE promedio" value={groupAverage(selectedRows.map((r) => r.rpe)).toFixed(1)} />
        <KpiCard label="Movimientos temporales" value={String(selectedRows.filter((r) => r.actingCategory !== (r.player.category ?? activeCategory)).length)} />
      </div>

      {message ? <div className="card"><strong>{message}</strong></div> : null}

      <div className="card session-table-card">
        <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Plantilla de sesión</h3>
          <div className="btn-row">
            <button type="button" className="btn secondary" onClick={() => downloadCsv(`sesion-${activeCategory}.csv`, selectedRows.map((r) => ({
              fecha: filters.date,
              jugador: r.player.name,
              categoria_base: r.player.category ?? activeCategory,
              categoria_participacion: r.actingCategory,
              movimiento: r.actingCategory === (r.player.category ?? activeCategory) ? 'base' : r.movementType,
              nota_movimiento: r.movementNote || '',
              participacion: r.participation,
              minutos: r.min,
              rpe: r.rpe,
              acc: youthSimple ? '' : r.acc,
              dcc: youthSimple ? '' : r.dcc,
              sprints: youthSimple ? '' : r.sprints,
              rhie: youthSimple ? '' : r.rhie,
              ima: youthSimple ? '' : r.ima,
            })))}>Exportar CSV</button>
            <button type="button" className="btn" onClick={saveSession}>Guardar sesión</button>
          </div>
        </div>

        <div className="session-player-grid mobile-clean-grid">
          {rows.map((row) => {
            const invited = row.actingCategory !== (row.player.category ?? activeCategory);
            return (
              <div key={row.player.id} className="session-player-card clean-mobile-card">
                <div className="session-player-header">
                  <div>
                    <strong>{row.player.name}</strong>
                    <div className="muted-line">{row.player.position} · Base {row.player.category}</div>
                    {invited ? <div className="muted-line" style={{ color: '#1d4ed8', fontWeight: 800 }}>Jugador invitado en {row.actingCategory}</div> : null}
                  </div>
                  <div className="btn-row">
                    <label className="session-checkbox"><input type="checkbox" checked={row.selected} onChange={(e) => updateRow(row.player.id, { selected: e.target.checked })} /><span>Incluir</span></label>
                    <ToneBadge text={row.player.status} tone={row.player.status === 'Disponible' ? 'green' : row.player.status === 'Molestia' ? 'yellow' : row.player.status === 'Readaptación' ? 'orange' : 'red'} />
                  </div>
                </div>

                <div className={`grid session-fields-grid ${youthSimple ? 'session-simple-grid' : 'session-metrics-grid'}`}>
                  <div className="field"><label>Participación</label><select className="select session-input-large" value={row.participation} onChange={(e) => updateRow(row.player.id, { participation: e.target.value as SessionParticipation })}>{participationOptions.map((option) => <option key={option}>{option}</option>)}</select></div>
                  <div className="field"><label>Minutos</label><input className="input session-input-large" type="number" placeholder="Vacío" value={renderNumberInput(row.min)} onChange={(e) => updateRow(row.player.id, { min: Number(e.target.value) || 0 })} /></div>
                  <div className="field"><label>RPE</label><input className="input session-input-large" type="number" min="1" max="10" placeholder="Vacío" value={renderNumberInput(row.rpe)} onChange={(e) => updateRow(row.player.id, { rpe: Number(e.target.value) || 0 })} /></div>
                  <div className="field"><label>Categoría participación</label><select className="select session-input-large" value={row.actingCategory} onChange={(e) => updateRow(row.player.id, { actingCategory: e.target.value as ClubCategory, movementType: e.target.value === (row.player.category ?? activeCategory) ? 'base' : row.movementType })}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="field"><label>Movimiento</label><select className="select session-input-large" value={row.actingCategory === (row.player.category ?? activeCategory) ? 'base' : row.movementType} onChange={(e) => updateRow(row.player.id, { movementType: e.target.value as MovementType })}><option value="base">Categoría base</option>{movementOptions.filter((m) => m.value !== 'base').map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
                  <div className="field"><label>Observación</label><input className="input session-input-large" value={row.movementNote} onChange={(e) => updateRow(row.player.id, { movementNote: e.target.value })} placeholder="Opcional" /></div>
                  {!youthSimple ? <>
                    <div className="field"><label>ACC</label><input className="input session-input-large" type="number" placeholder="Vacío" value={renderNumberInput(row.acc)} onChange={(e) => updateRow(row.player.id, { acc: Number(e.target.value) || 0 })} /></div>
                    <div className="field"><label>DCC</label><input className="input session-input-large" type="number" placeholder="Vacío" value={renderNumberInput(row.dcc)} onChange={(e) => updateRow(row.player.id, { dcc: Number(e.target.value) || 0 })} /></div>
                    <div className="field"><label>SPRINTS</label><input className="input session-input-large" type="number" placeholder="Vacío" value={renderNumberInput(row.sprints)} onChange={(e) => updateRow(row.player.id, { sprints: Number(e.target.value) || 0 })} /></div>
                    <div className="field"><label>RHIE</label><input className="input session-input-large" type="number" placeholder="Vacío" value={renderNumberInput(row.rhie)} onChange={(e) => updateRow(row.player.id, { rhie: Number(e.target.value) || 0 })} /></div>
                    <div className="field"><label>IMA</label><input className="input session-input-large" type="number" placeholder="Vacío" value={renderNumberInput(row.ima)} onChange={(e) => updateRow(row.player.id, { ima: Number(e.target.value) || 0 })} /></div>
                  </> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
