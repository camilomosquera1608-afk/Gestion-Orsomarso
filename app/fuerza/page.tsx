'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Dumbbell, Plus, Printer, Save, Trash2, Users } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge, showToast } from '@/components/pro-ui';
import { BodyMapSelector } from '@/components/body-map-selector';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import type { ClubCategory, Player, StrengthCompletion, StrengthExerciseDesign, StrengthGroup, StrengthPlayerAdjustment, StrengthPlayerResponse, StrengthMicrodoseIntent, StrengthMovementPattern, StrengthSession, StrengthSessionType, StrengthZone } from '@/lib/types';
import { getPlannedPlayerIds, groupPlayerHint, rpeDiffLabel, plannedStrengthReps, plannedStrengthSeries, strengthDecision, strengthExerciseId, strengthId, strengthLoad, strengthResponseId, microdoseIntentHint, movementPatternHint, STRENGTH_EXERCISE_PRESETS, STRENGTH_GROUPS, STRENGTH_MICRODOSE_INTENTS, STRENGTH_MOVEMENT_PATTERNS, STRENGTH_TYPES, STRENGTH_ZONE_GROUPS } from '@/lib/strength';
import { getCanonicalPlayers } from '@/lib/relational-data';

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
    zone: 'Cadena posterior' as StrengthZone,
    intent: 'Activación' as StrengthMicrodoseIntent,
    movementPattern: 'Aceleración' as StrengthMovementPattern,
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
  const [exerciseDraft, setExerciseDraft] = useState({ name: '', zone: 'Cadena posterior' as StrengthZone, movementPattern: 'Aceleración' as StrengthMovementPattern, sets: 3, reps: '', load: '', rest: '', note: '' });
  const [exercises, setExercises] = useState<StrengthExerciseDesign[]>([]);
  const [responsesDraft, setResponsesDraft] = useState<Record<string, Partial<StrengthPlayerResponse>>>({});

  const visiblePlayers = useMemo(
    () =>
      getCanonicalPlayers(
        data,
        data.players.filter((p) => category === 'all' || p.category === category),
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [data, category],
  );
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
      intent: form.intent,
      movementPattern: form.movementPattern,
      duration: Number(form.duration) || 0,
      expectedRpe: Number(form.expectedRpe) || 0,
      objective: form.objective,
      restrictions: form.restrictions,
      playerIds,
      excludedPlayerIds: [],
      exercises,
      adjustments,
      responses: [],
      createdBy: staff.email ?? staff.displayName ?? 'Staff',
      createdAt: new Date().toISOString(),
      status: 'Planificada',
    };
    upsertStrengthSession(record);
    setSelectedSessionId(record.id);
    setAdjustments([]);
    setExercises([]);
    showToast('Sesión de fuerza planificada.', 'green');
  };

  const printSelectedSession = () => {
    if (!selectedSession) return;
    if (typeof window !== 'undefined') window.print();
  };

  const addAdjustment = () => {
    if (!adjustPlayerId || (!adjustNote && !adjustRestriction && !adjustRpe)) return;
    setAdjustments((prev) => [{ playerId: adjustPlayerId, note: adjustNote, expectedRpe: adjustRpe ? Number(adjustRpe) : undefined, restriction: adjustRestriction }, ...prev.filter((a) => a.playerId !== adjustPlayerId)]);
    setAdjustPlayerId(''); setAdjustNote(''); setAdjustRpe(''); setAdjustRestriction('');
  };



  const addExercise = () => {
    if (!exerciseDraft.name.trim()) return;
    setExercises((prev) => [{
      id: strengthExerciseId(),
      name: exerciseDraft.name.trim(),
      zone: exerciseDraft.zone,
      sets: Number(exerciseDraft.sets) || undefined,
      reps: exerciseDraft.reps.trim(),
      load: exerciseDraft.load.trim(),
      movementPattern: exerciseDraft.movementPattern,
      rest: exerciseDraft.rest.trim(),
      note: exerciseDraft.note.trim(),
    }, ...prev]);
    setExerciseDraft({ name: '', zone: exerciseDraft.zone, movementPattern: exerciseDraft.movementPattern, sets: 3, reps: '', load: '', rest: '', note: '' });
  };

  const loadExercisePreset = () => {
    const preset = STRENGTH_EXERCISE_PRESETS[form.type] ?? [];
    setExercises(preset.map((item) => ({ ...item, id: strengthExerciseId() })));
    showToast(`Plantilla ${form.type.toLowerCase()} cargada. Puedes editarla antes de guardar.`, 'green');
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
  const plannedSeries = selectedSession ? plannedStrengthSeries(selectedSession.exercises ?? []) : 0;
  const plannedReps = selectedSession ? plannedStrengthReps(selectedSession.exercises ?? []) : 0;
  
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
        <KpiCard label="Sesiones planificadas" value={String(sessions.length)} tone={sessions.length ? 'green' : 'amber'} trend="Fuerza del día" icon={<Dumbbell size={18} />} />
        <KpiCard label="Respuestas" value={`${responsePct}%`} tone={responsePct >= 80 ? 'green' : responsePct >= 50 ? 'amber' : 'red'} trend={`${plannedResponses.length}/${plannedIds.length || 0} jugadores`} />
        <KpiCard label="RPE +2 o más" value={String(highDiff)} tone={highDiff ? 'amber' : 'green'} trend="Más exigente de lo esperado" />
        <KpiCard label="Dolor post fuerza" value={String(painCount)} tone={painCount ? 'red' : 'green'} trend="Reportado en respuesta rápida" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Antes del gimnasio" title="Planificar sesión de fuerza" subtitle="La llena el cuerpo técnico/PF. Los jugadores no planifican; solo responden percepción post sesión." />
          <div className="grid form-grid">
            <label>Grupo<select className="select" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value as StrengthGroup })}>{STRENGTH_GROUPS.map((g) => <option key={g}>{g}</option>)}</select><small>{groupPlayerHint(form.group)}</small></label>
            <label>Tipo<select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as StrengthSessionType })}>{STRENGTH_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <div className="span-2">
              <div className="field-label">Zona principal</div>
              <div className="zone-choice-grid">
                {STRENGTH_ZONE_GROUPS.map((group) => (
                  <div key={group.label} className="zone-choice-group">
                    <div className="zone-choice-title">{group.label}</div>
                    <div className="zone-choice-options">
                      {group.options.map((z) => (
                        <button key={z} type="button" className={`choice-pill ${form.zone === z ? 'active' : ''}`} onClick={() => setForm({ ...form, zone: z })}>
                          {z}
                        </button>
                      ))}
                    </div>
                    <small>{group.hint}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="span-2">
              <div className="field-label">Intención de la microdosis</div>
              <div className="choice-grid compact-choice-grid">
                {STRENGTH_MICRODOSE_INTENTS.map((intent) => (
                  <button key={intent} type="button" className={`choice-pill ${form.intent === intent ? 'active' : ''}`} onClick={() => setForm({ ...form, intent })}>{intent}</button>
                ))}
              </div>
              <small className="muted">{microdoseIntentHint(form.intent)}</small>
            </div>
            <div className="span-2">
              <div className="field-label">Movimiento que prepara</div>
              <div className="choice-grid compact-choice-grid">
                {STRENGTH_MOVEMENT_PATTERNS.map((pattern) => (
                  <button key={pattern} type="button" className={`choice-pill ${form.movementPattern === pattern ? 'active' : ''}`} onClick={() => setForm({ ...form, movementPattern: pattern })}>{pattern}</button>
                ))}
              </div>
              <small className="muted">{movementPatternHint(form.movementPattern)}</small>
            </div>
            <label>Duración estimada<input className="input" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} /></label>
            <label>RPE esperado<input className="input" type="number" min={1} max={10} value={form.expectedRpe} onChange={(e) => setForm({ ...form, expectedRpe: Number(e.target.value) })} /></label>
            <label>Objetivo<input className="input" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Ej. compensatorio suplentes, recuperación titulares" /></label>
            <label className="span-2">Restricciones<textarea className="textarea" value={form.restrictions} onChange={(e) => setForm({ ...form, restrictions: e.target.value })} placeholder="Ej. sin reactiva, sin excéntrico isquio, no carga unilateral alta" /></label>
          </div>
          <div className="card inset-card">
            <SectionHeader eyebrow="Diseño de sesión" title="Ejercicios planificados" subtitle="El PF puede dejar la sesión diseñada antes de entrar al gimnasio: ejercicios, series, reps, carga y observaciones." />
            <div className="action-row">
              <button className="btn secondary" onClick={loadExercisePreset}>Cargar plantilla {form.type}</button>
              <span className="muted">{exercises.length} ejercicio(s) · {plannedStrengthSeries(exercises)} series · {plannedStrengthReps(exercises)} reps estimadas · {plannedStrengthSeries(exercises)} series planificadas</span>
            </div>
            <div className="grid form-grid">
              <label className="span-2">Ejercicio<input className="input" value={exerciseDraft.name} onChange={(e) => setExerciseDraft({ ...exerciseDraft, name: e.target.value })} placeholder="Ej. nórdico, sentadilla, pogos, core antirotación" /></label>
              <label>Zona<select className="select" value={exerciseDraft.zone} onChange={(e) => setExerciseDraft({ ...exerciseDraft, zone: e.target.value as StrengthZone })}>{STRENGTH_ZONE_GROUPS.flatMap((g) => g.options).map((z) => <option key={z}>{z}</option>)}</select></label>
              <label>Patrón<select className="select" value={exerciseDraft.movementPattern} onChange={(e) => setExerciseDraft({ ...exerciseDraft, movementPattern: e.target.value as StrengthMovementPattern })}>{STRENGTH_MOVEMENT_PATTERNS.map((pattern) => <option key={pattern}>{pattern}</option>)}</select></label>
              <label>Series<input className="input" type="number" value={exerciseDraft.sets} onChange={(e) => setExerciseDraft({ ...exerciseDraft, sets: Number(e.target.value) })} /></label>
              <label>Reps / tiempo<input className="input" value={exerciseDraft.reps} onChange={(e) => setExerciseDraft({ ...exerciseDraft, reps: e.target.value })} placeholder="Ej. 4-6, 30s" /></label>
              <label>Carga<input className="input" value={exerciseDraft.load} onChange={(e) => setExerciseDraft({ ...exerciseDraft, load: e.target.value })} placeholder="Ej. 70%, RPE 6, bajo" /></label>
              <label>Descanso<input className="input" value={exerciseDraft.rest} onChange={(e) => setExerciseDraft({ ...exerciseDraft, rest: e.target.value })} placeholder="Ej. 60-90s" /></label>
              <label className="span-2">Nota<input className="input" value={exerciseDraft.note} onChange={(e) => setExerciseDraft({ ...exerciseDraft, note: e.target.value })} placeholder="Criterio técnico, restricción o foco de ejecución" /></label>
            </div>
            <button className="btn secondary" onClick={addExercise}><Plus size={16} /> Agregar ejercicio</button>
            {exercises.length ? <div className="table-scroll"><table className="pro-table"><thead><tr><th>Ejercicio</th><th>Zona</th><th>Series</th><th>Reps</th><th>Carga</th><th>Patrón</th><th>Descanso</th><th>Nota</th><th></th></tr></thead><tbody>
              {exercises.map((exercise) => <tr key={exercise.id}><td><strong>{exercise.name}</strong></td><td>{exercise.zone}</td><td>{exercise.sets ?? '—'}</td><td>{exercise.reps || '—'}</td><td>{exercise.load || '—'}</td><td>{exercise.movementPattern || '—'}</td><td>{exercise.rest || '—'}</td><td>{exercise.note || '—'}</td><td><button className="btn tiny ghost" onClick={() => setExercises((prev) => prev.filter((item) => item.id !== exercise.id))}>Quitar</button></td></tr>)}
            </tbody></table></div> : <div className="soft-alert">Aún no has agregado ejercicios. Puedes guardar solo la intención general o cargar una plantilla rápida.</div>}
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
                <div><strong>{s.group}</strong><br /><small>{s.type} · {s.intent ?? 'Microdosis'} · {s.movementPattern ?? s.zone} · {s.duration} min · RPE esp. {s.expectedRpe} · {(s.exercises ?? []).length} ej.</small></div>
                <StatusBadge text={`${resp}/${planned}`} tone={resp >= planned && planned ? 'green' : 'amber'} />
              </button>;
            })}
          </div>
          {selectedSession ? <div className="action-row no-print"><button className="btn secondary" onClick={printSelectedSession}><Printer size={16} /> Imprimir sesión</button><button className="btn danger ghost" onClick={() => { const id = selectedSession.id; deleteStrengthSession(id); setSelectedSessionId(''); setResponsesDraft({}); showToast('Sesión de fuerza eliminada también de Supabase.', 'amber'); }}><Trash2 size={16} /> Eliminar seleccionada</button></div> : null}
        </div>
      </div>

      {selectedSession ? (
        <div className="card">
          <SectionHeader
            eyebrow="Después del gimnasio"
            title={`Respuesta rápida · ${selectedSession.group}`}
            subtitle={`Planificado: ${selectedSession.type} · ${selectedSession.intent ?? 'Microdosis'} · ${selectedSession.movementPattern ?? selectedSession.zone} · ${selectedSession.duration} min · RPE esperado ${selectedSession.expectedRpe} · carga planificada ${plannedLoad} UA · ${plannedSeries} series · ${plannedReps} reps est.`}
          />
          {(selectedSession.exercises ?? []).length ? <div className="card inset-card">
            <SectionHeader eyebrow="Diseño ejecutado" title="Ejercicios planificados por el PF" subtitle="Referencia para que el staff compare lo planeado con la percepción post fuerza." />
            <div className="table-scroll"><table className="pro-table"><thead><tr><th>Ejercicio</th><th>Zona</th><th>Series</th><th>Reps</th><th>Carga</th><th>Patrón</th><th>Descanso</th><th>Nota</th></tr></thead><tbody>
              {(selectedSession.exercises ?? []).map((exercise) => <tr key={exercise.id}><td><strong>{exercise.name}</strong></td><td>{exercise.zone}</td><td>{exercise.sets ?? '—'}</td><td>{exercise.reps || '—'}</td><td>{exercise.load || '—'}</td><td>{exercise.movementPattern || '—'}</td><td>{exercise.rest || '—'}</td><td>{exercise.note || '—'}</td></tr>)}
            </tbody></table></div>
          </div> : null}
          <div className="print-strength-sheet card inset-card">
            <div className="print-header">
              <div>
                <h1>Sesión de fuerza</h1>
                <p>{selectedSession.date} · {selectedSession.category ?? categoryLabel(category === 'all' ? 'Sub20' : category)} · {selectedSession.group}</p>
              </div>
              <div className="print-meta"><strong>{selectedSession.type}</strong><br />{selectedSession.intent ?? 'Microdosis'} · {selectedSession.movementPattern ?? selectedSession.zone}</div>
            </div>
            <div className="print-grid">
              <div><strong>Zona:</strong> {selectedSession.zone}</div>
              <div><strong>Duración:</strong> {selectedSession.duration} min</div>
              <div><strong>RPE esperado:</strong> {selectedSession.expectedRpe}</div>
              <div><strong>Carga planificada:</strong> {plannedLoad} UA</div>
            </div>
            <p><strong>Objetivo:</strong> {selectedSession.objective || '—'}</p>
            <p><strong>Restricciones:</strong> {selectedSession.restrictions || '—'}</p>
            <table className="print-table"><thead><tr><th>Ejercicio</th><th>Zona</th><th>Patrón</th><th>Series</th><th>Reps/tiempo</th><th>Carga</th><th>Descanso</th><th>Nota técnica</th></tr></thead><tbody>
              {(selectedSession.exercises ?? []).map((exercise) => <tr key={exercise.id}><td>{exercise.name}</td><td>{exercise.zone || '—'}</td><td>{exercise.movementPattern || '—'}</td><td>{exercise.sets ?? '—'}</td><td>{exercise.reps || '—'}</td><td>{exercise.load || '—'}</td><td>{exercise.rest || '—'}</td><td>{exercise.note || '—'}</td></tr>)}
              {!(selectedSession.exercises ?? []).length ? <tr><td colSpan={8}>Sesión sin ejercicios detallados.</td></tr> : null}
            </tbody></table>
            {(selectedSession.adjustments ?? []).length ? <><h2>Ajustes individuales</h2><table className="print-table"><thead><tr><th>Jugador</th><th>RPE ind.</th><th>Restricción</th><th>Nota</th></tr></thead><tbody>{(selectedSession.adjustments ?? []).map((a) => <tr key={a.playerId}><td>{getName(visiblePlayers, a.playerId)}</td><td>{a.expectedRpe ?? '—'}</td><td>{a.restriction || '—'}</td><td>{a.note || '—'}</td></tr>)}</tbody></table></> : null}
            <p className="print-note">Uso: ejecutar la microdosis según calidad técnica, intención del movimiento y respuesta del jugador. Al terminar, registrar RPE post fuerza.</p>
          </div>
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
                <td>
                  <div className="rpe-quick-grid" aria-label="RPE fuerza rápido">
                    {[1,2,3,4,5,6,7,8,9,10].map((score) => (
                      <button key={score} type="button" className={`rpe-pill ${rpe === score ? 'active' : ''}`} onClick={() => setDraft(playerId, { rpe: score })}>{score}</button>
                    ))}
                  </div>
                </td>
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
        {selectedSession ? <><div className="grid grid-4 strength-load-summary">
          <KpiCard label="Carga planificada" value={`${plannedLoad} UA`} tone="blue" trend="Duración × RPE esp. × factor" />
          <KpiCard label="Series" value={String(plannedSeries)} tone={plannedSeries ? 'green' : 'amber'} trend="Volumen de microdosis" />
          <KpiCard label="Reps estimadas" value={String(plannedReps)} tone={plannedReps ? 'green' : 'amber'} trend="Primer valor de reps por ejercicio" />
          <KpiCard label="Movimiento" value={selectedSession.movementPattern ?? selectedSession.zone} tone="blue" trend={selectedSession.intent ?? 'Microdosis'} />
        </div><div className="insight-list compact">
          {plannedResponses.length ? plannedResponses.map((r) => {
            const diff = rpeDiffLabel(selectedSession.expectedRpe, r.rpe);
            return <div key={r.id} className={diff.tone === 'red' ? 'danger-row' : ''}><strong>{getName(visiblePlayers, r.playerId)}:</strong> RPE esperado {selectedSession.expectedRpe}, real {r.rpe}, carga percibida {strengthLoad(selectedSession.duration, r.rpe, selectedSession.type)} UA. {diff.text} {r.pain ? `Dolor: ${r.painRegion ?? 'sin zona'} ${r.painIntensity ?? ''}/10.` : ''}</div>;
          }) : <div className="soft-alert warning"><AlertTriangle size={16} /> Aún no hay respuestas post fuerza.</div>}
        </div></> : <div className="soft-alert"><CheckCircle2 size={16} /> Selecciona una sesión para ver análisis.</div>}
      </div>
    </div>
  );
}
