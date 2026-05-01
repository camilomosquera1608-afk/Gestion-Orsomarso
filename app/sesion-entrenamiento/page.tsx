'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { KpiCard } from '@/components/kpi-card';
import { DataQualityPanel, EmptyState, OperationalAlertPanel } from '@/components/pro-ui';
import { SessionReportTemplate } from '@/components/session-report';
import { ToneBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { ClubCategory, MovementType, SessionParticipation, TrainingSessionType } from '@/lib/types';
import { findMicrocycleByDate, groupAverage } from '@/lib/utils';
import { buildDailyOperations } from '@/lib/operational-helpers';
import { supportsGps } from '@/lib/report-utils';
import { findDuplicateTrainingSession } from '@/lib/operational-validation';
import { getSessionForDateAndCategory, getSessionNumberForDate, getSessionPlayersForSession, getInternalLoadsForSession } from '@/lib/session-derived';

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
  totalDistance: number;
  maxVelocity: number;
  playerLoad: number;
  highSpeedDistance: number;
  sprintDistance: number;
  movementType: MovementType;
  movementNote: string;
};

const renderNumberInput = (value: number) => (value === 0 ? '' : String(value));

export default function SesionEntrenamientoPage() {
  const { data, filters, setFilters, addExternalLoad, updateExternalLoad, deleteExternalLoad, upsertInternalLoad, deleteInternalLoad, upsertTrainingSessionSummary, deleteTrainingSessionSummary } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = (master ? (filters.category === 'all' ? 'Sub20' : filters.category) : session.category) as ClubCategory;
  const ops = buildDailyOperations(data, filters, activeCategory);
  const gpsEnabled = supportsGps(activeCategory);
  const youthSimple = !gpsEnabled;
  const selectedMicrocycle = data.microcycles.find((microcycle) => microcycle.id === filters.microcycleId);
  const detectedMicrocycle = findMicrocycleByDate(data.microcycles, filters.date, filters.microcycleId, activeCategory);
  const activeMicrocycleId = detectedMicrocycle?.id ?? '';
  const microcycleNotice = filters.date
    ? detectedMicrocycle
      ? 'Microciclo activo para esta fecha: ' + detectedMicrocycle.name
      : 'No hay microciclo asignado para esta fecha.'
    : selectedMicrocycle
      ? selectedMicrocycle.name + ' está seleccionado, pero aún no tiene rango de fechas. Asígnale fecha de inicio y fin en Microciclo.'
      : 'No hay microciclo seleccionado.';
  const [sourceCategory, setSourceCategory] = useState<ClubCategory>(activeCategory);
  const [message, setMessage] = useState('');
  const [showGroupReport, setShowGroupReport] = useState(false);
  const [sessionNumberInput, setSessionNumberInput] = useState(filters.sessionNumber ? String(filters.sessionNumber) : '');
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  useEffect(() => {
    setSourceCategory(activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    setSessionNumberInput(filters.sessionNumber ? String(filters.sessionNumber) : '');
  }, [filters.sessionNumber]);

  const summaryRecord = getSessionForDateAndCategory(data, filters.date, activeCategory, editingSessionId);
  const dateSummaryRecord = getSessionForDateAndCategory(data, filters.date, activeCategory);
  const sessionHistory = useMemo(
    () => data.trainingSessionSummaries
      .filter((item) => item.category === activeCategory)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [data.trainingSessionSummaries, activeCategory],
  );
  useEffect(() => {
    if (dateSummaryRecord && editingSessionId !== dateSummaryRecord.id) {
      setEditingSessionId(dateSummaryRecord.id);
      setSessionNumberInput(String(dateSummaryRecord.sessionNumber || 1));
      setSessionType(dateSummaryRecord.sessionType ?? 'cdEf');
      setSessionObjective(dateSummaryRecord.objective ?? '');
      setSessionObservation(dateSummaryRecord.observation ?? '');
      return;
    }
    if (!dateSummaryRecord && editingSessionId) {
      const editing = data.trainingSessionSummaries.find((item) => item.id === editingSessionId);
      if (!editing || editing.date !== filters.date || editing.category !== activeCategory) setEditingSessionId(null);
    }
  }, [dateSummaryRecord?.id, editingSessionId, filters.date, activeCategory, data.trainingSessionSummaries]);

  const [sessionType, setSessionType] = useState<TrainingSessionType>(summaryRecord?.sessionType ?? 'cdEf');
  const [sessionObjective, setSessionObjective] = useState(summaryRecord?.objective ?? '');
  const [sessionObservation, setSessionObservation] = useState(summaryRecord?.observation ?? '');

  useEffect(() => {
    setSessionType(summaryRecord?.sessionType ?? 'cdEf');
    setSessionObjective(summaryRecord?.objective ?? '');
    setSessionObservation(summaryRecord?.observation ?? '');
  }, [summaryRecord?.id, summaryRecord?.sessionType, summaryRecord?.objective, summaryRecord?.observation]);

  useEffect(() => {
    const canonicalNumber = getSessionNumberForDate(data, filters.date, activeCategory, activeMicrocycleId, editingSessionId);
    setSessionNumberInput(String(canonicalNumber || 1));
    if (canonicalNumber && canonicalNumber !== filters.sessionNumber) setFilters({ sessionNumber: canonicalNumber });
  }, [summaryRecord?.id, summaryRecord?.sessionNumber, filters.date, activeCategory, activeMicrocycleId, editingSessionId, data.trainingSessionSummaries]);

  const sessionPlayers = useMemo(() => data.players.filter((player) => player.category === sourceCategory), [data.players, sourceCategory]);
  const existingRecords = useMemo(
    () => getSessionPlayersForSession(data, summaryRecord, filters.date, activeCategory),
    [data.externalLoads, data.players, summaryRecord?.id, summaryRecord?.date, summaryRecord?.category, summaryRecord?.sessionNumber, filters.date, activeCategory],
  );
  const existingInternalRecords = useMemo(
    () => getInternalLoadsForSession(data, summaryRecord, filters.date, activeCategory),
    [data.internalLoads, data.players, summaryRecord?.id, summaryRecord?.date, summaryRecord?.category, summaryRecord?.sessionNumber, filters.date, activeCategory],
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
        totalDistance: existing?.totalDistance ?? 0,
        maxVelocity: existing?.maxVelocity ?? 0,
        playerLoad: existing?.playerLoad ?? 0,
        highSpeedDistance: existing?.highSpeedDistance ?? existing?.hsr ?? 0,
        sprintDistance: existing?.sprintDistance ?? 0,
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
      totalDistance: 0,
      maxVelocity: 0,
      playerLoad: 0,
      highSpeedDistance: 0,
      sprintDistance: 0,
      movementType: 'base',
      movementNote: '',
    }),
  }));
  const selectedRows = rows.filter((row) => row.selected);
  const reportRows = selectedRows.length ? selectedRows : rows.filter((row) => existingRecords.some((record) => record.playerId === row.player.id));
  const absentPlayers = sessionPlayers.filter((player) => !reportRows.some((row) => row.player.id === player.id));
  const sessionWellnessRecords = data.wellness.filter((record) => record.date === filters.date && sessionPlayers.some((player) => player.id === record.playerId));
  const sessionLoadTotal = reportRows.reduce((acc, row) => acc + row.min * row.rpe, 0);

  const editSessionSummary = (sessionId: string) => {
    const target = data.trainingSessionSummaries.find((item) => item.id === sessionId);
    if (!target) return;
    setFilters({ date: target.date, microcycleId: target.microcycleId, sessionNumber: target.sessionNumber, category: target.category ?? activeCategory });
    setSessionType(target.sessionType ?? 'cdEf');
    setSessionObjective(target.objective ?? '');
    setSessionObservation(target.observation ?? '');
    setEditingSessionId(target.id);
    setSessionNumberInput(String(target.sessionNumber || 1));
    setMessage(`Editando sesión ${target.sessionNumber || '-'} · ${categoryLabel(target.category ?? activeCategory)} · ${target.date}. Los datos cargados se muestran en la planilla.`);
  };

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
          totalDistance: 0,
          maxVelocity: 0,
          playerLoad: 0,
          highSpeedDistance: 0,
          sprintDistance: 0,
          movementType: 'base',
          movementNote: '',
        }),
        ...patch,
      },
    }));

  const saveSession = () => {
    if (isSavingSession) return;
    const parsedSessionNumber = Number(sessionNumberInput);
    if (!sessionNumberInput.trim() || !Number.isFinite(parsedSessionNumber) || parsedSessionNumber <= 0) {
      setMessage('Debes ingresar un número de sesión válido antes de guardar.');
      return;
    }

    if (parsedSessionNumber !== filters.sessionNumber) {
      setFilters({ sessionNumber: parsedSessionNumber });
    }

    if (!filters.date) {
      setMessage('Debes seleccionar una fecha antes de guardar la sesión. Si elegiste un microciclo nuevo, primero asígnale fecha de inicio y fin.');
      return;
    }

    if (!detectedMicrocycle) {
      setMessage('No hay microciclo asignado para esta fecha. Ajusta la fecha o crea el rango en el módulo Microciclo.');
      return;
    }

    if (!selectedRows.length) {
      setMessage('Debes incluir al menos un jugador antes de guardar la sesión.');
      return;
    }

    const invalidRow = selectedRows.find((row) => {
      const gpsValues = [row.acc, row.dcc, row.sprints, row.rhie, row.ima, row.totalDistance, row.maxVelocity, row.playerLoad, row.highSpeedDistance, row.sprintDistance];
      return row.min < 0
        || row.min > 240
        || row.rpe < 0
        || row.rpe > 10
        || (!youthSimple && gpsValues.some((value) => value < 0));
    });
    if (invalidRow) {
      setMessage(`Revisa la planilla de ${invalidRow.player.name}: MIN debe ser 0-240, RPE 0-10 y GPS no puede ser negativo.`);
      return;
    }

    const inconsistentRow = selectedRows.find((row) => row.participation === 'No participa' && (row.min > 0 || row.rpe > 0));
    if (inconsistentRow) {
      setMessage(`${inconsistentRow.player.name} está como No participa. Deja MIN y RPE en 0 o cambia la participación.`);
      return;
    }

    const duplicateSummary = findDuplicateTrainingSession(data.trainingSessionSummaries, { id: summaryRecord?.id ?? editingSessionId ?? undefined, date: filters.date, category: activeCategory });
    if (duplicateSummary && duplicateSummary.id !== summaryRecord?.id) {
      setEditingSessionId(duplicateSummary.id);
      setMessage(`Ya existe una sesión ${duplicateSummary.sessionNumber} para esta fecha. Se cargó para edición.`);
      return;
    }

    setIsSavingSession(true);
    const sessionId = summaryRecord?.id ?? crypto.randomUUID();
    upsertTrainingSessionSummary({
      id: sessionId,
      date: filters.date,
      category: activeCategory,
      microcycleId: activeMicrocycleId,
      sessionNumber: parsedSessionNumber,
      sessionType,
      objective: sessionObjective,
      observation: sessionObservation,
    });

    selectedRows.forEach((row) => {
      const existing = existingRecords.find((item) => item.playerId === row.player.id);
      const movementType = sourceCategory === activeCategory ? 'base' : row.movementType;
      const externalRecord = {
        id: existing?.id ?? crypto.randomUUID(),
        sessionId,
        playerId: row.player.id,
        date: filters.date,
        min: row.min,
        rpe: row.rpe,
        acc: youthSimple ? 0 : row.acc,
        dcc: youthSimple ? 0 : row.dcc,
        sprints: youthSimple ? 0 : row.sprints,
        rhie: youthSimple ? 0 : row.rhie,
        ima: youthSimple ? 0 : row.ima,
        totalDistance: youthSimple ? undefined : row.totalDistance,
        distancePerMin: youthSimple || !row.totalDistance || !row.min ? undefined : Number((row.totalDistance / row.min).toFixed(1)),
        maxVelocity: youthSimple ? undefined : row.maxVelocity,
        playerLoad: youthSimple ? undefined : row.playerLoad,
        playerLoadPerMin: youthSimple || !row.playerLoad || !row.min ? undefined : Number((row.playerLoad / row.min).toFixed(2)),
        highSpeedDistance: youthSimple ? undefined : row.highSpeedDistance,
        sprintDistance: youthSimple ? undefined : row.sprintDistance,
        hsr: youthSimple ? undefined : row.highSpeedDistance,
        participation: row.participation,
        microcycleId: activeMicrocycleId,
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
      const existingInternal = existingInternalRecords.find((item) => item.playerId === row.player.id);
      upsertInternalLoad({
        id: existingInternal?.id ?? crypto.randomUUID(),
        sessionId,
        playerId: row.player.id,
        date: filters.date,
        rpe: row.rpe,
        duration: row.min,
        microcycleId: activeMicrocycleId,
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

    existingRecords
      .filter((record) => !selectedRows.find((row) => row.player.id === record.playerId))
      .forEach((record) => deleteExternalLoad(record.id));
    existingInternalRecords
      .filter((record) => !selectedRows.find((row) => row.player.id === record.playerId))
      .forEach((record) => deleteInternalLoad(record.id));
    setIsSavingSession(false);
    setEditingSessionId(sessionId);
    setMessage(summaryRecord ? 'Sesión actualizada correctamente.' : 'Sesión guardada correctamente.');
  };

  const deleteSession = (sessionId: string) => {
    const target = data.trainingSessionSummaries.find((item) => item.id === sessionId);
    if (!target) return;
    const confirmed = window.confirm(`¿Eliminar la sesión ${target.sessionNumber || '-'} del ${target.date}? También se quitará la participación de jugadores asociada.`);
    if (!confirmed) return;
    deleteTrainingSessionSummary(sessionId);
    if (editingSessionId === sessionId) setEditingSessionId(null);
    setMessage('Sesión eliminada correctamente.');
  };

  const cancelSessionEditing = () => {
    setEditingSessionId(null);
    setMessage('Edición cancelada. Selecciona una fecha o una sesión del historial.');
  };

  return (
    <>
    <div className="grid no-print">
      <AppHero title="Ficha técnica de entrenamiento" subtitle={`Sesión · ${categoryLabel(activeCategory)}${gpsEnabled ? ' · GPS Catapult U20' : ''}`} />


      <div className="grid grid-2">
        <DataQualityPanel percent={ops.dataQualityPercent} items={ops.dataQualityItems} />
        <OperationalAlertPanel title="Alertas de sesión" alerts={ops.alerts} />
      </div>
      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span className="section-eyebrow">Sesión</span><h3 style={{ margin: 0 }}>Sesión de entrenamiento</h3>
            
            <div className="muted-line" style={{ marginTop: 8 }}>{microcycleNotice}</div>
            {summaryRecord ? <div className="muted-line" style={{ marginTop: 4, color: '#1d4ed8', fontWeight: 800 }}>Sesión existente detectada: estás editando la sesión {summaryRecord.sessionNumber} del {summaryRecord.date}.</div> : null}
          </div>
          <div className="btn-row">
            <button type="button" className="btn secondary" onClick={summaryRecord ? cancelSessionEditing : () => setMessage('')}>{summaryRecord ? 'Cancelar edición' : 'Limpiar formulario'}</button>
            {summaryRecord ? <button type="button" className="btn danger" onClick={() => deleteSession(summaryRecord.id)}>Eliminar sesión</button> : null}
          </div>
        </div>
        <div className="grid grid-4" style={{ marginTop: 16 }}>
          <div className="field">
            <label>Fecha</label>
            <input className="input" type="date" value={filters.date} onChange={(e) => setFilters({ date: e.target.value })} />
          </div>
          <div className="field">
            <label>Tipo de sesión</label>
            <select className="select" value={sessionType} onChange={(e) => setSessionType(e.target.value as TrainingSessionType)}>
              {sessionTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Número de sesión</label>
            <input
              className="input"
              type="number"
              min="1"
              placeholder="Se asigna automáticamente"
              value={sessionNumberInput}
              readOnly={!!summaryRecord}
              onChange={(e) => {
                if (summaryRecord) return;
                setSessionNumberInput(e.target.value);
                if (e.target.value === '') return;
                const parsed = Number(e.target.value);
                if (Number.isFinite(parsed) && parsed > 0) setFilters({ sessionNumber: parsed });
              }}
            />
            <div className="muted-line" style={{ marginTop: 6 }}>{summaryRecord ? 'Número asociado a la sesión guardada para esta fecha.' : 'Se sugiere el siguiente número disponible.'}</div>
          </div>
          <div className="field">
            <label>Categoría base</label>
            <input className="input" value={categoryLabel(activeCategory)} readOnly />
          </div>
        </div>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Objetivo general</label>
            <input className="input" value={sessionObjective} onChange={(e) => setSessionObjective(e.target.value)} placeholder="Objetivo de la sesión" />
          </div>
          <div className="field">
            <label>Observación general</label>
            <input className="input" value={sessionObservation} onChange={(e) => setSessionObservation(e.target.value)} placeholder="Resumen del trabajo realizado" />
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <KpiCard label="Jugadores seleccionados" value={String(selectedRows.length)} tone="green" trend="Incluidos en sesión" />
        <KpiCard label="MIN promedio" value={groupAverage(selectedRows.map((r) => r.min)).toFixed(0)} tone="dark" trend="Volumen medio" />
        <KpiCard label="RPE promedio" value={groupAverage(selectedRows.map((r) => r.rpe)).toFixed(1)} tone="amber" trend="Esfuerzo percibido" />
        <KpiCard label="Invitados" value={String(selectedRows.filter((r) => sourceCategory !== activeCategory).length)} tone="blue" trend="Movimientos" />
      </div>

      {message ? <div className="card"><strong>{message}</strong></div> : null}

      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span className="section-eyebrow">Informe</span><h3 style={{ margin: 0 }}>Informe grupal de sesión</h3>
            <div className="summary-chip" style={{ marginTop: 8 }}>{categoryLabel(activeCategory)} · {filters.date} · {detectedMicrocycle?.name ?? 'Sin microciclo'} · Sesión {sessionNumberInput || '-'}</div>
          </div>
          <div className="btn-row">
            <button type="button" className="btn secondary" onClick={() => setShowGroupReport((value) => !value)}>{showGroupReport ? 'Ocultar informe grupal' : 'Ver informe grupal'}</button>
            <button type="button" className="btn" onClick={() => window.print()}>Exportar PDF</button>
          </div>
        </div>
        {showGroupReport ? (
          <div className="report-preview-shell" style={{ marginTop: 16 }}>
            <SessionReportTemplate
              date={filters.date}
              category={activeCategory}
              microcycle={detectedMicrocycle}
              sessionNumber={sessionNumberInput || filters.sessionNumber}
              sessionType={sessionType}
              objective={sessionObjective}
              observation={sessionObservation}
              rows={reportRows}
              absentPlayers={absentPlayers}
              dataQualityPercent={ops.dataQualityPercent}
              wellnessRecords={sessionWellnessRecords}
              compact
            />
          </div>
        ) : null}
      </div>

      {master ? (
        <div className="summary-chip">Administrador general · edición completa habilitada para sesión, planilla e informe.</div>
      ) : null}

      <div className="card session-table-card">
          <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="section-eyebrow">Planilla</span><h3 style={{ margin: 0 }}>Participación</h3>
            <div className="btn-row">
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Categoría del jugador</label>
                <select className="select" value={sourceCategory} onChange={(e) => setSourceCategory(e.target.value as ClubCategory)}>
                  {categories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </select>
              </div>
              <button type="button" className="btn secondary" onClick={() => downloadCsv(`sesion-${activeCategory}.csv`, selectedRows.map((r) => ({ fecha: filters.date, jugador: r.player.name, categoria_base: categoryLabel(r.player.category), categoria_participacion: categoryLabel(activeCategory), movimiento: sourceCategory === activeCategory ? 'base' : r.movementType, minutos: r.min, rpe: r.rpe })))}>Exportar CSV</button>
              <button type="button" className="btn" disabled={isSavingSession} onClick={saveSession}>{isSavingSession ? 'Guardando...' : summaryRecord ? 'Actualizar sesión' : 'Guardar sesión'}</button>
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
                      <div className="field"><label>Distancia total (m)</label><input className="input session-input-large" type="number" value={renderNumberInput(row.totalDistance)} onChange={(e) => updateRow(row.player.id, { totalDistance: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>Vel. máx. (km/h)</label><input className="input session-input-large" type="number" step="0.1" value={renderNumberInput(row.maxVelocity)} onChange={(e) => updateRow(row.player.id, { maxVelocity: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>Player Load</label><input className="input session-input-large" type="number" value={renderNumberInput(row.playerLoad)} onChange={(e) => updateRow(row.player.id, { playerLoad: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>Alta velocidad (m)</label><input className="input session-input-large" type="number" value={renderNumberInput(row.highSpeedDistance)} onChange={(e) => updateRow(row.player.id, { highSpeedDistance: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>Sprint dist. (m)</label><input className="input session-input-large" type="number" value={renderNumberInput(row.sprintDistance)} onChange={(e) => updateRow(row.player.id, { sprintDistance: Number(e.target.value) || 0 })} /></div>
                    </> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      <div className="card table-wrap">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span className="section-eyebrow">Historial</span><h3 style={{ margin: 0 }}>Sesiones cargadas</h3>
            <div className="muted-line" style={{ marginTop: 8 }}>Edita una sesión guardada para corregir datos generales o participación de jugadores.</div>
          </div>
        </div>
        {sessionHistory.length ? (
          <table>
            <thead><tr><th>Fecha</th><th>Categoría</th><th>Microciclo</th><th>Sesión</th><th>Tipo</th><th>Objetivo</th><th>Acciones</th></tr></thead>
            <tbody>
              {sessionHistory.map((item) => {
                const itemMicrocycle = data.microcycles.find((microcycle) => microcycle.id === item.microcycleId);
                return (
                  <tr key={item.id}>
                    <td>{item.date}</td>
                    <td>{categoryLabel(item.category ?? activeCategory)}</td>
                    <td>{itemMicrocycle?.name ?? 'Sin microciclo'}</td>
                    <td>{item.sessionNumber}</td>
                    <td>{item.sessionType}</td>
                    <td>{item.objective || '-'}</td>
                    <td><div className="btn-row"><button type="button" className="btn secondary" onClick={() => editSessionSummary(item.id)}>Editar sesión</button><button type="button" className="btn danger" onClick={() => deleteSession(item.id)}>Eliminar</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="Sin sesiones cargadas" text="Las sesiones guardadas aparecerán aquí para edición." />}
      </div>

      </div>

      <SessionReportTemplate
        date={filters.date}
        category={activeCategory}
        microcycle={detectedMicrocycle}
        sessionNumber={sessionNumberInput || filters.sessionNumber}
        sessionType={sessionType}
        objective={sessionObjective}
        observation={sessionObservation}
        rows={reportRows}
        absentPlayers={absentPlayers}
        dataQualityPercent={ops.dataQualityPercent}
        wellnessRecords={sessionWellnessRecords}
        className="print-only"
      />
    </>
  );
}
