'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, CalendarCheck2, ClipboardList, HeartPulse, ShieldCheck, Target, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { PlayerStatusBadge, WellnessBadge } from '@/components/status-badge';
import { DataQualityPanel, EmptyState, OperationalAlertPanel, PlayerStatusCard, SectionHeader, TaskChecklist } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { averageWellness, calculateInternalLoad, groupAverage } from '@/lib/utils';
import { buildDailyOperations, formatDateShort } from '@/lib/operational-helpers';

export default function HomePage() {
  const { data, filters, backendMode, syncStatus, forceSync } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const ops = buildDailyOperations(data, filters, activeCategory);

  const chartData = ops.players.map((player) => {
    const wellness = data.wellness.find((x) => x.playerId === player.id && x.date === filters.date);
    const internalLoad = data.internalLoads.find((x) => x.playerId === player.id && x.date === filters.date);
    return {
      jugador: player.name.split(' ')[0],
      wellness: averageWellness(wellness),
      carga: internalLoad ? calculateInternalLoad(internalLoad) : 0,
    };
  });

  const latestActivity = ops.recentActivity.length ? ops.recentActivity : [
    'Sin actividad reciente.',
  ];

  return (
    <div className="grid operational-dashboard">
      <AppHero
        title="Inicio"
        subtitle={`${master ? 'Vista general' : categoryLabel(activeCategory)} · ${formatDateShort(filters.date)}`}
      />
      <GlobalFiltersBar />

      <div className="command-overview-card card">
        <div>
          <span className="section-eyebrow">Flujo</span>
          <h3 style={{ margin: 0 }}>Rutina diaria</h3>
          <p className="muted-line">Wellness, disponibilidad, sesión, pendientes y cierre.</p>
        </div>
        <div className="workflow-steps">
          <span>1. Wellness</span>
          <span>2. Disponibilidad</span>
          <span>3. Sesión</span>
          <span>4. Pendientes</span>
          <span>5. Cierre</span>
        </div>
      </div>

      <div className="toolbar card">
        <div>
          <span className="section-eyebrow">Sistema</span>
          <h3 style={{ margin: 0 }}>Estado</h3>
          <div className="muted-line">Almacenamiento local activo.</div>
        </div>
        <div className="btn-row">
          <span className="status-badge ui-tone-green"><ShieldCheck size={14} />{backendMode === 'supabase' ? 'Supabase' : 'Local'}</span>
          <span className={`status-badge ${syncStatus === 'error' ? 'ui-tone-red' : syncStatus === 'syncing' ? 'ui-tone-amber' : 'ui-tone-blue'}`}>{syncStatus}</span>
          <button type="button" className="btn secondary" onClick={() => forceSync()}>Actualizar datos</button>
        </div>
      </div>

      <div className="grid grid-5">
        <KpiCard label="Disponibles" value={String(ops.statusCounts.Disponible)} tone="green" icon={<Users size={18} />} trend="Habilitados" />
        <KpiCard label="Molestia" value={String(ops.statusCounts.Molestia)} tone="amber" icon={<AlertTriangle size={18} />} trend="Prevención" />
        <KpiCard label="Readaptación" value={String(ops.statusCounts.Readaptación)} tone="blue" icon={<Activity size={18} />} trend="Controlado" />
        <KpiCard label="Lesionados" value={String(ops.statusCounts.Lesionado)} tone="red" icon={<HeartPulse size={18} />} trend="Médico" />
        <KpiCard label="Sin wellness" value={String(ops.statusCounts['Sin registro'])} tone="dark" icon={<ClipboardList size={18} />} trend="Pendientes" />
      </div>

      <div className="grid grid-4">
        <KpiCard label="Wellness promedio" value={ops.averages.wellness.toFixed(1)} tone="blue" trend="Promedio" />
        <KpiCard label="Carga interna promedio" value={ops.averages.internalLoad.toFixed(0)} tone="dark" trend="UA" />
        <KpiCard label="RPE promedio" value={ops.averages.rpe.toFixed(1)} tone="amber" trend="RPE" />
        <KpiCard label="MIN promedio" value={ops.averages.minutes.toFixed(0)} tone="green" trend="Sesión" />
      </div>

      <div className="command-layout">
        <div className="grid">
          <DataQualityPanel percent={ops.dataQualityPercent} items={ops.dataQualityItems} />
          <div className="card">
            <SectionHeader eyebrow="Monitoreo" title="Wellness y carga" />
            {chartData.length ? (
              <div style={{ width: '100%', height: 340 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="jugador" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="wellness" name="Wellness" fill="#1557d6" radius={[7, 7, 0, 0]} />
                    <Bar yAxisId="right" dataKey="carga" name="Carga interna" fill="#93c5fd" radius={[7, 7, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState title="Sin jugadores" text="Ajusta los filtros." />}
          </div>
        </div>

        <div className="grid">
          <TaskChecklist tasks={ops.tasks} />
          <OperationalAlertPanel alerts={ops.alerts} />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Actividad" title="Actividad reciente" />
          <div className="command-feed">
            {latestActivity.map((item) => (
              <div key={item} className="command-feed-item"><span className="command-feed-dot" /><strong>{item}</strong></div>
            ))}
          </div>
        </div>
        <div className="card">
          <SectionHeader eyebrow="Acciones" title="Accesos rápidos" />
          <div className="quick-action-grid">
            <Link className="quick-action-card" href="/disponibilidad"><div className="qa-icon"><HeartPulse size={18} /></div><strong>Centro médico</strong><span>Disponibilidad</span></Link>
            <Link className="quick-action-card" href="/carga"><div className="qa-icon"><Activity size={18} /></div><strong>Centro de carga</strong><span>Carga GPS</span></Link>
            <Link className="quick-action-card" href="/wellness"><div className="qa-icon"><CalendarCheck2 size={18} /></div><strong>Wellness</strong><span>Bienestar diario</span></Link>
            <Link className="quick-action-card" href="/competencia"><div className="qa-icon"><ClipboardList size={18} /></div><strong>Match Center</strong><span>Competencia</span></Link>
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Plantel" title="Seguimiento individual" />
        <div className="grid" style={{ gap: 12 }}>
          {ops.players.slice(0, 14).map((player) => {
            const record = data.wellness.find((item) => item.playerId === player.id && item.date === filters.date);
            const external = data.externalLoads.find((item) => item.playerId === player.id && item.date === filters.date);
            return (
              <PlayerStatusCard
                key={player.id}
                href={`/jugadores/${player.id}`}
                name={player.name}
                meta={`${player.position} · ${categoryLabel(player.category)}`}
                status={<><PlayerStatusBadge status={player.status} /><WellnessBadge value={averageWellness(record)} /></>}
                right={<span className="muted-line"><ClipboardList size={14} /> {external?.min ?? 0} min · RPE {external?.rpe ?? '-'}</span>}
              />
            );
          })}
          {!ops.players.length ? <EmptyState title="Sin jugadores" text="Ajusta los filtros." /> : null}
          {ops.players.length > 14 ? <div className="muted-line">Mostrando 14 de {ops.players.length}.</div> : null}
        </div>
      </div>
    </div>
  );
}
