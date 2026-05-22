'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Compass,
  FileText,
  MapPinned,
  Medal,
  Route,
  Search,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge, showToast } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession } from '@/lib/auth';
import { hasTechnicalSecretariatPermission } from '@/lib/access-control';
import { calcAge, categoryLabel } from '@/lib/labels';
import type {
  CaptureSource,
  Player,
  ScoutStatus,
  SelectionCallRecord,
  SelectionCallStatus,
  SelectionCallType,
  SelectionLevel,
  TechnicalDecisionType,
  TechnicalRecommendation,
  TechnicalReportContext,
} from '@/lib/types';
import {
  buildCaptureMapStats,
  buildTechnicalPlayerRows,
  captureSourceLabel,
  decisionLabel,
  formatSelectionCall,
  makeRecordId,
  recommendationLabel,
  scoreAverage,
  scoutStatusLabel,
  selectionLevelLabel,
  selectionStatusLabel,
  selectionTypeLabel,
  getPlayerTechnicalBundle,
  type CaptureMapFilters,
  type CaptureZoneStats,
} from '@/lib/technical-secretariat';
import { TechnicalAccessGate, TechnicalModuleNav, statusToneForScout, statusToneForSelection } from './technical-ui';

const getToday = () => new Date().toISOString().slice(0, 10);
const currentUser = () => {
  const session = getStaffSession();
  return session.email ?? session.displayName ?? 'Secretaría Técnica';
};

const positions = ['all', 'Portero', 'Defensa central', 'Lateral', 'Mediocampista', 'Extremo', 'Delantero'];
const categories = ['all', 'Sub15', 'Sub17', 'Sub20'];
const scoutStatuses: ScoutStatus[] = ['sin_seguimiento', 'nuevo', 'observado', 'en_seguimiento', 'interesante', 'prioridad', 'convocable', 'promovible', 'descartado'];
const recommendations: TechnicalRecommendation[] = ['seguir_observando', 'priorizar', 'convocable', 'promover', 'descartar', 'revisar_mas_adelante'];
const contexts: TechnicalReportContext[] = ['partido', 'entrenamiento', 'torneo', 'video', 'prueba', 'otro'];
const selectionLevels: SelectionLevel[] = ['nacional', 'departamental', 'regional', 'municipal', 'otra'];
const selectionTypes: SelectionCallType[] = ['microciclo', 'competencia', 'amistoso', 'visoria', 'entrenamiento', 'otro'];
const selectionStatuses: SelectionCallStatus[] = ['preconvocado', 'convocado', 'participo', 'no_asistio', 'descartado', 'pendiente'];
const captureSources: CaptureSource[] = ['scouting', 'recomendacion', 'torneo', 'escuela', 'club_aliado', 'prueba', 'seleccion', 'otro'];
const decisionTypes: TechnicalDecisionType[] = ['mantener_en_observacion', 'marcar_prioridad', 'marcar_convocable', 'promover_categoria', 'descartar', 'solicitar_nuevo_reporte', 'enviar_a_revision', 'cerrar_seguimiento'];

const unique = (values: Array<string | undefined>) => Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
const fieldStyle = { minWidth: 180 } as const;

