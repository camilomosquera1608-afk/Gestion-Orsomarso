'use client';

import { useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { groupAverage } from '@/lib/utils';

export default function CompetenciaPage() {
  const { data, filters, addCompetitionRecord, updateCompetitionRecord, deleteCompetitionRecord } = useApp();
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState('');

  const filteredPlayers = data.players.filter((player) =>
    (filters.category === 'all' || player.category === filters.category) &&
    (filters.position === 'all' || player.position === filters.position) &&
    (filters.status === 'all' || player.status === filters.status)
  );

  const selectedPlayerId = editingId
    ? data.competitionRecords.find((record) => record.id === editingId)?.playerId ?? (filters.playerId === 'all' ? filteredPlayers[0]?.id ?? '' : filters.playerId)
    : (filters.playerId === 'all' ? filteredPlayers[0]?.id ?? '' : filters.playerId);

  const selectedPlayer = data.players.find((player) => player.id === selectedPlayerId) ?? filteredPlayers[0];
  const isGoalkeeper = selectedPlayer?.position === 'Portero';

  const records = useMemo(() => data.competitionRecords.filter((record) => {
    const player = data.players.find((p) => p.id === record.playerId);
    return !!player &&
      (filters.playerId === 'all' || record.playerId === filters.playerId) &&
      (filters.category === 'all' || player.category === filters.category) &&
      (filters.position === 'all' || player.position === filters.position) &&
      (filters.status === 'all' || player.status === filters.status);
  }).sort((a,b) => b.date.localeCompare(a.date)), [data.competitionRecords, data.players, filters]);

  const editing = records.find((record) => record.id === editingId);
  const editingPlayer = editing ? data.players.find((p) => p.id === editing.playerId) : selectedPlayer;
  const editingIsGoalkeeper = editingPlayer?.position === 'Portero';

  const submit = (formData: FormData) => {
    const playerId = String(formData.get('playerId'));
    const player = data.players.find((item) => item.id === playerId);
    const goalkeeper = player?.position === 'Portero';

    const baseRecord = {
      id: editingId || crypto.randomUUID(),
      playerId,
      date: String(formData.get('date')),
      opponent: String(formData.get('opponent')),
      minutesPlayed: Number(formData.get('minutesPlayed')) || 0,
      yellowCards: Number(formData.get('yellowCards')) || 0,
      redCards: Number(formData.get('redCards')) || 0,
      category: player?.category,
    };

    const record = goalkeeper
      ? {
          ...baseRecord,
          goals: 0,
          assists: 0,
          goalsConceded: Number(formData.get('goalsConceded')) || 0,
          goalsPrevented: Number(formData.get('goalsPrevented')) || 0,
          crossesDefended: Number(formData.get('crossesDefended')) || 0,
          shotsOnTarget: Number(formData.get('shotsOnTarget')) || 0,
        }
      : {
          ...baseRecord,
          goals: Number(formData.get('goals')) || 0,
          assists: Number(formData.get('assists')) || 0,
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

  const outfieldRecords = records.filter((record) => {
    const player = data.players.find((p) => p.id === record.playerId);
    return player?.position !== 'Portero';
  });
  const goalkeeperRecords = records.filter((record) => {
    const player = data.players.find((p) => p.id === record.playerId);
    return player?.position === 'Portero';
  });

  return (
    <div className="grid">
      <AppHero title="Competencia" />
      <GlobalFiltersBar />

      <div className="grid grid-5">
        <KpiCard label="Partidos registrados" value={String(records.length)} />
        <KpiCard label="Minutos jugados" value={groupAverage(records.map((r) => r.minutesPlayed)).toFixed(0)} />
        <KpiCard label="Goles de campo" value={String(outfieldRecords.reduce((acc, r) => acc + r.goals, 0))} />
        <KpiCard label="Goles evitados" value={String(goalkeeperRecords.reduce((acc, r) => acc + (r.goalsPrevented ?? 0), 0))} />
        <KpiCard label="IMA promedio" value={groupAverage(outfieldRecords.map((r) => r.ima ?? 0)).toFixed(1)} />
      </div>

      {message ? <div className="card"><strong>{message}</strong></div> : null}

      <form className="card grid" action={submit}>
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{editing ? 'Editar competencia' : 'Cargar competencia'}</h3>
          <div className="btn-row">
            <button type="button" className="btn secondary" onClick={() => downloadCsv('competencia.csv', records.map((r) => {
              const player = data.players.find((p) => p.id === r.playerId);
              return {
                fecha: r.date,
                jugador: player?.name ?? 'Jugador',
                categoria: player?.category ?? 'Sub20',
                rival: r.opponent,
                minutos_jugados: r.minutesPlayed,
                goles: r.goals,
                asistencias: r.assists,
                goles_encajados: r.goalsConceded ?? '',
                goles_evitados: r.goalsPrevented ?? '',
                centros_defendidos: r.crossesDefended ?? '',
                remates_a_porteria: r.shotsOnTarget ?? '',
                acc: r.acc ?? '',
                dcc: r.dcc ?? '',
                sprints: r.sprints ?? '',
                rhie: r.rhie ?? '',
                ima: r.ima ?? '',
                amarillas: r.yellowCards,
                rojas: r.redCards,
              };
            })))}>Exportar CSV</button>
            <button type="button" className="btn secondary" onClick={() => setEditingId('')}>Limpiar</button>
          </div>
        </div>

        <div className="grid grid-3">
          <select className="select" name="playerId" defaultValue={editing?.playerId ?? (filters.playerId === 'all' ? filteredPlayers[0]?.id : filters.playerId)} key={`comp-player-${editingId || 'new'}`}>
            {filteredPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input" type="date" name="date" defaultValue={editing?.date ?? filters.date} key={`comp-date-${editingId || 'new'}`} required />
          <input className="input" name="opponent" placeholder="Rival" defaultValue={editing?.opponent ?? ''} key={`comp-opp-${editingId || 'new'}`} required />
        </div>

        <div className="card compact-card goalkeeper-panel">
          <div className="subsection-title"><span>{editingIsGoalkeeper ? 'Panel de portero' : 'Panel de jugador de campo'}</span></div>

          {editingIsGoalkeeper ? (
            <div className="grid grid-4">
              <input className="input" type="number" name="minutesPlayed" placeholder="Minutos jugados" defaultValue={editing?.minutesPlayed ?? ''} key={`gk-min-${editingId || 'new'}`} required />
              <input className="input" type="number" name="goalsConceded" placeholder="Goles encajados" defaultValue={editing?.goalsConceded ?? ''} key={`gk-goalsConceded-${editingId || 'new'}`} />
              <input className="input" type="number" name="goalsPrevented" placeholder="Goles evitados" defaultValue={editing?.goalsPrevented ?? ''} key={`gk-goalsPrevented-${editingId || 'new'}`} />
              <input className="input" type="number" name="crossesDefended" placeholder="Centros defendidos" defaultValue={editing?.crossesDefended ?? ''} key={`gk-crosses-${editingId || 'new'}`} />
              <input className="input" type="number" name="shotsOnTarget" placeholder="Remates a portería" defaultValue={editing?.shotsOnTarget ?? ''} key={`gk-shots-${editingId || 'new'}`} />
              <input className="input" type="number" name="yellowCards" placeholder="Tarjetas amarillas" defaultValue={editing?.yellowCards ?? ''} key={`gk-yellow-${editingId || 'new'}`} required />
              <input className="input" type="number" name="redCards" placeholder="Tarjetas rojas" defaultValue={editing?.redCards ?? ''} key={`gk-red-${editingId || 'new'}`} required />
            </div>
          ) : (
            <>
              <div className="grid grid-4">
                <input className="input" type="number" name="minutesPlayed" placeholder="Minutos jugados" defaultValue={editing?.minutesPlayed ?? ''} key={`comp-min-${editingId || 'new'}`} required />
                <input className="input" type="number" name="acc" placeholder="ACC" defaultValue={editing?.acc ?? ''} key={`comp-acc-${editingId || 'new'}`} />
                <input className="input" type="number" name="dcc" placeholder="DCC" defaultValue={editing?.dcc ?? ''} key={`comp-dcc-${editingId || 'new'}`} />
                <input className="input" type="number" name="sprints" placeholder="SPRINTS" defaultValue={editing?.sprints ?? ''} key={`comp-sprints-${editingId || 'new'}`} />
              </div>
              <div className="grid grid-4">
                <input className="input" type="number" name="rhie" placeholder="RHIE" defaultValue={editing?.rhie ?? ''} key={`comp-rhie-${editingId || 'new'}`} />
                <input className="input" type="number" name="ima" placeholder="IMA" defaultValue={editing?.ima ?? ''} key={`comp-ima-${editingId || 'new'}`} />
                <input className="input" type="number" name="goals" placeholder="Goles" defaultValue={editing?.goals ?? ''} key={`comp-goals-${editingId || 'new'}`} required />
                <input className="input" type="number" name="assists" placeholder="Asistencias" defaultValue={editing?.assists ?? ''} key={`comp-assists-${editingId || 'new'}`} required />
              </div>
              <div className="grid grid-2">
                <input className="input" type="number" name="yellowCards" placeholder="Tarjetas amarillas" defaultValue={editing?.yellowCards ?? ''} key={`comp-yellow-${editingId || 'new'}`} required />
                <input className="input" type="number" name="redCards" placeholder="Tarjetas rojas" defaultValue={editing?.redCards ?? ''} key={`comp-red-${editingId || 'new'}`} required />
              </div>
            </>
          )}
        </div>

        <button className="btn" type="submit">{editing ? 'Actualizar informe' : 'Guardar informe'}</button>
      </form>

      <div className="card table-wrap">
        <h3>Historial de competencia</h3>
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Jugador</th><th>Categoría</th><th>Rival</th><th>Minutos jugados</th><th>Detalle</th><th>TA</th><th>TR</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const player = data.players.find((p) => p.id === record.playerId);
              const goalkeeper = player?.position === 'Portero';
              return (
                <tr key={record.id}>
                  <td>{record.date}</td>
                  <td>{player?.name ?? 'Jugador'}</td>
                  <td>{player?.category ?? 'Sub20'}</td>
                  <td>{record.opponent}</td>
                  <td>{record.minutesPlayed}</td>
                  <td>
                    {goalkeeper
                      ? `GE ${record.goalsConceded ?? 0} · GEv ${record.goalsPrevented ?? 0} · CD ${record.crossesDefended ?? 0} · RP ${record.shotsOnTarget ?? 0}`
                      : `G ${record.goals} · A ${record.assists} · ACC ${record.acc ?? 0} · DCC ${record.dcc ?? 0} · SP ${record.sprints ?? 0} · RHIE ${record.rhie ?? 0} · IMA ${record.ima ?? 0}`}
                  </td>
                  <td>{record.yellowCards}</td>
                  <td>{record.redCards}</td>
                  <td><div className="btn-row"><button type="button" className="btn secondary" onClick={() => setEditingId(record.id)}>Editar</button><button type="button" className="btn danger" onClick={() => deleteCompetitionRecord(record.id)}>Eliminar</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
