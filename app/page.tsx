'use client';

import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { PlayerStatusBadge, WellnessBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { averageWellness, calculateInternalLoad, groupAverage } from '@/lib/utils';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function HomePage() {
  const { data, filters, backendMode, syncStatus, forceSync } = useApp();
  const selectedPlayers = data.players.filter((player) =>
    (filters.playerId === 'all' || player.id === filters.playerId) &&
    (filters.position === 'all' || player.position === filters.position) &&
    (filters.status === 'all' || player.status === filters.status)
  );

  const todayWellness = selectedPlayers.map((player) => {
    const record = data.wellness.find((item) => item.playerId === player.id && item.date === filters.date);
    return averageWellness(record);
  });

  const todayLoads = selectedPlayers.map((player) => {
    const record = data.internalLoads.find((item) => item.playerId === player.id && item.date === filters.date);
    return record ? calculateInternalLoad(record) : 0;
  });

  const todayCmj = selectedPlayers.map((player) => {
    const record = data.cmjRecords.find((item) => item.playerId === player.id && item.date === filters.date);
    return record?.value ?? 0;
  });

  const alerts = selectedPlayers.flatMap((player) => {
    const wellness = data.wellness.find((x) => x.playerId === player.id && x.date === filters.date);
    const internal = data.internalLoads.find((x) => x.playerId === player.id && x.date === filters.date);
    const cmj = data.cmjRecords.find((x) => x.playerId === player.id && x.date === filters.date);
    const groupCmj = groupAverage(data.cmjRecords.filter((x) => x.date === filters.date).map((x) => x.value));
    const messages = [];
    if (averageWellness(wellness) < 3) messages.push({ player: player.name, text: 'Wellness bajo', tone: 'red' });
    if (player.status !== 'Disponible') messages.push({ player: player.name, text: `Estado ${player.status}`, tone: 'yellow' });
    if ((internal ? calculateInternalLoad(internal) : 0) > 500) messages.push({ player: player.name, text: 'Carga interna alta', tone: 'yellow' });
    if ((cmj?.value ?? 0) && (cmj?.value ?? 0) < groupCmj) messages.push({ player: player.name, text: 'CMJ por debajo del promedio', tone: 'yellow' });
    return messages;
  }).slice(0, 8);

  const availability = {
    disponibles: data.players.filter((p) => p.status === 'Disponible').length,
    molestia: data.players.filter((p) => p.status === 'Molestia').length,
    readaptacion: data.players.filter((p) => p.status === 'Readaptación').length,
    lesionados: data.players.filter((p) => p.status === 'Lesionado').length,
  };

  const chartData = selectedPlayers.map((player) => {
    const wellness = data.wellness.find((x) => x.playerId === player.id && x.date === filters.date);
    const load = data.internalLoads.find((x) => x.playerId === player.id && x.date === filters.date);
    return {
      jugador: player.name.split(' ')[0],
      wellness: averageWellness(wellness),
      carga: load ? calculateInternalLoad(load) : 0,
    };
  });

  return (
    <div className="grid">
      <AppHero title="Resumen general" />
      <GlobalFiltersBar />
      <div className="card"><div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><strong>Estado del sistema</strong><div className="btn-row"><span className="badge tone-green">Backend: {backendMode === 'supabase' ? 'Supabase' : 'Local'}</span><span className={`badge ${syncStatus === 'error' ? 'tone-red' : syncStatus === 'syncing' ? 'tone-yellow' : 'tone-green'}`}>Sync: {syncStatus}</span><button type="button" className="btn secondary" onClick={() => forceSync()}>Actualizar datos</button></div></div></div>

      <div className="grid grid-4">
        <KpiCard label="Jugadores filtrados" value={String(selectedPlayers.length)} />
        <KpiCard label="Wellness promedio" value={groupAverage(todayWellness).toFixed(1)} />
        <KpiCard label="Carga interna promedio" value={groupAverage(todayLoads).toFixed(0)} />
        <KpiCard label="CMJ promedio" value={`${groupAverage(todayCmj).toFixed(1)} cm`} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Centro de alertas</h3>
          {alerts.length ? alerts.map((alert, index) => <div key={`${alert.player}-${index}`} className={`alert-item tone-${alert.tone}`} style={{ marginBottom: 10 }}><strong>{alert.player}</strong><span>{alert.text}</span></div>) : <div className="empty">Sin alertas relevantes para la fecha seleccionada.</div>}
        </div>
        <div className="card">
          <h3>Disponibilidad diaria</h3>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <div className="mini-stat-card"><strong>Disponibles</strong><div className="muted-line">{availability.disponibles}</div></div>
            <div className="mini-stat-card"><strong>Molestia</strong><div className="muted-line">{availability.molestia}</div></div>
            <div className="mini-stat-card"><strong>Readaptación</strong><div className="muted-line">{availability.readaptacion}</div></div>
            <div className="mini-stat-card"><strong>Lesionados</strong><div className="muted-line">{availability.lesionados}</div></div>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Wellness y carga interna del día</h3>
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="jugador" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="wellness" name="Wellness" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="carga" name="Carga interna" fill="#93c5fd" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Estado actual del grupo</h3>
          <div className="grid" style={{ gap: 12 }}>
            {selectedPlayers.map((player) => {
              const record = data.wellness.find((item) => item.playerId === player.id && item.date === filters.date);
              return (
                <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid #edf2f7' }}>
                  <div>
                    <strong>{player.name}</strong>
                    <div style={{ color: '#5d6b82', marginTop: 4 }}>{player.position}</div>
                  </div>
                  <div className="btn-row">
                    <PlayerStatusBadge status={player.status} />
                    <WellnessBadge value={averageWellness(record)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
