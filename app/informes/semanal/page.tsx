'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Activity, FileText, Trophy } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { SectionHeader } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { formatDateShort } from '@/lib/operational-helpers';
import { averageWellness, groupAverage } from '@/lib/utils';
import { buildAcwrData, buildMonotonyStrain } from '@/lib/strategic-helpers';


export default function InformeSemanalPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;

  const report = useMemo(() => {
    const catFilter = activeCategory === 'all' ? undefined : activeCategory;
    const microcycle = data.microcycles.find((mc) =>
      mc.id === filters.microcycleId && (!catFilter || mc.category === catFilter),
    );

    // Rango del microciclo activo o última semana como fallback
    const endDate = microcycle?.endDate || filters.date;
    const startDate = microcycle?.startDate || (() => {
      const d = new Date(endDate);
      d.setDate(d.getDate() - 6);
      return d.toISOString().slice(0, 10);
    })();

    const players = data.players.filter((p) => !catFilter || p.category === catFilter);
    const playerIds = new Set(players.map((p) => p.id));

    // Disponibilidad
    const disponibles = players.filter((p) => p.status === 'Disponible').length;
    const lesionados = players.filter((p) => p.status === 'Lesionado').length;
    const molestia = players.filter((p) => p.status === 'Molestia').length;
    const readaptacion = players.filter((p) => p.status === 'Readaptación').length;
    const disponibilidadPct = players.length > 0 ? Math.round((disponibles / players.length) * 100) : 0;

    // Wellness del período
    const wellnessPeriodo = data.wellness.filter((w) =>
      playerIds.has(w.playerId) && w.date >= startDate && w.date <= endDate,
    );
    const wellnessPromedio = groupAverage(wellnessPeriodo.map((w) => averageWellness(w)));

    // Carga del período
    const cargaPeriodo = data.internalLoads.filter((l) =>
      playerIds.has(l.playerId) && l.date >= startDate && l.date <= endDate,
    );
    const cargaTotal = cargaPeriodo.reduce((acc, l) => acc + l.rpe * l.duration, 0);
    const rpePromedio = groupAverage(cargaPeriodo.map((l) => l.rpe));
    const minPromedio = groupAverage(cargaPeriodo.map((l) => l.duration));

    // Sesiones
    const sesiones = data.trainingSessionSummaries.filter((s) =>
      (!catFilter || s.category === catFilter) && s.date >= startDate && s.date <= endDate,
    );

    // Competencia
    const partidos = data.competitionMatchSummaries.filter((m) =>
      (!catFilter || m.category === catFilter) && m.date >= startDate && m.date <= endDate,
    );
    const victorias = partidos.filter((m) => m.resultType === 'Victoria').length;
    const empates = partidos.filter((m) => m.resultType === 'Empate').length;
    const derrotas = partidos.filter((m) => m.resultType === 'Derrota').length;
    const golesFavor = partidos.reduce((acc, m) => acc + (m.goalsFor ?? 0), 0);
    const golesContra = partidos.reduce((acc, m) => acc + (m.goalsAgainst ?? 0), 0);

    // ACWR
    const acwrData = buildAcwrData(data, activeCategory, endDate);
    const acwrRiesgo = acwrData.filter((r) => r.zone === 'danger').length;
    const acwrSincarga = acwrData.filter((r) => r.zone === 'no_data').length;

    // Monotonía
    const monotony = microcycle ? buildMonotonyStrain(data, microcycle.id, activeCategory) : null;

    // Valoraciones en el período
    const cmj = data.cmjRecords.filter((r) => playerIds.has(r.playerId) && r.date >= startDate && r.date <= endDate);
    const fms = data.fmsRecords.filter((r) => playerIds.has(r.playerId) && r.date >= startDate && r.date <= endDate);
    const neuro = data.neuromuscularRecords.filter((r) => playerIds.has(r.playerId) && r.date >= startDate && r.date <= endDate);
    const nutri = data.nutritionRecords.filter((r) => playerIds.has(r.playerId) && r.date >= startDate && r.date <= endDate);

    return {
      microcycle, startDate, endDate, players, disponibles, lesionados,
      molestia, readaptacion, disponibilidadPct, wellnessPromedio,
      cargaTotal, rpePromedio, minPromedio, sesiones, partidos,
      victorias, empates, derrotas, golesFavor, golesContra,
      acwrData, acwrRiesgo, acwrSincarga, monotony,
      valoraciones: cmj.length + fms.length + neuro.length + nutri.length,
    };
  }, [data, filters, activeCategory]);

  const catLabel = activeCategory === 'all' ? 'Global' : categoryLabel(activeCategory);
  const periodoLabel = `${formatDateShort(report.startDate)} — ${formatDateShort(report.endDate)}`;

  return (
    <div className="grid">
      <AppHero
        title="Informe semanal"
        subtitle={`Resumen ejecutivo · ${catLabel} · ${periodoLabel}`}
      />

      <div className="toolbar card">
        <div>
          <span className="section-eyebrow">Resumen ejecutivo</span>
          <h3 style={{ margin: 0 }}>
            {report.microcycle?.name ?? 'Período activo'} · {catLabel}
          </h3>
          <div className="muted-line">{periodoLabel}</div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn secondary" onClick={() => window.print()}>
            <FileText size={15} /> Imprimir / PDF
          </button>
          <Link href="/informes" className="btn secondary">← Informes</Link>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="weekly-report-cover no-print">
        <div>
          <span style={{ color: '#93c5fd', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.16em' }}>Resumen del período</span>
          <h2 style={{ margin: '6px 0 4px', fontSize: 'clamp(22px,3vw,34px)', letterSpacing: '-.04em' }}>{report.microcycle?.name ?? 'Período activo'}</h2>
          <p style={{ margin: 0, color: 'rgba(255,255,255,.75)', fontWeight: 600 }}>{catLabel} · {periodoLabel}</p>
        </div>
        <div className="weekly-report-kpis">
          <div className="weekly-kpi">
            <span>Disponibilidad</span>
            <strong>{report.disponibilidadPct}%</strong>
            <small>{report.disponibles}/{report.players.length} jugadores</small>
          </div>
          <div className="weekly-kpi">
            <span>Wellness</span>
            <strong>{report.wellnessPromedio > 0 ? report.wellnessPromedio.toFixed(1) : '—'}</strong>
            <small>Promedio /5</small>
          </div>
          <div className="weekly-kpi">
            <span>Carga total</span>
            <strong>{report.cargaTotal > 0 ? report.cargaTotal.toFixed(0) : '—'}</strong>
            <small>UA período</small>
          </div>
          <div className="weekly-kpi">
            <span>Partidos</span>
            <strong>{report.partidos.length}</strong>
            <small>{report.victorias}V {report.empates}E {report.derrotas}D</small>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Disponibilidad médica */}
        <div className="card">
          <SectionHeader eyebrow="Plantilla" title="Disponibilidad médica" />
          <div className="grid grid-2" style={{ gap: 10 }}>
            {[
              { label: 'Disponibles', value: report.disponibles, tone: 'green' as const },
              { label: 'Molestia', value: report.molestia, tone: 'amber' as const },
              { label: 'Readaptación', value: report.readaptacion, tone: 'blue' as const },
              { label: 'Lesionados', value: report.lesionados, tone: 'red' as const },
            ].map(({ label, value, tone }) => (
              <div key={label} className={`mini-stat-card ui-tone-${tone}`} style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .7 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1, marginTop: 4 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 5 }}>
              <span>Disponibilidad total</span>
              <span>{report.disponibilidadPct}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${report.disponibilidadPct}%` }} />
            </div>
          </div>
        </div>

        {/* Carga y sesiones */}
        <div className="card">
          <SectionHeader eyebrow="Entrenamiento" title="Carga del período" />
          <div className="compact-info-list">
            {[
              { label: 'Sesiones registradas', value: report.sesiones.length },
              { label: 'Carga interna total', value: report.cargaTotal > 0 ? `${report.cargaTotal.toFixed(0)} UA` : '—' },
              { label: 'RPE promedio', value: report.rpePromedio > 0 ? report.rpePromedio.toFixed(1) : '—' },
              { label: 'MIN promedio', value: report.minPromedio > 0 ? `${Math.round(report.minPromedio)} min` : '—' },
              { label: 'Monotonía', value: report.monotony ? `${report.monotony.monotony} (${report.monotony.verdictLabel})` : '—' },
              { label: 'Strain', value: report.monotony?.strain ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="compact-info-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Competencia */}
        <div className="card">
          <SectionHeader eyebrow="Competencia" title="Resultados del período" />
          {report.partidos.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><Trophy size={18} /></div><div><strong>Sin partidos en el período</strong></div></div>
          ) : (
            <>
              <div className="grid grid-3" style={{ gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'Victorias', value: report.victorias, tone: 'green' },
                  { label: 'Empates', value: report.empates, tone: 'neutral' },
                  { label: 'Derrotas', value: report.derrotas, tone: 'red' },
                ].map(({ label, value, tone }) => (
                  <div key={label} className={`mini-stat-card ui-tone-${tone}`} style={{ textAlign: 'center', padding: '12px 8px' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.04em' }}>{value}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, opacity: .7, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div className="compact-info-list">
                <div className="compact-info-row"><span>Goles a favor</span><strong>{report.golesFavor}</strong></div>
                <div className="compact-info-row"><span>Goles en contra</span><strong>{report.golesContra}</strong></div>
                <div className="compact-info-row"><span>Diferencia</span><strong style={{ color: report.golesFavor >= report.golesContra ? 'var(--green)' : 'var(--red)' }}>{report.golesFavor - report.golesContra >= 0 ? '+' : ''}{report.golesFavor - report.golesContra}</strong></div>
              </div>
            </>
          )}
        </div>

        {/* ACWR */}
        <div className="card">
          <SectionHeader eyebrow="Prevención" title="Riesgo de carga (ACWR)" />
          {report.acwrData.filter((r) => r.zone !== 'no_data').length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><Activity size={18} /></div><div><strong>Sin datos suficientes para calcular ACWR</strong><p>Se necesitan al menos 2 semanas de carga registrada.</p></div></div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {report.acwrData.filter((r) => r.zone !== 'no_data').slice(0, 8).map((row) => (
                <div key={row.player.id} className="acwr-table-row">
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>{row.player.name}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{row.acute.toFixed(0)} UA</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>ACWR {row.ratio}</span>
                  <span className={`acwr-badge acwr-${row.zone === 'safe' ? 'green' : row.zone === 'danger' ? 'red' : 'amber'}`}>
                    {row.zoneLabel}
                  </span>
                </div>
              ))}
              {report.acwrRiesgo > 0 && (
                <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12, fontWeight: 700 }}>
                  ⚠ {report.acwrRiesgo} jugador(es) en zona de riesgo ACWR
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Valoraciones */}
      <div className="card">
        <SectionHeader eyebrow="Valoraciones" title="Evaluaciones del período" />
        <div className="compact-info-list">
          <div className="compact-info-row"><span>Total valoraciones</span><strong>{report.valoraciones}</strong></div>
          <div className="compact-info-row"><span>Jugadores evaluados</span><strong>{new Set([...data.cmjRecords, ...data.fmsRecords, ...data.neuromuscularRecords, ...data.nutritionRecords].filter((r) => r.date >= report.startDate && r.date <= report.endDate).map((r) => r.playerId)).size}</strong></div>
        </div>
      </div>
    </div>
  );
}
