'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardPlus, Download, Save } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { BodyMapSelector } from '@/components/body-map-selector';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge, showToast } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import {
  BODY_REGIONS,
  bodyMapTone,
  getBodyMapDecision,
  newBodyMapId,
  readBodyMapRecords,
  saveBodyMapRecords,
  todayInput,
  type BodyMapRecord,
  type BodyMapRecordType,
  type BodyMapSide,
  type BodyMapSource,
  type BodyMapStatus,
} from '@/lib/body-map';
import { categoryLabel } from '@/lib/labels';
import type { ClubCategory } from '@/lib/types';

const categories: Array<ClubCategory | 'all'> = ['all', 'Sub20', 'Sub17', 'Sub15'];
const sources: BodyMapSource[] = ['Jugador', 'Fisioterapia', 'Cuerpo técnico'];
const types: BodyMapRecordType[] = ['Dolor muscular', 'Molestia', 'Lesión reportada', 'Seguimiento'];
const sides: BodyMapSide[] = ['Derecha', 'Izquierda', 'Bilateral', 'Central'];
const statuses: BodyMapStatus[] = ['Abierto', 'En seguimiento', 'Cerrado'];

export default function DolorLesionesPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const [records, setRecords] = useState<BodyMapRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ClubCategory | 'all'>((activeCategory === 'all' ? 'all' : activeCategory) as ClubCategory | 'all');
  const [date, setDate] = useState(filters.date || todayInput());
  const [playerId, setPlayerId] = useState('');
  const [region, setRegion] = useState<string>('Isquiotibial');
  const [source, setSource] = useState<BodyMapSource>('Jugador');
  const [type, setType] = useState<BodyMapRecordType>('Dolor muscular');
  const [side, setSide] = useState<BodyMapSide>('Derecha');
  const [intensity, setIntensity] = useState(3);
  const [limitation, setLimitation] = useState(false);
  const [sprint, setSprint] = useState(false);
  const [cod, setCod] = useState(false);
  const [mechanism, setMechanism] = useState('');
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState('');

  useEffect(() => setRecords(readBodyMapRecords()), []);

  const visiblePlayers = useMemo(() => data.players.filter((player) => selectedCategory === 'all' || player.category === selectedCategory), [data.players, selectedCategory]);

  useEffect(() => {
    if (!playerId && visiblePlayers[0]) setPlayerId(visiblePlayers[0].id);
  }, [visiblePlayers, playerId]);

  const filteredRecords = useMemo(() => records
    .filter((record) => selectedCategory === 'all' || record.category === selectedCategory)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [records, selectedCategory]);
  const active = filteredRecords.filter((record) => record.status !== 'Cerrado');
  const high = active.filter((record) => record.intensity >= 7 || record.limitation || record.type === 'Lesión reportada');
  const today = filteredRecords.filter((record) => record.date === date);
  const uniquePlayers = new Set(active.map((record) => record.playerId)).size;

  const persist = (next: BodyMapRecord[], success = 'Registro guardado.') => {
    setRecords(next);
    saveBodyMapRecords(next);
    showToast(success, 'green');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const player = data.players.find((item) => item.id === playerId);
    if (!player) return showToast('Selecciona un jugador.', 'amber');
    const record: BodyMapRecord = {
      id: newBodyMapId(),
      playerId,
      date,
      source,
      type,
      region,
      side,
      intensity,
      limitation,
      increasesWithSprint: sprint,
      increasesWithChangeOfDirection: cod,
      mechanism,
      notes,
      action,
      status: type === 'Lesión reportada' ? 'En seguimiento' : 'Abierto',
      category: player.category,
      createdAt: new Date().toISOString(),
    };
    persist([record, ...records], 'Dolor/lesión registrado correctamente.');
    setNotes('');
    setAction('');
    setMechanism('');
    setIntensity(3);
    setLimitation(false);
    setSprint(false);
    setCod(false);
  };

  const updateRecord = (record: BodyMapRecord, patch: Partial<BodyMapRecord>) => {
    persist(records.map((item) => item.id === record.id ? { ...item, ...patch } : item), 'Registro actualizado.');
  };

  const playerName = (id: string) => data.players.find((item) => item.id === id)?.name ?? 'Jugador';

  return (
    <div className="grid body-map-page">
      <AppHero
        heroClass="hero-alimentacion"
        title="Dolor y lesiones"
        subtitle="Silueta muscular para que jugadores, fisioterapeutas y cuerpo técnico ubiquen molestias, lesiones y decisiones de carga."
      />
      <GlobalFiltersBar />

      <div className="toolbar card house-toolbar">
        <div className="grid form-grid house-toolbar-fields">
          <label>Categoría<select className="select" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value as ClubCategory | 'all')}>{categories.map((cat) => <option key={cat} value={cat}>{cat === 'all' ? 'Todas' : categoryLabel(cat)}</option>)}</select></label>
          <label>Fecha<input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </div>
        <button className="btn" onClick={() => window.print()}><Download size={16} /> Exportar PDF</button>
      </div>

      <div className="grid grid-4">
        <KpiCard label="Registros activos" value={String(active.length)} tone={active.length ? 'amber' : 'green'} trend="Dolor/lesión abierta" icon={<ClipboardPlus size={18} />} />
        <KpiCard label="Alta prioridad" value={String(high.length)} tone={high.length ? 'red' : 'green'} trend="Dolor >=7, limita o lesión" icon={<AlertTriangle size={18} />} />
        <KpiCard label="Jugadores en seguimiento" value={String(uniquePlayers)} tone={uniquePlayers ? 'amber' : 'green'} trend="Con registro abierto" />
        <KpiCard label="Hoy" value={String(today.length)} tone={today.length ? 'blue' : 'green'} trend={date} />
      </div>

      <div className="grid grid-2 body-map-layout">
        <div className="card">
          <SectionHeader eyebrow="Registro" title="Marcar zona en silueta" subtitle="Usa la misma herramienta para dolor subjetivo del jugador y reporte profesional de fisioterapia." />
          <form className="grid form-grid" onSubmit={handleSubmit}>
            <label>Jugador<select className="select" value={playerId} onChange={(event) => setPlayerId(event.target.value)}>{visiblePlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
            <label>Fuente<select className="select" value={source} onChange={(event) => setSource(event.target.value as BodyMapSource)}>{sources.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Tipo<select className="select" value={type} onChange={(event) => setType(event.target.value as BodyMapRecordType)}>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Lado<select className="select" value={side} onChange={(event) => setSide(event.target.value as BodyMapSide)}>{sides.map((item) => <option key={item}>{item}</option>)}</select></label>
            <div className="field full-width"><span>Zona seleccionada</span><BodyMapSelector value={region} onChange={setRegion} /></div>
            <label>Zona manual<select className="select" value={region} onChange={(event) => setRegion(event.target.value)}>{BODY_REGIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Intensidad 0-10<input className="input" type="number" min="0" max="10" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} /></label>
            <label className="checkline"><input type="checkbox" checked={limitation} onChange={(event) => setLimitation(event.target.checked)} /> Limita el entrenamiento</label>
            <label className="checkline"><input type="checkbox" checked={sprint} onChange={(event) => setSprint(event.target.checked)} /> Aumenta al acelerar/sprintar</label>
            <label className="checkline"><input type="checkbox" checked={cod} onChange={(event) => setCod(event.target.checked)} /> Aumenta al frenar/cambiar dirección</label>
            <label>Mecanismo<input className="input" value={mechanism} onChange={(event) => setMechanism(event.target.value)} placeholder="Ej: sprint, golpe, cambio de dirección, progresivo" /></label>
            <label>Acción recomendada<input className="input" value={action} onChange={(event) => setAction(event.target.value)} placeholder="Ej: fisioterapia, evitar sprint, trabajo modificado" /></label>
            <label className="full-width">Notas<textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Descripción clínica o sensación del jugador" /></label>
            <button className="btn full-width" type="submit"><Save size={16} /> Guardar registro</button>
          </form>
        </div>

        <div className="card">
          <SectionHeader eyebrow="Decisión" title="Regla práctica de carga" subtitle="La silueta no diagnostica; traduce dolor/lesión en una decisión operativa para entrenar." />
          <div className="body-map-decision-card">
            {(() => {
              const preview = getBodyMapDecision({ intensity, limitation, type, increasesWithSprint: sprint, increasesWithChangeOfDirection: cod, status: type === 'Lesión reportada' ? 'En seguimiento' : 'Abierto' });
              return <><StatusBadge text={preview.decision} tone={preview.decision.includes('No campo') ? 'red' : preview.decision.includes('modificado') || preview.decision.includes('Reducir') ? 'amber' : 'green'} /><h3>{preview.pct} de carga sugerida</h3><p>{preview.rationale}</p></>;
            })()}
          </div>
          <div className="insight-list compact">
            <div><strong>Jugador:</strong> marca ubicación e intensidad del dolor antes o después de entrenar.</div>
            <div><strong>Fisioterapia:</strong> confirma lesión, lado, mecanismo, restricción y plan de manejo.</div>
            <div><strong>Preparador físico:</strong> decide exposición a campo, sprint, desaceleraciones y volumen.</div>
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Seguimiento" title="Registros de dolor y lesión" subtitle="Prioriza registros abiertos, intensidad alta, limitación funcional y lesiones reportadas por fisioterapia." />
        {!filteredRecords.length ? <EmptyState title="Sin registros" text="Marca la primera zona de dolor o lesión para iniciar seguimiento individual." /> : null}
        <div className="table-scroll"><table className="pro-table house-table"><thead><tr><th>Fecha</th><th>Jugador</th><th>Fuente</th><th>Tipo</th><th>Zona</th><th>Lado</th><th>Int.</th><th>Decisión</th><th>Estado</th><th>Acción/nota</th></tr></thead><tbody>
          {filteredRecords.map((record) => {
            const decision = getBodyMapDecision(record);
            return <tr key={record.id}>
              <td>{record.date}</td>
              <td>{playerName(record.playerId)}</td>
              <td>{record.source}</td>
              <td><StatusBadge text={record.type} tone={bodyMapTone(record) as any} /></td>
              <td>{record.region}</td>
              <td>{record.side}</td>
              <td>{record.intensity}/10</td>
              <td><strong>{decision.decision}</strong><br /><small>{decision.pct} · {decision.rationale}</small></td>
              <td><select className="select mini" value={record.status} onChange={(event) => updateRecord(record, { status: event.target.value as BodyMapStatus })}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></td>
              <td><input className="input" value={record.action || record.notes || ''} onChange={(event) => updateRecord(record, { action: event.target.value })} placeholder="Acción o nota" /></td>
            </tr>;
          })}
        </tbody></table></div>
      </div>

      <div className="soft-alert success"><CheckCircle2 size={16} /> Esta información debe cruzarse con wellness, RPE, carga 7/28 días y exposición a sprint para decidir la carga final.</div>
    </div>
  );
}
