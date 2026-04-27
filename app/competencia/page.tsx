'use client';

import { useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { ClubCategory } from '@/lib/types';
import { groupAverage } from '@/lib/utils';

const competitionsByCategory: Record<ClubCategory, string[]> = {
  Sub20: ['Super copa juvenil'],
  Sub17: ['Liga vallecaucana Sub17', 'Torneo nacional Sub17'],
  Sub15: ['Liga vallecaucana Sub16', 'Torneo nacional Sub15'],
};

export default function CompetenciaPage() {
  const { data, filters, addCompetitionRecord, updateCompetitionRecord, deleteCompetitionRecord } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = (master ? (filters.category === 'all' ? 'Sub20' : filters.category) : session.category) as ClubCategory;
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState('');

  const filteredPlayers = data.players.filter((player) =>
    player.category === activeCategory &&
    (filters.position === 'all' || player.position === filters.position) &&
    (filters.status === 'all' || player.status === filters.status),
  );

  const records = useMemo(
    () =>
      data.competitionRecords
        .filter((record) => {
          const player = data.players.find((p) => p.id === record.playerId);
          return !!player &&
            player.category === activeCategory &&
            (filters.playerId === 'all' || record.playerId === filters.playerId) &&
            (filters.position === 'all' || player.position === filters.position) &&
            (filters.status === 'all' || player.status === filters.status);
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.competitionRecords, data.players, filters.playerId, filters.position, filters.status, activeCategory],
  );

  const editing = records.find((record) => record.id === editingId);
  const selectedPlayerId = editing?.playerId ?? (filters.playerId === 'all' ? filteredPlayers[0]?.id ?? '' : filters.playerId);
  const currentPlayer = data.players.find((player) => player.id === selectedPlayerId) ?? filteredPlayers[0];
  const isGoalkeeper = currentPlayer?.position === 'Portero';
  const youthSimple = activeCategory !== 'Sub20';

  const submit = (formData: FormData) => {
    const playerId = String(formData.get('playerId'));
    const player = data.players.find((item) => item.id === playerId);
    const goalkeeper = player?.position === 'Portero';
    const category = (player?.category ?? activeCategory) as ClubCategory;
    const isSimple = category !== 'Sub20';

    const baseRecord = {
      id: editingId || crypto.randomUUID(),
      playerId,
      date: String(formData.get('date')),
      opponent: String(formData.get('competitionName') || formData.get('opponent')),
      competitionName: String(formData.get('competitionName') || ''),
      minutesPlayed: Number(formData.get('minutesPlayed')) || 0,
      yellowCards: Number(formData.get('yellowCards')) || 0,
      redCards: Number(formData.get('redCards')) || 0,
      category,
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
      : isSimple
      ? {
          ...baseRecord,
          goals: Number(formData.get('goals')) || 0,
          assists: Number(formData.get('assists')) || 0,
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

    if (editingId) updateCompetitionRecord(record);
    else addCompetitionRecord(record);
    setMessage(editingId ? 'Informe de competencia actualizado.' : 'Informe de competencia guardado.');
    setEditingId('');
  };

  return (
    <div className="grid">
      <AppHero title="Competencia" subtitle={youthSimple ? 'Panel simplificado por categoría con minutos y datos esenciales.' : 'Panel avanzado de competencia para Sub20.'} />
      <GlobalFiltersBar />

      <div className="grid grid-4">
        <KpiCard label="Partidos registrados" value={String(records.length)} />
        <KpiCard label="Minutos jugados" value={groupAverage(records.map((r) => r.minutesPlayed)).toFixed(0)} />
        <KpiCard label={isGoalkeeper ? 'Goles evitados' : 'Goles'} value={String(records.reduce((acc, r) => acc + (isGoalkeeper ? (r.goalsPrevented ?? 0) : r.goals), 0))} />
        <KpiCard label="Categoría activa" value={activeCategory} />
      </div>

      {message ? <div className="card"><strong>{message}</strong></div> : null}

      <form className="card grid" action={submit}>
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{editing ? 'Editar competencia' : 'Cargar competencia'}</h3>
          <button type="button" className="btn secondary" onClick={() => setEditingId('')}>Limpiar</button>
        </div>

        <div className="grid grid-3">
          <select className="select" name="playerId" defaultValue={selectedPlayerId} key={`comp-player-${editingId || 'new'}`}>
            {filteredPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input" type="date" name="date" defaultValue={editing?.date ?? filters.date} key={`comp-date-${editingId || 'new'}`} required />
          <select className="select" name="competitionName" defaultValue={editing?.competitionName ?? editing?.opponent ?? competitionsByCategory[activeCategory][0]}>
            {competitionsByCategory[activeCategory].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        <div className="card compact-card goalkeeper-panel">
          <div className="subsection-title">
            <span>{isGoalkeeper ? 'Panel de portero' : youthSimple ? `Panel simplificado ${activeCategory}` : 'Panel Sub20 jugador de campo'}</span>
          </div>

          {isGoalkeeper ? (
            <div className="grid grid-4">
              <input className="input" type="number" name="minutesPlayed" placeholder="Minutos jugados" defaultValue={editing?.minutesPlayed ?? ''} required />
              <input className="input" type="number" name="goalsConceded" placeholder="Goles encajados" defaultValue={editing?.goalsConceded ?? ''} />
              <input className="input" type="number" name="goalsPrevented" placeholder="Goles evitados" defaultValue={editing?.goalsPrevented ?? ''} />
              <input className="input" type="number" name="crossesDefended" placeholder="Centros defendidos" defaultValue={editing?.crossesDefended ?? ''} />
              <input className="input" type="number" name="shotsOnTarget" placeholder="Remates a portería" defaultValue={editing?.shotsOnTarget ?? ''} />
              <input className="input" type="number" name="yellowCards" placeholder="Tarjetas amarillas" defaultValue={editing?.yellowCards ?? ''} required />
              <input className="input" type="number" name="redCards" placeholder="Tarjetas rojas" defaultValue={editing?.redCards ?? ''} required />
            </div>
          ) : youthSimple ? (
            <div className="grid grid-4">
              <input className="input" type="number" name="minutesPlayed" placeholder="Minutos jugados" defaultValue={editing?.minutesPlayed ?? ''} required />
              <input className="input" type="number" name="goals" placeholder="Goles" defaultValue={editing?.goals ?? ''} required />
              <input className="input" type="number" name="assists" placeholder="Asistencias" defaultValue={editing?.assists ?? ''} required />
              <input className="input" type="number" name="yellowCards" placeholder="Tarjetas amarillas" defaultValue={editing?.yellowCards ?? ''} required />
              <input className="input" type="number" name="redCards" placeholder="Tarjetas rojas" defaultValue={editing?.redCards ?? ''} required />
            </div>
          ) : (
            <>
              <div className="grid grid-4">
                <input className="input" type="number" name="minutesPlayed" placeholder="Minutos jugados" defaultValue={editing?.minutesPlayed ?? ''} required />
                <input className="input" type="number" name="acc" placeholder="ACC" defaultValue={editing?.acc ?? ''} />
                <input className="input" type="number" name="dcc" placeholder="DCC" defaultValue={editing?.dcc ?? ''} />
                <input className="input" type="number" name="sprints" placeholder="SPRINTS" defaultValue={editing?.sprints ?? ''} />
              </div>
              <div className="grid grid-4">
                <input className="input" type="number" name="rhie" placeholder="RHIE" defaultValue={editing?.rhie ?? ''} />
                <input className="input" type="number" name="ima" placeholder="IMA" defaultValue={editing?.ima ?? ''} />
                <input className="input" type="number" name="goals" placeholder="Goles" defaultValue={editing?.goals ?? ''} required />
                <input className="input" type="number" name="assists" placeholder="Asistencias" defaultValue={editing?.assists ?? ''} required />
              </div>
              <div className="grid grid-2">
                <input className="input" type="number" name="yellowCards" placeholder="Tarjetas amarillas" defaultValue={editing?.yellowCards ?? ''} required />
                <input className="input" type="number" name="redCards" placeholder="Tarjetas rojas" defaultValue={editing?.redCards ?? ''} required />
              </div>
            </>
          )}
        </div>

        <button className="btn" type="submit">{editing ? 'Actualizar informe' : 'Guardar informe'}</button>
      </form>

      <div className="card table-wrap">
        <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h3>Historial de competencia</h3>
          <button type="button" className="btn secondary" onClick={() => downloadCsv(`competencia-${activeCategory}.csv`, records.map((r) => ({
            fecha: r.date,
            jugador: data.players.find((p) => p.id === r.playerId)?.name ?? 'Jugador',
            categoria: data.players.find((p) => p.id === r.playerId)?.category ?? activeCategory,
            competencia: r.competitionName ?? r.opponent,
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
          })))}>Exportar CSV</button>
        </div>
        <table>
          <thead>
            <tr><th>Fecha</th><th>Jugador</th><th>Competencia</th><th>Minutos</th><th>Detalle</th><th>TA</th><th>TR</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const player = data.players.find((p) => p.id === record.playerId);
              const goalkeeper = player?.position === 'Portero';
              return (
                <tr key={record.id}>
                  <td>{record.date}</td>
                  <td>{player?.name ?? 'Jugador'}</td>
                  <td>{record.competitionName ?? record.opponent}</td>
                  <td>{record.minutesPlayed}</td>
                  <td>{goalkeeper ? `GE ${record.goalsConceded ?? 0} · GEv ${record.goalsPrevented ?? 0} · CD ${record.crossesDefended ?? 0} · RP ${record.shotsOnTarget ?? 0}` : youthSimple ? `G ${record.goals} · A ${record.assists}` : `G ${record.goals} · A ${record.assists} · ACC ${record.acc ?? 0} · DCC ${record.dcc ?? 0} · SP ${record.sprints ?? 0} · RHIE ${record.rhie ?? 0} · IMA ${record.ima ?? 0}`}</td>
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
