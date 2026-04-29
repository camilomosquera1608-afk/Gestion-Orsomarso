'use client';

import Link from 'next/link';
import { Activity, HeartPulse, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { PlayerStatusBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { buildAvailabilityCenter } from '@/lib/strategic-helpers';
import { formatDateShort } from '@/lib/operational-helpers';

export default function AvailabilityPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const center = buildAvailabilityCenter(data, filters, activeCategory);

  return (
    <div className="grid availability-page">
      <AppHero
        title="Centro médico y disponibilidad"
        subtitle={`Estado del plantel, incidencias y readaptación · ${activeCategory === 'all' ? 'Todas' : categoryLabel(activeCategory)} · ${formatDateShort(filters.date)}`}
      />
      <GlobalFiltersBar />

      <div className="grid grid-4">
        <KpiCard label="Disponibles" value={String(center.statusCounts.Disponible)} tone="green" icon={<Users size={18} />} trend="Habilitados para planificar" />
        <KpiCard label="Molestia" value={String(center.statusCounts.Molestia)} tone="amber" icon={<Stethoscope size={18} />} trend="Control preventivo" />
        <KpiCard label="Readaptación" value={String(center.statusCounts.Readaptación)} tone="blue" icon={<Activity size={18} />} trend="Carga progresiva" />
        <KpiCard label="Lesionados" value={String(center.statusCounts.Lesionado)} tone="red" icon={<HeartPulse size={18} />} trend="Seguimiento médico" />
      </div>

      <div className="card medical-command-card">
        <SectionHeader
          eyebrow="Disponibilidad"
          title="Mapa médico del plantel"
          subtitle="Disponibilidad e incidencias."
          action={<Link className="btn secondary" href="/jugadores">Ver plantilla</Link>}
        />
        <div className="availability-board">
          {center.rows.map((row) => (
            <Link href={`/jugadores/${row.player.id}`} key={row.player.id} className={`availability-row ui-tone-${row.tone}`}>
              <div className="availability-main">
                <div className="player-avatar">{row.player.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{row.player.name}</strong>
                  <span>{row.player.position} · {categoryLabel(row.player.category)}</span>
                </div>
              </div>
              <PlayerStatusBadge status={row.player.status} />
              <div className="availability-metrics">
                <span>Wellness {row.latestWellness ? row.latestWellness.toFixed(1) : '—'}</span>
                <span>{row.todayMinutes} min hoy</span>
                <span>{row.weeklyMinutes} min periodo</span>
              </div>
              <div className="availability-note">
                <strong>{row.recommendation}</strong>
                {row.latestMedicalObservation ? <span>{row.latestMedicalObservation}</span> : <span>Sin observación médica reciente.</span>}
              </div>
            </Link>
          ))}
          {!center.rows.length ? <EmptyState title="No hay jugadores visibles" text="Ajusta filtros de categoría, posición o estado para ver disponibilidad." /> : null}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Readaptación" title="Jugadores en seguimiento" subtitle="Control de disponibilidad y carga progresiva." />
          <div className="medical-focus-list">
            {center.rows.filter((row) => row.player.status !== 'Disponible').map((row) => (
              <div key={row.player.id} className="medical-focus-item">
                <div>
                  <strong>{row.player.name}</strong>
                  <span>{row.player.status} · {row.player.position}</span>
                </div>
                <StatusBadge text={row.recommendation} tone={row.tone} />
              </div>
            ))}
            {!center.rows.some((row) => row.player.status !== 'Disponible') ? <EmptyState icon="check" title="Plantel sin incidencias activas" text="Sin incidencias." /> : null}
          </div>
        </div>
        <div className="card">
          <SectionHeader eyebrow="Historial" title="Observaciones médicas recientes" subtitle="Incidencias registradas desde competencia o estado del jugador." />
          <div className="medical-focus-list">
            {center.recentMedical.map((record) => {
              const player = data.players.find((item) => item.id === record.playerId);
              return (
                <div key={record.id} className="medical-focus-item">
                  <div>
                    <strong>{player?.name ?? 'Jugador'}</strong>
                    <span>{formatDateShort(record.date)} · vs {record.opponent}</span>
                  </div>
                  <span className="muted-line">{record.medicalObservation || record.medicalStatus || 'Sin detalle'}</span>
                </div>
              );
            })}
            {!center.recentMedical.length ? <EmptyState icon="check" title="Sin incidencias médicas recientes" text="Cuando existan observaciones médicas, aparecerán en este panel." /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
