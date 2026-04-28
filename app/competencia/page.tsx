'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { KpiCard } from '@/components/kpi-card';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { ClubCategory, InjuryKind, MovementType } from '@/lib/types';
import { groupAverage } from '@/lib/utils';

const categories: ClubCategory[] = ['Sub15', 'Sub17', 'Sub20'];
const competitionsByCategory: Record<ClubCategory, string[]> = {
  Sub20: ['Super copa juvenil'],
  Sub17: ['Liga vallecaucana Sub17', 'Torneo nacional Sub17'],
  Sub15: ['Liga vallecaucana Sub16', 'Torneo nacional Sub15'],
};
const medicalStates = ['Sin novedad', 'Fatigado', 'Molestia', 'Lesionado'];
const injuryKinds: InjuryKind[] = ['Muscular', 'Articular', 'Tendinosa', 'Ósea'];
const movementOptions: Array<{ value: MovementType; label: string }> = [
  { value: 'base', label: 'Categoría base' },
  { value: 'subio_a_competir', label: 'Subió a competir' },
  { value: 'bajo_a_competir', label: 'Bajó a competir' },
];

export default function CompetenciaPage() {
  const { data, filters, addCompetitionRecord, updateCompetitionRecord, deleteCompetitionRecord, setFilters } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = (master ? (filters.category === 'all' ? 'Sub20' : filters.category) : session.category) as ClubCategory;
  const youthSimple = activeCategory !== 'Sub20';
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState('');
  const [sourceCategory, setSourceCategory] = useState<ClubCategory>(activeCategory);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [showGroupReport, setShowGroupReport] = useState(false);

  const sourcePlayers = data.players.filter((player) => player.category === sourceCategory);
  const records = useMemo(
    () => data.competitionRecords.filter((record) => (record.category ?? record.actingCategory ?? activeCategory) === activeCategory).sort((a, b) => b.date.localeCompare(a.date)),
    [data.competitionRecords, activeCategory],
  );
  const editing = records.find((record) => record.id === editingId);

  useEffect(() => {
    if (editing?.playerId) {
      setSelectedPlayerId(editing.playerId);
      return;
    }
    if (!sourcePlayers.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId(sourcePlayers[0]?.id ?? '');
    }
  }, [sourceCategory, sourcePlayers, editing?.playerId, selectedPlayerId]);

  const currentPlayerId = editing?.playerId ?? selectedPlayerId ?? sourcePlayers[0]?.id ?? '';
  const currentPlayer = data.players.find((player) => player.id === currentPlayerId) ?? sourcePlayers[0];
  const isGoalkeeper = currentPlayer?.position === 'Portero';

  const selectedRecords = currentPlayerId ? records.filter((record) => record.playerId === currentPlayerId) : records;
  const uniqueMatches = Array.from(
    new Map(
      selectedRecords.map((record) => [
        `${record.date}|${record.competitionName ?? ''}|${record.opponent ?? ''}|${record.actingCategory ?? record.category ?? activeCategory}`,
        record,
      ]),
    ).values(),
  );
  const kpiMatches = uniqueMatches.length;
  const kpiMinutes = selectedRecords.length ? selectedRecords.reduce((acc, record) => acc + record.minutesPlayed, 0) : 0;
  const kpiGoals = selectedRecords.reduce((acc, record) => acc + (record.goals ?? 0), 0);
  const kpiAssists = selectedRecords.reduce((acc, record) => acc + (record.assists ?? 0), 0);
  const kpiGoalsConceded = selectedRecords.reduce((acc, record) => acc + (record.goalsConceded ?? 0), 0);
  const kpiGoalsPrevented = selectedRecords.reduce((acc, record) => acc + (record.goalsPrevented ?? 0), 0);
  const groupUniqueMatches = Array.from(new Map(records.map((record) => [`${record.date}|${record.competitionName ?? ''}|${record.opponent ?? ''}|${record.actingCategory ?? record.category ?? activeCategory}`, record])).values());
  const groupMinutes = records.reduce((acc, record) => acc + record.minutesPlayed, 0);
  const goalkeeperRecords = records.filter((record) => (data.players.find((player) => player.id === record.playerId)?.position) === 'Portero');
  const fieldRecords = records.filter((record) => (data.players.find((player) => player.id === record.playerId)?.position) !== 'Portero');

  const submit = (formData: FormData) => {
    const playerId = String(formData.get('playerId'));
    const player = data.players.find((item) => item.id === playerId);
    const goalkeeper = player?.position === 'Portero';
    const movementType = sourceCategory === activeCategory ? 'base' : (String(formData.get('movementType')) as MovementType);
    const date = String(formData.get('date'));
    const competitionName = String(formData.get('competitionName'));
    const opponent = String(formData.get('opponent') || '').trim();
    const minutesPlayed = Number(formData.get('minutesPlayed')) || 0;

    if (!opponent) {
      setMessage('Debes seleccionar o escribir un rival antes de guardar.');
      return;
    }
    const duplicatePlayerMatch = records.find((record) => record.id !== editingId && record.playerId === playerId && record.date === date && (record.competitionName ?? '') === competitionName && (record.opponent ?? '').trim() === opponent);
    if (duplicatePlayerMatch) {
      setMessage('Ese jugador ya tiene un registro en el mismo partido.');
      return;
    }
    if (goalkeeper && ['goals', 'assists', 'acc', 'dcc', 'sprints', 'rhie', 'ima'].some((field) => Number(formData.get(field)) > 0)) {
      setMessage('No se puede guardar un portero con métricas de jugador de campo.');
      return;
    }
    if (!goalkeeper && (Number(formData.get('goalsConceded')) > 0 || Number(formData.get('goalsPrevented')) > 0)) {
      setMessage('No se puede guardar un jugador de campo con métricas de portero.');
      return;
    }

    const baseRecord = {
      id: editingId || crypto.randomUUID(),
      playerId,
      date,
      opponent,
      competitionName,
      minutesPlayed,
      yellowCards: Number(formData.get('yellowCards')) || 0,
      redCards: Number(formData.get('redCards')) || 0,
      category: activeCategory,
      baseCategory: player?.category ?? sourceCategory,
      actingCategory: activeCategory,
      movementType,
      movementNote: String(formData.get('movementNote') || ''),
      movementModule: 'competencia' as const,
      loggedBy: session.displayName,
      postCompetitionStatus: String(formData.get('postCompetitionStatus') || ''),
      injuryKind: String(formData.get('injuryKind') || '') as InjuryKind,
      medicalObservation: String(formData.get('medicalObservation') || ''),
    };

    const record = goalkeeper
      ? { ...baseRecord, goals: 0, assists: 0, goalsConceded: Number(formData.get('goalsConceded')) || 0, goalsPrevented: Number(formData.get('goalsPrevented')) || 0, crossesDefended: 0, shotsOnTarget: 0 }
      : youthSimple
        ? { ...baseRecord, goals: Number(formData.get('goals')) || 0, assists: Number(formData.get('assists')) || 0 }
        : { ...baseRecord, goals: Number(formData.get('goals')) || 0, assists: Number(formData.get('assists')) || 0, acc: Number(formData.get('acc')) || 0, dcc: Number(formData.get('dcc')) || 0, sprints: Number(formData.get('sprints')) || 0, rhie: Number(formData.get('rhie')) || 0, ima: Number(formData.get('ima')) || 0 };

    if (editingId) updateCompetitionRecord(record);
    else addCompetitionRecord(record);
    setEditingId('');
    setMessage('Competencia guardada correctamente.');
  };

  return (
    <div className="grid">
      <AppHero title="Competencia" subtitle={`Orsomarso SC Performance · ${categoryLabel(activeCategory)}`} />

      <div className="grid grid-4">
        <KpiCard label="Partidos registrados" value={String(kpiMatches)} />
        <KpiCard label="Minutos jugados" value={String(kpiMinutes)} />
        <KpiCard label={isGoalkeeper ? "Goles encajados" : "Goles"} value={String(isGoalkeeper ? kpiGoalsConceded : kpiGoals)} />
        <KpiCard label={isGoalkeeper ? "Goles evitados" : "Asistencias"} value={String(isGoalkeeper ? kpiGoalsPrevented : kpiAssists)} />
      </div>

      {message ? <div className="card"><strong>{message}</strong></div> : null}

      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Informe grupal de competencia</h3>
            <div className="summary-chip" style={{ marginTop: 8 }}>{categoryLabel(activeCategory)} · {groupUniqueMatches[0]?.competitionName ?? 'Competencia'} · {groupUniqueMatches[0]?.opponent ?? 'Sin rival'}</div>
          </div>
          <div className="btn-row">
            <button type="button" className="btn secondary" onClick={() => setShowGroupReport((value) => !value)}>{showGroupReport ? 'Ocultar informe grupal' : 'Ver informe grupal'}</button>
            <button type="button" className="btn" onClick={() => window.print()}>Exportar PDF</button>
          </div>
        </div>
        {showGroupReport ? (
          <div className="grid" style={{ gap: 16, marginTop: 16 }}>
            <div className="grid grid-4">
              <KpiCard label="Partidos únicos" value={String(groupUniqueMatches.length)} />
              <KpiCard label="Jugadores cargados" value={String(new Set(records.map((record) => record.playerId)).size)} />
              <KpiCard label="Minutos del grupo" value={String(groupMinutes)} />
              <KpiCard label="Alertas médicas" value={String(records.filter((record) => (record.postCompetitionStatus && record.postCompetitionStatus !== 'Sin novedad') || record.injuryKind).length)} />
            </div>
            <div className="grid grid-4">
              <KpiCard label="Goles" value={String(fieldRecords.reduce((acc, record) => acc + (record.goals ?? 0), 0))} />
              <KpiCard label="Asistencias" value={String(fieldRecords.reduce((acc, record) => acc + (record.assists ?? 0), 0))} />
              <KpiCard label="Goles encajados" value={String(goalkeeperRecords.reduce((acc, record) => acc + (record.goalsConceded ?? 0), 0))} />
              <KpiCard label="Goles evitados" value={String(goalkeeperRecords.reduce((acc, record) => acc + (record.goalsPrevented ?? 0), 0))} />
            </div>
            <div className="card compact-card">
              <strong>Resumen general del partido</strong>
              <div className="muted-line" style={{ marginTop: 8 }}>Rivales cargados: {groupUniqueMatches.map((record) => `${record.date} · ${record.competitionName ?? '-'} vs ${record.opponent ?? '-'}`).join(' | ') || 'Sin registros'}</div>
              <div className="muted-line">Jugadores de campo: {fieldRecords.length} · Porteros: {goalkeeperRecords.length}</div>
            </div>
          </div>
        ) : null}
      </div>

      {master ? (
        <div className="card"><strong>Usuario Maestro:</strong> acceso de lectura. Usa Informes y Ranking para el análisis global.</div>
      ) : (
        <form key={`${currentPlayerId}-${isGoalkeeper ? "gk" : "field"}-${editingId || "new"}`} className="card grid" action={submit}>
          <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>{editing ? 'Editar competencia' : 'Cargar competencia'}</h3>
              <div className="summary-chip" style={{ marginTop: 8 }}>Plantilla activa: {isGoalkeeper ? 'Portero' : 'Jugador de campo'}</div>
            </div>
            <button type="button" className="btn secondary" onClick={() => downloadCsv('competencia.csv', records.map((r) => ({
              fecha: r.date,
              jugador: data.players.find((p) => p.id === r.playerId)?.name ?? 'Jugador',
              categoria_base: categoryLabel(data.players.find((p) => p.id === r.playerId)?.category),
              categoria_participacion: categoryLabel(r.actingCategory ?? r.category),
              competencia: r.competitionName ?? '',
              rival: r.opponent ?? '',
              minutos: r.minutesPlayed,
              goles: r.goals,
              asistencias: r.assists,
              estado_postcompetencia: r.postCompetitionStatus ?? '',
              tipo_lesion: r.injuryKind ?? '',
              observacion_medica: r.medicalObservation ?? '',
            })))}>Exportar CSV</button>
          </div>

          <div className="grid grid-4">
            <div className="field"><label>Categoría del jugador</label><select className="select" value={sourceCategory} onChange={(e) => setSourceCategory(e.target.value as ClubCategory)}>{categories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select></div>
            <div className="field"><label>Jugador</label><select className="select" name="playerId" value={currentPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)}>{sourcePlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field"><label>Fecha</label><input className="input" type="date" name="date" defaultValue={editing?.date ?? filters.date} required /></div>
            <div className="field"><label>Competencia</label><select className="select" name="competitionName" defaultValue={editing?.competitionName ?? competitionsByCategory[activeCategory][0]}>{competitionsByCategory[activeCategory].map((name) => <option key={name}>{name}</option>)}</select></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>Rival</label><input className="input" name="opponent" placeholder="Nombre del rival" defaultValue={editing?.opponent ?? ''} required /></div>
            <div className="field"><label>Minutos jugados</label><input className="input" type="number" name="minutesPlayed" defaultValue={editing?.minutesPlayed ?? ''} required /></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>Movimiento</label><select className="select" name="movementType" defaultValue={editing?.movementType ?? (sourceCategory === activeCategory ? 'base' : 'subio_a_competir')}>{movementOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
            <div className="field"><label>Observación movimiento</label><input className="input" name="movementNote" defaultValue={editing?.movementNote ?? ''} /></div>
          </div>

          {isGoalkeeper ? (
            <div className="grid grid-2">
              <div className="field"><label>Goles encajados</label><input className="input" type="number" name="goalsConceded" placeholder="Goles encajados" defaultValue={editing?.goalsConceded ?? ''} /></div>
              <div className="field"><label>Goles evitados</label><input className="input" type="number" name="goalsPrevented" placeholder="Goles evitados" defaultValue={editing?.goalsPrevented ?? ''} /></div>
            </div>
          ) : youthSimple ? (
            <div className="grid grid-2">
              <input className="input" type="number" name="goals" placeholder="Goles" defaultValue={editing?.goals ?? ''} />
              <input className="input" type="number" name="assists" placeholder="Asistencias" defaultValue={editing?.assists ?? ''} />
            </div>
          ) : (
            <>
              <div className="grid grid-4">
                <input className="input" type="number" name="goals" placeholder="Goles" defaultValue={editing?.goals ?? ''} />
                <input className="input" type="number" name="assists" placeholder="Asistencias" defaultValue={editing?.assists ?? ''} />
                <input className="input" type="number" name="acc" placeholder="ACC" defaultValue={editing?.acc ?? ''} />
                <input className="input" type="number" name="dcc" placeholder="DCC" defaultValue={editing?.dcc ?? ''} />
              </div>
              <div className="grid grid-3">
                <input className="input" type="number" name="sprints" placeholder="SPRINTS" defaultValue={editing?.sprints ?? ''} />
                <input className="input" type="number" name="rhie" placeholder="RHIE" defaultValue={editing?.rhie ?? ''} />
                <input className="input" type="number" name="ima" placeholder="IMA" defaultValue={editing?.ima ?? ''} />
              </div>
            </>
          )}

          <div className="grid grid-4">
            <input className="input" type="number" name="yellowCards" placeholder="Tarjetas amarillas" defaultValue={editing?.yellowCards ?? ''} />
            <input className="input" type="number" name="redCards" placeholder="Tarjetas rojas" defaultValue={editing?.redCards ?? ''} />
            <select className="select" name="postCompetitionStatus" defaultValue={editing?.postCompetitionStatus ?? 'Sin novedad'}>{medicalStates.map((state) => <option key={state}>{state}</option>)}</select>
            <select className="select" name="injuryKind" defaultValue={editing?.injuryKind ?? ''}>
              <option value="">Sin lesión</option>
              {injuryKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </div>
          <textarea className="input" name="medicalObservation" placeholder="Observación médica postcompetencia" defaultValue={editing?.medicalObservation ?? ''} />
          <button className="btn" type="submit">{editing ? 'Actualizar competencia' : 'Guardar competencia'}</button>
        </form>
      )}

      <div className="card table-wrap">
        <h3>Historial de competencia</h3>
        <table>
          <thead>
            <tr><th>Fecha</th><th>Jugador</th><th>Categoría</th><th>Competencia</th><th>Rival</th><th>Min</th><th>Estado</th><th>Lesión</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const player = data.players.find((p) => p.id === record.playerId);
              return (
                <tr key={record.id}>
                  <td>{record.date}</td>
                  <td>{player?.name ?? 'Jugador'}</td>
                  <td>{categoryLabel(record.actingCategory ?? record.category)}</td>
                  <td>{record.competitionName ?? '-'}</td>
                  <td>{record.opponent ?? '-'}</td>
                  <td>{record.minutesPlayed}</td>
                  <td>{record.postCompetitionStatus ?? '-'}</td>
                  <td>{record.injuryKind ?? '-'}</td>
                  <td>{master ? '-' : <div className="btn-row"><button type="button" className="btn secondary" onClick={() => setEditingId(record.id)}>Editar</button><button type="button" className="btn danger" onClick={() => deleteCompetitionRecord(record.id)}>Eliminar</button></div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
