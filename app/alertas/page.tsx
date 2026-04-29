'use client';

import Link from 'next/link';
import { AlertTriangle, Bell, CheckCircle2, ClipboardList, Info } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { buildGlobalAlertCenter } from '@/lib/strategic-helpers';
import { formatDateShort, type OperationalAlert } from '@/lib/operational-helpers';

const toneForLevel = (level: OperationalAlert['level']) => level === 'critical' ? 'red' : level === 'warning' ? 'amber' : 'blue';
const labelForLevel = (level: OperationalAlert['level']) => level === 'critical' ? 'Crítica' : level === 'warning' ? 'Atención' : 'Informativa';
const iconForLevel = (level: OperationalAlert['level']) => level === 'critical' ? AlertTriangle : level === 'warning' ? Bell : Info;

const AlertList = ({ title, subtitle, items }: { title: string; subtitle: string; items: OperationalAlert[] }) => (
  <div className="card">
    <SectionHeader eyebrow="Alertas" title={title} subtitle={subtitle} />
    <div className="alert-center-list">
      {items.map((alert) => {
        const Icon = iconForLevel(alert.level);
        return (
          <div key={alert.id} className={`alert-center-row ui-tone-${toneForLevel(alert.level)}`}>
            <div className="alert-center-icon"><Icon size={18} /></div>
            <div>
              <strong>{alert.title}</strong>
              <p>{alert.description}</p>
              {alert.action ? <span>{alert.action}</span> : null}
            </div>
            <StatusBadge text={labelForLevel(alert.level)} tone={toneForLevel(alert.level)} />
          </div>
        );
      })}
      {!items.length ? <EmptyState icon="check" title="Sin alertas en esta categoría" text="Sin novedades." /> : null}
    </div>
  </div>
);

export default function AlertCenterPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const center = buildGlobalAlertCenter(data, filters, activeCategory);

  return (
    <div className="grid alert-center-page">
      <AppHero title="Centro de alertas" subtitle={`Prioridades operativas del staff · ${activeCategory === 'all' ? 'Todas' : categoryLabel(activeCategory)} · ${formatDateShort(filters.date)}`} />
      <GlobalFiltersBar />

      <div className="grid grid-4">
        <KpiCard label="Críticas" value={String(center.critical.length)} tone={center.critical.length ? 'red' : 'green'} icon={<AlertTriangle size={18} />} trend="Atención inmediata" />
        <KpiCard label="Atención" value={String(center.warning.length)} tone="amber" icon={<Bell size={18} />} trend="Control preventivo" />
        <KpiCard label="Informativas" value={String(center.info.length)} tone="blue" icon={<Info size={18} />} trend="Seguimiento operativo" />
        <KpiCard label="Tareas" value={String(center.tasks.length)} tone="dark" icon={<ClipboardList size={18} />} trend="Pendientes del día" />
      </div>

      <div className="card alert-command-strip">
        <div>
          <span className="section-eyebrow">Priorización</span>
          <h3>Acciones sugeridas</h3>
          <p className="muted-line">Las alertas no bloquean la operación; orientan al staff sobre qué revisar primero.</p>
        </div>
        <div className="btn-row">
          <Link className="btn secondary" href="/disponibilidad">Centro médico</Link>
          <Link className="btn secondary" href="/carga">Centro de carga</Link>
          <Link className="btn secondary" href="/wellness">Centro wellness</Link>
          <Link className="btn" href="/registro"><CheckCircle2 size={16} />Registrar datos</Link>
        </div>
      </div>

      <div className="grid grid-2">
        <AlertList title="Alertas críticas" subtitle="Lesiones, expulsiones o situaciones que requieren acción inmediata." items={center.critical} />
        <AlertList title="Alertas de atención" subtitle="Wellness bajo, carga alta, molestias y controles preventivos." items={center.warning} />
      </div>
      <div className="grid grid-2">
        <AlertList title="Alertas informativas" subtitle="Datos incompletos, baja exposición o información para seguimiento." items={center.info} />
        <div className="card">
          <SectionHeader eyebrow="Checklist" title="Tareas pendientes" subtitle="Lo mínimo para cerrar el día con datos confiables." />
          <div className="alert-center-list">
            {center.tasks.map((task) => (
              <div key={task.id} className="alert-center-row ui-tone-blue">
                <div className="alert-center-icon"><ClipboardList size={18} /></div>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.description}</p>
                  {task.action ? <span>{task.action}</span> : null}
                </div>
              </div>
            ))}
            {!center.tasks.length ? <EmptyState icon="check" title="No hay tareas críticas" text="La operación diaria está completa con los datos actuales." /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
