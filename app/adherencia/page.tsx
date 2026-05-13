'use client';

import { Activity, AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { buildAdherenceDashboard } from '@/lib/sport-science';

export default function AdherencePage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const rows = buildAdherenceDashboard(data, filters.date, activeCategory);
  const avg = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.adherencePct, 0) / rows.length) : 0;
  const low = rows.filter((row) => row.adherencePct < 70).length;
  const high = rows.filter((row) => row.adherencePct >= 85).length;
  const last7 = rows.map((row) => ({ ...row, dates: row.dates.slice(-7) }));

  return (
    <div className="grid">
      <AppHero title="Adherencia al registro" subtitle={`Wellness últimas 4 semanas · ${activeCategory === 'all' ? 'Todas' : categoryLabel(activeCategory)} · confianza del dato`} />
      <GlobalFiltersBar />

      <div className="grid grid-4">
        <KpiCard label="Adherencia promedio" value={`${avg}%`} tone={avg >= 85 ? 'green' : avg >= 70 ? 'amber' : 'red'} icon={<ClipboardList size={18} />} trend="Wellness últimos 28 días" />
        <KpiCard label="Baja adherencia" value={String(low)} tone={low ? 'red' : 'green'} icon={<AlertTriangle size={18} />} trend="Jugadores <70%" />
        <KpiCard label="Alta confianza" value={String(high)} tone="green" icon={<CheckCircle2 size={18} />} trend="Jugadores ≥85%" />
        <KpiCard label="Jugadores" value={String(rows.length)} tone="blue" icon={<Activity size={18} />} trend="Con seguimiento activo" />
      </div>

      <div className="card">
        <SectionHeader eyebrow="Tabla" title="Porcentaje de días con wellness registrado" subtitle="La adherencia baja reduce la confianza de cualquier recomendación individual." />
        <div className="table-scroll">
          <table className="pro-table compact-table">
            <thead>
              <tr><th>Jugador</th><th>Adherencia</th><th>Registrados</th><th>Confianza</th><th>Últimos días sin dato</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.playerId}>
                  <td><strong>{row.name}</strong></td>
                  <td><StatusBadge text={`${row.adherencePct}%`} tone={row.tone} /></td>
                  <td>{row.registeredDays}/{row.totalDays}</td>
                  <td><StatusBadge text={row.confidenceLabel} tone={row.tone} /></td>
                  <td>{row.missingDates.slice(-5).join(' · ') || 'Completo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Heatmap" title="Días sin dato" subtitle="Verde = registró wellness · rojo = sin registro. Se muestran los últimos 7 días para lectura rápida." />
        <div className="table-scroll">
          <table className="pro-table compact-table">
            <thead>
              <tr>
                <th>Jugador</th>
                {last7[0]?.dates.map((day) => <th key={day.date}>{day.date.slice(5)}</th>)}
              </tr>
            </thead>
            <tbody>
              {last7.map((row) => (
                <tr key={row.playerId}>
                  <td><strong>{row.name}</strong></td>
                  {row.dates.map((day) => <td key={day.date}><StatusBadge text={day.registered ? 'OK' : 'Sin dato'} tone={day.registered ? 'green' : 'red'} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
