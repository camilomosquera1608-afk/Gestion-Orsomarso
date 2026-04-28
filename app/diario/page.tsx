'use client';

import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { PlayerStatusBadge, WellnessBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { averageWellness, inferMicrocycleFromSequence, groupAverage } from '@/lib/utils';
import { categoryLabel } from '@/lib/labels';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function DiarioPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const youthSimple = activeCategory !== 'Sub20';
  const detectedMicrocycle = (findMicrocycleByDate(data.microcycles, filters.date) ?? inferMicrocycleFromSequence(data.microcycles, filters.date));

  const players = data.players.filter((player) =>
    (activeCategory === 'all' || player.category === activeCategory) &&
    (filters.playerId === 'all' || player.id === filters.playerId) &&
    (filters.position === 'all' || player.position === filters.position) &&
    (filters.status === 'all' || player.status === filters.status)
  );

  const tableRows = players.map((player) => {
    const wellness = data.wellness.find((x) => x.playerId === player.id && x.date === filters.date);
    const external = data.externalLoads.find((x) => x.playerId === player.id && x.date === filters.date);
    return { player, wellness, external, wellnessAvg: averageWellness(wellness) };
  });

  const lineData = ['2026-04-22', '2026-04-23'].map((date) => ({
    date: date.slice(5),
    wellness: groupAverage(players.map((player) => averageWellness(data.wellness.find((x) => x.playerId === player.id && x.date === date)))),
    minutos: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.min ?? 0)),
    rpe: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.rpe ?? 0)),
  }));

  return (
    <div className="grid">
      <AppHero title="Dashboard diario" subtitle={youthSimple ? 'Vista simplificada por categoría con minutos y RPE.' : 'Vista operativa avanzada para Sub20.'} />
      <GlobalFiltersBar />
      <div className="card">
        <strong>{detectedMicrocycle ? `Microciclo detectado: ${detectedMicrocycle.name}` : 'La fecha seleccionada no pertenece a un microciclo registrado.'}</strong>
      </div>

      <div className="grid grid-4">
        <KpiCard label="Wellness promedio" value={groupAverage(tableRows.map((r) => r.wellnessAvg)).toFixed(1)} />
        <KpiCard label="MIN promedio" value={groupAverage(tableRows.map((r) => r.external?.min ?? 0)).toFixed(0)} />
        <KpiCard label="RPE promedio" value={groupAverage(tableRows.map((r) => r.external?.rpe ?? 0)).toFixed(1)} />
        <KpiCard label="Categoría activa" value={categoryLabel(activeCategory)} />
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
          <h3>{youthSimple ? 'RPE del día' : 'RPE del día'}</h3>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={tableRows.map((item) => ({ jugador: item.player.name.split(' ')[0], rpe: item.external?.rpe ?? 0 }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="jugador" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="rpe" name="RPE" fill="#1d4ed8" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card table-wrap">
        <h3>Detalle diario por jugador</h3>
        <table>
          <thead>
            <tr><th>Jugador</th><th>Estado</th><th>Wellness</th><th>Sueño</th><th>Fatiga</th><th>Estrés</th><th>Dolor</th><th>Ánimo</th><th>MIN</th><th>RPE</th>{!youthSimple ? <><th>ACC</th><th>DCC</th><th>SPRINTS</th><th>RHIE</th><th>IMA</th></> : null}</tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row.player.id}>
                <td>{row.player.name}</td>
                <td><PlayerStatusBadge status={row.player.status} /></td>
                <td><WellnessBadge value={row.wellnessAvg} /></td>
                <td>{row.wellness?.sleep ?? '-'}</td><td>{row.wellness?.fatigue ?? '-'}</td><td>{row.wellness?.stress ?? '-'}</td><td>{row.wellness?.musclePain ?? '-'}</td><td>{row.wellness?.mood ?? '-'}</td>
                <td>{row.external?.min ?? '-'}</td><td>{row.external?.rpe ?? '-'}</td>
                {!youthSimple ? <><td>{row.external?.acc ?? '-'}</td><td>{row.external?.dcc ?? '-'}</td><td>{row.external?.sprints ?? '-'}</td><td>{row.external?.rhie ?? '-'}</td><td>{row.external?.ima ?? '-'}</td></> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
