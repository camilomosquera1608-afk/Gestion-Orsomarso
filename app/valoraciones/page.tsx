'use client';

import { useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { KpiCard } from '@/components/kpi-card';
import { EvaluationsReportTemplate } from '@/components/evaluations-report';
import { ToneBadge } from '@/components/status-badge';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { ClubCategory } from '@/lib/types';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { buildEvaluationsReportData } from '@/lib/evaluations-report';
import { buildAvailabilityIndex, buildEvaluationLogic, buildPlayerReadinessSemaphores, buildSelfComparisonInsights } from '@/lib/logic-insights';
import { Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  FAT_PERCENTAGE_RANGES,
  MUSCLE_MASS_RANGES,
  NUTRITION_PLANS,
  SKINFOLD_RANGES,
  formatNutritionText,
  formatNutritionValue,
  getNutritionPlanLabel,
  getNutritionRangeLabel,
  getNutritionRangeTone,
  getNutritionStatus,
  getNutritionTechnicalReading,
  isValidNutritionNumber,
  normalizeFatPercentageRange,
  normalizeMuscleMassRange,
  normalizeNutritionPlan,
  normalizeNutritionRecord,
  normalizeSkinfoldRange,
  safeNutritionNumber,
} from '@/lib/nutrition';

const tabs = ['Nutrición', 'Perfil neuromuscular', 'CMJ', 'FMS'] as const;

type TabName = (typeof tabs)[number];
type NutritionBadgeTone = 'green' | 'yellow' | 'red' | 'neutral';

const compareTone = (delta: number, reverse = false): 'green' | 'yellow' | 'red' => {
  if (delta === 0) return 'yellow';
  const improved = reverse ? delta < 0 : delta > 0;
  return improved ? 'green' : 'red';
};

const nutritionToneClass = (tone: NutritionBadgeTone) => tone === 'yellow' ? 'tone-yellow' : tone === 'neutral' ? 'ui-tone-neutral' : `tone-${tone}`;

function NutritionBadge({ label, tone = 'neutral' }: { label: string; tone?: NutritionBadgeTone }) {
  return <span className={`nutrition-badge ${nutritionToneClass(tone)}`}>{label}</span>;
}

export default function ValoracionesPage() {
  const {
    data,
    filters,
    setFilters,
    addNutritionRecord,
    updateNutritionRecord,
    deleteNutritionRecord,
    addNeuromuscularRecord,
    updateNeuromuscularRecord,
    deleteNeuromuscularRecord,
    addCMJRecord,
    updateCMJRecord,
    deleteCMJRecord,
    addFMSRecord,
    updateFMSRecord,
    deleteFMSRecord,
    canEdit,
    syncStatus,
    permissionMessage,
  } = useApp();

  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = (master ? (filters.category === 'all' ? 'Sub20' : filters.category) : session.category) as ClubCategory;

  const [activeTab, setActiveTab] = useState<TabName>('Nutrición');
  const [message, setMessage] = useState('');
  const [nutritionError, setNutritionError] = useState('');
  const [editingNutritionId, setEditingNutritionId] = useState('');
  const [editingNeuroId, setEditingNeuroId] = useState('');
  const [editingCmjId, setEditingCmjId] = useState('');
  const [editingFmsId, setEditingFmsId] = useState('');
  const [showGroupReport, setShowGroupReport] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);

  const categoryPlayers = data.players.filter((player) => player.category === activeCategory);
  const selectedPlayerId = filters.playerId === 'all' || !categoryPlayers.some((player) => player.id === filters.playerId) ? categoryPlayers[0]?.id ?? '' : filters.playerId;
  const selectedPlayer = data.players.find((player) => player.id === selectedPlayerId) ?? categoryPlayers[0];
  if (!selectedPlayer) return <div className="empty">No hay jugadores disponibles en esta categoría.</div>;

  const nutritionHistory = useMemo(() => data.nutritionRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => b.date.localeCompare(a.date)), [data.nutritionRecords, selectedPlayerId]);
  const neuromuscularHistory = useMemo(() => data.neuromuscularRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => b.date.localeCompare(a.date)), [data.neuromuscularRecords, selectedPlayerId]);
  const cmjHistory = useMemo(() => data.cmjRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => b.date.localeCompare(a.date)), [data.cmjRecords, selectedPlayerId]);
  const fmsHistory = useMemo(() => data.fmsRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => b.date.localeCompare(a.date)).map((record) => ({ ...record, total: record.shoulderMobility + record.squat + record.legRaise + record.hurdleStep + record.lunge + record.trunkStability + record.rotaryStability })), [data.fmsRecords, selectedPlayerId]);


  const latestByPlayer = <T extends { playerId: string; date: string }>(items: T[]) => Object.values(items.reduce<Record<string, T>>((acc, item) => {
    const current = acc[item.playerId];
    if (!current || item.date > current.date) acc[item.playerId] = item;
    return acc;
  }, {}));
  const categoryPlayerIds = new Set(categoryPlayers.map((player) => player.id));
  const latestNutritionGroup = latestByPlayer(data.nutritionRecords.filter((record) => categoryPlayerIds.has(record.playerId)));
  const latestNeuromuscularGroup = latestByPlayer(data.neuromuscularRecords.filter((record) => categoryPlayerIds.has(record.playerId)));
  const latestCmjGroup = latestByPlayer(data.cmjRecords.filter((record) => categoryPlayerIds.has(record.playerId)));
  const latestFmsGroup = latestByPlayer(data.fmsRecords.filter((record) => categoryPlayerIds.has(record.playerId)).map((record) => ({ ...record, total: record.shoulderMobility + record.squat + record.legRaise + record.hurdleStep + record.lunge + record.trunkStability + record.rotaryStability })));
  const cmjGroupAverage = latestCmjGroup.length ? latestCmjGroup.reduce((acc, row) => acc + row.value, 0) / latestCmjGroup.length : 0;
  const neuroGroupAverage = latestNeuromuscularGroup.length ? latestNeuromuscularGroup.reduce((acc, row) => acc + row.cmj, 0) / latestNeuromuscularGroup.length : 0;
  const fmsGroupAverage = latestFmsGroup.length ? latestFmsGroup.reduce((acc, row) => acc + row.total, 0) / latestFmsGroup.length : 0;
  const standoutCmj = latestCmjGroup.slice().sort((a, b) => b.value - a.value).slice(0, 3).map((row) => `${data.players.find((player) => player.id === row.playerId)?.name ?? 'Jugador'} (${row.value})`);
  const belowAverageCmj = latestCmjGroup.filter((row) => row.value < cmjGroupAverage).map((row) => data.players.find((player) => player.id === row.playerId)?.name ?? 'Jugador').slice(0, 5);

  const latestNutrition = nutritionHistory[0] ? normalizeNutritionRecord(nutritionHistory[0]) : undefined;
  const previousNutrition = nutritionHistory[1] ? normalizeNutritionRecord(nutritionHistory[1]) : undefined;
  const latestNeuro = neuromuscularHistory[0];
  const previousNeuro = neuromuscularHistory[1];
  const latestCmj = cmjHistory[0];
  const previousCmj = cmjHistory[1];
  const latestFms = fmsHistory[0];
  const previousFms = fmsHistory[1];

  const editingNutritionSource = nutritionHistory.find((item) => item.id === editingNutritionId);
  const editingNutrition = editingNutritionSource ? normalizeNutritionRecord(editingNutritionSource) : undefined;
  const editingNeuro = neuromuscularHistory.find((item) => item.id === editingNeuroId);
  const editingCmj = cmjHistory.find((item) => item.id === editingCmjId);
  const editingFms = fmsHistory.find((item) => item.id === editingFmsId);

  const clearEditors = () => {
    setEditingNutritionId('');
    setEditingNeuroId('');
    setEditingCmjId('');
    setEditingFmsId('');
  };

  const submitNutrition = (formData: FormData) => {
    if (!canEdit) {
      setNutritionError('Solo lectura.');
      return;
    }

    const date = String(formData.get('date') ?? '');
    const skinfoldRange = normalizeSkinfoldRange(formData.get('skinfoldRange'));
    const muscleMassRange = normalizeMuscleMassRange(formData.get('muscleMassRange'));
    const fatPercentageRange = normalizeFatPercentageRange(formData.get('fatPercentageRange'));
    const plan = normalizeNutritionPlan(formData.get('plan'));

    const validations = [
      isValidNutritionNumber(formData.get('weight'), { min: 0.01 }),
      isValidNutritionNumber(formData.get('height'), { min: 0.01 }),
      isValidNutritionNumber(formData.get('bodyFat'), { min: 0, max: 100 }),
      isValidNutritionNumber(formData.get('skinfoldSum'), { min: 0.01 }),
      isValidNutritionNumber(formData.get('muscleMassPercentage'), { min: 0, max: 100 }),
      isValidNutritionNumber(formData.get('imo'), { required: false, min: 0 }),
    ];

    if (!date || validations.some((valid) => !valid)) {
      setNutritionError('Valor inválido.');
      setMessage('');
      return;
    }

    if (!skinfoldRange || !muscleMassRange) {
      setNutritionError('Selecciona un rango.');
      setMessage('');
      return;
    }

    const imo = String(formData.get('imo') ?? '').trim();
    const record = normalizeNutritionRecord({
      id: editingNutritionId || crypto.randomUUID(),
      playerId: selectedPlayerId,
      date,
      weight: safeNutritionNumber(formData.get('weight')),
      height: safeNutritionNumber(formData.get('height')),
      bodyFat: safeNutritionNumber(formData.get('bodyFat')),
      skinfoldSum: safeNutritionNumber(formData.get('skinfoldSum')),
      plan,
      weightRange: String(formData.get('weightRange') ?? '').trim(),
      skinfoldRange,
      fatPercentageRange,
      muscleMassPercentage: safeNutritionNumber(formData.get('muscleMassPercentage')),
      muscleMassRange,
      imo: imo ? safeNutritionNumber(imo) : undefined,
      diagnosis: String(formData.get('diagnosis') ?? '').trim(),
      category: activeCategory,
    });

    if (editingNutritionId) {
      updateNutritionRecord(record);
      setMessage('Nutrición actualizada.');
    } else {
      addNutritionRecord(record);
      setMessage('Nutrición guardada.');
    }
    setNutritionError('');
    setEditingNutritionId('');
  };

  const submitNeuromuscular = (formData: FormData) => {
    const neuroRecord = {
      id: editingNeuroId || crypto.randomUUID(),
      playerId: selectedPlayerId,
      date: String(formData.get('date')),
      cmj: Number.parseFloat(String(formData.get('cmj'))) || 0,
      sj: Number.parseFloat(String(formData.get('sj'))) || 0,
      reactiveJumps: Number.parseFloat(String(formData.get('reactiveJumps'))) || 0,
    };
    const cmjRecord = {
      id: editingCmjId || crypto.randomUUID(),
      playerId: selectedPlayerId,
      date: neuroRecord.date,
      value: neuroRecord.cmj,
    };

    if (editingNeuroId) {
      updateNeuromuscularRecord(neuroRecord);
      if (editingCmjId) updateCMJRecord(cmjRecord);
      setMessage('Perfil neuromuscular actualizado.');
    } else {
      addNeuromuscularRecord(neuroRecord);
      addCMJRecord(cmjRecord);
      setMessage('Perfil neuromuscular guardado.');
    }
    setEditingNeuroId('');
    setEditingCmjId('');
  };

  const submitFMS = (formData: FormData) => {
    const record = {
      id: editingFmsId || crypto.randomUUID(),
      playerId: selectedPlayerId,
      date: String(formData.get('date')),
      shoulderMobility: Number(formData.get('shoulderMobility')),
      squat: Number(formData.get('squat')),
      legRaise: Number(formData.get('legRaise')),
      hurdleStep: Number(formData.get('hurdleStep')),
      lunge: Number(formData.get('lunge')),
      trunkStability: Number(formData.get('trunkStability')),
      rotaryStability: Number(formData.get('rotaryStability')),
    };
    if (editingFmsId) {
      updateFMSRecord(record);
      setMessage('Valoración FMS actualizada.');
    } else {
      addFMSRecord(record);
      setMessage('Valoración FMS guardada.');
    }
    setEditingFmsId('');
  };

  const improvementNotes = activeTab === 'Nutrición' && latestNutrition && previousNutrition ? [
    `Peso ${(latestNutrition.weight - previousNutrition.weight).toFixed(1)} kg`,
    `% grasa ${(latestNutrition.bodyFat - previousNutrition.bodyFat).toFixed(1)}`,
    `Σ pliegues ${(latestNutrition.skinfoldSum - previousNutrition.skinfoldSum).toFixed(1)}`,
  ] : activeTab === 'Perfil neuromuscular' && latestNeuro && previousNeuro ? [
    `CMJ ${(latestNeuro.cmj - previousNeuro.cmj).toFixed(1)} cm`,
    `SJ ${(latestNeuro.sj - previousNeuro.sj).toFixed(1)} cm`,
    `Reactivos ${(latestNeuro.reactiveJumps - previousNeuro.reactiveJumps).toFixed(1)}`,
  ] : activeTab === 'CMJ' && latestCmj && previousCmj ? [
    `CMJ ${(latestCmj.value - previousCmj.value).toFixed(1)} cm`,
  ] : activeTab === 'FMS' && latestFms && previousFms ? [
    `Total FMS ${(latestFms.total - previousFms.total).toFixed(0)} puntos`,
    'Revisar pruebas con puntaje 1.',
  ] : ['Sin histórico suficiente para comparación.'];

  const evaluationLogic = useMemo(
    () => buildEvaluationLogic({ data, players: data.players, category: activeCategory, limit: 8 }),
    [data, activeCategory],
  );
  const valuationReadiness = useMemo(
    () => buildPlayerReadinessSemaphores({ players: data.players, wellness: data.wellness, internalLoads: data.internalLoads, externalLoads: data.externalLoads, referenceDate: filters.date, category: activeCategory, limit: 5 }),
    [data.players, data.wellness, data.internalLoads, data.externalLoads, filters.date, activeCategory],
  );
  const valuationAvailabilityIndex = useMemo(
    () => buildAvailabilityIndex({ players: data.players, wellness: data.wellness, internalLoads: data.internalLoads, externalLoads: data.externalLoads, referenceDate: filters.date, category: activeCategory }),
    [data.players, data.wellness, data.internalLoads, data.externalLoads, filters.date, activeCategory],
  );
  const valuationSelfComparison = useMemo(
    () => buildSelfComparisonInsights({ players: data.players, internalLoads: data.internalLoads, externalLoads: data.externalLoads, referenceDate: filters.date, category: activeCategory, limit: 4 }),
    [data.players, data.internalLoads, data.externalLoads, filters.date, activeCategory],
  );
  const evaluationReport = buildEvaluationsReportData({ data, player: selectedPlayer, activeCategory, referenceDate: filters.date });
  const nutritionChartData = [...nutritionHistory].reverse().map((row) => {
    const normalized = normalizeNutritionRecord(row);
    return {
      fecha: normalized.date.slice(5),
      peso: normalized.weight,
      grasa: normalized.bodyFat,
      pliegues: normalized.skinfoldSum,
      masaMuscular: normalized.muscleMassPercentage ?? null,
    };
  });
  const nutritionSaveState = !canEdit ? 'Solo lectura' : syncStatus === 'syncing' ? 'Guardando' : syncStatus === 'error' ? 'Error' : message ? 'Guardado' : permissionMessage || 'Pendiente';
  const nutritionReading = getNutritionTechnicalReading(latestNutrition);

  return (
    <div className="grid evaluations-page-root">
      <div className="evaluations-operational no-print">
      <AppHero heroClass="hero-valoraciones" title="Valoraciones físicas" subtitle="Control antropométrico, neuromuscular y funcional." />
      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'end' }}>
          <div className="field" style={{ maxWidth: 360 }}>
            <label>Jugador seleccionado</label>
            <select className="select" value={selectedPlayerId} onChange={(e) => setFilters({ playerId: e.target.value })}>
              {categoryPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </div>
          <button className="btn secondary" onClick={clearEditors}>Limpiar edición</button>
        </div>
        {selectedPlayer ? <div style={{ marginTop: 14, fontWeight: 700 }}>{selectedPlayer.name}</div> : null}
      </div>
      {message ? <div className="card"><strong>{message}</strong></div> : null}

      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span className="section-eyebrow">Lógica de valoraciones</span>
            <h3 style={{ margin: 0 }}>Interpretación automática del grupo</h3>
            <div className="muted-line" style={{ marginTop: 6 }}>Detecta mejoras, retrocesos, disponibilidad y alertas funcionales para seguimiento preventivo.</div>
          </div>
        </div>
        <div className={`alert-item tone-${valuationAvailabilityIndex.tone === 'red' ? 'red' : valuationAvailabilityIndex.tone === 'yellow' ? 'yellow' : 'green'}`} style={{ marginTop: 14 }}>
          <strong>{valuationAvailabilityIndex.title}</strong> · {valuationAvailabilityIndex.value}<br />{valuationAvailabilityIndex.description}
        </div>
        <div className="grid grid-2" style={{ gap: 10, marginTop: 14 }}>
          {[...evaluationLogic, ...valuationSelfComparison].length ? [...evaluationLogic, ...valuationSelfComparison].slice(0, 8).map((insight) => (
            <div key={insight.id} className={`alert-item tone-${insight.tone === 'red' ? 'red' : insight.tone === 'yellow' ? 'yellow' : 'green'}`}>
              <strong>{insight.title}</strong> {insight.value ? `· ${insight.value}` : ''}<br />{insight.description}
            </div>
          )) : <div className="empty">Sin cambios relevantes detectados. Carga al menos dos mediciones por jugador para activar comparaciones.</div>}
        </div>
        <div className="grid" style={{ gap: 8, marginTop: 14 }}>
          {valuationReadiness.filter((row) => row.tone !== 'green').slice(0, 4).map((row) => (
            <div key={row.playerId} className={`alert-item tone-${row.tone === 'red' ? 'red' : 'yellow'}`}>
              <strong>{row.name}: {row.label}</strong> · {Math.round(row.score)}%<br />{row.detail}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Informe grupal de valoraciones</h3>
            <div className="summary-chip" style={{ marginTop: 8 }}>{categoryLabel(activeCategory)} · {filters.date}</div>
          </div>
          <div className="btn-row">
            <button type="button" className="btn secondary" onClick={() => setShowGroupReport((value) => !value)}>{showGroupReport ? 'Ocultar informe grupal' : 'Ver informe grupal'}</button>
            <button type="button" className="btn secondary" onClick={() => setShowReportPreview((value) => !value)}>{showReportPreview ? 'Ocultar vista previa PDF' : 'Vista previa PDF'}</button>
            <button type="button" className="btn" onClick={() => window.print()}>Exportar PDF</button>
          </div>
        </div>
        {showGroupReport ? (
          <div className="grid" style={{ gap: 16, marginTop: 16 }}>
            <div className="grid grid-4">
              <KpiCard label="Jugadores evaluados" value={String(categoryPlayers.length)} />
              <KpiCard label="CMJ promedio" value={cmjGroupAverage.toFixed(1)} />
              <KpiCard label="Neuromuscular promedio" value={neuroGroupAverage.toFixed(1)} />
              <KpiCard label="FMS promedio" value={fmsGroupAverage.toFixed(1)} />
            </div>
            <div className="grid grid-2">
              <div className="card compact-card">
                <strong>Resumen nutricional del grupo</strong>
                <div className="muted-line" style={{ marginTop: 8 }}>Peso promedio: {(latestNutritionGroup.reduce((acc, row) => acc + row.weight, 0) / (latestNutritionGroup.length || 1)).toFixed(1)} kg</div>
                <div className="muted-line">% grasa promedio: {(latestNutritionGroup.reduce((acc, row) => acc + row.bodyFat, 0) / (latestNutritionGroup.length || 1)).toFixed(1)}</div>
              </div>
              <div className="card compact-card">
                <strong>Lectura general</strong>
                <div className="muted-line" style={{ marginTop: 8 }}>Jugadores destacados: {standoutCmj.join(', ') || 'Sin destacados'}</div>
                <div className="muted-line">Jugadores por debajo del promedio: {belowAverageCmj.join(', ') || 'Sin alertas'}</div>
              </div>
            </div>
          </div>
        ) : null}
        {showReportPreview ? (
          <div style={{ marginTop: 16 }}>
            <EvaluationsReportTemplate report={evaluationReport} compact />
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map((tab) => <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}
        </div>

        <div className="grid grid-3" style={{ marginBottom: 18 }}>
          <div className="card compact-card">
            <h3 style={{ marginBottom: 10 }}>Actual vs anterior</h3>
            {activeTab === 'Nutrición' && latestNutrition ? <>
              <div className="muted-line">Peso {latestNutrition.weight} kg</div>
              {previousNutrition ? <ToneBadge text={`Δ ${(latestNutrition.weight - previousNutrition.weight).toFixed(1)} kg`} tone={compareTone(latestNutrition.weight - previousNutrition.weight)} /> : null}
              <div className="muted-line" style={{ marginTop: 10 }}>% grasa {latestNutrition.bodyFat}</div>
              {previousNutrition ? <ToneBadge text={`Δ ${(latestNutrition.bodyFat - previousNutrition.bodyFat).toFixed(1)} %`} tone={compareTone(latestNutrition.bodyFat - previousNutrition.bodyFat, true)} /> : null}
            </> : null}
            {activeTab === 'Perfil neuromuscular' && latestNeuro ? <>
              <div className="muted-line">CMJ {latestNeuro.cmj} · SJ {latestNeuro.sj}</div>
              {previousNeuro ? <ToneBadge text={`Δ CMJ ${(latestNeuro.cmj - previousNeuro.cmj).toFixed(1)}`} tone={compareTone(latestNeuro.cmj - previousNeuro.cmj)} /> : null}
            </> : null}
            {activeTab === 'CMJ' && latestCmj ? <>
              <div className="muted-line">CMJ actual {latestCmj.value} cm</div>
              {previousCmj ? <ToneBadge text={`Δ ${(latestCmj.value - previousCmj.value).toFixed(1)} cm`} tone={compareTone(latestCmj.value - previousCmj.value)} /> : null}
            </> : null}
            {activeTab === 'FMS' && latestFms ? <>
              <div className="muted-line">Total actual {latestFms.total}</div>
              {previousFms ? <ToneBadge text={`Δ ${(latestFms.total - previousFms.total).toFixed(0)} puntos`} tone={compareTone(latestFms.total - previousFms.total)} /> : null}
            </> : null}
          </div>
          <div className="card compact-card" style={{ gridColumn: 'span 2' }}>
            <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Punto de mejora sugerido</h3>
              {activeTab === 'Perfil neuromuscular' ? <button className="btn secondary" onClick={() => downloadCsv(`neuromuscular-${selectedPlayerId}.csv`, neuromuscularHistory.map((r) => ({ fecha: r.date, cmj: r.cmj, sj: r.sj, reactivos: r.reactiveJumps })))}>Exportar CSV</button> : null}
              {activeTab === 'CMJ' ? <button className="btn secondary" onClick={() => downloadCsv(`cmj-${selectedPlayerId}.csv`, cmjHistory.map((r) => ({ fecha: r.date, cmj: r.value })))}>Exportar CSV</button> : null}
              {activeTab === 'FMS' ? <button className="btn secondary" onClick={() => downloadCsv(`fms-${selectedPlayerId}.csv`, fmsHistory.map((r) => ({ fecha: r.date, movilidad_hombros: r.shoulderMobility, sentadilla: r.squat, elevacion_pierna: r.legRaise, paso_obstaculo: r.hurdleStep, zancada: r.lunge, estabilidad_tronco: r.trunkStability, estabilidad_rotacion: r.rotaryStability, total: r.total })))}>Exportar CSV</button> : null}
            </div>
            <div className="grid" style={{ gap: 10 }}>{improvementNotes.map((note) => <div key={note} className="alert-item tone-yellow">{note}</div>)}</div>
          </div>
        </div>

        {activeTab === 'Nutrición' && (
          <div className="nutrition-module">
            <section className="nutrition-header-card card">
              <div className="nutrition-header-main">
                <span className="section-eyebrow">Ficha nutricional</span>
                <h3>{selectedPlayer.name}</h3>
                <div className="nutrition-meta-row">
                  <span>{categoryLabel(selectedPlayer.category ?? activeCategory)}</span>
                  <span>{latestNutrition?.date ?? filters.date}</span>
                  <span>{getNutritionStatus(latestNutrition)}</span>
                  <span>{nutritionSaveState}</span>
                  <span>{session.displayName || session.email || 'Responsable no disponible'}</span>
                </div>
              </div>
              <div className="nutrition-header-actions">
                <button className="btn secondary" type="button" onClick={() => downloadCsv(
                  `nutricion-${selectedPlayerId}.csv`,
                  nutritionHistory.map((row) => {
                    const normalized = normalizeNutritionRecord(row);
                    return {
                      fecha: normalized.date,
                      peso: normalized.weight,
                      rango_peso: normalized.weightRange ?? '',
                      talla: normalized.height,
                      sumatoria_grasa: normalized.skinfoldSum,
                      rango_sumatoria_grasa: normalized.skinfoldRange ?? '',
                      porcentaje_grasa: normalized.bodyFat,
                      rango_porcentaje_grasa: normalized.fatPercentageRange ?? '',
                      porcentaje_masa_muscular: normalized.muscleMassPercentage ?? '',
                      rango_masa_muscular: normalized.muscleMassRange ?? '',
                      imo: normalized.imo ?? '',
                      plan: getNutritionPlanLabel(normalized.plan),
                      diagnostico: normalized.diagnosis ?? '',
                    };
                  }),
                )}>Exportar CSV</button>
              </div>
            </section>

            <section className="nutrition-kpi-grid">
              <div className="nutrition-kpi-card"><span>Peso actual</span><strong>{latestNutrition ? formatNutritionValue(latestNutrition.weight, ' kg') : 'Sin registro'}</strong><small>{formatNutritionText(latestNutrition?.weightRange)}</small></div>
              <div className="nutrition-kpi-card"><span>% grasa</span><strong>{latestNutrition ? formatNutritionValue(latestNutrition.bodyFat, '%') : 'Sin registro'}</strong><small>{getNutritionRangeLabel(latestNutrition?.fatPercentageRange)}</small></div>
              <div className="nutrition-kpi-card"><span>Sumatoria grasa</span><strong>{latestNutrition ? formatNutritionValue(latestNutrition.skinfoldSum, '') : 'Sin registro'}</strong><small>{getNutritionRangeLabel(latestNutrition?.skinfoldRange)}</small></div>
              <div className="nutrition-kpi-card"><span>% masa muscular</span><strong>{latestNutrition ? formatNutritionValue(latestNutrition.muscleMassPercentage, '%') : 'Sin registro'}</strong><small>{getNutritionRangeLabel(latestNutrition?.muscleMassRange)}</small></div>
              <div className="nutrition-kpi-card"><span>IMO</span><strong>{latestNutrition ? formatNutritionValue(latestNutrition.imo, '') : 'Sin registro'}</strong><small>Indicador</small></div>
              <div className="nutrition-kpi-card nutrition-kpi-plan"><span>Plan</span><strong>{latestNutrition ? getNutritionPlanLabel(latestNutrition.plan) : 'Sin registro'}</strong><small>{latestNutrition?.date ?? 'No disponible'}</small></div>
            </section>

            <div className="nutrition-layout">
              <form className="card nutrition-form-card" action={submitNutrition}>
                <div className="section-header compact-section-header">
                  <div>
                    <span className="section-eyebrow">Carga</span>
                    <h3>{editingNutrition ? 'Editar valoración' : 'Nueva valoración'}</h3>
                  </div>
                  <NutritionBadge label={nutritionSaveState} tone={syncStatus === 'error' ? 'red' : canEdit ? 'green' : 'neutral'} />
                </div>
                {nutritionError ? <div className="nutrition-error">{nutritionError}</div> : null}

                <div className="nutrition-form-section">
                  <div className="nutrition-section-title"><strong>Datos antropométricos</strong><span>Talla, peso e IMO.</span></div>
                  <div className="nutrition-field-grid">
                    <label className="field"><span>Fecha</span><input className="input" type="date" name="date" defaultValue={editingNutrition?.date ?? filters.date} key={`nutrition-date-${editingNutritionId || 'new'}`} disabled={!canEdit} required /></label>
                    <label className="field"><span>Talla</span><div className="input-unit"><input className="input" type="number" min="0" step="0.01" name="height" placeholder="Talla" defaultValue={editingNutrition?.height ?? selectedPlayer?.height} key={`nutrition-height-${editingNutritionId || 'new'}`} disabled={!canEdit} required /><em>cm</em></div></label>
                    <label className="field"><span>Peso</span><div className="input-unit"><input className="input" type="number" min="0" step="0.01" name="weight" placeholder="Peso" defaultValue={editingNutrition?.weight ?? selectedPlayer?.weight} key={`nutrition-weight-${editingNutritionId || 'new'}`} disabled={!canEdit} required /><em>kg</em></div></label>
                    <label className="field"><span>Rango de peso</span><input className="input" name="weightRange" placeholder="Ej. objetivo" defaultValue={editingNutrition?.weightRange ?? ''} key={`nutrition-weight-range-${editingNutritionId || 'new'}`} disabled={!canEdit} /></label>
                    <label className="field"><span>IMO</span><input className="input" type="number" min="0" step="0.01" name="imo" placeholder="IMO" defaultValue={editingNutrition?.imo ?? ''} key={`nutrition-imo-${editingNutritionId || 'new'}`} disabled={!canEdit} /></label>
                  </div>
                </div>

                <div className="nutrition-form-section">
                  <div className="nutrition-section-title"><strong>Composición corporal</strong><span>Grasa, pliegues y masa muscular.</span></div>
                  <div className="nutrition-field-grid">
                    <label className="field"><span>Sumatoria grasa</span><input className="input" type="number" min="0" step="0.01" name="skinfoldSum" placeholder="Sumatoria" defaultValue={editingNutrition?.skinfoldSum ?? ''} key={`nutrition-skin-${editingNutritionId || 'new'}`} disabled={!canEdit} required /></label>
                    <label className="field"><span>Rango sumatoria grasa</span><select className="select" name="skinfoldRange" defaultValue={editingNutrition?.skinfoldRange ?? ''} key={`nutrition-skin-range-${editingNutritionId || 'new'}`} disabled={!canEdit} required><option value="">Selecciona</option>{SKINFOLD_RANGES.map((range) => <option key={range} value={range}>{range}</option>)}</select></label>
                    <label className="field"><span>% grasa</span><div className="input-unit"><input className="input" type="number" min="0" max="100" step="0.01" name="bodyFat" placeholder="% grasa" defaultValue={editingNutrition?.bodyFat ?? ''} key={`nutrition-fat-${editingNutritionId || 'new'}`} disabled={!canEdit} required /><em>%</em></div></label>
                    <label className="field"><span>Rango % grasa</span><select className="select" name="fatPercentageRange" defaultValue={editingNutrition?.fatPercentageRange ?? ''} key={`nutrition-fat-range-${editingNutritionId || 'new'}`} disabled={!canEdit}><option value="">Sin rango</option>{FAT_PERCENTAGE_RANGES.map((range) => <option key={range} value={range}>{range}</option>)}</select></label>
                    <label className="field"><span>% masa muscular</span><div className="input-unit"><input className="input" type="number" min="0" max="100" step="0.01" name="muscleMassPercentage" placeholder="% masa" defaultValue={editingNutrition?.muscleMassPercentage ?? ''} key={`nutrition-muscle-${editingNutritionId || 'new'}`} disabled={!canEdit} required /><em>%</em></div></label>
                    <label className="field"><span>Rango % masa muscular</span><select className="select" name="muscleMassRange" defaultValue={editingNutrition?.muscleMassRange ?? ''} key={`nutrition-muscle-range-${editingNutritionId || 'new'}`} disabled={!canEdit} required><option value="">Selecciona</option>{MUSCLE_MASS_RANGES.map((range) => <option key={range} value={range}>{range}</option>)}</select></label>
                  </div>
                </div>

                <div className="nutrition-form-section">
                  <div className="nutrition-section-title"><strong>Diagnóstico y plan</strong><span>Lectura breve y plan actual.</span></div>
                  <div className="nutrition-field-grid diagnosis-grid">
                    <label className="field"><span>Plan nutricional</span><select className="select" name="plan" defaultValue={editingNutrition?.plan ?? 'Normocalorico'} key={`nutrition-plan-${editingNutritionId || 'new'}`} disabled={!canEdit} required>{NUTRITION_PLANS.map((plan) => <option key={plan} value={plan}>{getNutritionPlanLabel(plan)}</option>)}</select></label>
                    <label className="field nutrition-diagnosis-field"><span>Diagnóstico</span><textarea className="textarea" name="diagnosis" rows={3} placeholder="Lectura nutricional, objetivo y observaciones relevantes." defaultValue={editingNutrition?.diagnosis ?? ''} key={`nutrition-diagnosis-${editingNutritionId || 'new'}`} disabled={!canEdit} /></label>
                  </div>
                </div>

                {canEdit ? (
                  <div className="btn-row nutrition-actions">
                    <button className="btn" type="submit">{editingNutrition ? 'Actualizar' : 'Guardar'}</button>
                    {editingNutrition ? <button className="btn secondary" type="button" onClick={() => setEditingNutritionId('')}>Cancelar</button> : null}
                  </div>
                ) : <div className="nutrition-readonly">Modo lectura.</div>}
              </form>

              <aside className="card nutrition-summary-card">
                <div className="section-header compact-section-header">
                  <div>
                    <span className="section-eyebrow">Resumen</span>
                    <h3>Lectura rápida</h3>
                  </div>
                  <NutritionBadge label={latestNutrition ? getNutritionPlanLabel(latestNutrition.plan) : 'Sin plan'} tone="neutral" />
                </div>
                <div className="nutrition-summary-grid">
                  <div><span>Peso</span><strong>{latestNutrition ? formatNutritionValue(latestNutrition.weight, ' kg') : 'No disponible'}</strong><small>{formatNutritionText(latestNutrition?.weightRange)}</small></div>
                  <div><span>Sumatoria grasa</span><strong>{latestNutrition ? formatNutritionValue(latestNutrition.skinfoldSum) : 'No disponible'}</strong><NutritionBadge label={getNutritionRangeLabel(latestNutrition?.skinfoldRange)} tone={getNutritionRangeTone('skinfold', latestNutrition?.skinfoldRange)} /></div>
                  <div><span>% grasa</span><strong>{latestNutrition ? formatNutritionValue(latestNutrition.bodyFat, '%') : 'No disponible'}</strong><NutritionBadge label={getNutritionRangeLabel(latestNutrition?.fatPercentageRange)} tone={getNutritionRangeTone('fat', latestNutrition?.fatPercentageRange)} /></div>
                  <div><span>% masa muscular</span><strong>{latestNutrition ? formatNutritionValue(latestNutrition.muscleMassPercentage, '%') : 'No disponible'}</strong><NutritionBadge label={getNutritionRangeLabel(latestNutrition?.muscleMassRange)} tone={getNutritionRangeTone('muscle', latestNutrition?.muscleMassRange)} /></div>
                </div>
                <div className="nutrition-reading-box">
                  <span>Lectura profesional</span>
                  <p>{nutritionReading}</p>
                  {latestNutrition?.diagnosis ? <p><strong>Diagnóstico:</strong> {latestNutrition.diagnosis}</p> : <p>Diagnóstico: No disponible.</p>}
                </div>
              </aside>
            </div>

            <section className="card nutrition-chart-card">
              <div className="section-header compact-section-header">
                <div>
                  <span className="section-eyebrow">Evolución</span>
                  <h3>Histórico nutricional</h3>
                </div>
              </div>
              {nutritionChartData.length ? (
                <div className="nutrition-chart-box">
                  <ResponsiveContainer>
                    <LineChart data={nutritionChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="fecha" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="peso" name="Peso" stroke="#1d4ed8" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="grasa" name="% grasa" stroke="#f59e0b" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="pliegues" name="Sumatoria" stroke="#64748b" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="masaMuscular" name="% masa muscular" stroke="#059669" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="empty"><strong>Sin registros nutricionales.</strong><br />Crea una valoración para iniciar el seguimiento.</div>}
            </section>

            <section className="card nutrition-history-card">
              <div className="section-header compact-section-header">
                <div>
                  <span className="section-eyebrow">Histórico</span>
                  <h3>Valoraciones nutricionales</h3>
                </div>
              </div>
              {nutritionHistory.length ? (
                <div className="table-wrap nutrition-table-wrap">
                  <table className="data-table nutrition-table">
                    <thead><tr><th>Fecha</th><th>Peso</th><th>Rango peso</th><th>Talla</th><th>Sumatoria</th><th>Rango sum.</th><th>% grasa</th><th>% masa</th><th>Rango masa</th><th>IMO</th><th>Plan</th><th>Diagnóstico</th>{canEdit ? <th>Acciones</th> : null}</tr></thead>
                    <tbody>{nutritionHistory.map((record) => {
                      const row = normalizeNutritionRecord(record);
                      return <tr key={row.id}><td>{row.date}</td><td>{formatNutritionValue(row.weight, ' kg')}</td><td>{formatNutritionText(row.weightRange)}</td><td>{formatNutritionValue(row.height, ' cm')}</td><td>{formatNutritionValue(row.skinfoldSum)}</td><td><NutritionBadge label={getNutritionRangeLabel(row.skinfoldRange)} tone={getNutritionRangeTone('skinfold', row.skinfoldRange)} /></td><td>{formatNutritionValue(row.bodyFat, '%')}</td><td>{formatNutritionValue(row.muscleMassPercentage, '%')}</td><td><NutritionBadge label={getNutritionRangeLabel(row.muscleMassRange)} tone={getNutritionRangeTone('muscle', row.muscleMassRange)} /></td><td>{formatNutritionValue(row.imo)}</td><td>{getNutritionPlanLabel(row.plan)}</td><td className="diagnosis-cell">{formatNutritionText(row.diagnosis)}</td>{canEdit ? <td><div className="btn-row compact-actions"><button type="button" className="btn secondary" onClick={() => setEditingNutritionId(row.id)}>Editar</button><button type="button" className="btn danger" onClick={() => deleteNutritionRecord(row.id)}>Eliminar</button></div></td> : null}</tr>;
                    })}</tbody>
                  </table>
                </div>
              ) : (
                <div className="empty nutrition-empty"><strong>Sin registros nutricionales.</strong><span>Crea una valoración para iniciar el seguimiento.</span>{canEdit ? <button className="btn secondary" type="button">Nueva valoración</button> : null}</div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'Perfil neuromuscular' && (
          <div className="grid grid-2">
            <form className="card grid" action={submitNeuromuscular}>
              <h3>{editingNeuro ? 'Editar perfil neuromuscular' : 'Cargar perfil neuromuscular'}</h3>
              <input className="input" type="date" name="date" defaultValue={editingNeuro?.date ?? filters.date} key={`neuro-date-${editingNeuroId || 'new'}`} required />
              <div className="grid grid-3">
                <input className="input" type="number" step="0.01" name="cmj" placeholder="Salto CMJ" defaultValue={editingNeuro?.cmj ?? ''} key={`neuro-cmj-${editingNeuroId || 'new'}`} required />
                <input className="input" type="number" step="0.01" name="sj" placeholder="Salto SJ" defaultValue={editingNeuro?.sj ?? ''} key={`neuro-sj-${editingNeuroId || 'new'}`} required />
                <input className="input" type="number" step="0.01" name="reactiveJumps" placeholder="Saltos reactivos" defaultValue={editingNeuro?.reactiveJumps ?? ''} key={`neuro-rj-${editingNeuroId || 'new'}`} required />
              </div>
              <button className="btn" type="submit">{editingNeuro ? 'Actualizar perfil' : 'Guardar perfil'}</button>
            </form>
            <div className="card">
              <h3>Comparación histórica</h3>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={[...neuromuscularHistory].reverse().map((row) => ({ fecha: row.date.slice(5), cmj: row.cmj, sj: row.sj, reactivos: row.reactiveJumps }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="cmj" stroke="#1d4ed8" strokeWidth={3} />
                    <Line type="monotone" dataKey="sj" stroke="#60a5fa" strokeWidth={3} />
                    <Line type="monotone" dataKey="reactivos" stroke="#93c5fd" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card table-wrap" style={{ gridColumn: '1 / -1' }}>
              <h3>Todas las valoraciones neuromusculares</h3>
              <table><thead><tr><th>Fecha</th><th>CMJ</th><th>SJ</th><th>Reactivos</th><th>Acciones</th></tr></thead><tbody>{neuromuscularHistory.map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.cmj}</td><td>{row.sj}</td><td>{row.reactiveJumps}</td><td><div className="btn-row"><button type="button" className="btn secondary" onClick={() => { setEditingNeuroId(row.id); const paired = cmjHistory.find((cmj) => cmj.date === row.date); setEditingCmjId(paired?.id ?? ''); }}>Editar</button><button type="button" className="btn danger" onClick={() => { deleteNeuromuscularRecord(row.id); const paired = cmjHistory.find((cmj) => cmj.date === row.date); if (paired) deleteCMJRecord(paired.id); }}>Eliminar</button></div></td></tr>)}</tbody></table>
            </div>
          </div>
        )}

        {activeTab === 'CMJ' && (
          <div className="grid grid-2">
            <div className="card">
              <h3>Evolución histórica de CMJ</h3>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={[...cmjHistory].reverse().map((row) => ({ fecha: row.date.slice(5), cmj: row.value }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="cmj" stroke="#1d4ed8" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card table-wrap">
              <h3>Historial CMJ</h3>
              <table><thead><tr><th>Fecha</th><th>CMJ</th><th>Acciones</th></tr></thead><tbody>{cmjHistory.map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.value}</td><td><div className="btn-row"><button type="button" className="btn secondary" onClick={() => setEditingCmjId(row.id)}>Seleccionar</button><button type="button" className="btn danger" onClick={() => deleteCMJRecord(row.id)}>Eliminar</button></div></td></tr>)}</tbody></table>
              {editingCmj ? <div style={{ marginTop: 16 }} className="grid"><strong>Editar CMJ rápido</strong><button type="button" className="btn secondary" onClick={() => { const next = window.prompt('Nuevo valor CMJ', String(editingCmj.value)); if (next) { updateCMJRecord({ ...editingCmj, value: Number(next) }); setMessage('CMJ actualizado.'); setEditingCmjId(''); } }}>Editar valor seleccionado</button></div> : null}
            </div>
          </div>
        )}

        {activeTab === 'FMS' && (
          <div className="grid grid-2">
            <form className="card grid" action={submitFMS}>
              <h3>{editingFms ? 'Editar FMS' : 'Cargar FMS'}</h3>
              <input className="input" type="date" name="date" defaultValue={editingFms?.date ?? filters.date} key={`fms-date-${editingFmsId || 'new'}`} required />
              <div className="grid grid-3">
                <input className="input" type="number" min="1" max="3" name="shoulderMobility" placeholder="Movilidad hombros" defaultValue={editingFms?.shoulderMobility ?? ''} key={`fms-1-${editingFmsId || 'new'}`} required />
                <input className="input" type="number" min="1" max="3" name="squat" placeholder="Sentadilla" defaultValue={editingFms?.squat ?? ''} key={`fms-2-${editingFmsId || 'new'}`} required />
                <input className="input" type="number" min="1" max="3" name="legRaise" placeholder="Elevación de pierna" defaultValue={editingFms?.legRaise ?? ''} key={`fms-3-${editingFmsId || 'new'}`} required />
                <input className="input" type="number" min="1" max="3" name="hurdleStep" placeholder="Paso obstáculo" defaultValue={editingFms?.hurdleStep ?? ''} key={`fms-4-${editingFmsId || 'new'}`} required />
                <input className="input" type="number" min="1" max="3" name="lunge" placeholder="Zancada" defaultValue={editingFms?.lunge ?? ''} key={`fms-5-${editingFmsId || 'new'}`} required />
                <input className="input" type="number" min="1" max="3" name="trunkStability" placeholder="Estabilidad de tronco" defaultValue={editingFms?.trunkStability ?? ''} key={`fms-6-${editingFmsId || 'new'}`} required />
                <input className="input" type="number" min="1" max="3" name="rotaryStability" placeholder="Estabilidad con rotación" defaultValue={editingFms?.rotaryStability ?? ''} key={`fms-7-${editingFmsId || 'new'}`} required />
              </div>
              <button className="btn" type="submit">{editingFms ? 'Actualizar FMS' : 'Guardar FMS'}</button>
            </form>
            <div className="card">
              <h3>Evolución FMS</h3>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={[...fmsHistory].reverse().map((row) => ({ fecha: row.date.slice(5), total: row.total }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke="#1d4ed8" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card table-wrap" style={{ gridColumn: '1 / -1' }}>
              <h3>Todas las valoraciones FMS</h3>
              <table><thead><tr><th>Fecha</th><th>Total</th><th>Hombros</th><th>Sentadilla</th><th>Pierna</th><th>Obstáculo</th><th>Zancada</th><th>Tronco</th><th>Rotación</th><th>Acciones</th></tr></thead><tbody>{fmsHistory.map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.total}</td><td>{row.shoulderMobility}</td><td>{row.squat}</td><td>{row.legRaise}</td><td>{row.hurdleStep}</td><td>{row.lunge}</td><td>{row.trunkStability}</td><td>{row.rotaryStability}</td><td><div className="btn-row"><button type="button" className="btn secondary" onClick={() => setEditingFmsId(row.id)}>Editar</button><button type="button" className="btn danger" onClick={() => deleteFMSRecord(row.id)}>Eliminar</button></div></td></tr>)}</tbody></table>
            </div>
          </div>
        )}
      </div>
      </div>
      <EvaluationsReportTemplate report={evaluationReport} className="print-only" />
    </div>
  );
}
