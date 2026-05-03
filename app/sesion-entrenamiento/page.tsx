'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Upload, X } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { KpiCard } from '@/components/kpi-card';
import { DataQualityPanel, EmptyState, OperationalAlertPanel, useConfirm } from '@/components/pro-ui';
import { SessionReportTemplate } from '@/components/session-report';
import { ToneBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { type ClubCategory, type DailyExternalLoadRecord, type MovementType, type SessionParticipation, type TrainingSessionType } from '@/lib/types';
import { findMicrocycleByDate, groupAverage } from '@/lib/utils';
import { buildDailyOperations } from '@/lib/operational-helpers';
import { supportsGps } from '@/lib/report-utils';
import { findDuplicateTrainingSession } from '@/lib/operational-validation';
import { getSessionForDateAndCategory, getSessionNumberForDate, getSessionPlayersForSession, getInternalLoadsForSession } from '@/lib/session-derived';
import { CsvImporter } from '@/components/csv-importer';

// ─── Constants ────────────────────────────────────────────────────────────────
const SESSION_TYPE_OPTIONS: { value: TrainingSessionType; label: string }[] = [
  { value: 'cdef', label: 'Recuperación (cdef)' },
  { value: 'cdEf', label: 'Ejecución (cdEf)' },
  { value: 'cdeF', label: 'Condición física (cdeF)' },
  { value: 'Cdef', label: 'Comunicación (Cdef)' },
];
const PARTICIPATION_OPTIONS: SessionParticipation[] = ['Completa', 'Parcial', 'No participa', 'Gimnasio', 'Readaptación'];
const CATEGORIES: ClubCategory[] = ['Sub15', 'Sub17', 'Sub20'];
const MOVEMENT_OPTIONS: Array<{ value: MovementType; label: string }> = [
  { value: 'base', label: 'Categoría base' },
  { value: 'subio_a_entrenar', label: 'Subió a entrenar' },
  { value: 'bajo_a_entrenar', label: 'Bajó a entrenar' },
];

const normalizeCategoryParam = (value: string | null): ClubCategory | undefined => {
  const n = (value ?? '').toLowerCase().replace(/\s+/g, '');
  if (n === 'u20' || n === 'sub20') return 'Sub20';
  if (n === 'u17' || n === 'sub17') return 'Sub17';
  if (n === 'u15' || n === 'sub15') return 'Sub15';
  return undefined;
};

// ─── Types ────────────────────────────────────────────────────────────────────
type RowState = {
  selected: boolean; participation: SessionParticipation;
  min: number; rpe: number; acc: number; dcc: number;
  sprints: number; rhie: number; ima: number;
  totalDistance: number; maxVelocity: number; playerLoad: number;
  highSpeedDistance: number; sprintDistance: number;
  movementType: MovementType; movementNote: string;
};

type Msg = { text: string; kind: 'error' | 'success' | 'info' };

const DEFAULT_ROW: RowState = {
  selected: false, participation: 'Completa',
  min: 0, rpe: 0, acc: 0, dcc: 0, sprints: 0, rhie: 0, ima: 0,
  totalDistance: 0, maxVelocity: 0, playerLoad: 0,
  highSpeedDistance: 0, sprintDistance: 0,
  movementType: 'base', movementNote: '',
};

const num = (v: number) => v === 0 ? '' : String(v);

// ─── Message banner ───────────────────────────────────────────────────────────
function MsgBanner({ msg, onClose }: { msg: Msg; onClose: () => void }) {
  const colors = {
    error:   { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: <AlertTriangle size={16} /> },
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#065f46', icon: <CheckCircle2 size={16} /> },
    info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: null },
  }[msg.kind];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 14, background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, fontWeight: 700, fontSize: 13 }}>
      {colors.icon && <span style={{ flexShrink: 0, marginTop: 1 }}>{colors.icon}</span>}
      <span style={{ flex: 1 }}>{msg.text}</span>
      <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'grid', placeItems: 'center' }}><X size={15} /></button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SesionEntrenamientoPage() {
  const searchParams = useSearchParams();
  const {
    data, filters, setFilters,
    addExternalLoad, updateExternalLoad, deleteExternalLoad,
    upsertInternalLoad, deleteInternalLoad,
    upsertTrainingSessionSummary, deleteTrainingSessionSummary,
  } = useApp();

  const session       = getStaffSession();
  const master        = isMasterRole(session);
  const activeCategory = (master
    ? (filters.category === 'all' ? 'Sub20' : filters.category)
    : session.category) as ClubCategory;

  const ops              = useMemo(() => buildDailyOperations(data, filters, activeCategory), [data, filters, activeCategory]);
  const gpsEnabled       = supportsGps(activeCategory);
  const youthSimple      = !gpsEnabled;
  const detectedMicrocycle = findMicrocycleByDate(data.microcycles, filters.date, filters.microcycleId, activeCategory);
  const activeMicrocycleId = detectedMicrocycle?.id ?? '';
  const selectedMicrocycle = data.microcycles.find(m => m.id === filters.microcycleId);

  // ── UI state ──
  const [sourceCategory, setSourceCategory]     = useState<ClubCategory>(activeCategory);
  const [msg, setMsg]                           = useState<Msg | null>(null);
  const [showReport, setShowReport]             = useState(false);
  const [sessionNumberInput, setSessionNumberInput] = useState(filters.sessionNumber ? String(filters.sessionNumber) : '');
  const [isSaving, setIsSaving]                 = useState(false);
  const [showCsvImporter, setShowCsvImporter]   = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionType, setSessionType]           = useState<TrainingSessionType>('cdEf');
  const [sessionObjective, setSessionObjective]   = useState('');
  const [sessionObservation, setSessionObservation] = useState('');
  const justImportedRef = useRef(false);
  const { confirm: showConfirm, ConfirmModal } = useConfirm();

  const flash = useCallback((text: string, kind: Msg['kind'] = 'info') => setMsg({ text, kind }), []);

  // ── Query params ──
  useEffect(() => {
    const qDate     = searchParams.get('date');
    const qCat      = normalizeCategoryParam(searchParams.get('category'));
    const qSession  = searchParams.get('sessionId');
    const next: Partial<typeof filters> = {};
    if (qDate && qDate !== filters.date) next.date = qDate;
    if (master && qCat && qCat !== filters.category) next.category = qCat;
    if (Object.keys(next).length) setFilters(next);
    if (qSession && qSession !== editingSessionId) setEditingSessionId(qSession);
  }, [searchParams]); // eslint-disable-line

  useEffect(() => { setSourceCategory(activeCategory); }, [activeCategory]);
  useEffect(() => { setSessionNumberInput(filters.sessionNumber ? String(filters.sessionNumber) : ''); }, [filters.sessionNumber]);

  // ── Session records ──
  const summaryRecord    = getSessionForDateAndCategory(data, filters.date, activeCategory, editingSessionId);
  const dateSummaryRecord = getSessionForDateAndCategory(data, filters.date, activeCategory);

  // Auto-load session when date/category has an existing session
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
      const ed = data.trainingSessionSummaries.find(i => i.id === editingSessionId);
      if (!ed || ed.date !== filters.date || ed.category !== activeCategory) setEditingSessionId(null);
    }
  }, [dateSummaryRecord?.id, editingSessionId, filters.date, activeCategory, data.trainingSessionSummaries]); // eslint-disable-line

  // Sync form fields when summaryRecord changes
  useEffect(() => {
    setSessionType(summaryRecord?.sessionType ?? 'cdEf');
    setSessionObjective(summaryRecord?.objective ?? '');
    setSessionObservation(summaryRecord?.observation ?? '');
  }, [summaryRecord?.id, summaryRecord?.sessionType, summaryRecord?.objective, summaryRecord?.observation]); // eslint-disable-line

  // Auto-assign session number
  useEffect(() => {
    const n = getSessionNumberForDate(data, filters.date, activeCategory, activeMicrocycleId, editingSessionId);
    setSessionNumberInput(String(n || 1));
    if (n && n !== filters.sessionNumber) setFilters({ sessionNumber: n });
  }, [summaryRecord?.id, filters.date, activeCategory, activeMicrocycleId, editingSessionId, data.trainingSessionSummaries]); // eslint-disable-line

  const sessionHistory = useMemo(
    () => data.trainingSessionSummaries.filter(i => i.category === activeCategory).sort((a, b) => b.date.localeCompare(a.date)),
    [data.trainingSessionSummaries, activeCategory],
  );

  // ── Players & rows ──
  const sessionPlayers = useMemo(() => data.players.filter(p => p.category === sourceCategory), [data.players, sourceCategory]);
  const existingRecords = useMemo(
    () => getSessionPlayersForSession(data, summaryRecord, filters.date, activeCategory),
    [data.externalLoads, data.players, summaryRecord?.id, filters.date, activeCategory], // eslint-disable-line
  );
  const existingInternalRecords = useMemo(
    () => getInternalLoadsForSession(data, summaryRecord, filters.date, activeCategory),
    [data.internalLoads, data.players, summaryRecord?.id, filters.date, activeCategory], // eslint-disable-line
  );

  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  useEffect(() => {
    if (justImportedRef.current) { justImportedRef.current = false; return; }
    const next: Record<string, RowState> = {};
    sessionPlayers.forEach(player => {
      const ex = existingRecords.find(r => r.playerId === player.id);
      next[player.id] = {
        selected: !!ex,
        participation: ex?.participation ?? 'Completa',
        min: ex?.min ?? 0,
        rpe: ex?.rpe ?? 0,
        acc: ex?.acc ?? 0,
        dcc: ex?.dcc ?? 0,
        sprints: ex?.sprints ?? 0,
        rhie: ex?.rhie ?? 0,
        ima: ex?.ima ?? 0,
        totalDistance: ex?.totalDistance ?? 0,
        maxVelocity: ex?.maxVelocity ?? 0,
        playerLoad: ex?.playerLoad ?? 0,
        highSpeedDistance: ex?.highSpeedDistance ?? ex?.hsr ?? 0,
        sprintDistance: ex?.sprintDistance ?? 0,
        movementType: ex?.movementType ?? 'base',
        movementNote: ex?.movementNote ?? '',
      };
    });
    setRowStates(next);
  }, [sessionPlayers, existingRecords]);

  const updateRow = useCallback((playerId: string, patch: Partial<RowState>) =>
    setRowStates(prev => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? DEFAULT_ROW), ...patch },
    })), []);

  const rows = sessionPlayers.map(player => ({
    player,
    ...(rowStates[player.id] ?? DEFAULT_ROW),
  }));
  const selectedRows = rows.filter(r => r.selected);
  const reportRows   = selectedRows.length ? selectedRows : rows.filter(r => existingRecords.some(rec => rec.playerId === r.player.id));
  const absentPlayers = sessionPlayers.filter(p => !reportRows.some(r => r.player.id === p.id));
  const sessionWellness = data.wellness.filter(rec => rec.date === filters.date && sessionPlayers.some(p => p.id === rec.playerId));

  // ── Microcycle notice ──
  const microcycleNotice = filters.date
    ? detectedMicrocycle
      ? `Microciclo activo: ${detectedMicrocycle.name}`
      : 'Sin microciclo asignado para esta fecha.'
    : selectedMicrocycle
      ? `${selectedMicrocycle.name} seleccionado, sin rango de fechas aún.`
      : 'Sin microciclo seleccionado.';

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveSession = () => {
    if (isSaving) return;
    const parsedNum = Number(sessionNumberInput);

    // — Validaciones —
    if (!sessionNumberInput.trim() || !Number.isFinite(parsedNum) || parsedNum <= 0) {
      flash('Ingresa un número de sesión válido antes de guardar.', 'error'); return;
    }
    if (!filters.date) {
      flash('Selecciona una fecha antes de guardar.', 'error'); return;
    }
    if (!detectedMicrocycle) {
      flash('No hay microciclo para esta fecha. Ajusta la fecha o crea el rango en Microciclo.', 'error'); return;
    }
    if (!selectedRows.length) {
      flash('Incluye al menos un jugador antes de guardar.', 'error'); return;
    }
    const badRow = selectedRows.find(r =>
      r.min < 0 || r.min > 240 || r.rpe < 0 || r.rpe > 10 ||
      (!youthSimple && [r.acc, r.dcc, r.sprints, r.rhie, r.ima, r.totalDistance, r.maxVelocity, r.playerLoad, r.highSpeedDistance, r.sprintDistance].some(v => v < 0))
    );
    if (badRow) {
      flash(`Revisa los datos de ${badRow.player.name}: MIN 0-240, RPE 0-10, GPS sin negativos.`, 'error'); return;
    }
    const noPartRow = selectedRows.find(r => r.participation === 'No participa' && (r.min > 0 || r.rpe > 0));
    if (noPartRow) {
      flash(`${noPartRow.player.name} está como "No participa" pero tiene MIN/RPE. Corrígelo.`, 'error'); return;
    }
    const dup = findDuplicateTrainingSession(data.trainingSessionSummaries, { id: summaryRecord?.id ?? editingSessionId ?? undefined, date: filters.date, category: activeCategory });
    if (dup && dup.id !== summaryRecord?.id) {
      setEditingSessionId(dup.id);
      flash(`Ya existe la sesión ${dup.sessionNumber} para esta fecha. Se cargó para edición.`, 'info');
      return;
    }

    setIsSaving(true);
    if (parsedNum !== filters.sessionNumber) setFilters({ sessionNumber: parsedNum });

    const sessionId = summaryRecord?.id ?? crypto.randomUUID();

    // 1. Guardar resumen de sesión
    upsertTrainingSessionSummary({
      id: sessionId,
      date: filters.date,
      category: activeCategory,
      microcycleId: activeMicrocycleId,
      sessionNumber: parsedNum,
      sessionType,
      objective: sessionObjective,
      observation: sessionObservation,
      status: summaryRecord?.status ?? 'Borrador',
    });

    // 2. Guardar cargas por jugador
    selectedRows.forEach(row => {
      const existing  = existingRecords.find(r => r.playerId === row.player.id);
      const movType   = sourceCategory === activeCategory ? 'base' : row.movementType;
      const ext = {
        id:           existing?.id ?? crypto.randomUUID(),
        sessionId,
        playerId:     row.player.id,
        date:         filters.date,
        min:          row.min,
        rpe:          Math.min(10, Math.max(0, row.rpe)),
        acc:          youthSimple ? 0 : row.acc,
        dcc:          youthSimple ? 0 : row.dcc,
        sprints:      youthSimple ? 0 : row.sprints,
        rhie:         youthSimple ? 0 : row.rhie,
        ima:          youthSimple ? 0 : row.ima,
        totalDistance:     youthSimple ? undefined : row.totalDistance,
        distancePerMin:    youthSimple || !row.totalDistance || !row.min ? undefined : Number((row.totalDistance / row.min).toFixed(1)),
        maxVelocity:       youthSimple ? undefined : row.maxVelocity,
        playerLoad:        youthSimple ? undefined : row.playerLoad,
        playerLoadPerMin:  youthSimple || !row.playerLoad || !row.min ? undefined : Number((row.playerLoad / row.min).toFixed(2)),
        highSpeedDistance: youthSimple ? undefined : row.highSpeedDistance,
        sprintDistance:    youthSimple ? undefined : row.sprintDistance,
        hsr:               youthSimple ? undefined : row.highSpeedDistance,
        participation:  row.participation,
        microcycleId:   activeMicrocycleId,
        sessionNumber:  parsedNum,
        sessionType,
        category:       activeCategory,
        baseCategory:   row.player.category ?? sourceCategory,
        actingCategory: activeCategory,
        movementType:   movType,
        movementNote:   row.movementNote,
        movementModule: 'sesion' as const,
        loggedBy:       session.displayName,
      };
      if (existing) updateExternalLoad(ext); else addExternalLoad(ext);

      const exInt = existingInternalRecords.find(r => r.playerId === row.player.id);
      upsertInternalLoad({
        id:           exInt?.id ?? crypto.randomUUID(),
        sessionId,
        playerId:     row.player.id,
        date:         filters.date,
        rpe:          Math.min(10, Math.max(0, row.rpe)),
        duration:     row.min,
        microcycleId: activeMicrocycleId,
        sessionNumber: parsedNum,
        category:       activeCategory,
        baseCategory:   row.player.category ?? sourceCategory,
        actingCategory: activeCategory,
        movementType:   movType,
        movementNote:   row.movementNote,
        movementModule: 'sesion' as const,
        loggedBy:       session.displayName,
      });
    });

    // 3. Eliminar cargas de jugadores desmarcados
    existingRecords
      .filter(r => !selectedRows.find(row => row.player.id === r.playerId))
      .forEach(r => deleteExternalLoad(r.id));
    existingInternalRecords
      .filter(r => !selectedRows.find(row => row.player.id === r.playerId))
      .forEach(r => deleteInternalLoad(r.id));

    setEditingSessionId(sessionId);
    setIsSaving(false);
    flash(summaryRecord ? 'Sesión actualizada correctamente.' : 'Sesión guardada correctamente.', 'success');
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteSession = async (sessionId: string) => {
    const target = data.trainingSessionSummaries.find(i => i.id === sessionId);
    if (!target) return;
    const ok = await showConfirm({
      title: `¿Eliminar sesión ${target.sessionNumber || '-'} del ${target.date}?`,
      description: 'Se eliminará la participación y carga de todos los jugadores asociados.',
      danger: true,
    });
    if (!ok) return;
    deleteTrainingSessionSummary(sessionId);
    if (editingSessionId === sessionId) setEditingSessionId(null);
    flash('Sesión eliminada.', 'info');
  };

  // ── Edit existing session ─────────────────────────────────────────────────
  const editSession = (sessionId: string) => {
    const t = data.trainingSessionSummaries.find(i => i.id === sessionId);
    if (!t) return;
    setFilters({ date: t.date, microcycleId: t.microcycleId, sessionNumber: t.sessionNumber, category: t.category ?? activeCategory });
    setSessionType(t.sessionType ?? 'cdEf');
    setSessionObjective(t.objective ?? '');
    setSessionObservation(t.observation ?? '');
    setEditingSessionId(t.id);
    setSessionNumberInput(String(t.sessionNumber || 1));
    flash(`Editando sesión ${t.sessionNumber || '-'} · ${categoryLabel(t.category ?? activeCategory)} · ${t.date}`, 'info');
  };

  // ── CSV import ────────────────────────────────────────────────────────────
  const handleCsvImport = (records: Omit<DailyExternalLoadRecord, 'id'>[]) => {
    records.forEach(record => addExternalLoad({ ...record, id: crypto.randomUUID() }));
    justImportedRef.current = true;
    setRowStates(prev => {
      const next = { ...prev };
      records.forEach(record => {
        next[record.playerId] = {
          selected: true,
          participation: (record.participation as SessionParticipation) ?? 'Completa',
          min: record.min ?? 0,
          rpe: prev[record.playerId]?.rpe ?? 0,
          acc: record.acc ?? 0, dcc: record.dcc ?? 0,
          sprints: record.sprints ?? 0, rhie: record.rhie ?? 0, ima: record.ima ?? 0,
          totalDistance: record.totalDistance ?? 0,
          maxVelocity: record.maxVelocity ?? 0,
          playerLoad: record.playerLoad ?? 0,
          highSpeedDistance: record.highSpeedDistance ?? record.hsr ?? 0,
          sprintDistance: record.sprintDistance ?? 0,
          movementType: prev[record.playerId]?.movementType ?? 'base',
          movementNote: prev[record.playerId]?.movementNote ?? '',
        };
      });
      return next;
    });
    setShowCsvImporter(false);
    flash(`${records.length} jugadores importados. Ingresa el RPE de cada uno y guarda la sesión.`, 'info');
  };

  const updateStatus = (status: 'Borrador' | 'En revisión' | 'Cerrada' | 'Reabierta') => {
    if (!summaryRecord) return;
    upsertTrainingSessionSummary({ ...summaryRecord, status });
    flash(status === 'Cerrada' ? 'Sesión cerrada.' : 'Sesión reabierta.', 'info');
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="grid no-print">
        <AppHero
          title="Ficha técnica de entrenamiento"
          subtitle={`${categoryLabel(activeCategory)}${gpsEnabled ? ' · GPS Catapult U20' : ' · Carga interna'}`}
        />

        {/* ── Alertas operativas ── */}
        <div className="grid grid-2">
          <DataQualityPanel percent={ops.dataQualityPercent} items={ops.dataQualityItems} />
          <OperationalAlertPanel title="Alertas de sesión" alerts={ops.alerts} />
        </div>

        {/* ── Mensaje banner ── */}
        {msg && <MsgBanner msg={msg} onClose={() => setMsg(null)} />}

        {/* ══ CARD: Configuración de sesión ══════════════════════════════════ */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <div className="section-eyebrow">Sesión</div>
              <h3 style={{ margin: '4px 0 0' }}>Configuración de sesión</h3>
              <div className="muted-line" style={{ marginTop: 6 }}>{microcycleNotice}</div>
              {summaryRecord && (
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: '#1d4ed8' }}>
                  Editando sesión {summaryRecord.sessionNumber} · {summaryRecord.date} · Estado: {summaryRecord.status ?? 'Borrador'}
                </div>
              )}
            </div>
            <div className="btn-row" style={{ flexWrap: 'wrap' }}>
              {gpsEnabled && (
                <button type="button" className="btn secondary" onClick={() => setShowCsvImporter(true)}>
                  <Upload size={14} /> Importar CSV GPS
                </button>
              )}
              {summaryRecord && (
                <button type="button" className="btn secondary" onClick={() => updateStatus(summaryRecord.status === 'Cerrada' ? 'Reabierta' : 'Cerrada')}>
                  {summaryRecord.status === 'Cerrada' ? 'Reabrir' : 'Cerrar sesión'}
                </button>
              )}
              {summaryRecord && (
                <button type="button" className="btn danger" onClick={() => deleteSession(summaryRecord.id)}>
                  Eliminar
                </button>
              )}
              {summaryRecord && (
                <button type="button" className="btn secondary" onClick={() => {
                  setEditingSessionId(null);
                  flash('Edición cancelada.', 'info');
                }}>
                  Cancelar edición
                </button>
              )}
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-4">
            <div className="field">
              <label>Fecha</label>
              <input className="input" type="date" value={filters.date}
                onChange={e => setFilters({ date: e.target.value })} />
            </div>
            <div className="field">
              <label>Tipo de sesión</label>
              <select className="select" value={sessionType}
                onChange={e => setSessionType(e.target.value as TrainingSessionType)}>
                {SESSION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>N° de sesión</label>
              <input className="input" type="number" min="1"
                placeholder="Auto" value={sessionNumberInput}
                readOnly={!!summaryRecord}
                onChange={e => {
                  if (summaryRecord) return;
                  setSessionNumberInput(e.target.value);
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n > 0) setFilters({ sessionNumber: n });
                }} />
              <div className="field-help">{summaryRecord ? 'Asignado a sesión guardada' : 'Siguiente disponible sugerido'}</div>
            </div>
            <div className="field">
              <label>Categoría</label>
              <input className="input" value={categoryLabel(activeCategory)} readOnly />
            </div>
          </div>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Objetivo de sesión</label>
              <input className="input" value={sessionObjective} placeholder="Objetivo principal del entrenamiento"
                onChange={e => setSessionObjective(e.target.value)} />
            </div>
            <div className="field">
              <label>Observación general</label>
              <input className="input" value={sessionObservation} placeholder="Resumen del trabajo realizado"
                onChange={e => setSessionObservation(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ══ KPIs rápidos ════════════════════════════════════════════════════ */}
        <div className="grid grid-4">
          <KpiCard label="Jugadores incluidos" value={String(selectedRows.length)} tone="green" trend="Seleccionados en planilla" />
          <KpiCard label="MIN promedio" value={groupAverage(selectedRows.map(r => r.min)).toFixed(0)} tone="dark" trend="Volumen medio" />
          <KpiCard label="RPE promedio" value={groupAverage(selectedRows.map(r => r.rpe)).toFixed(1)} tone="amber" trend="Esfuerzo percibido" />
          <KpiCard label="Invitados" value={String(selectedRows.filter(() => sourceCategory !== activeCategory).length)} tone="blue" trend="Movimientos de categoría" />
        </div>

        {/* ══ PLANILLA ════════════════════════════════════════════════════════ */}
        <div className="card">
          {/* Header planilla */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <div className="section-eyebrow">Planilla</div>
              <h3 style={{ margin: '4px 0 0' }}>Participación y carga individual</h3>
              <div className="muted-line" style={{ marginTop: 6 }}>
                {categoryLabel(activeCategory)} · {filters.date || 'Sin fecha'} · {detectedMicrocycle?.name ?? 'Sin microciclo'} · Sesión {sessionNumberInput || '—'}
              </div>
            </div>
            <div className="btn-row" style={{ flexWrap: 'wrap' }}>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: 10 }}>Categoría del jugador</label>
                <select className="select" value={sourceCategory}
                  onChange={e => setSourceCategory(e.target.value as ClubCategory)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </select>
              </div>
              <button type="button" className="btn secondary"
                onClick={() => downloadCsv(`sesion-${activeCategory}.csv`, selectedRows.map(r => ({
                  fecha: filters.date, jugador: r.player.name,
                  categoria: categoryLabel(activeCategory),
                  minutos: r.min, rpe: r.rpe,
                })))}>
                Exportar CSV
              </button>
              <button type="button" className="btn" disabled={isSaving} onClick={saveSession}
                style={{ minWidth: 140 }}>
                {isSaving ? 'Guardando…' : summaryRecord ? 'Actualizar sesión' : 'Guardar sesión'}
              </button>
            </div>
          </div>

          {/* Grid de tarjetas de jugadores */}
          <div className="session-player-grid mobile-clean-grid">
            {rows.map(row => {
              const invited = sourceCategory !== activeCategory;
              const hasGps  = row.playerLoad > 0 || row.totalDistance > 0;
              const needsRpe = row.selected && row.min > 0 && row.rpe === 0;
              const cardState = !row.selected ? 'state-empty'
                : (row.min > 0 && row.rpe > 0) ? 'state-complete'
                : 'state-partial';
              return (
                <div key={row.player.id} className={`session-player-card ${cardState}`}>
                  {/* Player header */}
                  <div className="session-player-header">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 13 }}>{row.player.name}</strong>
                        {row.player.jerseyNumber
                          ? <span className="jersey-badge">#{row.player.jerseyNumber}</span>
                          : null}
                      </div>
                      <div className="muted-line">{row.player.position} · {categoryLabel(row.player.category)}</div>
                      {invited && <div style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8' }}>Invitado en {categoryLabel(activeCategory)}</div>}
                      {hasGps  && <div style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>📡 GPS cargado · ingresa RPE</div>}
                      {needsRpe && <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626' }}>⚠ RPE requerido</div>}
                    </div>
                    <div className="btn-row" style={{ alignItems: 'flex-start', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                        <input type="checkbox" checked={row.selected}
                          onChange={e => updateRow(row.player.id, { selected: e.target.checked })} />
                        Incluir
                      </label>
                      <ToneBadge text={row.player.status}
                        tone={row.player.status === 'Disponible' ? 'green'
                          : row.player.status === 'Molestia' ? 'yellow'
                          : row.player.status === 'Readaptación' ? 'orange'
                          : 'red'} />
                    </div>
                  </div>

                  {/* Fields grid */}
                  <div className={`grid session-fields-grid ${youthSimple ? 'session-simple-grid' : 'session-metrics-grid'}`}>
                    <div className="field">
                      <label>Participación</label>
                      <select className="select session-input-large" value={row.participation}
                        onChange={e => updateRow(row.player.id, { participation: e.target.value as SessionParticipation })}>
                        {PARTICIPATION_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Minutos</label>
                      <input className="input session-input-large" type="number" value={num(row.min)}
                        onChange={e => updateRow(row.player.id, { min: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="field">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        RPE
                        {needsRpe && <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 800 }}>requerido</span>}
                      </label>
                      <input className="input session-input-large" type="number" min={0} max={10}
                        value={num(row.rpe)}
                        style={needsRpe ? { borderColor: '#fca5a5', background: '#fff5f5' } : {}}
                        onChange={e => updateRow(row.player.id, { rpe: Math.min(10, Math.max(0, Number(e.target.value) || 0)) })} />
                    </div>
                    {invited && <>
                      <div className="field">
                        <label>Movimiento</label>
                        <select className="select session-input-large" value={row.movementType}
                          onChange={e => updateRow(row.player.id, { movementType: e.target.value as MovementType })}>
                          {MOVEMENT_OPTIONS.filter(m => m.value !== 'base').map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label>Nota</label>
                        <input className="input session-input-large" value={row.movementNote}
                          onChange={e => updateRow(row.player.id, { movementNote: e.target.value })} />
                      </div>
                    </>}
                    {!youthSimple && row.player.position !== 'Portero' && <>
                      <div className="field"><label>ACC</label><input className="input session-input-large" type="number" value={num(row.acc)} onChange={e => updateRow(row.player.id, { acc: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>DCC</label><input className="input session-input-large" type="number" value={num(row.dcc)} onChange={e => updateRow(row.player.id, { dcc: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>Sprints</label><input className="input session-input-large" type="number" value={num(row.sprints)} onChange={e => updateRow(row.player.id, { sprints: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>RHIE</label><input className="input session-input-large" type="number" value={num(row.rhie)} onChange={e => updateRow(row.player.id, { rhie: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>IMA</label><input className="input session-input-large" type="number" value={num(row.ima)} onChange={e => updateRow(row.player.id, { ima: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>Distancia (m)</label><input className="input session-input-large" type="number" value={num(row.totalDistance)} onChange={e => updateRow(row.player.id, { totalDistance: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>Vel. máx (km/h)</label><input className="input session-input-large" type="number" step="0.1" value={num(row.maxVelocity)} onChange={e => updateRow(row.player.id, { maxVelocity: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>Player Load</label><input className="input session-input-large" type="number" value={num(row.playerLoad)} onChange={e => updateRow(row.player.id, { playerLoad: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>HSR (m)</label><input className="input session-input-large" type="number" value={num(row.highSpeedDistance)} onChange={e => updateRow(row.player.id, { highSpeedDistance: Number(e.target.value) || 0 })} /></div>
                      <div className="field"><label>Sprint dist (m)</label><input className="input session-input-large" type="number" value={num(row.sprintDistance)} onChange={e => updateRow(row.player.id, { sprintDistance: Number(e.target.value) || 0 })} /></div>
                    </>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botón guardar al final de la planilla también */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
            <button type="button" className="btn" disabled={isSaving} onClick={saveSession}
              style={{ minWidth: 160, padding: '12px 24px', fontSize: 15 }}>
              {isSaving ? 'Guardando…' : summaryRecord ? '✓ Actualizar sesión' : '✓ Guardar sesión'}
            </button>
          </div>
        </div>

        {/* ══ INFORME PREVIEW ═════════════════════════════════════════════════ */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="section-eyebrow">Informe</div>
              <h3 style={{ margin: '4px 0 0' }}>Informe grupal de sesión</h3>
            </div>
            <div className="btn-row">
              <button type="button" className="btn secondary" onClick={() => setShowReport(v => !v)}>
                {showReport ? 'Ocultar vista previa' : 'Vista previa'}
              </button>
              <button type="button" className="btn" onClick={() => window.print()}>
                Exportar PDF
              </button>
            </div>
          </div>
          {showReport && (
            <div className="report-preview-shell" style={{ marginTop: 16 }}>
              <SessionReportTemplate
                date={filters.date} category={activeCategory}
                microcycle={detectedMicrocycle}
                sessionNumber={sessionNumberInput || filters.sessionNumber}
                sessionType={sessionType} objective={sessionObjective}
                observation={sessionObservation} rows={reportRows}
                absentPlayers={absentPlayers}
                dataQualityPercent={ops.dataQualityPercent}
                wellnessRecords={sessionWellness} compact
              />
            </div>
          )}
        </div>

        {/* ══ HISTORIAL ═══════════════════════════════════════════════════════ */}
        <div className="card table-wrap">
          <div style={{ marginBottom: 14 }}>
            <div className="section-eyebrow">Historial</div>
            <h3 style={{ margin: '4px 0 0' }}>Sesiones guardadas</h3>
            <div className="muted-line" style={{ marginTop: 6 }}>Haz clic en "Editar" para cargar una sesión existente.</div>
          </div>
          {sessionHistory.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th><th>Categoría</th><th>Microciclo</th>
                  <th>N°</th><th>Tipo</th><th>Objetivo</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sessionHistory.map(item => {
                  const mc = data.microcycles.find(m => m.id === item.microcycleId);
                  const isEditing = editingSessionId === item.id;
                  return (
                    <tr key={item.id} style={isEditing ? { background: '#eff6ff' } : {}}>
                      <td>{item.date}</td>
                      <td>{categoryLabel(item.category ?? activeCategory)}</td>
                      <td>{mc?.name ?? '—'}</td>
                      <td>{item.sessionNumber}</td>
                      <td>{item.sessionType}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.objective || '—'}</td>
                      <td><span style={{ padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: item.status === 'Cerrada' ? '#fee2e2' : '#dcfce7', color: item.status === 'Cerrada' ? '#991b1b' : '#065f46' }}>{item.status ?? 'Borrador'}</span></td>
                      <td>
                        <div className="btn-row">
                          <button type="button" className="btn secondary" onClick={() => editSession(item.id)}>
                            {isEditing ? 'Editando…' : 'Editar'}
                          </button>
                          <button type="button" className="btn danger" onClick={() => deleteSession(item.id)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState title="Sin sesiones guardadas" text="Las sesiones que guardes aparecerán aquí." />
          )}
        </div>
      </div>

      {/* PDF — solo al imprimir */}
      <SessionReportTemplate
        date={filters.date} category={activeCategory}
        microcycle={detectedMicrocycle}
        sessionNumber={sessionNumberInput || filters.sessionNumber}
        sessionType={sessionType} objective={sessionObjective}
        observation={sessionObservation} rows={reportRows}
        absentPlayers={absentPlayers}
        dataQualityPercent={ops.dataQualityPercent}
        wellnessRecords={sessionWellness}
        className="print-only"
      />

      {ConfirmModal}

      {showCsvImporter && (
        <CsvImporter
          players={ops.players}
          sessionId={summaryRecord?.id ?? crypto.randomUUID()}
          date={filters.date}
          microcycleId={activeMicrocycleId}
          sessionNumber={Number(sessionNumberInput) || filters.sessionNumber}
          category={activeCategory}
          onImport={handleCsvImport}
          onClose={() => setShowCsvImporter(false)}
        />
      )}
    </>
  );
}
