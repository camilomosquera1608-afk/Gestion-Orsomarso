'use client';

import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Database,
  Gauge,
  HeartPulse,
  ShieldCheck,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge, type UiTone } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { computePlayerLoadRiskProfile, type DailyLoadDecisionState, type RiskDomain } from '@/lib/load-risk-engine';
import { formatDateShort } from '@/lib/operational-helpers';
import { supportsGps } from '@/lib/report-utils';
import { buildLoadCenter } from '@/lib/strategic-helpers';

const controlModules = [
  {
    href: '/carga',
    label: 'Resumen',
    icon: Gauge,
    text: 'Carga, riesgo, ACWR y decisión diaria en un solo tablero.',
  },
  {
    href: '/wellness',
    label: 'Wellness',
    icon: ShieldCheck,
    text: 'Respuesta subjetiva, dolor, sueño y adherencia de jugadores.',
  },
  {
    href: '/disponibilidad',
    label: 'Disponibilidad',
    icon: HeartPulse,
    text: 'Estado médico, restricciones corporales y readaptación.',
  },
  {
    href: '/riesgo',
    label: 'Riesgo detallado',
    icon: TrendingUp,
    text: 'Vista ampliada de alertas predictivas y contribuciones.',
  },
  {
    href: '/adherencia',
    label: 'Calidad del dato',
    icon: Database,
    text: 'Seguimiento de registros faltantes y confianza del análisis.',
  },
];

const domainLabels: Record<RiskDomain, string> = {
  fatigue: 'Fatiga / recuperación',
  overload: 'Sobrecarga',
  underexposure: 'Subexposición',
  muscleTendon: 'Músculo-tendinoso',
  dataQuality: 'Calidad del dato',
};

const domainNotes: Record<RiskDomain, string> = {
  fatigue: 'Wellness bajo, monotonía, strain o fatiga acumulada.',
  overload: 'ACWR, carga semanal y picos sobre el rango individual.',
  underexposure: 'Baja carga reciente o poca exposición antes de competir.',
  muscleTendon: 'Sprint, HSR, aceleraciones, dolor corporal e historial lesional.',
  dataQuality: 'Historial incompleto, wellness bajo en adherencia o falta de GPS.',
};

const decisionTone = (decision: DailyLoadDecisionState): UiTone => {
  if (decision === 'No campo' || decision === 'Trabajo modificado') return 'red';
  if (decision === 'Carga reducida' || decision === 'Control preventivo') return 'amber';
  if (decision === 'Compensatorio') return 'blue';
  return 'green';
};

const confidenceTone = (label: 'Alta' | 'Media' | 'Baja'): UiTone => {
  if (label === 'Alta') return 'green';
  if (label === 'Media') return 'amber';
  return 'red';
};

const round = (value: number, digits = 0) => Number(value.toFixed(digits));
const average = (values: number[]) => values.length ? values.reduce((acc, value) => acc + value, 0) / values.length : 0;

