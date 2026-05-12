'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Dumbbell, Save, Trash2, Users } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge, showToast } from '@/components/pro-ui';
import { BodyMapSelector } from '@/components/body-map-selector';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import type { ClubCategory, Player, StrengthCompletion, StrengthGroup, StrengthPlayerAdjustment, StrengthPlayerResponse, StrengthSession, StrengthSessionType, StrengthZone } from '@/lib/types';
import { getPlannedPlayerIds, groupPlayerHint, rpeDiffLabel, strengthDecision, strengthId, strengthLoad, strengthResponseId, STRENGTH_GROUPS, STRENGTH_TYPES, STRENGTH_ZONES } from '@/lib/strength';

const categories: Array<ClubCategory | 'all'> = ['all', 'Sub20', 'Sub17', 'Sub15'];
const todayInput = () => new Date().toISOString().slice(0, 10);
const getName = (players: Player[], id: string) => players.find((p) => p.id === id)?.name ?? 'Jugador';
const toneForDecision = (text: string) => text.includes('Dolor') || text.includes('No completó') || text.includes('Control preventivo') ? 'amber' as const : 'green' as const;

const playersForGroup = (group: StrengthGroup, players: Player[]) => {
  if (group === 'Retorno/readaptación') return players.filter((p) => p.status === 'Readaptación' || p.competitiveRole === 'Retorno a competencia');
  return players;
};