const PlayerSelect = ({ players, value, onChange }: { players: Player[]; value: string; onChange: (id: string) => void }) => (
  <select className="select" value={value} onChange={(event) => onChange(event.target.value)} style={fieldStyle}>
    <option value="">Seleccionar jugador</option>
    {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
  </select>
);

function TechnicalShell({ children, permission = 'secretaria_tecnica.view' }: { children: React.ReactNode; permission?: Parameters<typeof hasTechnicalSecretariatPermission>[1] }) {
  return (
    <TechnicalAccessGate permission={permission}>
      <div className="grid secretaria-tecnica-page">
        <AppHero
          title="Secretaría Técnica"
          subtitle="Fichas técnicas, scouting, llamados a selección, decisiones y mapa de captación con acceso restringido."
        />
        <TechnicalModuleNav />
        {children}
      </div>
    </TechnicalAccessGate>
  );
}

export function TechnicalPanelPage() {
  const { data } = useApp();
  const rows = useMemo(() => buildTechnicalPlayerRows(data), [data]);
  const reports = [...(data.technicalReports ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const selections = [...(data.selectionCallRecords ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const decisions = [...(data.technicalDecisions ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const captureStats = buildCaptureMapStats(data.players, data.playerCaptureLocations ?? [], data.scoutFollowUps ?? [], data.selectionCallRecords ?? []);
  const playerName = (id: string) => data.players.find((player) => player.id === id)?.name ?? 'Jugador eliminado';

  return (
    <TechnicalShell>
      <div className="grid grid-4">
        <KpiCard label="En seguimiento" value={String(rows.filter((row) => row.followUp && row.followUp.status !== 'sin_seguimiento' && row.followUp.status !== 'descartado').length)} tone="blue" icon={<Users size={18} />} trend="Jugadores activos" />
        <KpiCard label="Prioritarios" value={String(rows.filter((row) => row.followUp?.status === 'prioridad').length)} tone="green" icon={<Star size={18} />} trend="Seguimiento alto" />
        <KpiCard label="Con selección" value={String(rows.filter((row) => row.latestSelection).length)} tone="amber" icon={<Medal size={18} />} trend="Colombia, Valle u otras" />
        <KpiCard label="Zonas activas" value={String(captureStats.activeZones)} tone="dark" icon={<MapPinned size={18} />} trend={captureStats.topZone?.zoneName ?? 'Sin captación'} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Actividad" title="Reportes técnicos recientes" subtitle="Últimos registros del staff." />
          {reports.length ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Jugador</th><th>Score</th><th>Recomendación</th></tr></thead>
                <tbody>{reports.slice(0, 6).map((report) => (
                  <tr key={report.id}>
                    <td>{report.date}</td>
                    <td><Link href={`/secretaria-tecnica/jugadores/${report.playerId}`}>{playerName(report.playerId)}</Link></td>
                    <td>{scoreAverage(report).toFixed(1)}</td>
                    <td><StatusBadge text={recommendationLabel[report.recommendation]} tone={report.recommendation === 'descartar' ? 'red' : report.recommendation === 'priorizar' ? 'green' : 'blue'} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState title="Sin reportes técnicos" text="Cuando el staff cree reportes, aparecerán aquí." />}
        </div>
        <div className="card">
          <SectionHeader eyebrow="Selecciones" title="Últimos llamados" subtitle="Microciclos o competencias externas registradas." />
          {selections.length ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Jugador</th><th>Selección</th><th>Tipo</th><th>Estado</th></tr></thead>
                <tbody>{selections.slice(0, 6).map((call) => (
                  <tr key={call.id}>
                    <td>{call.startDate}</td>
                    <td><Link href={`/secretaria-tecnica/jugadores/${call.playerId}`}>{playerName(call.playerId)}</Link></td>
                    <td>{call.selectionName} {call.category}</td>
                    <td>{selectionTypeLabel[call.callType]}</td>
                    <td><StatusBadge text={selectionStatusLabel[call.status]} tone={statusToneForSelection(call.status)} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState title="Sin llamados a selección" text="Registra llamados a Selección Colombia, Valle u otras selecciones." />}
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Decisiones" title="Historial reciente" subtitle="Trazabilidad de prioridades, descartes y solicitudes de revisión." />
        {decisions.length ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Fecha</th><th>Jugador</th><th>Decisión</th><th>Motivo</th><th>Usuario</th></tr></thead>
              <tbody>{decisions.slice(0, 8).map((decision) => (
                <tr key={decision.id}>
                  <td>{decision.createdAt.slice(0, 10)}</td>
                  <td><Link href={`/secretaria-tecnica/jugadores/${decision.playerId}`}>{playerName(decision.playerId)}</Link></td>
                  <td>{decisionLabel[decision.decision]}</td>
                  <td>{decision.reason}</td>
                  <td>{decision.createdBy}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="Sin decisiones registradas" text="Las decisiones técnicas con motivo quedarán guardadas aquí." />}
      </div>
    </TechnicalShell>
  );
}

export function TechnicalPlayersPage() {
  const { data } = useApp();
  const rows = useMemo(() => buildTechnicalPlayerRows(data), [data]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    return (!q || row.player.name.toLowerCase().includes(q) || row.player.position.toLowerCase().includes(q))
      && (status === 'all' || row.followUp?.status === status)
      && (category === 'all' || row.player.category === category);
  });

  return (
    <TechnicalShell permission="secretaria_tecnica.players.view">
      <div className="card">
        <SectionHeader eyebrow="Fichas" title="Jugadores Secretaría Técnica" subtitle="Estado scout, último reporte, llamados a selección y zona de captación." />
        <div className="btn-row" style={{ marginBottom: 14 }}>
          <div className="input-icon" style={{ flex: 1, minWidth: 260 }}><Search size={15} /><input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar jugador o posición" /></div>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>{['all', ...scoutStatuses].map((item) => <option key={item} value={item}>{item === 'all' ? 'Todos los estados' : scoutStatusLabel[item as ScoutStatus]}</option>)}</select>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item} value={item}>{item === 'all' ? 'Todas las categorías' : item}</option>)}</select>
        </div>
        {filtered.length ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Jugador</th><th>Edad</th><th>Categoría</th><th>Posición</th><th>Estado scout</th><th>Último reporte</th><th>Selección</th><th>Zona</th><th>Acción</th></tr></thead>
              <tbody>{filtered.map((row) => (
                <tr key={row.player.id}>
                  <td><strong>{row.player.name}</strong></td>
                  <td>{calcAge(row.player.birthDate) ?? row.player.age}</td>
                  <td>{categoryLabel(row.player.category)}</td>
                  <td>{row.player.position}</td>
                  <td><StatusBadge text={row.followUp ? scoutStatusLabel[row.followUp.status] : 'Sin seguimiento'} tone={statusToneForScout(row.followUp?.status)} /></td>
                  <td>{row.latestReport ? `${row.globalScore.toFixed(1)} · ${recommendationLabel[row.latestReport.recommendation]}` : 'Sin reporte'}</td>
                  <td>{formatSelectionCall(row.latestSelection)}</td>
                  <td>{row.primaryLocation?.municipality || row.primaryLocation?.city || row.primaryLocation?.department || 'Sin zona'}</td>
                  <td><Link className="btn secondary btn-compact" href={`/secretaria-tecnica/jugadores/${row.player.id}`}>Ver ficha</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="Sin jugadores visibles" text="Agrega jugadores o ajusta los filtros para usar Secretaría Técnica." />}
      </div>
    </TechnicalShell>
  );
}

function QuickReportForm({ players }: { players: Player[] }) {
  const { upsertTechnicalReport } = useApp();
  const canCreate = hasTechnicalSecretariatPermission(getStaffSession(), 'secretaria_tecnica.reports.create');
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '');
  const [summary, setSummary] = useState('');
  const [recommendation, setRecommendation] = useState<TechnicalRecommendation>('seguir_observando');
  const [context, setContext] = useState<TechnicalReportContext>('partido');
  const [score, setScore] = useState(7);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate) return showToast('No tienes permiso para crear reportes.', 'red');
    if (!playerId || !summary.trim()) return showToast('Selecciona jugador y escribe resumen.', 'amber');
    const safeScore = Math.max(1, Math.min(10, Number(score) || 1));
    upsertTechnicalReport({
      id: makeRecordId('tech-report'),
      playerId,
      authorId: currentUser(),
      date: getToday(),
      context,
      observedPosition: players.find((player) => player.id === playerId)?.position ?? 'Sin definir',
      technicalScore: safeScore,
      tacticalScore: safeScore,
      physicalScore: safeScore,
      mentalScore: safeScore,
      projectionScore: safeScore,
      modelFitScore: safeScore,
      strengths: [],
      weaknesses: [],
      summary: summary.trim(),
      recommendation,
      createdAt: new Date().toISOString(),
    });
    setSummary('');
    showToast('Reporte técnico guardado.');
  };

  if (!players.length) return null;
  return (
    <form className="card" onSubmit={submit}>
      <SectionHeader eyebrow="Nuevo" title="Reporte técnico rápido" subtitle="Para reportes detallados se podrán ampliar campos después." />
      <div className="btn-row">
        <PlayerSelect players={players} value={playerId} onChange={setPlayerId} />
        <select className="select" value={context} onChange={(e) => setContext(e.target.value as TechnicalReportContext)}>{contexts.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <input className="input" type="number" min={1} max={10} value={score} onChange={(e) => setScore(Number(e.target.value))} style={{ maxWidth: 110 }} />
        <select className="select" value={recommendation} onChange={(e) => setRecommendation(e.target.value as TechnicalRecommendation)}>{recommendations.map((item) => <option key={item} value={item}>{recommendationLabel[item]}</option>)}</select>
      </div>
      <textarea className="textarea" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Resumen cualitativo: fortalezas, aspectos por mejorar, encaje con modelo..." />
      <button type="submit" className="btn" disabled={!canCreate}>Guardar reporte</button>
    </form>
  );
}

export function TechnicalReportsPage() {
  const { data } = useApp();
  const [query, setQuery] = useState('');
  const playerName = (id: string) => data.players.find((player) => player.id === id)?.name ?? 'Jugador eliminado';
  const reports = [...(data.technicalReports ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((report) => !query.trim() || playerName(report.playerId).toLowerCase().includes(query.toLowerCase()) || report.summary.toLowerCase().includes(query.toLowerCase()));

  return (
    <TechnicalShell permission="secretaria_tecnica.reports.view">
      <QuickReportForm players={data.players} />
      <div className="card">
        <SectionHeader eyebrow="Reportes" title="Reportes técnicos / scout" subtitle="Historial de observaciones y recomendaciones." />
        <div className="btn-row" style={{ marginBottom: 14 }}><input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por jugador o resumen" /></div>
        {reports.length ? (
          <div className="table-wrapper">
            <table className="data-table"><thead><tr><th>Fecha</th><th>Jugador</th><th>Autor</th><th>Contexto</th><th>Score</th><th>Recomendación</th><th>Resumen</th></tr></thead>
            <tbody>{reports.map((report) => <tr key={report.id}><td>{report.date}</td><td><Link href={`/secretaria-tecnica/jugadores/${report.playerId}`}>{playerName(report.playerId)}</Link></td><td>{report.authorId}</td><td>{report.context}</td><td>{scoreAverage(report).toFixed(1)}</td><td><StatusBadge text={recommendationLabel[report.recommendation]} tone={report.recommendation === 'descartar' ? 'red' : report.recommendation === 'priorizar' ? 'green' : 'blue'} /></td><td>{report.summary}</td></tr>)}</tbody></table>
          </div>
        ) : <EmptyState title="Sin reportes" text="Crea el primer reporte técnico para activar el historial del jugador." />}
      </div>
    </TechnicalShell>
  );
}

function QuickScoutingForm({ players }: { players: Player[] }) {
  const { upsertScoutFollowUp } = useApp();
  const canManage = hasTechnicalSecretariatPermission(getStaffSession(), 'secretaria_tecnica.scouting.manage');
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '');
  const [status, setStatus] = useState<ScoutStatus>('en_seguimiento');
  const [priorityLevel, setPriorityLevel] = useState<'baja' | 'media' | 'alta'>('media');
  const [notes, setNotes] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return showToast('No tienes permiso para editar seguimiento scout.', 'red');
    if (!playerId) return showToast('Selecciona un jugador.', 'amber');
    upsertScoutFollowUp({ id: `scout-${playerId}`, playerId, status, priorityLevel, notes, updatedAt: new Date().toISOString(), updatedBy: currentUser() });
    setNotes('');
    showToast('Seguimiento scout actualizado.');
  };
  if (!players.length) return null;
  return <form className="card" onSubmit={submit}><SectionHeader eyebrow="Seguimiento" title="Actualizar estado scout" /><div className="btn-row"><PlayerSelect players={players} value={playerId} onChange={setPlayerId} /><select className="select" value={status} onChange={(e) => setStatus(e.target.value as ScoutStatus)}>{scoutStatuses.map((item) => <option key={item} value={item}>{scoutStatusLabel[item as ScoutStatus]}</option>)}</select><select className="select" value={priorityLevel} onChange={(e) => setPriorityLevel(e.target.value as 'baja' | 'media' | 'alta')}><option value="baja">Prioridad baja</option><option value="media">Prioridad media</option><option value="alta">Prioridad alta</option></select></div><textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observación o motivo del estado" /><button className="btn" type="submit" disabled={!canManage}>Guardar estado</button></form>;
}

export function TechnicalScoutingPage() {
  const { data } = useApp();
  const rows = useMemo(() => buildTechnicalPlayerRows(data), [data]);
  const [status, setStatus] = useState('all');
  const filtered = rows.filter((row) => status === 'all' || row.followUp?.status === status);
  return (
    <TechnicalShell permission="secretaria_tecnica.scouting.view">
      <QuickScoutingForm players={data.players} />
      <div className="card">
        <SectionHeader eyebrow="Scouting" title="Seguimiento scout" subtitle="Estados y prioridades de jugadores en radar." />
        <div className="btn-row" style={{ marginBottom: 14 }}><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>{['all', ...scoutStatuses].map((item) => <option key={item} value={item}>{item === 'all' ? 'Todos los estados' : scoutStatusLabel[item as ScoutStatus]}</option>)}</select></div>
        {filtered.length ? <div className="table-wrapper"><table className="data-table"><thead><tr><th>Jugador</th><th>Posición</th><th>Categoría</th><th>Estado</th><th>Prioridad</th><th>Responsable</th><th>Actualización</th><th>Acción</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.player.id}><td>{row.player.name}</td><td>{row.player.position}</td><td>{categoryLabel(row.player.category)}</td><td><StatusBadge text={row.followUp ? scoutStatusLabel[row.followUp.status] : 'Sin seguimiento'} tone={statusToneForScout(row.followUp?.status)} /></td><td>{row.followUp?.priorityLevel ?? '-'}</td><td>{row.followUp?.updatedBy ?? '-'}</td><td>{row.followUp?.updatedAt?.slice(0, 10) ?? '-'}</td><td><Link className="btn secondary btn-compact" href={`/secretaria-tecnica/jugadores/${row.player.id}`}>Ficha</Link></td></tr>)}</tbody></table></div> : <EmptyState title="Sin jugadores" text="No hay jugadores con este filtro." />}
      </div>
    </TechnicalShell>
  );
}

function QuickSelectionForm({ players }: { players: Player[] }) {
  const { upsertSelectionCallRecord } = useApp();
  const canCreate = hasTechnicalSecretariatPermission(getStaffSession(), 'secretaria_tecnica.selecciones.create');
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '');
  const [selectionName, setSelectionName] = useState('Colombia');
  const [selectionLevel, setSelectionLevel] = useState<SelectionLevel>('nacional');
  const [category, setCategory] = useState('Sub-17');
  const [callType, setCallType] = useState<SelectionCallType>('microciclo');
  const [status, setStatus] = useState<SelectionCallStatus>('convocado');
  const [startDate, setStartDate] = useState(getToday());
  const [eventName, setEventName] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate) return showToast('No tienes permiso para registrar llamados.', 'red');
    if (!playerId || !selectionName.trim() || !category.trim() || !startDate) return showToast('Completa jugador, selección, categoría y fecha.', 'amber');
    upsertSelectionCallRecord({ id: makeRecordId('selection'), playerId, selectionName: selectionName.trim(), selectionLevel, category: category.trim(), callType, status, startDate, eventName: eventName.trim(), createdAt: new Date().toISOString(), createdBy: currentUser() });
    setEventName('');
    showToast('Llamado a selección registrado.');
  };
  if (!players.length) return null;
  return <form className="card" onSubmit={submit}><SectionHeader eyebrow="Selecciones" title="Registrar llamado externo" subtitle="Ejemplo: Selección Colombia o Selección Valle, microciclo o competencia." /><div className="btn-row"><PlayerSelect players={players} value={playerId} onChange={setPlayerId} /><input className="input" value={selectionName} onChange={(e) => setSelectionName(e.target.value)} placeholder="Colombia, Valle..." style={fieldStyle} /><select className="select" value={selectionLevel} onChange={(e) => setSelectionLevel(e.target.value as SelectionLevel)}>{selectionLevels.map((item) => <option key={item} value={item}>{selectionLevelLabel[item]}</option>)}</select><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Sub-17" style={{ maxWidth: 110 }} /><select className="select" value={callType} onChange={(e) => setCallType(e.target.value as SelectionCallType)}>{selectionTypes.map((item) => <option key={item} value={item}>{selectionTypeLabel[item]}</option>)}</select><select className="select" value={status} onChange={(e) => setStatus(e.target.value as SelectionCallStatus)}>{selectionStatuses.map((item) => <option key={item} value={item}>{selectionStatusLabel[item]}</option>)}</select><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div><input className="input" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Evento: Microciclo FCF, Torneo Interligas..." /><button className="btn" type="submit" disabled={!canCreate}>Guardar llamado</button></form>;
}

export function TechnicalSelectionsPage() {
  const { data } = useApp();
  const playerName = (id: string) => data.players.find((player) => player.id === id)?.name ?? 'Jugador eliminado';
  const [selectionFilter, setSelectionFilter] = useState('all');
  const selectionOptions = unique((data.selectionCallRecords ?? []).map((item) => item.selectionName));
  const rows = [...(data.selectionCallRecords ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate)).filter((item) => selectionFilter === 'all' || item.selectionName === selectionFilter);
  return (
    <TechnicalShell permission="secretaria_tecnica.selecciones.view">
      <QuickSelectionForm players={data.players} />
      <div className="card"><SectionHeader eyebrow="Llamados" title="Llamados a Selección" subtitle="Registro simple de microciclos, competencias, visorías y entrenamientos externos." /><div className="btn-row" style={{ marginBottom: 14 }}><select className="select" value={selectionFilter} onChange={(e) => setSelectionFilter(e.target.value)}><option value="all">Todas las selecciones</option>{selectionOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>{rows.length ? <div className="table-wrapper"><table className="data-table"><thead><tr><th>Fecha</th><th>Jugador</th><th>Selección</th><th>Nivel</th><th>Categoría</th><th>Tipo</th><th>Estado</th><th>Evento</th></tr></thead><tbody>{rows.map((call) => <tr key={call.id}><td>{call.startDate}</td><td><Link href={`/secretaria-tecnica/jugadores/${call.playerId}`}>{playerName(call.playerId)}</Link></td><td>{call.selectionName}</td><td>{selectionLevelLabel[call.selectionLevel]}</td><td>{call.category}</td><td>{selectionTypeLabel[call.callType]}</td><td><StatusBadge text={selectionStatusLabel[call.status]} tone={statusToneForSelection(call.status)} /></td><td>{call.eventName || '-'}</td></tr>)}</tbody></table></div> : <EmptyState title="Sin llamados registrados" text="Registra si un jugador fue llamado a Selección Colombia, Valle u otra selección." />}</div>
    </TechnicalShell>
  );
}

function QuickCaptureLocationForm({ players }: { players: Player[] }) {
  const { upsertPlayerCaptureLocation } = useApp();
  const canManage = hasTechnicalSecretariatPermission(getStaffSession(), 'secretaria_tecnica.capture_map.manage');
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '');
  const [department, setDepartment] = useState('Valle del Cauca');
  const [municipality, setMunicipality] = useState('Cali');
  const [captureSource, setCaptureSource] = useState<CaptureSource>('torneo');
  const [captureDate, setCaptureDate] = useState(getToday());
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return showToast('No tienes permiso para editar captación.', 'red');
    if (!playerId || !municipality.trim()) return showToast('Selecciona jugador y zona.', 'amber');
    upsertPlayerCaptureLocation({ id: `capture-${playerId}-${Date.now()}`, playerId, country: 'Colombia', department: department.trim(), municipality: municipality.trim(), captureSource, captureDate, captureYear: Number(captureDate.slice(0, 4)), capturedBy: currentUser(), isPrimary: true });
    showToast('Zona de captación guardada.');
  };
  if (!players.length) return null;
  return <form className="card" onSubmit={submit}><SectionHeader eyebrow="Captación" title="Asignar zona de captación" /><div className="btn-row"><PlayerSelect players={players} value={playerId} onChange={setPlayerId} /><input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Departamento" /><input className="input" value={municipality} onChange={(e) => setMunicipality(e.target.value)} placeholder="Municipio / ciudad" /><select className="select" value={captureSource} onChange={(e) => setCaptureSource(e.target.value as CaptureSource)}>{captureSources.map((item) => <option key={item} value={item}>{captureSourceLabel[item]}</option>)}</select><input className="input" type="date" value={captureDate} onChange={(e) => setCaptureDate(e.target.value)} /></div><button className="btn" type="submit" disabled={!canManage}>Guardar zona</button></form>;
}

function CaptureMapGraphic({ zones, selectedZoneId, onSelect }: { zones: CaptureZoneStats[]; selectedZoneId?: string; onSelect: (zoneId: string) => void }) {
  const max = Math.max(1, ...zones.map((zone) => zone.totalPlayers));
  const coordinateFor = (zone: CaptureZoneStats, index: number) => {
    const withCoords = zone.players.find((player) => typeof player.latitude === 'number' && typeof player.longitude === 'number');
    if (withCoords?.latitude && withCoords?.longitude) {
      const x = Math.max(8, Math.min(92, ((withCoords.longitude + 79) / 13) * 100));
      const y = Math.max(8, Math.min(92, 100 - ((withCoords.latitude + 5) / 18) * 100));
      return { x, y };
    }
    const angle = (index / Math.max(1, zones.length)) * Math.PI * 2;
    return { x: 50 + Math.cos(angle) * 34, y: 50 + Math.sin(angle) * 27 };
  };
  return (
    <svg viewBox="0 0 100 62" role="img" aria-label="Mapa de captación" style={{ width: '100%', minHeight: 360, background: 'linear-gradient(135deg,#ecfeff,#f8fafc)', borderRadius: 22, border: '1px solid #dbeafe' }}>
      <path d="M7 52 C18 24, 31 14, 49 9 C67 5, 89 12, 94 31 C99 50, 82 58, 55 57 C33 57, 16 61, 7 52Z" fill="#dbeafe" stroke="#93c5fd" strokeWidth="0.7" />
      {zones.map((zone, index) => {
        const { x, y } = coordinateFor(zone, index);
        const radius = 4 + (zone.totalPlayers / max) * 8;
        const selected = selectedZoneId === zone.zoneId;
        return (
          <g key={zone.zoneId} onClick={() => onSelect(zone.zoneId)} style={{ cursor: 'pointer' }}>
            <circle cx={x} cy={y} r={radius + 2} fill={selected ? '#f59e0b' : '#38bdf8'} opacity={selected ? 0.32 : 0.2} />
            <circle cx={x} cy={y} r={radius} fill={selected ? '#f59e0b' : '#2563eb'} opacity="0.78" />
            <text x={x} y={y + radius + 5} fontSize="3.1" textAnchor="middle" fill="#0f172a" fontWeight={700}>{zone.zoneName}</text>
            <text x={x} y={y + 1.2} fontSize="3" textAnchor="middle" fill="white" fontWeight={700}>{zone.totalPlayers}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function TechnicalCaptureMapPage() {
  const { data } = useApp();
  const [filters, setFilters] = useState<CaptureMapFilters>({ category: 'all', position: 'all', scoutStatus: 'all', selectionName: 'all', selectionType: 'all', department: 'all', municipality: 'all', captureSource: 'all', year: 'all' });
  const stats = buildCaptureMapStats(data.players, data.playerCaptureLocations ?? [], data.scoutFollowUps ?? [], data.selectionCallRecords ?? [], filters);
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>(stats.topZone?.zoneId);
  const selectedZone = stats.zones.find((zone) => zone.zoneId === selectedZoneId) ?? stats.topZone;
  const selectionOptions = unique((data.selectionCallRecords ?? []).map((item) => item.selectionName));
  const departmentOptions = unique((data.playerCaptureLocations ?? []).map((item) => item.department));
  const municipalityOptions = unique((data.playerCaptureLocations ?? []).map((item) => item.municipality ?? item.city));
  const yearOptions = unique((data.playerCaptureLocations ?? []).map((item) => item.captureYear ? String(item.captureYear) : item.captureDate?.slice(0, 4)));

  return (
    <TechnicalShell permission="secretaria_tecnica.capture_map.view">
      <QuickCaptureLocationForm players={data.players} />
      <div className="grid grid-5"><KpiCard label="Captados" value={String(stats.totalPlayers)} tone="dark" icon={<MapPinned size={18} />} trend="Con filtro actual" /><KpiCard label="Zonas activas" value={String(stats.activeZones)} tone="blue" icon={<Compass size={18} />} trend="Municipios/zonas" /><KpiCard label="Mayor zona" value={stats.topZone?.zoneName ?? '—'} tone="green" icon={<Route size={18} />} trend={stats.topZone ? `${stats.topZone.percentage}%` : 'Sin datos'} /><KpiCard label="Prioritarios" value={String(stats.priorityPlayers)} tone="amber" icon={<Star size={18} />} trend="Estado scout" /><KpiCard label="Con selección" value={String(stats.playersWithSelection)} tone="green" icon={<Medal size={18} />} trend="Llamados externos" /></div>
      <div className="card"><SectionHeader eyebrow="Filtros" title="Mapa de Captación" subtitle="Porcentajes por zona y listado de jugadores captados." /><div className="btn-row" style={{ marginBottom: 14 }}><select className="select" value={filters.year} onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))}><option value="all">Todos los años</option>{yearOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><select className="select" value={filters.category} onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}>{categories.map((item) => <option key={item} value={item}>{item === 'all' ? 'Todas las categorías' : item}</option>)}</select><select className="select" value={filters.position} onChange={(e) => setFilters((prev) => ({ ...prev, position: e.target.value }))}>{positions.map((item) => <option key={item} value={item}>{item === 'all' ? 'Todas las posiciones' : item}</option>)}</select><select className="select" value={filters.scoutStatus} onChange={(e) => setFilters((prev) => ({ ...prev, scoutStatus: e.target.value }))}><option value="all">Todos los estados</option>{scoutStatuses.map((item) => <option key={item} value={item}>{scoutStatusLabel[item as ScoutStatus]}</option>)}</select><select className="select" value={filters.selectionName} onChange={(e) => setFilters((prev) => ({ ...prev, selectionName: e.target.value }))}><option value="all">Todas las selecciones</option>{selectionOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><select className="select" value={filters.selectionType} onChange={(e) => setFilters((prev) => ({ ...prev, selectionType: e.target.value }))}><option value="all">Todos los llamados</option>{selectionTypes.map((item) => <option key={item} value={item}>{selectionTypeLabel[item]}</option>)}</select><select className="select" value={filters.department} onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))}><option value="all">Todos los departamentos</option>{departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><select className="select" value={filters.municipality} onChange={(e) => setFilters((prev) => ({ ...prev, municipality: e.target.value }))}><option value="all">Todos los municipios</option>{municipalityOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><select className="select" value={filters.captureSource} onChange={(e) => setFilters((prev) => ({ ...prev, captureSource: e.target.value }))}><option value="all">Todas las fuentes</option>{captureSources.map((item) => <option key={item} value={item}>{captureSourceLabel[item]}</option>)}</select></div><div className="grid grid-2"><CaptureMapGraphic zones={stats.zones} selectedZoneId={selectedZone?.zoneId} onSelect={setSelectedZoneId} /><div className="card" style={{ boxShadow: 'none', border: '1px solid #e2e8f0' }}><SectionHeader eyebrow="Zona seleccionada" title={selectedZone?.zoneName ?? 'Sin zona'} subtitle={selectedZone ? `${selectedZone.totalPlayers} jugadores · ${selectedZone.percentage}% del total` : 'Selecciona una zona'} />{selectedZone ? <><div className="btn-row" style={{ marginBottom: 10 }}><StatusBadge text={`${selectedZone.playersWithSelection} con selección`} tone="green" /><StatusBadge text={`${selectedZone.priorityPlayers} prioritarios`} tone="amber" /></div><div className="table-wrapper"><table className="data-table"><thead><tr><th>Jugador</th><th>Categoría</th><th>Posición</th><th>Estado</th><th>Selección</th></tr></thead><tbody>{selectedZone.players.map((player) => <tr key={player.id}><td><Link href={`/secretaria-tecnica/jugadores/${player.id}`}>{player.name}</Link></td><td>{player.category}</td><td>{player.position}</td><td>{player.scoutStatus}</td><td>{player.lastSelectionCall}</td></tr>)}</tbody></table></div></> : <EmptyState title="Sin zona seleccionada" />}</div></div></div>
    </TechnicalShell>
  );
}

function QuickDecisionForm({ players }: { players: Player[] }) {
  const { upsertTechnicalDecision } = useApp();
  const canCreate = hasTechnicalSecretariatPermission(getStaffSession(), 'secretaria_tecnica.decisions.create');
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '');
  const [decision, setDecision] = useState<TechnicalDecisionType>('mantener_en_observacion');
  const [reason, setReason] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate) return showToast('No tienes permiso para registrar decisiones.', 'red');
    if (!playerId || !reason.trim()) return showToast('Toda decisión necesita jugador y motivo.', 'amber');
    upsertTechnicalDecision({ id: makeRecordId('decision'), playerId, decision, reason: reason.trim(), createdAt: new Date().toISOString(), createdBy: currentUser() });
    setReason('');
    showToast('Decisión técnica registrada.');
  };
  if (!players.length) return null;
  return <form className="card" onSubmit={submit}><SectionHeader eyebrow="Decisión" title="Registrar decisión técnica" /><div className="btn-row"><PlayerSelect players={players} value={playerId} onChange={setPlayerId} /><select className="select" value={decision} onChange={(e) => setDecision(e.target.value as TechnicalDecisionType)}>{decisionTypes.map((item) => <option key={item} value={item}>{decisionLabel[item]}</option>)}</select></div><textarea className="textarea" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de la decisión" /><button className="btn" type="submit" disabled={!canCreate}>Guardar decisión</button></form>;
}

export function TechnicalDecisionsPage() {
  const { data } = useApp();
  const playerName = (id: string) => data.players.find((player) => player.id === id)?.name ?? 'Jugador eliminado';
  const rows = [...(data.technicalDecisions ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <TechnicalShell permission="secretaria_tecnica.decisions.view">
      <QuickDecisionForm players={data.players} />
      <div className="card"><SectionHeader eyebrow="Trazabilidad" title="Decisiones técnicas" subtitle="Toda decisión queda registrada con motivo y usuario." />{rows.length ? <div className="table-wrapper"><table className="data-table"><thead><tr><th>Fecha</th><th>Jugador</th><th>Decisión</th><th>Motivo</th><th>Usuario</th></tr></thead><tbody>{rows.map((decision) => <tr key={decision.id}><td>{decision.createdAt.slice(0, 10)}</td><td><Link href={`/secretaria-tecnica/jugadores/${decision.playerId}`}>{playerName(decision.playerId)}</Link></td><td>{decisionLabel[decision.decision]}</td><td>{decision.reason}</td><td>{decision.createdBy}</td></tr>)}</tbody></table></div> : <EmptyState title="Sin decisiones" text="Registra decisiones para tener trazabilidad de seguimiento, prioridad, promoción o descarte." />}</div>
    </TechnicalShell>
  );
}

export function TechnicalPlayerDetailPage({ playerId }: { playerId: string }) {
  const { data, upsertTechnicalProfile } = useApp();
  const player = data.players.find((item) => item.id === playerId);
  const bundle = player ? getPlayerTechnicalBundle(data, player.id) : null;
  const canEditProfile = hasTechnicalSecretariatPermission(getStaffSession(), 'secretaria_tecnica.scouting.manage');
  const [gameProfile, setGameProfile] = useState(bundle?.profile?.gameProfile ?? '');
  const [strengths, setStrengths] = useState((bundle?.profile?.strengths ?? []).join(', '));
  const [weaknesses, setWeaknesses] = useState((bundle?.profile?.weaknesses ?? []).join(', '));
  const [generalNotes, setGeneralNotes] = useState(bundle?.profile?.generalNotes ?? '');
  const saveProfile = () => {
    if (!player || !canEditProfile) return;
    upsertTechnicalProfile({
      id: `profile-${player.id}`,
      playerId: player.id,
      mainPosition: player.position,
      secondaryPositions: player.secondaryPosition ? [player.secondaryPosition] : [],
      dominantFoot: player.dominantFoot === 'Izquierda' ? 'izquierda' : player.dominantFoot === 'Ambidiestro' ? 'ambas' : 'derecha',
      gameProfile,
      tacticalRole: bundle?.profile?.tacticalRole ?? '',
      strengths: strengths.split(',').map((item) => item.trim()).filter(Boolean),
      weaknesses: weaknesses.split(',').map((item) => item.trim()).filter(Boolean),
      projection: bundle?.profile?.projection ?? 'media',
      modelFit: bundle?.profile?.modelFit ?? 'medio',
      generalNotes,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser(),
    });
    showToast('Perfil técnico actualizado.');
  };

  if (!player || !bundle) {
    return <TechnicalShell permission="secretaria_tecnica.players.view"><div className="card"><EmptyState title="Jugador no encontrado" text="El jugador no existe o no tienes acceso a su categoría." /></div></TechnicalShell>;
  }

  return (
    <TechnicalShell permission="secretaria_tecnica.players.view">
      <div className="card player-card">
        <img src={player.photo || '/orsomarso-crest.jpg'} alt={player.name} loading="lazy" className="player-photo" />
        <div>
          <span className="section-eyebrow">Ficha técnica</span>
          <h2 style={{ margin: '2px 0 4px' }}>{player.name}</h2>
          <div className="muted-line">{player.position} · {categoryLabel(player.category)} · {calcAge(player.birthDate) ?? player.age} años · {player.dominantFoot ?? 'Pie sin definir'}</div>
          <div className="btn-row" style={{ marginTop: 12 }}><StatusBadge text={bundle.followUp ? scoutStatusLabel[bundle.followUp.status] : 'Sin seguimiento'} tone={statusToneForScout(bundle.followUp?.status)} /><StatusBadge text={formatSelectionCall(bundle.latestSelection)} tone={bundle.latestSelection ? 'green' : 'neutral'} /><StatusBadge text={bundle.primaryLocation?.municipality || bundle.primaryLocation?.department || 'Sin zona'} tone="blue" /></div>
        </div>
      </div>
      <div className="grid grid-4"><KpiCard label="Reportes" value={String(bundle.reports.length)} tone="blue" icon={<FileText size={18} />} trend={bundle.latestReport ? `${scoreAverage(bundle.latestReport).toFixed(1)} último score` : 'Sin reportes'} /><KpiCard label="Llamados selección" value={String(bundle.selections.length)} tone="green" icon={<Medal size={18} />} trend={formatSelectionCall(bundle.latestSelection)} /><KpiCard label="Decisiones" value={String(bundle.decisions.length)} tone="amber" icon={<ClipboardList size={18} />} trend={bundle.latestDecision ? decisionLabel[bundle.latestDecision.decision] : 'Sin decisiones'} /><KpiCard label="Captación" value={bundle.primaryLocation?.municipality || bundle.primaryLocation?.department || '—'} tone="dark" icon={<MapPinned size={18} />} trend={bundle.primaryLocation ? captureSourceLabel[bundle.primaryLocation.captureSource] : 'Sin zona'} /></div>
      <div className="grid grid-2"><div className="card"><SectionHeader eyebrow="Perfil" title="Perfil técnico" subtitle="Información propia de Secretaría Técnica." /><input className="input" value={gameProfile} onChange={(e) => setGameProfile(e.target.value)} placeholder="Perfil de juego" /><input className="input" value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Fortalezas separadas por coma" /><input className="input" value={weaknesses} onChange={(e) => setWeaknesses(e.target.value)} placeholder="Aspectos por mejorar separados por coma" /><textarea className="textarea" rows={4} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Observaciones generales" /><button className="btn" type="button" onClick={saveProfile} disabled={!canEditProfile}>Guardar perfil técnico</button></div><div className="card"><SectionHeader eyebrow="Resumen" title="Últimas señales" /><div className="compact-info-list"><div><span>Último reporte</span><strong>{bundle.latestReport ? `${bundle.latestReport.date} · ${recommendationLabel[bundle.latestReport.recommendation]}` : 'Sin reporte'}</strong></div><div><span>Estado scout</span><strong>{bundle.followUp ? scoutStatusLabel[bundle.followUp.status] : 'Sin seguimiento'}</strong></div><div><span>Último llamado</span><strong>{formatSelectionCall(bundle.latestSelection)}</strong></div><div><span>Zona captación</span><strong>{bundle.primaryLocation?.municipality || bundle.primaryLocation?.department || 'Sin zona asignada'}</strong></div><div><span>Disponibilidad</span><strong>{player.status}</strong></div></div></div></div>
      <div className="grid grid-2"><div className="card"><SectionHeader eyebrow="Reportes" title="Historial técnico" />{bundle.reports.length ? <div className="table-wrapper"><table className="data-table"><thead><tr><th>Fecha</th><th>Score</th><th>Recomendación</th><th>Resumen</th></tr></thead><tbody>{bundle.reports.map((report) => <tr key={report.id}><td>{report.date}</td><td>{scoreAverage(report).toFixed(1)}</td><td>{recommendationLabel[report.recommendation]}</td><td>{report.summary}</td></tr>)}</tbody></table></div> : <EmptyState title="Sin reportes técnicos" />}</div><div className="card"><SectionHeader eyebrow="Selecciones" title="Historial de llamados" />{bundle.selections.length ? <div className="table-wrapper"><table className="data-table"><thead><tr><th>Fecha</th><th>Selección</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>{bundle.selections.map((call) => <tr key={call.id}><td>{call.startDate}</td><td>{call.selectionName} {call.category}</td><td>{selectionTypeLabel[call.callType]}</td><td>{selectionStatusLabel[call.status]}</td></tr>)}</tbody></table></div> : <EmptyState title="Sin llamados a selección" />}</div></div>
      <div className="card"><SectionHeader eyebrow="Decisiones" title="Historial de decisiones técnicas" />{bundle.decisions.length ? <div className="table-wrapper"><table className="data-table"><thead><tr><th>Fecha</th><th>Decisión</th><th>Motivo</th><th>Usuario</th></tr></thead><tbody>{bundle.decisions.map((decision) => <tr key={decision.id}><td>{decision.createdAt.slice(0, 10)}</td><td>{decisionLabel[decision.decision]}</td><td>{decision.reason}</td><td>{decision.createdBy}</td></tr>)}</tbody></table></div> : <EmptyState title="Sin decisiones técnicas" />}</div>
    </TechnicalShell>
  );
}
