'use client';

import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { PlayerStatusBadge, WellnessBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { averageWellness, calculateInternalLoad, groupAverage } from '@/lib/utils';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function DiarioPage() {
  const { data, filters } = useApp();
  const players = data.players.filter((player) =>
    (filters.playerId === 'all' || player.id === filters.playerId) &&
    (filters.position === 'all' || player.position === filters.position) &&
    (filters.status === 'all' || player.status === filters.status)
  );

  const tableRows = players.map((player) => {
    const wellness = data.wellness.find((x) => x.playerId === player.id && x.date === filters.date);
    const internal = data.internalLoads.find((x) => x.playerId === player.id && x.date === filters.date);
    const external = data.externalLoads.find((x) => x.playerId === player.id && x.date === filters.date);
    return {
      player,
      wellness,
      internal,
      external,
      wellnessAvg: averageWellness(wellness),
      internalLoad: internal ? calculateInternalLoad(internal) : 0,
    };
  });

  const ranking = [...tableRows].sort((a, b) => (b.external?.acc ?? 0) - (a.external?.acc ?? 0));
  const lineData = ['2026-04-22', '2026-04-23'].map((date) => ({
    date: date.slice(5),
    wellness: groupAverage(players.map((player) => averageWellness(data.wellness.find((x) => x.playerId === player.id && x.date === date)))),
    minutos: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.min ?? 0)),
    rhie: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.rhie ?? 0)),
  }));

  return (
    <div className="grid">
      <AppHero title="Dashboard diario" />
      <GlobalFiltersBar />

      <div className="grid grid-4">
        <KpiCard label="Wellness promedio" value={groupAverage(tableRows.map((r) => r.wellnessAvg)).toFixed(1)} />
        <KpiCard label="MIN promedio" value={groupAverage(tableRows.map((r) => r.external?.min ?? 0)).toFixed(0)} />
        <KpiCard label="ACC promedio" value={groupAverage(tableRows.map((r) => r.external?.acc ?? 0)).toFixed(1)} />
        <KpiCard label="RPE promedio" value={groupAverage(tableRows.map((r) => r.external?.rpe ?? 0)).toFixed(1)} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Comportamiento diario del grupo</h3>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="wellness" name="Wellness" stroke="#1d4ed8" strokeWidth={3} />
                <Line yAxisId="right" type="monotone" dataKey="minutos" name="MIN" stroke="#60a5fa" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Ranking ACC del día</h3>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={ranking.map((item) => ({ jugador: item.player.name.split(' ')[0], acc: item.external?.acc ?? 0 }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="jugador" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="acc" name="ACC" fill="#1d4ed8" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card table-wrap">
        <h3>Detalle diario por jugador</h3>
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Estado</th>
              <th>Wellness</th>
              <th>Sueño</th>
              <th>Fatiga</th>
              <th>Estrés</th>
              <th>Dolor muscular</th>
              <th>Ánimo</th>
              <th>MIN</th>
              <th>RPE</th>
              <th>ACC</th>
              <th>DCC</th>
              <th>SPRINTS</th>
              <th>RHIE</th>
              <th>IMA</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row.player.id}>
                <td>{row.player.name}</td>
                <td><PlayerStatusBadge status={row.player.status} /></td>
                <td><WellnessBadge value={row.wellnessAvg} /></td>
                <td>{row.wellness?.sleep ?? '-'}</td>
                <td>{row.wellness?.fatigue ?? '-'}</td>
                <td>{row.wellness?.stress ?? '-'}</td>
                <td>{row.wellness?.musclePain ?? '-'}</td>
                <td>{row.wellness?.mood ?? '-'}</td>
                <td>{row.external?.min ?? '-'}</td>
                <td>{row.external?.rpe ?? '-'}</td>
                <td>{row.external?.acc ?? '-'}</td>
                <td>{row.external?.dcc ?? '-'}</td>
                <td>{row.external?.sprints ?? '-'}</td>
                <td>{row.external?.rhie ?? '-'}</td>
                <td>{row.external?.ima ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
