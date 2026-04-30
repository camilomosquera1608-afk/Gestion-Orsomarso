'use client';

import { Activity, AlertTriangle, HeartPulse, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { PlayerStatusBadge, WellnessBadge } from '@/components/status-badge';
import { DataQualityPanel, EmptyState, OperationalAlertPanel, PlayerStatusCard, SectionHeader } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { averageWellness, findMicrocycleByDate, groupAverage } from '@/lib/utils';
import { categoryLabel } from '@/lib/labels';
import { buildDailyOperations } from '@/lib/operational-helpers';

export default function DiarioPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const ops = buildDailyOperations(data, filters, activeCategory);
  const youthSimple = activeCategory !== 'Sub20';
  const selectedMicrocycle = data.microcycles.find((microcycle) => microcycle.id === filters.microcycleId);
  const detectedMicrocycle = findMicrocycleByDate(data.microcycles, filters.date, filters.microcycleId, activeCategory);
  const visibleMicrocycle = filters.date ? detectedMicrocycle : selectedMicrocycle;
  const microcycleNotice = filters.date
    ? detectedMicrocycle
      ? 'Microciclo activo para esta fecha: ' + detectedMicrocycle.name
      : 'No hay microciclo asignado para esta fecha.'
    : selectedMicrocycle
      ? selectedMicrocycle.name + ' está seleccionado, pero aún no tiene rango de fechas. Asígnale fecha de inicio y fin en Microciclo.'
      : 'No hay microciclo seleccionado.';

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

  const chartDates = Array.from(new Set([
    ...data.wellness.map((record) => record.date),
    ...data.externalLoads.map((record) => record.date),
  ]))
    .filter((date) => {
      const start = visibleMicrocycle?.startDate;
      const end = visibleMicrocycle?.endDate;
      return start && end ? date >= start && date <= end : date === filters.date;
    })
    .sort();
  const lineData = chartDates.map((date) => ({
    date: date.slice(5),
    wellness: groupAverage(players.map((player) => averageWellness(data.wellness.find((x) => x.playerId === player.id && x.date === date)))),
    minutos: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.min ?? 0)),
    rpe: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.rpe ?? 0)),
  }));

  const playersWithoutWellness = players.filter((player) => !data.wellness.find((x) => x.playerId === player.id && x.date === filters.date));
  const playersWithoutLoad = players.filter((player) => !data.externalLoads.find((x) => x.playerId === player.id && x.date === filters.date));
  const medicalAlerts = players.filter((player) => player.status !== 'Disponible').map((player) => `${player.name}: ${player.status}`);
  const alertItems = [
    ...medicalAlerts,
    ...playersWithoutWellness.slice(0, 5).map((player) => `${player.name}: sin wellness`),
    ...playersWithoutLoad.slice(0, 5).map((player) => `${player.name}: sin carga externa`),
  ];

  return (
    <div className="grid">
      <AppHero title="Parte diario del equipo" subtitle={youthSimple ? 'Control diario simplificado por categoría.' : 'Monitoreo operativo de wellness, carga y estado médico.'} />
      <GlobalFiltersBar />

      <div className="grid grid-2">
        <DataQualityPanel percent={ops.dataQualityPercent} items={ops.dataQualityItems} />
        <OperationalAlertPanel title="Centro de alertas diario" alerts={ops.alerts} />
      </div>

      <div className="card toolbar">
        <div>
          <span className="section-eyebrow">Contexto activo</span>
          <h3 style={{ margin: 0 }}>{microcycleNotice}</h3>
          <div className="muted-line">Fecha, categoría y microciclo determinan todos los cálculos de esta vista.</div>
        </div>
        <span className={`status-badge ${detectedMicrocycle ? 'ui-tone-blue' : 'ui-tone-amber'}`}>{detectedMicrocycle ? 'Microciclo detectado' : 'Revisar rango'}</span>
      </div>

      <div className="grid grid-4">
        <KpiCard label="Wellness promedio" value={groupAverage(tableRows.map((r) => r.wellnessAvg)).toFixed(1)} tone="blue" icon={<HeartPulse size={18} />} trend="Promedio del grupo" />
        <KpiCard label="MIN promedio" value={groupAverage(tableRows.map((r) => r.external?.min ?? 0)).toFixed(0)} tone="dark" icon={<Activity size={18} />} trend="Carga diaria" />
        <KpiCard label="RPE promedio" value={groupAverage(tableRows.map((r) => r.external?.rpe ?? 0)).toFixed(1)} tone="amber" trend="Percepción de esfuerzo" />
        <KpiCard label="Jugadores visibles" value={String(players.length)} tone="green" icon={<Users size={18} />} trend={categoryLabel(activeCategory)} />
      </div>

      <div className="command-layout">
        <div className="grid">
          <div className="card">
            <SectionHeader eyebrow="Tendencia" title="Comportamiento diario del grupo" subtitle="Wellness y minutos en el rango operativo." />
            {lineData.length ? (
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="wellness" name="Wellness" stroke="#1557d6" strokeWidth={3} />
                    <Line yAxisId="right" type="monotone" dataKey="minutos" name="MIN" stroke="#60a5fa" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState title="Sin datos para graficar" text="Carga wellness o sesión para la fecha seleccionada." />}
          </div>
          <div className="card">
            <SectionHeader eyebrow="Carga" title="RPE del día" subtitle="Distribución individual de esfuerzo percibido." />
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={tableRows.map((item) => ({ jugador: item.player.name.split(' ')[0], rpe: item.external?.rpe ?? 0 }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" />
                  <YAxis dataKey="jugador" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="rpe" name="RPE" fill="#1557d6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="grid">
          <OperationalAlertPanel title="Alertas del día" alerts={ops.alerts} />
          <div className="card">
            <SectionHeader eyebrow="Pendientes" title="Registros faltantes" subtitle="Jugadores que requieren completar datos." />
            <div className="grid" style={{ gap: 10 }}>
              <KpiCard label="Sin wellness" value={String(playersWithoutWellness.length)} tone="amber" icon={<AlertTriangle size={18} />} />
              <KpiCard label="Sin carga" value={String(playersWithoutLoad.length)} tone="amber" icon={<Activity size={18} />} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Plantilla" title="Detalle diario por jugador" subtitle="Estado, wellness y métricas del día." />
        <div className="grid" style={{ gap: 12 }}>
          {tableRows.map((row) => (
            <PlayerStatusCard
              key={row.player.id}
              name={row.player.name}
              meta={`${row.player.position} · ${categoryLabel(row.player.category)}`}
              status={<><PlayerStatusBadge status={row.player.status} /><WellnessBadge value={row.wellnessAvg} /></>}
              right={<span className="muted-line">MIN {row.external?.min ?? '-'} · RPE {row.external?.rpe ?? '-'}</span>}
            />
          ))}
          {!tableRows.length ? <EmptyState title="No hay jugadores para mostrar" text="Ajusta filtros o carga la plantilla." /> : null}
        </div>
      </div>
    </div>
  );
}
