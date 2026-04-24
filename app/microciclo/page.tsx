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
  const players = data.players.filter((player) => filters.playerId === 'all' || player.id === filters.playerId);
  const sessionRecords = data.externalLoads
    .filter((x) => (x.microcycleId ?? filters.microcycleId) === filters.microcycleId)
    .sort((a, b) => (a.date + (a.sessionNumber ?? 0)).localeCompare(b.date + (b.sessionNumber ?? 0)));

  const uniqueDays = [...new Set(sessionRecords.map((record) => record.date))];
  const dayData = uniqueDays.map((date) => ({
    date: date.slice(5),
    wellness: groupAverage(players.map((player) => averageWellness(data.wellness.find((x) => x.playerId === player.id && x.date === date)))),
    carga: groupAverage(players.map((player) => {
      const rec = data.internalLoads.find((x) => x.playerId === player.id && x.date === date);
      return rec ? calculateInternalLoad(rec) : 0;
    })),
    hsr: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.hsr ?? 0)),
  }));

  const accumulated = players.map((player) => ({
    jugador: player.name,
    carga: data.internalLoads.filter((x) => x.playerId === player.id && x.date >= microcycle.startDate && x.date <= microcycle.endDate).reduce((acc, item) => acc + calculateInternalLoad(item), 0),
    hsr: data.externalLoads.filter((x) => x.playerId === player.id && x.date >= microcycle.startDate && x.date <= microcycle.endDate).reduce((acc, item) => acc + item.hsr, 0),
  })).sort((a, b) => b.carga - a.carga);

  const timeline = sessionRecords.reduce<Array<{ date: string; sessionNumber: number; sessionType: string; avgHsr: number; avgRhie: number; players: number }>>((acc, record) => {
    const existing = acc.find((item) => item.date === record.date && item.sessionNumber === (record.sessionNumber ?? 1));
    if (!existing) {
      const bucket = sessionRecords.filter((x) => x.date === record.date && (x.sessionNumber ?? 1) === (record.sessionNumber ?? 1));
      acc.push({
        date: record.date,
        sessionNumber: record.sessionNumber ?? 1,
        sessionType: record.sessionType ?? '-',
        avgHsr: groupAverage(bucket.map((x) => x.hsr)),
        avgRhie: groupAverage(bucket.map((x) => x.rhie)),
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
        <KpiCard label="Carga acumulada" value={accumulated.reduce((acc, item) => acc + item.carga, 0).toFixed(0)} />
        <KpiCard label="HSR acumulado" value={`${accumulated.reduce((acc, item) => acc + item.hsr, 0).toFixed(0)} m`} />
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
                <span>HSR {item.avgHsr.toFixed(0)}</span>
                <span>RHIE {item.avgRhie.toFixed(0)}</span>
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
                <Line yAxisId="right" type="monotone" dataKey="carga" stroke="#60a5fa" name="Carga" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>HSR por día del microciclo</h3>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hsr" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
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
              <th>Carga interna acumulada</th>
              <th>HSR acumulado</th>
            </tr>
          </thead>
          <tbody>
            {accumulated.map((item) => (
              <tr key={item.jugador}>
                <td>{item.jugador}</td>
                <td>{item.carga}</td>
                <td>{item.hsr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
