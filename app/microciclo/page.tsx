'use client';

import { categoryLabel } from '@/lib/labels';

import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { averageWellness, calculateInternalLoad, groupAverage } from '@/lib/utils';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const sessionLabels: Record<string, string> = { cdef: 'Recuperación', cdEf: 'Ejecución', cdeF: 'Condición física', Cdef: 'Comunicación' };

export default function MicrocicloPage() {
  const { data, filters, updateMicrocycle } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const youthSimple = activeCategory !== 'Sub20';
  const microcycle = data.microcycles.find((x) => x.id === filters.microcycleId) ?? { id: filters.microcycleId, name: `Microciclo ${Number(String(filters.microcycleId).replace('mc-', '')) || 1}`, startDate: '', endDate: '' };
  const players = data.players.filter((player) => (activeCategory === 'all' || player.category === activeCategory) && (filters.playerId === 'all' || player.id === filters.playerId));
  const sessionRecords = data.externalLoads.filter((x) => (activeCategory === 'all' || x.category === activeCategory || data.players.find((p)=>p.id===x.playerId)?.category === activeCategory) && (x.microcycleId ?? filters.microcycleId) === filters.microcycleId).sort((a, b) => (a.date + (a.sessionNumber ?? 0)).localeCompare(b.date + (b.sessionNumber ?? 0)));

  const uniqueDays = [...new Set(sessionRecords.map((record) => record.date))];
  const dayData = uniqueDays.map((date) => ({
    date: date.slice(5),
    wellness: groupAverage(players.map((player) => averageWellness(data.wellness.find((x) => x.playerId === player.id && x.date === date)))),
    minutos: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.min ?? 0)),
    rpe: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.rpe ?? 0)),
    acc: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.acc ?? 0)),
  }));

  const dateOutOfRange = !!(microcycle.startDate && microcycle.endDate) && (filters.date < microcycle.startDate || filters.date > microcycle.endDate);
  const availabilitySummary = {
    disponibles: players.filter((p) => p.status === 'Disponible').length,
    molestia: players.filter((p) => p.status === 'Molestia').length,
    readaptacion: players.filter((p) => p.status === 'Readaptación').length,
    lesionados: players.filter((p) => p.status === 'Lesionado').length,
  };
  const playersWithoutRecords = players.filter((player) => !sessionRecords.some((record) => record.playerId === player.id));

  const accumulated = players.map((player) => ({
    jugador: player.name,
    carga: data.internalLoads.filter((x) => x.playerId === player.id && x.date >= microcycle.startDate && x.date <= microcycle.endDate).reduce((acc, item) => acc + calculateInternalLoad(item), 0),
    minutos: data.externalLoads.filter((x) => x.playerId === player.id && x.date >= microcycle.startDate && x.date <= microcycle.endDate).reduce((acc, item) => acc + (item.min ?? 0), 0),
    rpe: groupAverage(data.externalLoads.filter((x) => x.playerId === player.id && x.date >= microcycle.startDate && x.date <= microcycle.endDate).map((item) => item.rpe ?? 0)),
    acc: data.externalLoads.filter((x) => x.playerId === player.id && x.date >= microcycle.startDate && x.date <= microcycle.endDate).reduce((acc, item) => acc + (item.acc ?? 0), 0),
  })).sort((a, b) => youthSimple ? b.minutos - a.minutos : b.acc - a.acc);

  const timeline = sessionRecords.reduce((acc, record) => {
    const existing = acc.find((item) => item.date === record.date && item.sessionNumber === (record.sessionNumber ?? 1));
    if (!existing) {
      const bucket = sessionRecords.filter((x) => x.date === record.date && (x.sessionNumber ?? 1) === (record.sessionNumber ?? 1));
      acc.push({
        date: record.date, sessionNumber: record.sessionNumber ?? 1, sessionType: record.sessionType ?? '-',
        avgRpe: groupAverage(bucket.map((x) => x.rpe ?? 0)),
        avgMin: groupAverage(bucket.map((x) => x.min ?? 0)),
        avgAcc: groupAverage(bucket.map((x) => x.acc ?? 0)),
        players: bucket.length,
      });
    }
    return acc;
  }, [] as Array<{date:string;sessionNumber:number;sessionType:string;avgRpe:number;avgMin:number;avgAcc:number;players:number}>);

  return (
    <div className="grid">
      <AppHero title="Dashboard de microciclo" subtitle={youthSimple ? `Vista ${categoryLabel(activeCategory)} simplificada sin métricas GPS.` : 'Vista avanzada de U20.'} />
      <GlobalFiltersBar />
      <div className="card">
        <h3>Fechas del microciclo</h3>
        <div className="grid grid-3">
          <div className="field">
            <label>Microciclo seleccionado</label>
            <input className="input" value={microcycle.name} readOnly />
          </div>
          <div className="field">
            <label>Fecha de inicio</label>
            <input className="input" type="date" value={microcycle.startDate ?? ''} onChange={(e) => updateMicrocycle({ ...microcycle, startDate: e.target.value })} />
          </div>
          <div className="field">
            <label>Fecha de fin</label>
            <input className="input" type="date" value={microcycle.endDate ?? ''} onChange={(e) => updateMicrocycle({ ...microcycle, endDate: e.target.value })} />
          </div>
        </div>
      </div>
      {dateOutOfRange ? <div className="card"><strong>Alerta:</strong> la fecha seleccionada no corresponde al rango del {microcycle.name}.</div> : null}
      <div className="grid grid-4">
        <KpiCard label="Microciclo activo" value={microcycle.name} />
        <KpiCard label="Wellness promedio" value={groupAverage(dayData.map((d) => d.wellness)).toFixed(1)} />
        <KpiCard label="MIN acumulados" value={accumulated.reduce((acc, item) => acc + item.minutos, 0).toFixed(0)} />
        <KpiCard label={youthSimple ? 'RPE promedio' : 'ACC acumulado'} value={youthSimple ? groupAverage(accumulated.map((x) => x.rpe)).toFixed(1) : accumulated.reduce((acc, item) => acc + item.acc, 0).toFixed(0)} />
      </div>

      <div className="grid grid-4">
        <KpiCard label="Disponibles" value={String(availabilitySummary.disponibles)} />
        <KpiCard label="Molestia" value={String(availabilitySummary.molestia)} />
        <KpiCard label="Readaptación" value={String(availabilitySummary.readaptacion)} />
        <KpiCard label="Lesionados" value={String(availabilitySummary.lesionados)} />
      </div>

      <div className="card">
        <h3>Timeline del microciclo</h3>
        <div className="timeline-grid">
          {timeline.map((item) => (
            <div key={`${item.date}-${item.sessionNumber}`} className="timeline-card">
              <div className="timeline-date">{item.date}</div>
              <strong>Sesión {item.sessionNumber}</strong>
              <div className="muted-line">{item.sessionType} · {sessionLabels[item.sessionType] ?? 'Sin etiqueta'}</div>
              <div className="timeline-metrics">
                <span>MIN {item.avgMin.toFixed(0)}</span>
                <span>RPE {item.avgRpe.toFixed(1)}</span>
                {!youthSimple ? <span>ACC {item.avgAcc.toFixed(0)}</span> : null}
                <span>{item.players} jugadores</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Tendencia diaria del microciclo</h3>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="wellness" stroke="#1d4ed8" name="Wellness" strokeWidth={3} />
                <Line yAxisId="right" type="monotone" dataKey="minutos" stroke="#60a5fa" name="MIN" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>{youthSimple ? 'RPE por día' : 'ACC por día'}</h3>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey={youthSimple ? 'rpe' : 'acc'} fill="#1d4ed8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Alertas del microciclo</h3>
        <div className="grid" style={{ gap: 10 }}>
          {dateOutOfRange ? <div className="alert-item tone-yellow">La fecha seleccionada está fuera del rango del microciclo.</div> : null}
          {players.filter((player) => player.status === 'Lesionado').map((player) => <div key={player.id} className="alert-item tone-red">{player.name} tiene lesión activa.</div>)}
          {playersWithoutRecords.map((player) => <div key={`missing-${player.id}`} className="alert-item tone-yellow">{player.name} no tiene registros en este microciclo.</div>)}
          {!players.filter((player) => player.status === 'Lesionado').length && !playersWithoutRecords.length && !dateOutOfRange ? <div className="empty">Sin alertas relevantes.</div> : null}
        </div>
      </div>

      <div className="card table-wrap">
        <h3>Jugadores sin registros en el microciclo</h3>
        {playersWithoutRecords.length ? <table><thead><tr><th>Jugador</th><th>Posición</th><th>Estado</th></tr></thead><tbody>{playersWithoutRecords.map((player) => <tr key={player.id}><td>{player.name}</td><td>{player.position}</td><td>{player.status}</td></tr>)}</tbody></table> : <div className="empty">Todos los jugadores tienen registros.</div>}
      </div>

      <div className="card table-wrap">
        <h3>Ranking del microciclo</h3>
        <table>
          <thead><tr><th>Jugador</th><th>MIN acumulados</th><th>RPE promedio</th>{!youthSimple ? <th>ACC acumulado</th> : null}<th>Carga interna</th></tr></thead>
          <tbody>{accumulated.map((item) => <tr key={item.jugador}><td>{item.jugador}</td><td>{item.minutos}</td><td>{item.rpe}</td>{!youthSimple ? <td>{item.acc}</td> : null}<td>{item.carga}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
