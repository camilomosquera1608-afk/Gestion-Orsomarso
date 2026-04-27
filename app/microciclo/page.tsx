'use client';

import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { useApp } from '@/context/app-context';
import { averageWellness, calculateInternalLoad, groupAverage } from '@/lib/utils';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const sessionLabels: Record<string, string> = {
  cdef: 'Recuperación',
  cdEf: 'Ejecución',
  cdeF: 'Condición física',
  Cdef: 'Comunicación',
};

export default function MicrocicloPage() {
  const { data, filters } = useApp();
  const microcycle = data.microcycles.find((x) => x.id === filters.microcycleId) ?? data.microcycles[0];
  const players = data.players.filter((player) => (filters.playerId === 'all' || player.id === filters.playerId) && (filters.category === 'all' || player.category === filters.category));
  const sessionRecords = data.externalLoads
    .filter((x) => (x.microcycleId ?? filters.microcycleId) === filters.microcycleId)
    .sort((a, b) => (a.date + (a.sessionNumber ?? 0)).localeCompare(b.date + (b.sessionNumber ?? 0)));

  const uniqueDays = [...new Set(sessionRecords.map((record) => record.date))];
  const dayData = uniqueDays.map((date) => ({
    date: date.slice(5),
    wellness: groupAverage(players.map((player) => averageWellness(data.wellness.find((x) => x.playerId === player.id && x.date === date)))),
    minutos: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.min ?? 0)),
    acc: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.acc ?? 0)),
  }));

  const accumulated = players.map((player) => ({
    jugador: player.name,
    carga: data.internalLoads.filter((x) => x.playerId === player.id && x.date >= microcycle.startDate && x.date <= microcycle.endDate).reduce((acc, item) => acc + calculateInternalLoad(item), 0),
    minutos: data.externalLoads.filter((x) => x.playerId === player.id && x.date >= microcycle.startDate && x.date <= microcycle.endDate).reduce((acc, item) => acc + (item.min ?? 0), 0),
    acc: data.externalLoads.filter((x) => x.playerId === player.id && x.date >= microcycle.startDate && x.date <= microcycle.endDate).reduce((acc, item) => acc + (item.acc ?? 0), 0),
    sprints: data.externalLoads.filter((x) => x.playerId === player.id && x.date >= microcycle.startDate && x.date <= microcycle.endDate).reduce((acc, item) => acc + (item.sprints ?? 0), 0),
  })).sort((a, b) => b.acc - a.acc);

  const timeline = sessionRecords.reduce<Array<{ date: string; sessionNumber: number; sessionType: string; avgAcc: number; avgRhie: number; avgSprints: number; players: number }>>((acc, record) => {
    const existing = acc.find((item) => item.date === record.date && item.sessionNumber === (record.sessionNumber ?? 1));
    if (!existing) {
      const bucket = sessionRecords.filter((x) => x.date === record.date && (x.sessionNumber ?? 1) === (record.sessionNumber ?? 1));
      acc.push({
        date: record.date,
        sessionNumber: record.sessionNumber ?? 1,
        sessionType: record.sessionType ?? '-',
        avgAcc: groupAverage(bucket.map((x) => x.acc ?? 0)),
        avgRhie: groupAverage(bucket.map((x) => x.rhie ?? 0)),
        avgSprints: groupAverage(bucket.map((x) => x.sprints ?? 0)),
        players: bucket.length,
      });
    }
    return acc;
  }, []);

  return (
    <div className="grid">
      <AppHero title="Dashboard de microciclo" />
      <GlobalFiltersBar />
      <div className="grid grid-4">
        <KpiCard label="Microciclo activo" value={microcycle.name} />
        <KpiCard label="Wellness promedio" value={groupAverage(dayData.map((d) => d.wellness)).toFixed(1)} />
        <KpiCard label="MIN acumulados" value={accumulated.reduce((acc, item) => acc + item.minutos, 0).toFixed(0)} />
        <KpiCard label="ACC acumulado" value={accumulated.reduce((acc, item) => acc + item.acc, 0).toFixed(0)} />
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
                <span>ACC {item.avgAcc.toFixed(0)}</span>
                <span>RHIE {item.avgRhie.toFixed(0)}</span>
                <span>SPRINTS {item.avgSprints.toFixed(0)}</span>
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
          <h3>ACC por día del microciclo</h3>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="acc" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card table-wrap">
        <h3>Ranking del microciclo</h3>
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>MIN acumulados</th>
              <th>ACC acumulado</th>
              <th>SPRINTS</th>
              <th>Carga interna</th>
            </tr>
          </thead>
          <tbody>
            {accumulated.map((item) => (
              <tr key={item.jugador}>
                <td>{item.jugador}</td>
                <td>{item.minutos}</td>
                <td>{item.acc}</td>
                <td>{item.sprints}</td>
                <td>{item.carga}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
