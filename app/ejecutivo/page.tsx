'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, BarChart3, Bell, Briefcase, ClipboardList, HeartPulse, ShieldCheck, Trophy, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { DataQualityPanel, EmptyState, OperationalAlertPanel, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { buildExecutiveCenter, activeCategoryLabel } from '@/lib/strategic-helpers';
import { formatDateShort } from '@/lib/operational-helpers';
import { formatMatchScore } from '@/lib/performance-helpers';

export default function ExecutivePage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const center = buildExecutiveCenter(data, filters, activeCategory);
  const activeCategoryText = activeCategory === 'all' ? 'todas las categorías' : categoryLabel(activeCategory);

  const trendData = center.load.dailyTrend.map((item) => ({ fecha: item.date, Min: item.min, Carga: item.carga }));

  return (
    <div className="grid executive-page">
      <AppHero
        title="Panel ejecutivo"
        subtitle={`Dirección deportiva · ${activeCategoryText} · ${formatDateShort(filters.date)}`}
      />
      <GlobalFiltersBar />

      <section className="executive-cover card">
        <div>
          <span className="section-eyebrow">Orsomarso Performance</span>
          <h2>Centro de control deportivo</h2>
          <p>Lectura ejecutiva del plantel: disponibilidad, carga, wellness, competencia y alertas críticas para tomar decisiones rápidas.</p>
        </div>
        <div className="executive-cover-badges">
          <StatusBadge text="Local" tone="green" />
          <StatusBadge text={activeCategoryLabel(activeCategory)} tone="blue" />
          {center.ops.activeMicrocycle ? <StatusBadge text={center.ops.activeMicrocycle.name} tone="dark" /> : <StatusBadge text="Sin microciclo" tone="amber" />}
        </div>
      </section>

      <div className="grid grid-5">
        <KpiCard label="Disponibles" value={String(center.availability.statusCounts.Disponible)} icon={<Users size={18} />} tone="green" trend="Plantel habilitado" />
        <KpiCard label="Molestia" value={String(center.availability.statusCounts.Molestia)} icon={<AlertTriangle size={18} />} tone="amber" trend="Control preventivo" />
        <KpiCard label="Readaptación" value={String(center.availability.statusCounts.Readaptación)} icon={<Activity size={18} />} tone="blue" trend="Carga controlada" />
        <KpiCard label="Lesionados" value={String(center.availability.statusCounts.Lesionado)} icon={<HeartPulse size={18} />} tone="red" trend="Área médica" />
        <KpiCard label="Alertas críticas" value={String(center.criticalAlerts.length)} icon={<Bell size={18} />} tone={center.criticalAlerts.length ? 'red' : 'green'} trend="Prioridad del staff" />
      </div>

      <div className="grid grid-4">
        <KpiCard label="Wellness promedio" value={center.ops.averages.wellness.toFixed(1)} tone="blue" trend="Fecha activa" />
        <KpiCard label="Carga semanal" value={center.load.totals.internalLoad.toFixed(0)} tone="dark" trend="UA acumuladas" />
        <KpiCard label="MIN acumulados" value={String(center.load.totals.minutes)} tone="green" trend="Periodo activo" />
        <KpiCard label="Balance competitivo" value={`${center.competition.balance.wins}-${center.competition.balance.draws}-${center.competition.balance.losses}`} icon={<Trophy size={18} />} tone="amber" trend="V-E-D" />
      </div>

      <div className="executive-layout">
        <DataQualityPanel percent={center.ops.dataQualityPercent} items={center.ops.dataQualityItems} />
        <OperationalAlertPanel title="Alertas para dirección deportiva" alerts={center.ops.alerts} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Tendencias" title="Lectura ejecutiva" subtitle="Indicadores listos para presentar al cuerpo técnico." />
          <div className="executive-insight-list">
            {center.trends.map((item) => (
              <div key={item} className="executive-insight"><Briefcase size={18} /><strong>{item}</strong></div>
            ))}
          </div>
        </div>
        <div className="card">
          <SectionHeader eyebrow="Competencia" title="Estado competitivo" subtitle="Último y próximo partido disponibles en la base local." />
          {center.competition.latest ? (
            <div className="executive-match-summary">
              <strong>Último partido</strong>
              <span>{formatDateShort(center.competition.latest.date)} · {center.competition.latest.venue ?? 'Local'}</span>
              <h3>Orsomarso SC {formatMatchScore(center.competition.latest)} {center.competition.latest.opponent}</h3>
              <StatusBadge text={center.competition.latest.resultType ?? 'Resultado'} tone={center.competition.latest.resultType === 'Victoria' ? 'green' : center.competition.latest.resultType === 'Derrota' ? 'red' : 'blue'} />
            </div>
          ) : <EmptyState title="Sin competencia registrada" text="Cuando cargues partidos, aparecerá el resumen competitivo ejecutivo." />}
          {center.competition.upcoming ? <div className="muted-line">Próximo partido: {formatDateShort(center.competition.upcoming.date)} vs {center.competition.upcoming.opponent}</div> : null}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Carga" title="Tendencia del periodo" subtitle="Carga interna y minutos por día del microciclo o fecha activa." />
          {trendData.length ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Carga" fill="#1557d6" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Min" fill="#93c5fd" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="Sin tendencia disponible" text="Carga registros para visualizar evolución." />}
        </div>
        <div className="card">
          <SectionHeader eyebrow="Acciones" title="Módulos estratégicos" subtitle="Accesos directos para operar como plataforma de club." />
          <div className="strategy-link-grid">
            <Link href="/disponibilidad" className="strategy-link"><HeartPulse size={18} /><strong>Centro médico</strong><span>Disponibilidad y readaptación.</span></Link>
            <Link href="/carga" className="strategy-link"><BarChart3 size={18} /><strong>Centro de carga</strong><span>Exposición y riesgo.</span></Link>
            <Link href="/wellness" className="strategy-link"><ShieldCheck size={18} /><strong>Centro wellness</strong><span>Bienestar y fatiga.</span></Link>
            <Link href="/alertas" className="strategy-link"><ClipboardList size={18} /><strong>Centro de alertas</strong><span>Prioridades del staff.</span></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
