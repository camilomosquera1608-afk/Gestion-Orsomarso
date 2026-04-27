'use client';

import { useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { groupAverage } from '@/lib/utils';

const renderNumberInput = (value?: number) => (!value ? '' : String(value));

export default function CompetenciaPage() {
  const { data, filters, addCompetitionRecord, updateCompetitionRecord, deleteCompetitionRecord } = useApp();
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState('');

  const records = useMemo(() => data.competitionRecords.filter((record) => {
    const player = data.players.find((p) => p.id === record.playerId);
    return !!player &&
      (filters.playerId === 'all' || record.playerId === filters.playerId) &&
      (filters.position === 'all' || player.position === filters.position) &&
      (filters.status === 'all' || player.status === filters.status);
  }).sort((a,b) => b.date.localeCompare(a.date)), [data.competitionRecords, data.players, filters]);

  const editing = records.find((record) => record.id === editingId);

  const submit = (formData: FormData) => {
    const record = {
      id: editingId || crypto.randomUUID(),
      playerId: String(formData.get('playerId')),
      date: String(formData.get('date')),
      opponent: String(formData.get('opponent')),
      minutesPlayed: Number(formData.get('minutesPlayed')) || 0,
      goals: Number(formData.get('goals')) || 0,
      assists: Number(formData.get('assists')) || 0,
      yellowCards: Number(formData.get('yellowCards')) || 0,
      redCards: Number(formData.get('redCards')) || 0,
      rpe: Number(formData.get('rpe')) || 0,
      acc: Number(formData.get('acc')) || 0,
      dcc: Number(formData.get('dcc')) || 0,
      sprints: Number(formData.get('sprints')) || 0,
      rhie: Number(formData.get('rhie')) || 0,
      ima: Number(formData.get('ima')) || 0,
    };
    if (editingId) {
      updateCompetitionRecord(record);
      setMessage('Informe de competencia actualizado.');
    } else {
      addCompetitionRecord(record);
      setMessage('Informe de competencia guardado.');
    }
    setEditingId('');
  };

  return (
    <div className="grid">
      <AppHero title="Competencia" />
      <GlobalFiltersBar />

      <div className="grid grid-5">
        <KpiCard label="Partidos registrados" value={String(records.length)} />
        <KpiCard label="Minutos promedio" value={groupAverage(records.map((r) => r.minutesPlayed)).toFixed(0)} />
        <KpiCard label="Goles totales" value={String(records.reduce((acc, r) => acc + r.goals, 0))} />
        <KpiCard label="Asistencias totales" value={String(records.reduce((acc, r) => acc + r.assists, 0))} />
        <KpiCard label="RPE promedio" value={groupAverage(records.map((r) => r.rpe ?? 0)).toFixed(1)} />
      </div>

      {message ? <div className="card"><strong>{message}</strong></div> : null}

      <form className="card grid" action={submit}>
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{editing ? 'Editar competencia' : 'Cargar competencia'}</h3>
          <div className="btn-row">
            <button type="button" className="btn secondary" onClick={() => downloadCsv('competencia.csv', records.map((r) => ({
              fecha: r.date,
              jugador: data.players.find((p) => p.id === r.playerId)?.name ?? 'Jugador',
              rival: r.opponent,
              minutos: r.minutesPlayed,
              goles: r.goals,
              asistencias: r.assists,
              amarillas: r.yellowCards,
              rojas: r.redCards,
              rpe: r.rpe ?? '',
              acc: r.acc ?? '',
              dcc: r.dcc ?? '',
              sprints: r.sprints ?? '',
              rhie: r.rhie ?? '',
              ima: r.ima ?? '',
            })))}>Exportar CSV</button>
            <button type="button" className="btn secondary" onClick={() => setEditingId('')}>Limpiar</button>
          </div>
        </div>

        <div className="grid grid-3">
          <select className="select" name="playerId" defaultValue={editing?.playerId ?? (filters.playerId === 'all' ? data.players[0]?.id : filters.playerId)} key={`comp-player-${editingId || 'new'}`}>
            {data.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input" type="date" name="date" defaultValue={editing?.date ?? filters.date} key={`comp-date-${editingId || 'new'}`} required />
          <input className="input" name="opponent" placeholder="Rival" defaultValue={editing?.opponent ?? ''} key={`comp-opp-${editingId || 'new'}`} required />
        </div>

        <div className="grid grid-4">
          <input className="input" type="number" name="minutesPlayed" placeholder="MIN sesión" defaultValue={editing?.minutesPlayed ?? ''} key={`comp-min-${editingId || 'new'}`} required />
          <input className="input" type="number" name="rpe" placeholder="RPE individual" defaultValue={editing?.rpe ?? ''} key={`comp-rpe-${editingId || 'new'}`} />
          <input className="input" type="number" name="acc" placeholder="ACC" defaultValue={editing?.acc ?? ''} key={`comp-acc-${editingId || 'new'}`} />
          <input className="input" type="number" name="dcc" placeholder="DCC" defaultValue={editing?.dcc ?? ''} key={`comp-dcc-${editingId || 'new'}`} />
        </div>

        <div className="grid grid-4">
          <input className="input" type="number" name="sprints" placeholder="SPRINTS" defaultValue={editing?.sprints ?? ''} key={`comp-sprints-${editingId || 'new'}`} />
          <input className="input" type="number" name="rhie" placeholder="RHIE" defaultValue={editing?.rhie ?? ''} key={`comp-rhie-${editingId || 'new'}`} />
          <input className="input" type="number" name="ima" placeholder="IMA" defaultValue={editing?.ima ?? ''} key={`comp-ima-${editingId || 'new'}`} />
          <div className="session-metric-pill" style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carga interna eliminada</div>
        </div>

        <div className="grid grid-4">
          <input className="input" type="number" name="goals" placeholder="Goles" defaultValue={editing?.goals ?? ''} key={`comp-goals-${editingId || 'new'}`} required />
          <input className="input" type="number" name="assists" placeholder="Asistencias" defaultValue={editing?.assists ?? ''} key={`comp-assists-${editingId || 'new'}`} required />
          <input className="input" type="number" name="yellowCards" placeholder="Tarjetas amarillas" defaultValue={editing?.yellowCards ?? ''} key={`comp-yellow-${editingId || 'new'}`} required />
          <input className="input" type="number" name="redCards" placeholder="Tarjetas rojas" defaultValue={editing?.redCards ?? ''} key={`comp-red-${editingId || 'new'}`} required />
        </div>

        <button className="btn" type="submit">{editing ? 'Actualizar informe' : 'Guardar informe'}</button>
      </form>

      <div className="card table-wrap">
        <h3>Historial de competencia</h3>
        <table>
          <thead>
            <tr><th>Fecha</th><th>Jugador</th><th>Rival</th><th>MIN</th><th>RPE</th><th>ACC</th><th>DCC</th><th>SPRINTS</th><th>RHIE</th><th>IMA</th><th>G</th><th>A</th><th>TA</th><th>TR</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const player = data.players.find((p) => p.id === record.playerId);
              return <tr key={record.id}><td>{record.date}</td><td>{player?.name ?? 'Jugador'}</td><td>{record.opponent}</td><td>{record.minutesPlayed}</td><td>{record.rpe ?? '-'}</td><td>{record.acc ?? '-'}</td><td>{record.dcc ?? '-'}</td><td>{record.sprints ?? '-'}</td><td>{record.rhie ?? '-'}</td><td>{record.ima ?? '-'}</td><td>{record.goals}</td><td>{record.assists}</td><td>{record.yellowCards}</td><td>{record.redCards}</td><td><div className="btn-row"><button type="button" className="btn secondary" onClick={() => setEditingId(record.id)}>Editar</button><button type="button" className="btn danger" onClick={() => deleteCompetitionRecord(record.id)}>Eliminar</button></div></td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
