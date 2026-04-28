'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { KpiCard } from '@/components/kpi-card';
import { ToneBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
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
  const [sourceCategory, setSourceCategory] = useState<ClubCategory>(activeCategory);
  const [message, setMessage] = useState('');
  const [showGroupReport, setShowGroupReport] = useState(false);
  const [sessionNumberInput, setSessionNumberInput] = useState(filters.sessionNumber ? String(filters.sessionNumber) : '');

  useEffect(() => {
    setSourceCategory(activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    setSessionNumberInput(filters.sessionNumber ? String(filters.sessionNumber) : '');
  }, [filters.sessionNumber]);

  const summaryRecord = data.trainingSessionSummaries.find((item) => item.microcycleId === filters.microcycleId && item.sessionNumber === filters.sessionNumber && item.date === filters.date);
  const [sessionType, setSessionType] = useState<TrainingSessionType>(summaryRecord?.sessionType ?? 'cdEf');
  const sessionPlayers = useMemo(() => data.players.filter((player) => player.category === sourceCategory), [data.players, sourceCategory]);
  const existingRecords = useMemo(
    () => data.externalLoads.filter((record) => record.date === filters.date && (record.category ?? record.actingCategory) === activeCategory && (record.microcycleId ?? filters.microcycleId) === filters.microcycleId && (record.sessionNumber ?? filters.sessionNumber) === filters.sessionNumber),
    [data.externalLoads, filters.date, filters.microcycleId, filters.sessionNumber, activeCategory],
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
        movementType: existing?.movementType ?? 'base',
        movementNote: existing?.movementNote ?? '',
      };
    });
    setRowStates(next);
  }, [sessionPlayers, existingRecords]);

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
      movementType: 'base',
      movementNote: '',
    }),
  }));
  const selectedRows = rows.filter((row) => row.selected);
  const reportRows = selectedRows.length ? selectedRows : rows.filter((row) => existingRecords.some((record) => record.playerId === row.player.id));
  const absentPlayers = sessionPlayers.filter((player) => !reportRows.some((row) => row.player.id === player.id));
  const sessionLoadTotal = reportRows.reduce((acc, row) => acc + row.min * row.rpe, 0);

  const updateRow = (playerId: string, patch: Partial<RowState>) =>
    setRowStates((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? {
          selected: false,
          participation: 'Completa',
          min: 0,
          rpe: 0,
          acc: 0,
          dcc: 0,
          sprints: 0,
          rhie: 0,
          ima: 0,
          movementType: 'base',
          movementNote: '',
        }),
        ...patch,
      },
    }));

  const saveSession = () => {
    const parsedSessionNumber = Number(sessionNumberInput);
    if (!sessionNumberInput.trim() || !Number.isFinite(parsedSessionNumber) || parsedSessionNumber <= 0) {
      setMessage('Debes ingresar un número de sesión válido antes de guardar.');
      return;
    }

    if (parsedSessionNumber !== filters.sessionNumber) {
      setFilters({ sessionNumber: parsedSessionNumber });
    }

    upsertTrainingSessionSummary({
      id: summaryRecord?.id ?? crypto.randomUUID(),
      date: filters.date,
      microcycleId: filters.microcycleId,
      sessionNumber: parsedSessionNumber,
      sessionType,
    });

    selectedRows.forEach((row) => {
      const existing = existingRecords.find((item) => item.playerId === row.player.id);
      const movementType = sourceCategory === activeCategory ? 'base' : row.movementType;
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
        sessionNumber: parsedSessionNumber,
        sessionType,
        category: activeCategory,
        baseCategory: row.player.category ?? sourceCategory,
        actingCategory: activeCategory,
        movementType,
        movementNote: row.movementNote,
        movementModule: 'sesion' as const,
        loggedBy: session.displayName,
      };
      if (existing) updateExternalLoad(externalRecord); else addExternalLoad(externalRecord);
      upsertInternalLoad({
        id: crypto.randomUUID(),
        playerId: row.player.id,
        date: filters.date,
        rpe: row.rpe,
        duration: row.min,
        microcycleId: filters.microcycleId,
        sessionNumber: parsedSessionNumber,
        category: activeCategory,
        baseCategory: row.player.category ?? sourceCategory,
        actingCategory: activeCategory,
        movementType,
        movementNote: row.movementNote,
        movementModule: 'sesion' as const,
        loggedBy: session.displayName,
      });
    });

    existingRecords.filter((record) => !selectedRows.find((row) => row.player.id === record.playerId)).forEach((record) => deleteExternalLoad(record.id));
    setMessage('Sesión guardada correctamente.');
  };

  return (
    <div className="grid">
      <AppHero title="Sesión de entrenamiento" subtitle={`Orsomarso SC Performance · ${categoryLabel(activeCategory)}`} />

      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Panel de sesión</h3>
            <div className="summary-chip" style={{ marginTop: 8 }}>Este panel corresponde al guardado de la sesión de entrenamiento.</div>
          </div>
          <button type="button" className="btn secondary" onClick={() => setMessage('')}>Limpiar aviso</button>
        </div>
        <div className="grid grid-4" style={{ marginTop: 16 }}>
          <div className="field">
            <label>Fecha</label>
            <input className="input" type="date" value={filters.date} onChange={(e) => setFilters({ date: e.target.value })} />
          </div>
          <div className="field">
            <label>Microciclo</label>
            <select className="select" value={filters.microcycleId} onChange={(e) => setFilters({ microcycleId: e.target.value })}>
              {data.microcycles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Número de sesión</label>
            <input
              className="input"
              type="number"
              min="1"
              placeholder="Escribe el número de sesión"
              value={sessionNumberInput}
              onChange={(e) => {
                setSessionNumberInput(e.target.value);
                if (e.target.value === '') return;
                const parsed = Number(e.target.value);
                if (Number.isFinite(parsed) && parsed > 0) setFilters({ sessionNumber: parsed });
              }}
            />
          </div>
          <div className="field">
            <label>Categoría base</label>
            <input className="input" value={categoryLabel(activeCategory)} readOnly />
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <KpiCard label="Jugadores seleccionados" value={String(selectedRows.length)} />
        <KpiCard label="MIN promedio" value={groupAverage(selectedRows.map((r) => r.min)).toFixed(0)} />
        <KpiCard label="RPE promedio" value={groupAverage(selectedRows.map((r) => r.rpe)).toFixed(1)} />
        <KpiCard label="Invitados" value={String(selectedRows.filter((r) => sourceCategory !== activeCategory).length)} />
      </div>

      {message ? <div className="card"><strong>{message}</strong></div> : null}

      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Informe grupal de sesión</h3>
            <div className="summary-chip" style={{ marginTop: 8 }}>{categoryLabel(activeCategory)} · {filters.date} · Microciclo {String(filters.microcycleId).replace('mc-', '')} · Sesión {sessionNumberInput || '-'}</div>
          </div>
          <div className="btn-row">
            <button type="button" className="btn secondary" onClick={() => setShowGroupReport((value) => !value)}>{showGroupReport ? 'Ocultar informe grupal' : 'Ver informe grupal'}</button>
            <button type="button" className="btn" onClick={() => window.print()}>Exportar PDF</button>
          </div>
        </div>
        {showGroupReport ? (
          <div className="grid" style={{ gap: 16, marginTop: 16 }}>
            <div className="grid grid-4">
              <KpiCard label="Jugadores incluidos" value={String(reportRows.length)} />
              <KpiCard label="Ausentes" value={String(absentPlayers.length)} />
              <KpiCard label="MIN promedio" value={groupAverage(reportRows.map((row) => row.min)).toFixed(0)} />
              <KpiCard label="RPE promedio" value={groupAverage(reportRows.map((row) => row.rpe)).toFixed(1)} />
            </div>
            <div className="grid grid-4">
              <KpiCard label="Carga total" value={String(sessionLoadTotal)} />
              <KpiCard label="Molestia" value={String(reportRows.filter((row) => row.player.status === 'Molestia').length)} />
              <KpiCard label="Readaptación" value={String(reportRows.filter((row) => row.player.status === 'Readaptación').length)} />
              <KpiCard label="Lesionados" value={String(reportRows.filter((row) => row.player.status === 'Lesionado').length)} />
            </div>
            {!youthSimple ? (
              <div className="grid grid-4">
                <KpiCard label="ACC promedio" value={groupAverage(reportRows.map((row) => row.acc)).toFixed(0)} />
                <KpiCard label="DCC promedio" value={groupAverage(reportRows.map((row) => row.dcc)).toFixed(0)} />
                <KpiCard label="SPRINTS promedio" value={groupAverage(reportRows.map((row) => row.sprints)).toFixed(0)} />
                <KpiCard label="RHIE promedio" value={groupAverage(reportRows.map((row) => row.rhie)).toFixed(0)} />
              </div>
            ) : null}
            <div className="card compact-card">
              <strong>Resumen del trabajo realizado</strong>
              <div className="muted-line" style={{ marginTop: 8 }}>Tipo de sesión: {sessionTypeOptions.find((option) => option.value === sessionType)?.label ?? sessionType}</div>
              <div className="muted-line">Jugadores incluidos: {reportRows.map((row) => row.player.name).join(', ') || 'Sin jugadores incluidos'}</div>
              <div className="muted-line">Jugadores ausentes: {absentPlayers.map((player) => player.name).join(', ') || 'Sin ausencias'}</div>
            </div>
          </div>
        ) : null}
      </div>

      {master ? (
        <div className="card"><strong>Usuario Maestro:</strong> acceso de lectura. Usa Informes y Ranking para análisis global.</div>
      ) : (
        <div className="card session-table-card">
          <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Plantilla de sesión</h3>
            <div className="btn-row">
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Categoría del jugador</label>
                <select className="select" value={sourceCategory} onChange={(e) => setSourceCategory(e.target.value as ClubCategory)}>
                  {categories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Tipo de sesión</label>
                <select className="select" value={sessionType} onChange={(e) => setSessionType(e.target.value as TrainingSessionType)}>
                  {sessionTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <button type="button" className="btn secondary" onClick={() => downloadCsv(`sesion-${activeCategory}.csv`, selectedRows.map((r) => ({ fecha: filters.date, jugador: r.player.name, categoria_base: categoryLabel(r.player.category), categoria_participacion: categoryLabel(activeCategory), movimiento: sourceCategory === activeCategory ? 'base' : r.movementType, minutos: r.min, rpe: r.rpe })))}>Exportar CSV</button>
              <button type="button" className="btn" onClick={saveSession}>Guardar sesión</button>
            </div>
          </div>

          <div className="session-player-grid mobile-clean-grid">
            {rows.map((row) => {
              const invited = sourceCategory !== activeCategory;
              return (
                <div key={row.player.id} className="session-player-card clean-mobile-card">
                  <div className="session-player-header">
                    <div>
                      <strong>{row.player.name}</strong>
                      <div className="muted-line">{row.player.position} · Base {categoryLabel(row.player.category)}</div>
                      {invited ? <div className="muted-line" style={{ color: '#1d4ed8', fontWeight: 800 }}>Jugador invitado en {categoryLabel(activeCategory)}</div> : null}
                    </div>
                    <div className="btn-row">
                      <label className="session-checkbox"><input type="checkbox" checked={row.selected} onChange={(e) => updateRow(row.player.id, { selected: e.target.checked })} /><span>Incluir</span></label>
                      <ToneBadge text={row.player.status} tone={row.player.status === 'Disponible' ? 'green' : row.player.status === 'Molestia' ? 'yellow' : row.player.status === 'Readaptación' ? 'orange' : 'red'} />
                    </div>
                  </div>
                  <div className={`grid session-fields-grid ${youthSimple ? 'session-simple-grid' : 'session-metrics-grid'}`}>
                    <div className="field"><label>Participación</label><select className="select session-input-large" value={row.participation} onChange={(e) => updateRow(row.player.id, { participation: e.target.value as SessionParticipation })}>{participationOptions.map((option) => <option key={option}>{option}</option>)}</select></div>
                    <div className="field"><label>Minutos</label><input className="input session-input-large" type="number" value={renderNumberInput(row.min)} onChange={(e) => updateRow(row.player.id, { min: Number(e.target.value) || 0 })} /></div>
                    <div className="field"><label>RPE</label><input className="input session-input-large" type="number" value={renderNumberInput(row.rpe)} onChange={(e) => updateRow(row.player.id, { rpe: Number(e.target.value) || 0 })} /></div>
                    {invited ? <div className="field"><label>Movimiento</label><select className="select session-input-large" value={row.movementType} onChange={(e) => updateRow(row.player.id, { movementType: e.target.value as MovementType })}>{movementOptions.filter((m) => m.value !== 'base').map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div> : null}
                    {invited ? <div className="field"><label>Observación</label><input className="input session-input-large" value={row.movementNote} onChange={(e) => updateRow(row.player.id, { movementNote: e.target.value })} /></div> : null}
                    {!youthSimple && row.player.position !== 'Portero' ? <>
                      <div className="field"><label>ACC</label><input className="input session-input-large" type="number" value={renderNumberInput(row.acc)} onChange={(e) => updateRow(row.player.id, { acc: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>DCC</label><input className="input session-input-large" type="number" value={renderNumberInput(row.dcc)} onChange={(e) => updateRow(row.player.id, { dcc: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>SPRINTS</label><input className="input session-input-large" type="number" value={renderNumberInput(row.sprints)} onChange={(e) => updateRow(row.player.id, { sprints: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>RHIE</label><input className="input session-input-large" type="number" value={renderNumberInput(row.rhie)} onChange={(e) => updateRow(row.player.id, { rhie: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>IMA</label><input className="input session-input-large" type="number" value={renderNumberInput(row.ima)} onChange={(e) => updateRow(row.player.id, { ima: Number(e.target.value) || 0 })} /></div>
                    </> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