export default function FuerzaPage() {
  const { data, filters, upsertStrengthSession, updateStrengthResponse, deleteStrengthSession } = useApp();
  const staff = getStaffSession();
  const activeCategory = isMasterRole(staff) ? filters.category : staff.category;
  const [category, setCategory] = useState<ClubCategory | 'all'>((activeCategory === 'all' ? 'all' : activeCategory) as ClubCategory | 'all');
  const [date, setDate] = useState(filters.date || todayInput());
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [showBodyMapFor, setShowBodyMapFor] = useState<string>('');
  const [form, setForm] = useState({
    group: 'Todo el plantel' as StrengthGroup,
    type: 'Concéntrica' as StrengthSessionType,
    zone: 'Tren inferior' as StrengthZone,
    duration: 30,
    expectedRpe: 5,
    objective: '',
    restrictions: '',
  });
  const [adjustPlayerId, setAdjustPlayerId] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustRpe, setAdjustRpe] = useState('');
  const [adjustRestriction, setAdjustRestriction] = useState('');
  const [adjustments, setAdjustments] = useState<StrengthPlayerAdjustment[]>([]);
  const [responsesDraft, setResponsesDraft] = useState<Record<string, Partial<StrengthPlayerResponse>>>({});

  const visiblePlayers = useMemo(() => data.players.filter((p) => category === 'all' || p.category === category).sort((a, b) => a.name.localeCompare(b.name)), [data.players, category]);
  const sessions = useMemo(() => (data.strengthSessions ?? []).filter((s) => s.date === date && (category === 'all' || s.category === category)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data.strengthSessions, date, category]);
  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? sessions[0];
  const plannedIds = selectedSession ? getPlannedPlayerIds(selectedSession, visiblePlayers) : [];
  const plannedResponses = selectedSession?.responses ?? [];
  const responsePct = plannedIds.length ? Math.round((plannedResponses.length / plannedIds.length) * 100) : 0;
  const highDiff = plannedResponses.filter((r) => (r.rpe - (selectedSession?.expectedRpe ?? 0)) >= 2).length;
  const painCount = plannedResponses.filter((r) => r.pain).length;

  const createSession = () => {
    const playerIds = playersForGroup(form.group, visiblePlayers).map((p) => p.id);
    const record: StrengthSession = {
      id: strengthId(),
      date,
      category: category === 'all' ? 'Sub20' : category,
      group: form.group,
      type: form.type,
      zone: form.zone,
      duration: Number(form.duration) || 0,
      expectedRpe: Number(form.expectedRpe) || 0,
      objective: form.objective,
      restrictions: form.restrictions,
      playerIds,
      excludedPlayerIds: [],
      adjustments,
      responses: [],
      createdBy: staff.email ?? staff.displayName ?? 'Staff',
      createdAt: new Date().toISOString(),
      status: 'Planificada',
    };
    upsertStrengthSession(record);
    setSelectedSessionId(record.id);
    setAdjustments([]);
    showToast('Sesión de fuerza planificada.', 'green');
  };

  const addAdjustment = () => {
    if (!adjustPlayerId || (!adjustNote && !adjustRestriction && !adjustRpe)) return;
    setAdjustments((prev) => [{ playerId: adjustPlayerId, note: adjustNote, expectedRpe: adjustRpe ? Number(adjustRpe) : undefined, restriction: adjustRestriction }, ...prev.filter((a) => a.playerId !== adjustPlayerId)]);
    setAdjustPlayerId(''); setAdjustNote(''); setAdjustRpe(''); setAdjustRestriction('');
  };

  const saveResponse = (playerId: string) => {
    if (!selectedSession) return;
    const existing = selectedSession.responses?.find((r) => r.playerId === playerId);
    const draft = responsesDraft[playerId] ?? existing ?? {};
    const response: StrengthPlayerResponse = {
      id: existing?.id ?? strengthResponseId(),
      sessionId: selectedSession.id,
      playerId,
      rpe: Number(draft.rpe ?? existing?.rpe ?? selectedSession.expectedRpe) || 0,
      completed: (draft.completed ?? existing?.completed ?? 'Completa') as StrengthCompletion,
      pain: Boolean(draft.pain ?? existing?.pain ?? false),
      painRegion: draft.painRegion ?? existing?.painRegion,
      painIntensity: draft.painIntensity !== undefined ? Number(draft.painIntensity) : existing?.painIntensity,
      painType: (draft.painType ?? existing?.painType ?? 'Fatiga') as StrengthPlayerResponse['painType'],
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    updateStrengthResponse(selectedSession.id, response);
    showToast(`Respuesta de ${getName(data.players, playerId)} guardada.`, 'green');
  };

  const setDraft = (playerId: string, patch: Partial<StrengthPlayerResponse>) => setResponsesDraft((prev) => ({ ...prev, [playerId]: { ...(prev[playerId] ?? {}), ...patch } }));
  const plannedLoad = selectedSession ? strengthLoad(selectedSession.duration, selectedSession.expectedRpe, selectedSession.type) : 0;

  return (
    <div className="grid fuerza-page">
      <AppHero heroClass="hero-carga" title="Fuerza" subtitle="Planificación por staff, respuesta rápida post gimnasio y comparación entre carga esperada y percibida." />
      <GlobalFiltersBar />

      <div className="toolbar card">
        <div className="grid form-grid">
          <label>Categoría<select className="select" value={category} onChange={(e) => setCategory(e.target.value as ClubCategory | 'all')}>{categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'Todas' : categoryLabel(c)}</option>)}</select></label>
          <label>Fecha<input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
      </div>

      <div className="grid grid-4">
        <KpiCard label="Sesiones planificadas" value={sessions.length} tone={sessions.length ? 'green' : 'amber'} trend="Fuerza del día" icon={<Dumbbell size={18} />} />
        <KpiCard label="Respuestas" value={`${responsePct}%`} tone={responsePct >= 80 ? 'green' : responsePct >= 50 ? 'amber' : 'red'} trend={`${plannedResponses.length}/${plannedIds.length || 0} jugadores`} />
        <KpiCard label="RPE +2 o más" value={highDiff} tone={highDiff ? 'amber' : 'green'} trend="Más exigente de lo esperado" />
        <KpiCard label="Dolor post fuerza" value={painCount} tone={painCount ? 'red' : 'green'} trend="Reportado en respuesta rápida" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Antes del gimnasio" title="Planificar sesión de fuerza" subtitle="La llena el cuerpo técnico/PF. Los jugadores no planifican; solo responden percepción post sesión." />
          <div className="grid form-grid">
            <label>Grupo<select className="select" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value as StrengthGroup })}>{STRENGTH_GROUPS.map((g) => <option key={g}>{g}</option>)}</select><small>{groupPlayerHint(form.group)}</small></label>
            <label>Tipo<select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as StrengthSessionType })}>{STRENGTH_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Zona principal<select className="select" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value as StrengthZone })}>{STRENGTH_ZONES.map((z) => <option key={z}>{z}</option>)}</select></label>
            <label>Duración estimada<input className="input" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} /></label>
            <label>RPE esperado<input className="input" type="number" min={1} max={10} value={form.expectedRpe} onChange={(e) => setForm({ ...form, expectedRpe: Number(e.target.value) })} /></label>
            <label>Objetivo<input className="input" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Ej. compensatorio suplentes, recuperación titulares" /></label>
            <label className="span-2">Restricciones<textarea className="textarea" value={form.restrictions} onChange={(e) => setForm({ ...form, restrictions: e.target.value })} placeholder="Ej. sin reactiva, sin excéntrico isquio, no carga unilateral alta" /></label>
          </div>
          <div className="soft-alert"><Users size={16} /> Se incluirán {playersForGroup(form.group, visiblePlayers).length} jugadores visibles. Puedes agregar ajustes individuales antes de guardar.</div>
          <div className="card inset-card">
            <SectionHeader eyebrow="Individualización" title="Ajustes puntuales" subtitle="Opcional: excepciones dentro del grupo." />
            <div className="grid form-grid">
              <label>Jugador<select className="select" value={adjustPlayerId} onChange={(e) => setAdjustPlayerId(e.target.value)}><option value="">Seleccionar</option>{visiblePlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label>RPE esperado individual<input className="input" type="number" value={adjustRpe} onChange={(e) => setAdjustRpe(e.target.value)} placeholder="Opcional" /></label>
              <label>Nota<input className="input" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="Ej. reducir volumen" /></label>
              <label>Restricción<input className="input" value={adjustRestriction} onChange={(e) => setAdjustRestriction(e.target.value)} placeholder="Ej. sin isquios" /></label>
            </div>
            <button className="btn secondary" onClick={addAdjustment}>Agregar ajuste</button>
            {adjustments.length ? <div className="tag-list">{adjustments.map((a) => <span key={a.playerId} className="tag">{getName(visiblePlayers, a.playerId)} · {a.restriction || a.note || `RPE ${a.expectedRpe}`}</span>)}</div> : null}
          </div>
          <button className="btn" onClick={createSession}><Save size={16} /> Guardar planificación</button>
        </div>

        <div className="card">
          <SectionHeader eyebrow="Planificaciones del día" title="Sesiones de fuerza" subtitle="Selecciona una sesión para cargar respuestas post gimnasio." />
          {!sessions.length ? <EmptyState title="Sin sesiones de fuerza" text="Planifica una sesión para iniciar el seguimiento." /> : null}
          <div className="stack-list">
            {sessions.map((s) => {
              const planned = getPlannedPlayerIds(s, visiblePlayers).length;
              const resp = s.responses?.length ?? 0;
              return <button key={s.id} className={`list-card ${selectedSession?.id === s.id ? 'selected' : ''}`} onClick={() => setSelectedSessionId(s.id)}>
                <div><strong>{s.group}</strong><br /><small>{s.type} · {s.zone} · {s.duration} min · RPE esp. {s.expectedRpe}</small></div>
                <StatusBadge text={`${resp}/${planned}`} tone={resp >= planned && planned ? 'green' : 'amber'} />
              </button>;
            })}
          </div>
          {selectedSession ? <button className="btn danger ghost" onClick={() => { deleteStrengthSession(selectedSession.id); showToast('Sesión de fuerza eliminada.', 'amber'); }}><Trash2 size={16} /> Eliminar seleccionada</button> : null}
        </div>
      </div>

      {selectedSession ? (
        <div className="card">
          <SectionHeader
            eyebrow="Después del gimnasio"
            title={`Respuesta rápida · ${selectedSession.group}`}
            subtitle={`Planificado: ${selectedSession.type} · ${selectedSession.zone} · ${selectedSession.duration} min · RPE esperado ${selectedSession.expectedRpe} · carga planificada ${plannedLoad} UA`}
          />
          <div className="table-scroll"><table className="pro-table"><thead><tr><th>Jugador</th><th>RPE fuerza</th><th>Completó</th><th>Dolor</th><th>Dif.</th><th>Carga percibida</th><th>Decisión</th><th></th></tr></thead><tbody>
            {plannedIds.map((playerId) => {
              const existing = selectedSession.responses?.find((r) => r.playerId === playerId);
              const draft = responsesDraft[playerId] ?? existing ?? {};
              const rpe = Number(draft.rpe ?? existing?.rpe ?? selectedSession.expectedRpe);
              const completed = (draft.completed ?? existing?.completed ?? 'Completa') as StrengthCompletion;
              const pain = Boolean(draft.pain ?? existing?.pain ?? false);
              const diff = rpeDiffLabel(selectedSession.expectedRpe, rpe);
              const load = strengthLoad(selectedSession.duration, rpe, selectedSession.type);
              const decision = strengthDecision(selectedSession, rpe, completed, pain);
              return <tr key={playerId}>
                <td><strong>{getName(visiblePlayers, playerId)}</strong></td>
                <td><input className="input small" type="number" min={1} max={10} value={rpe} onChange={(e) => setDraft(playerId, { rpe: Number(e.target.value) })} /></td>
                <td><select className="select small" value={completed} onChange={(e) => setDraft(playerId, { completed: e.target.value as StrengthCompletion })}><option>Completa</option><option>Parcial</option><option>No completó</option></select></td>
                <td><label className="inline-check"><input type="checkbox" checked={pain} onChange={(e) => { setDraft(playerId, { pain: e.target.checked }); if (e.target.checked) setShowBodyMapFor(playerId); }} /> Sí</label>{pain ? <button className="btn tiny secondary" onClick={() => setShowBodyMapFor(showBodyMapFor === playerId ? '' : playerId)}>Zona</button> : null}</td>
                <td><StatusBadge text={diff.label} tone={diff.tone} /></td>
                <td>{load} UA</td>
                <td><StatusBadge text={decision.includes('Compatible') ? 'Compatible' : 'Revisar'} tone={toneForDecision(decision)} /><br /><small>{decision}</small></td>
                <td><button className="btn tiny" onClick={() => saveResponse(playerId)}>Guardar</button></td>
              </tr>;
            })}
          </tbody></table></div>
          {showBodyMapFor ? <div className="card inset-card">
            <SectionHeader eyebrow="Mapa corporal" title={`Dolor o molestia · ${getName(visiblePlayers, showBodyMapFor)}`} subtitle="Solo aparece si el jugador reporta dolor/molestia post fuerza." />
            <BodyMapSelector value={String((responsesDraft[showBodyMapFor]?.painRegion ?? selectedSession.responses?.find((r) => r.playerId === showBodyMapFor)?.painRegion) ?? '')} onChange={(region) => setDraft(showBodyMapFor, { painRegion: region })} />
            <div className="grid form-grid">
              <label>Intensidad 0-10<input className="input" type="number" min={0} max={10} value={Number(responsesDraft[showBodyMapFor]?.painIntensity ?? selectedSession.responses?.find((r) => r.playerId === showBodyMapFor)?.painIntensity ?? 0)} onChange={(e) => setDraft(showBodyMapFor, { painIntensity: Number(e.target.value) })} /></label>
              <label>Tipo<select className="select" value={String(responsesDraft[showBodyMapFor]?.painType ?? selectedSession.responses?.find((r) => r.playerId === showBodyMapFor)?.painType ?? 'Fatiga')} onChange={(e) => setDraft(showBodyMapFor, { painType: e.target.value as StrengthPlayerResponse['painType'] })}><option>Fatiga</option><option>Molestia</option><option>Dolor</option></select></label>
            </div>
          </div> : null}
        </div>
      ) : null}

      <div className="card">
        <SectionHeader eyebrow="Análisis" title="Planificado vs percibido" subtitle="La app compara intención del staff con respuesta real para ajustar carga de campo o próxima fuerza." />
        {selectedSession ? <div className="insight-list compact">
          {plannedResponses.length ? plannedResponses.map((r) => {
            const diff = rpeDiffLabel(selectedSession.expectedRpe, r.rpe);
            return <div key={r.id} className={diff.tone === 'red' ? 'danger-row' : ''}><strong>{getName(visiblePlayers, r.playerId)}:</strong> RPE esperado {selectedSession.expectedRpe}, real {r.rpe}, carga percibida {strengthLoad(selectedSession.duration, r.rpe, selectedSession.type)} UA. {diff.text} {r.pain ? `Dolor: ${r.painRegion ?? 'sin zona'} ${r.painIntensity ?? ''}/10.` : ''}</div>;
          }) : <div className="soft-alert warning"><AlertTriangle size={16} /> Aún no hay respuestas post fuerza.</div>}
        </div> : <div className="soft-alert"><CheckCircle2 size={16} /> Selecciona una sesión para ver análisis.</div>}
      </div>
    </div>
  );
}
