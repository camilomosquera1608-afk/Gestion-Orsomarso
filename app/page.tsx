'use client';

import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { PlayerStatusBadge, WellnessBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { averageWellness, calculateInternalLoad, groupAverage } from '@/lib/utils';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function HomePage() {
  const { data, filters, backendMode, syncStatus, forceSync } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;

  const selectedPlayers = data.players.filter((player) =>
    (activeCategory === 'all' || player.category === activeCategory) &&
    (filters.playerId === 'all' || player.id === filters.playerId) &&
    (filters.position === 'all' || player.position === filters.position) &&
    (filters.status === 'all' || player.status === filters.status)
  );

  const todayWellness = selectedPlayers.map((player) => averageWellness(data.wellness.find((item) => item.playerId === player.id && item.date === filters.date)));
  const todayLoads = selectedPlayers.map((player) => {
    const record = data.internalLoads.find((item) => item.playerId === player.id && item.date === filters.date);
    return record ? calculateInternalLoad(record) : 0;
  });
  const todayCmj = selectedPlayers.map((player) => data.cmjRecords.find((item) => item.playerId === player.id && item.date === filters.date)?.value ?? 0);

  const availabilitySummary = {
    disponibles: selectedPlayers.filter((p) => p.status === 'Disponible').length,
    molestia: selectedPlayers.filter((p) => p.status === 'Molestia').length,
    readaptacion: selectedPlayers.filter((p) => p.status === 'Readaptación').length,
    lesionados: selectedPlayers.filter((p) => p.status === 'Lesionado').length,
  };
  const alertItems = [
    ...selectedPlayers.filter((player) => !data.wellness.find((item) => item.playerId === player.id && item.date === filters.date)).map((player) => `${player.name}: sin wellness del día`),
    ...selectedPlayers.filter((player) => !data.internalLoads.find((item) => item.playerId === player.id && item.date === filters.date)).map((player) => `${player.name}: sin carga interna del día`),
    ...selectedPlayers.filter((player) => player.status === 'Lesionado').map((player) => `${player.name}: lesión activa`),
    ...selectedPlayers.filter((player) => player.status === 'Molestia').map((player) => `${player.name}: molestia activa`),
  ].slice(0, 10);

  const chartData = selectedPlayers.map((player) => {
    const wellness = data.wellness.find((x) => x.playerId === player.id && x.date === filters.date);
    const load = data.internalLoads.find((x) => x.playerId === player.id && x.date === filters.date);
    return { jugador: player.name.split(' ')[0], wellness: averageWellness(wellness), carga: load ? calculateInternalLoad(load) : 0 };
  });

  return (
    <div className="grid">
      <AppHero title="Resumen general" subtitle={`Orsomarso SC Performance · ${master ? 'Maestro' : categoryLabel(activeCategory)}`} />
      <GlobalFiltersBar />
      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Estado del sistema</strong>
          <div className="btn-row">
            <span className="badge tone-green">Backend: {backendMode === 'supabase' ? 'Supabase' : 'Local'}</span>
            <span className={`badge ${syncStatus === 'error' ? 'tone-red' : syncStatus === 'syncing' ? 'tone-yellow' : 'tone-green'}`}>Sync: {syncStatus}</span>
            <button type="button" className="btn secondary" onClick={() => forceSync()}>Actualizar datos</button>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <KpiCard label="Jugadores visibles" value={String(selectedPlayers.length)} />
        <KpiCard label="Wellness promedio" value={groupAverage(todayWellness).toFixed(1)} />
        <KpiCard label="Carga interna promedio" value={groupAverage(todayLoads).toFixed(0)} />
        <KpiCard label="CMJ promedio" value={`${groupAverage(todayCmj).toFixed(1)} cm`} />
      </div>

      <div className="grid grid-4">
        <KpiCard label="Disponibles" value={String(availabilitySummary.disponibles)} />
        <KpiCard label="Molestia" value={String(availabilitySummary.molestia)} />
        <KpiCard label="Readaptación" value={String(availabilitySummary.readaptacion)} />
        <KpiCard label="Lesionados" value={String(availabilitySummary.lesionados)} />
      </div>

      <div className="card">
        <h3>Alertas inteligentes</h3>
        {alertItems.length ? <div className="grid" style={{ gap: 10 }}>{alertItems.map((item) => <div key={item} className="alert-item tone-yellow">{item}</div>)}</div> : <div className="empty">Sin alertas relevantes en la fecha seleccionada.</div>}
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
                    <div style={{ color: '#5d6b82', marginTop: 4 }}>{player.position} · {categoryLabel(player.category)}</div>
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
