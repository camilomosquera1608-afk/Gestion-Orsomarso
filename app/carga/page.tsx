'use client';

import Link from 'next/link';
import { AlertTriangle, BarChart3, Gauge, Timer, TrendingUp, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { buildLoadCenter } from '@/lib/strategic-helpers';
import { supportsGps } from '@/lib/report-utils';
import { formatDateShort } from '@/lib/operational-helpers';

export default function LoadCenterPage() {
  const { data, filters, isLoading } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const center = buildLoadCenter(data, filters, activeCategory);
  const gpsEnabled = supportsGps(activeCategory);
  const activePeriod = center.microcycle?.startDate && center.microcycle?.endDate
    ? `${center.microcycle.name} · ${formatDateShort(center.microcycle.startDate)} - ${formatDateShort(center.microcycle.endDate)}`
    : formatDateShort(filters.date);

  // Solo jugadores que tienen al menos un minuto registrado — evita filas fantasma
  const rowsWithData = center.rows.filter((row) => row.minutes > 0 || row.internalLoad > 0);
  const rowsEmpty = center.rows.filter((row) => row.minutes === 0 && row.internalLoad === 0);

  const playerChart = rowsWithData.slice(0, 10).map((row) => ({
    jugador: row.player.name.split(' ')[0],
    Carga: Number(row.internalLoad.toFixed(0)),
    Min: row.minutes,
  }));
  const gpsChart = rowsWithData.slice(0, 10).map((row) => ({
    jugador: row.player.name.split(' ')[0],
    Distancia: row.totalDistance,
    PL: Number(row.playerLoad.toFixed(0)),
    HSR: row.highSpeedDistance,
  }));

  const hasAnyLoad = rowsWithData.length > 0;

  if (isLoading) {
    return (
      <div className="grid">
        <AppHero heroClass="hero-carga" title="Centro de carga" subtitle="Cargando datos…" />
        <div className="card" style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          Sincronizando con Supabase…
        </div>
      </div>
    );
  }

  return (
    <div className="grid load-center-page">
      <AppHero heroClass="hero-carga" title="Centro de carga" subtitle={`Carga, RPE y volumen · ${activePeriod}${gpsEnabled ? ' · GPS' : ''}`} />
      <GlobalFiltersBar />

      {gpsEnabled && hasAnyLoad ? (
        <div className="card gps-catapult-panel">
          <SectionHeader eyebrow="Catapult U20" title="Dashboard GPS del microciclo" subtitle="Carga externa real: distancia, Player Load, alta velocidad y sprint. Solo visible para U20." />
          <div className="grid grid-4">
            <KpiCard label="Distancia total" value={`${center.totals.totalDistance.toFixed(0)} m`} tone="dark" trend="Catapult" />
            <KpiCard label="Player Load" value={center.totals.playerLoad.toFixed(0)} tone="blue" trend="Acumulado" />
            <KpiCard label="Alta velocidad" value={`${center.totals.highSpeedDistance.toFixed(0)} m`} tone="green" trend="HSR" />
            <KpiCard label="Vel. máxima" value={`${center.totals.maxVelocity.toFixed(1)} km/h`} tone="amber" trend="Pico" />
          </div>
          {gpsChart.length > 0 && (
            <div style={{ width: '100%', height: 300, marginTop: 16 }}>
              <ResponsiveContainer>
                <BarChart data={gpsChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="jugador" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Distancia" fill="#0f172a" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="HSR" fill="#16a34a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid grid-4">
        <KpiCard label="Carga acumulada" value={hasAnyLoad ? center.totals.internalLoad.toFixed(0) : '—'} tone="dark" icon={<Gauge size={18} />} trend="UA" />
        <KpiCard label="MIN acumulados" value={hasAnyLoad ? String(center.totals.minutes) : '—'} tone="green" icon={<Timer size={18} />} trend="Volumen" />
        <KpiCard label="RPE promedio" value={hasAnyLoad ? center.totals.avgRpe.toFixed(1) : '—'} tone="amber" icon={<TrendingUp size={18} />} trend="RPE" />
        <KpiCard label="Con carga" value={`${center.totals.playersWithLoad}/${center.rows.length}`} tone="blue" icon={<Users size={18} />} trend="Con datos" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Análisis" title="Top carga" />
          {playerChart.length ? (
            <div style={{ width: '100%', height: 340 }}>
              <ResponsiveContainer>
                <BarChart data={playerChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="jugador" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Carga" fill="#1557d6" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Min" fill="#93c5fd" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Sin carga registrada" text="Carga sesiones de entrenamiento para ver el análisis comparativo." />
          )}
        </div>
        <div className="card">
          <SectionHeader eyebrow="Riesgo" title="Seguimiento" />
          {hasAnyLoad ? (
            <>
              <div className="load-risk-grid">
                <div className="load-risk-panel ui-tone-amber">
                  <AlertTriangle size={18} />
                  <strong>Exposición alta</strong>
                  <span>{center.highLoad.length} jugador(es)</span>
                </div>
                <div className="load-risk-panel ui-tone-blue">
                  <BarChart3 size={18} />
                  <strong>Baja exposición</strong>
                  <span>{center.lowExposure.filter((r) => r.minutes > 0).length} jugador(es)</span>
                </div>
              </div>
              <div className="load-player-list">
                {[...center.highLoad, ...center.lowExposure.filter((r) => r.minutes > 0)].slice(0, 10).map((row) => (
                  <Link href={`/jugadores/${row.player.id}`} key={`${row.player.id}-${row.exposure}`} className="load-player-row">
                    <div>
                      <strong>{row.player.name}</strong>
                      <span>{row.player.position} · {categoryLabel(row.player.category)}</span>
                    </div>
                    <StatusBadge text={row.exposure} tone={row.tone} />
                    <span>{row.minutes} min · {row.internalLoad.toFixed(0)} UA</span>
                  </Link>
                ))}
                {!center.highLoad.length && !center.lowExposure.filter((r) => r.minutes > 0).length
                  ? <EmptyState icon="check" title="Sin alertas de carga" text="" />
                  : null}
              </div>
            </>
          ) : (
            <EmptyState title="Sin datos de carga" text="Registra al menos una sesión para ver el seguimiento de exposición." />
          )}
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Plantel" title="Ranking de carga" subtitle={`${rowsWithData.length} con carga · ${rowsEmpty.length} sin datos`} />
        {!hasAnyLoad && !center.rows.length ? (
          <EmptyState title="Sin jugadores en el período" text="Ajusta los filtros de fecha o microciclo." />
        ) : !hasAnyLoad ? (
          <EmptyState title="Ningún jugador tiene carga registrada en este período" text="Carga una sesión de entrenamiento primero." />
        ) : (
          <div className="professional-table-wrap">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Posición</th>
                  <th>MIN</th>
                  <th>RPE</th>
                  <th>Carga interna</th>
                  {gpsEnabled ? <>
                    <th>Distancia</th>
                    <th>PL</th>
                    <th>Vel. máx.</th>
                    <th>HSR</th>
                    <th>Sprints</th>
                  </> : null}
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {/* Primero jugadores con datos, luego los sin datos en gris */}
                {rowsWithData.map((row) => (
                  <tr key={row.player.id}>
                    <td><Link href={`/jugadores/${row.player.id}`}><strong>{row.player.name}</strong></Link></td>
                    <td>{row.player.position}</td>
                    <td>{row.minutes}</td>
                    <td>{row.avgRpe.toFixed(1)}</td>
                    <td>{row.internalLoad.toFixed(0)}</td>
                    {gpsEnabled ? <>
                      <td>{row.totalDistance.toFixed(0)} m</td>
                      <td>{row.playerLoad.toFixed(0)}</td>
                      <td>{row.maxVelocity.toFixed(1)}</td>
                      <td>{row.highSpeedDistance.toFixed(0)} m</td>
                      <td>{row.sprints}</td>
                    </> : null}
                    <td><StatusBadge text={row.exposure} tone={row.tone} /></td>
                  </tr>
                ))}
                {rowsEmpty.map((row) => (
                  <tr key={row.player.id} style={{ opacity: 0.45 }}>
                    <td><Link href={`/jugadores/${row.player.id}`}><strong>{row.player.name}</strong></Link></td>
                    <td>{row.player.position}</td>
                    <td style={{ color: '#94a3b8' }}>—</td>
                    <td style={{ color: '#94a3b8' }}>—</td>
                    <td style={{ color: '#94a3b8' }}>—</td>
                    {gpsEnabled ? <>
                      <td style={{ color: '#94a3b8' }}>—</td>
                      <td style={{ color: '#94a3b8' }}>—</td>
                      <td style={{ color: '#94a3b8' }}>—</td>
                      <td style={{ color: '#94a3b8' }}>—</td>
                      <td style={{ color: '#94a3b8' }}>—</td>
                    </> : null}
                    <td><StatusBadge text="Sin datos" tone="neutral" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
