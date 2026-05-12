'use client';

import Link from 'next/link';
import { Brain, HeartPulse, Moon, Smile, Users } from 'lucide-react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { buildWellnessCenter } from '@/lib/strategic-helpers';
import { averageWellness } from '@/lib/utils';
import { formatDateShort } from '@/lib/operational-helpers';

export default function WellnessCenterPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const center = buildWellnessCenter(data, filters, activeCategory);
  const activePeriod = center.microcycle?.startDate && center.microcycle?.endDate
    ? `${center.microcycle.name} · ${formatDateShort(center.microcycle.startDate)} - ${formatDateShort(center.microcycle.endDate)}`
    : formatDateShort(filters.date);
  const trend = center.dates.map((date) => {
    const records = center.records.filter((record) => record.date === date);
    return {
      fecha: formatDateShort(date),
      Wellness: Number(center.records.length ? records.length ? (records.reduce((acc, record) => acc + averageWellness(record), 0) / records.length).toFixed(1) : 0 : 0),
      Registros: records.length,
    };
  });

  return (
    <div className="grid wellness-center-page">
      <AppHero heroClass="hero-wellness" title="Centro de wellness" subtitle={`Bienestar, fatiga y registros subjetivos · ${activePeriod}`} />
      <GlobalFiltersBar />

      <div className="grid grid-5">
        <KpiCard label="Wellness" value={center.averages.wellness.toFixed(1)} tone="blue" icon={<HeartPulse size={18} />} trend="Promedio fecha activa" />
        <KpiCard label="Sueño" value={center.averages.sleep.toFixed(1)} tone="green" icon={<Moon size={18} />} trend="Calidad reportada" />
        <KpiCard label="Energía" value={center.averages.fatigue.toFixed(1)} tone="amber" icon={<Brain size={18} />} trend="Disposición reportada" />
        <KpiCard label="Estado muscular" value={center.averages.musclePain.toFixed(1)} tone="red" icon={<ActivityIcon />} trend="5 = sin dolor" />
        <KpiCard label="Sin registro" value={String(center.missingToday.length)} tone="dark" icon={<Users size={18} />} trend="Pendiente del día" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Tendencia" title="Evolución del wellness" subtitle="Promedio diario del periodo activo." />
          {trend.some((item) => item.Wellness > 0) ? (
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="fecha" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Wellness" stroke="#1557d6" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="Sin tendencia disponible" text="Carga registros wellness para visualizar evolución." />}
        </div>
        <div className="card">
          <SectionHeader eyebrow="Alertas" title="Jugadores en zona de atención" subtitle="Wellness bajo o sin registro para la fecha activa." />
          <div className="wellness-alert-list">
            {center.lowWellness.slice(0, 10).map((row) => (
              <Link href={`/jugadores/${row.player.id}`} key={row.player.id} className="wellness-alert-row">
                <div>
                  <strong>{row.player.name}</strong>
                  <span>{row.player.position} · {categoryLabel(row.player.category)}</span>
                </div>
                <StatusBadge text={row.recommendation} tone={row.tone} />
                <span>{row.average ? row.average.toFixed(1) : '—'}</span>
              </Link>
            ))}
            {center.missingToday.slice(0, 8).map((player) => (
              <Link href={`/jugadores/${player.id}`} key={`missing-${player.id}`} className="wellness-alert-row">
                <div>
                  <strong>{player.name}</strong>
                  <span>{player.position} · {categoryLabel(player.category)}</span>
                </div>
                <StatusBadge text="Sin registro" tone="neutral" />
                <span>—</span>
              </Link>
            ))}
            {!center.lowWellness.length && !center.missingToday.length ? <EmptyState icon="check" title="Wellness en orden" text="No hay alertas subjetivas con los filtros actuales." /> : null}
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Plantel" title="Detalle de wellness por jugador" subtitle="Lectura individual para tomar decisiones de recuperación." />
        <div className="professional-table-wrap">
          <table className="professional-table">
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Posición</th>
                <th>Promedio</th>
                <th>Sueño</th>
                <th>Energía</th>
                <th>Estrés</th>
                <th>Músculo</th>
                <th>Ánimo</th>
                <th>Lectura</th>
              </tr>
            </thead>
            <tbody>
              {center.rows.map((row) => (
                <tr key={row.player.id}>
                  <td><Link href={`/jugadores/${row.player.id}`}><strong>{row.player.name}</strong></Link></td>
                  <td>{row.player.position}</td>
                  <td>{row.average ? row.average.toFixed(1) : '—'}</td>
                  <td>{row.sleep || '—'}</td>
                  <td>{row.fatigue || '—'}</td>
                  <td>{row.stress || '—'}</td>
                  <td>{row.musclePain || '—'}</td>
                  <td>{row.mood || '—'}</td>
                  <td><StatusBadge text={row.recommendation} tone={row.tone} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!center.rows.length ? <EmptyState title="No hay jugadores visibles" text="Ajusta filtros o carga registros wellness." /> : null}
        </div>
      </div>
    </div>
  );
}

const ActivityIcon = () => <Smile size={18} />;