export default function LoadCenterPage() {
  const { data, filters, isLoading } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const center = buildLoadCenter(data, filters, activeCategory);
  const gpsEnabled = activeCategory === 'all' || supportsGps(activeCategory);
  const activePeriod = center.microcycle?.startDate && center.microcycle?.endDate
    ? `${center.microcycle.name} · ${formatDateShort(center.microcycle.startDate)} - ${formatDateShort(center.microcycle.endDate)}`
    : formatDateShort(filters.date);

  const rowsWithData = center.rows.filter((row) => row.minutes > 0 || row.internalLoad > 0);
  const rowsEmpty = center.rows.filter((row) => row.minutes === 0 && row.internalLoad === 0);
  const hasAnyLoad = rowsWithData.length > 0;

  const riskRows = center.rows
    .map((row) => ({
      row,
      profile: computePlayerLoadRiskProfile({ data, player: row.player, date: filters.date }),
    }))
    .sort((a, b) => b.profile.riskScore - a.profile.riskScore || b.profile.load.today.effectiveLoad - a.profile.load.today.effectiveLoad);

  const highRiskCount = riskRows.filter(({ profile }) => profile.riskTone === 'red').length;
  const moderateRiskCount = riskRows.filter(({ profile }) => profile.riskTone === 'amber').length;
  const lowConfidenceCount = riskRows.filter(({ profile }) => profile.dataConfidence.label === 'Baja').length;
  const adjustedPlanCount = riskRows.filter(({ profile }) => profile.decision !== 'Carga completa').length;
  const averageAcwr = average(riskRows.map(({ profile }) => profile.acwr.primary.rolling).filter((value) => value > 0));
  const averageConfidence = average(riskRows.map(({ profile }) => profile.dataConfidence.score));

  const domainRows = (Object.keys(domainLabels) as RiskDomain[]).map((domain) => {
    const affected = riskRows.filter(({ profile }) => profile.domainScores[domain] >= (domain === 'dataQuality' ? 8 : 10));
    const maxScore = Math.max(0, ...riskRows.map(({ profile }) => profile.domainScores[domain]));
    const tone: UiTone = maxScore >= 25 ? 'red' : maxScore >= 10 ? 'amber' : 'green';
    return {
      domain,
      affected: affected.length,
      maxScore,
      tone,
      topPlayer: affected[0]?.row.player.name,
    };
  });

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
    DCC: row.dcc,
    RHIE: row.rhie,
  }));

  if (isLoading) {
    return (
      <div className="grid">
        <AppHero heroClass="hero-carga" title="Control de carga" subtitle="Cargando datos…" />
        <div className="card" style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          Sincronizando con Supabase…
        </div>
      </div>
    );
  }

  return (
    <div className="grid load-center-page">
      <AppHero
        heroClass="hero-carga"
        title="Control de carga y riesgo"
        subtitle={`Tablero único de carga, disponibilidad, wellness y riesgo · ${activePeriod}${gpsEnabled ? ' · GPS' : ''}`}
      />
      <GlobalFiltersBar />

      <div className="grid grid-5">
        {controlModules.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="card" style={{ textDecoration: 'none', color: 'inherit', minHeight: 128 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span className="kpi-icon"><Icon size={17} /></span>
                <strong>{item.label}</strong>
              </div>
              <p style={{ margin: 0, color: '#64748b', fontSize: 13, lineHeight: 1.45 }}>{item.text}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-4">
        <KpiCard label="Riesgo alto" value={String(highRiskCount)} tone={highRiskCount ? 'red' : 'green'} icon={<AlertTriangle size={18} />} trend="Jugadores en rojo" />
        <KpiCard label="Control preventivo" value={String(moderateRiskCount)} tone={moderateRiskCount ? 'amber' : 'green'} icon={<Activity size={18} />} trend="Jugadores en amarillo" />
        <KpiCard label="Ajustar plan" value={String(adjustedPlanCount)} tone={adjustedPlanCount ? 'amber' : 'green'} icon={<Timer size={18} />} trend="No van a carga completa" />
        <KpiCard label="Confianza del dato" value={`${round(averageConfidence)}%`} tone={lowConfidenceCount ? 'amber' : 'green'} icon={<Database size={18} />} trend={`${lowConfidenceCount} baja confianza`} />
      </div>

      <div className="grid grid-4">
        <KpiCard label="Carga acumulada" value={hasAnyLoad ? center.totals.internalLoad.toFixed(0) : '—'} tone="dark" icon={<Gauge size={18} />} trend="UA efectivas" />
        <KpiCard label="MIN acumulados" value={hasAnyLoad ? String(center.totals.minutes) : '—'} tone="green" icon={<Timer size={18} />} trend="Volumen" />
        <KpiCard label="RPE promedio" value={hasAnyLoad ? center.totals.avgRpe.toFixed(1) : '—'} tone="amber" icon={<TrendingUp size={18} />} trend="Intensidad percibida" />
        <KpiCard label="ACWR promedio" value={averageAcwr ? averageAcwr.toFixed(2) : '—'} tone={averageAcwr > 1.5 ? 'red' : averageAcwr > 1.3 ? 'amber' : 'blue'} icon={<BarChart3 size={18} />} trend="Carga interna 7/28" />
      </div>

      <div className="card">
        <SectionHeader
          eyebrow="Decisión diaria"
          title="Semáforo operativo por jugador"
          subtitle="Cada fila usa el motor unificado de carga: sRPE, competencia, GPS, ACWR, monotonía, wellness y confianza del dato."
        />
        {riskRows.length ? (
          <div className="professional-table-wrap">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Decisión</th>
                  <th>Riesgo</th>
                  <th>Carga hoy</th>
                  <th>ACWR</th>
                  <th>Wellness</th>
                  <th>Confianza</th>
                  <th>Motivo principal</th>
                </tr>
              </thead>
              <tbody>
                {riskRows.slice(0, 18).map(({ row, profile }) => {
                  const mainReason = profile.alerts[0] ?? profile.dataConfidence.flags[0] ?? profile.recommendations[0];
                  return (
                    <tr key={row.player.id}>
                      <td>
                        <Link href={`/jugadores/${row.player.id}`}><strong>{row.player.name}</strong></Link>
                        <br />
                        <span style={{ color: '#64748b', fontSize: 12 }}>{row.player.position} · {categoryLabel(row.player.category)}</span>
                      </td>
                      <td><StatusBadge text={`${profile.decision} ${profile.decisionPercent}`} tone={decisionTone(profile.decision)} /></td>
                      <td><StatusBadge text={`${profile.riskLabel} · ${profile.riskScore}`} tone={profile.riskTone} /></td>
                      <td>{profile.load.today.effectiveLoad.toFixed(0)} UA · {profile.load.today.minutes} min</td>
                      <td>{profile.acwr.primary.zone === 'no_data' ? '—' : profile.acwr.primary.rolling.toFixed(2)}</td>
                      <td>{profile.wellness.today !== undefined ? `${profile.wellness.today.toFixed(1)}/5` : 'Sin dato'}</td>
                      <td><StatusBadge text={`${profile.dataConfidence.label} · ${profile.dataConfidence.score}%`} tone={confidenceTone(profile.dataConfidence.label)} /></td>
                      <td style={{ maxWidth: 360 }}>{mainReason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Sin jugadores para analizar" text="Ajusta categoría, fecha o microciclo para ver el semáforo operativo." />
        )}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Dominios de riesgo" title="Qué está disparando las alertas" subtitle="El objetivo es explicar la decisión, no esconderla detrás de un índice único." />
          <div className="load-player-list">
            {domainRows.map((item) => (
              <div key={item.domain} className="load-player-row">
                <div>
                  <strong>{domainLabels[item.domain]}</strong>
                  <span>{domainNotes[item.domain]}</span>
                </div>
                <StatusBadge text={`${item.affected} jugador(es)`} tone={item.tone} />
                <span>{item.topPlayer ? `Mayor alerta: ${item.topPlayer}` : 'Sin alerta relevante'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <SectionHeader eyebrow="Riesgo" title="Seguimiento de exposición" subtitle="Lectura rápida del centro de carga tradicional: altas cargas y baja exposición." />
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
                {[...center.highLoad, ...center.lowExposure.filter((r) => r.minutes > 0)].slice(0, 8).map((row) => (
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
                  ? <EmptyState icon="check" title="Sin alertas de exposición" text="El plantel no muestra picos o bajas exposiciones relevantes en este período." />
                  : null}
              </div>
            </>
          ) : (
            <EmptyState title="Sin datos de carga" text="Registra al menos una sesión o competencia para ver el seguimiento de exposición." />
          )}
        </div>
      </div>

      {gpsEnabled && hasAnyLoad ? (
        <div className="card gps-catapult-panel">
          <SectionHeader eyebrow="Catapult / GPS" title="Carga externa del microciclo" subtitle="Distancia, Player Load, alta velocidad y sprint. La carga externa se interpreta separada de la carga interna." />
          <div className="grid grid-4">
            <KpiCard label="Distancia total" value={`${center.totals.totalDistance.toFixed(0)} m`} tone="dark" trend="GPS" />
            <KpiCard label="Player Load" value={center.totals.playerLoad.toFixed(0)} tone="blue" trend="Acumulado" />
            <KpiCard label="Alta velocidad" value={`${center.totals.highSpeedDistance.toFixed(0)} m`} tone="green" trend="HSR" />
            <KpiCard label="DCC / RHIE" value={`${center.totals.dcc.toFixed(0)} / ${center.totals.rhie.toFixed(0)}`} tone="amber" trend="Neuromuscular" />
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
          <SectionHeader eyebrow="Calidad" title="Pendientes que afectan la medición" subtitle="Un jugador sin datos suficientes no debe aparecer como verde fuerte." />
          <div className="load-player-list">
            {riskRows
              .filter(({ profile }) => profile.dataConfidence.label !== 'Alta' || profile.wellness.today === undefined)
              .slice(0, 8)
              .map(({ row, profile }) => (
                <Link href={`/jugadores/${row.player.id}`} key={`quality-${row.player.id}`} className="load-player-row">
                  <div>
                    <strong>{row.player.name}</strong>
                    <span>{profile.dataConfidence.flags[0] ?? 'Registro incompleto para decisión robusta'}</span>
                  </div>
                  <StatusBadge text={`${profile.dataConfidence.label} · ${profile.dataConfidence.score}%`} tone={confidenceTone(profile.dataConfidence.label)} />
                  <span>{profile.wellness.today === undefined ? 'Sin wellness hoy' : `${profile.wellness.adherence28d}% wellness 28d`}</span>
                </Link>
              ))}
            {!riskRows.some(({ profile }) => profile.dataConfidence.label !== 'Alta' || profile.wellness.today === undefined) ? (
              <EmptyState icon="check" title="Datos consistentes" text="El plantel tiene carga y wellness suficientes para una lectura confiable." />
            ) : null}
          </div>
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
                    <th>DCC</th>
                    <th>RHIE</th>
                  </> : null}
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
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
                      <td>{row.dcc}</td>
                      <td>{row.rhie}</td>
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
