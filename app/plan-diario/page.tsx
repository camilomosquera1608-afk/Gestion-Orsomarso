'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Gauge, History, ShieldAlert, Target } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, MicrocycleSetupBanner, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { formatDateShort } from '@/lib/operational-helpers';
import { readBodyMapRecords, type BodyMapRecord } from '@/lib/body-map';
import { buildDailyPlan, componentStatusTone, decisionTone } from '@/lib/daily-plan';
import { riskToneLabel } from '@/lib/predictive-risk';
import { findMicrocycleByDate } from '@/lib/utils';

const nf = (value?: number, suffix = '') => Number.isFinite(Number(value)) ? `${Math.round(Number(value)).toLocaleString('es-CO')}${suffix}` : '—';

export default function DailyPlanPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const [bodyRecords, setBodyRecords] = useState<BodyMapRecord[]>([]);

  useEffect(() => setBodyRecords(readBodyMapRecords()), []);

  const rows = useMemo(() => buildDailyPlan(data, filters.date, bodyRecords, activeCategory), [data, filters.date, bodyRecords, activeCategory]);
  const daySessions = data.trainingSessionSummaries.filter((item) => item.date === filters.date && (activeCategory === 'all' || item.category === activeCategory));
  const activeMicrocycle = findMicrocycleByDate(data.microcycles, filters.date, filters.microcycleId, activeCategory);
  const microcycleIncomplete = activeMicrocycle && (!activeMicrocycle.startDate || !activeMicrocycle.endDate);

  const complete = rows.filter((row) => row.decision === 'Carga completa').length;
  const controlled = rows.filter((row) => ['Control preventivo', 'Carga reducida'].includes(row.decision)).length;
  const modified = rows.filter((row) => ['Trabajo modificado', 'No campo'].includes(row.decision)).length;
  const compensatory = rows.filter((row) => row.decision === 'Compensatorio').length;
  const lowQuality = rows.filter((row) => row.quality === 'Baja' || row.dataConfidence.label === 'Baja').length;
  const adherenceAlerts = rows.filter((row) => row.dataConfidence.adherencePct < 70).length;
  const redRisk = rows.filter((row) => row.predictiveRisk.tone === 'red').length;
  const amberRisk = rows.filter((row) => row.predictiveRisk.tone === 'amber').length;

  const objectiveText = daySessions.map((item) => item.objective).filter(Boolean).join(' · ') || 'Sin objetivo de campo registrado';

  return (
    <div className="grid daily-plan-page">
      <AppHero
        title="Plan diario unificado"
        subtitle={`Campo + disponibilidad + decisión individual · ${activeCategory === 'all' ? 'Todas' : categoryLabel(activeCategory)} · ${formatDateShort(filters.date)}`}
      />
      <GlobalFiltersBar />
      {microcycleIncomplete ? <MicrocycleSetupBanner microcycleName={activeMicrocycle?.name} /> : null}

      <div className="grid grid-4">
        <KpiCard label="Carga completa" value={String(complete)} tone="green" icon={<CheckCircle2 size={18} />} trend="Sin ajuste crítico" />
        <KpiCard label="Control/reducida" value={String(controlled)} tone="amber" icon={<Gauge size={18} />} trend="Seguimiento o ajuste" />
        <KpiCard label="Modificado/no campo" value={String(modified)} tone="red" icon={<ShieldAlert size={18} />} trend="Restricción alta" />
        <KpiCard label="Riesgo rojo/ámbar" value={`${redRisk}/${amberRisk}`} tone={redRisk ? 'red' : amberRisk ? 'amber' : 'green'} icon={<AlertTriangle size={18} />} trend="Semáforo predictivo pre-sesión" />
        <KpiCard label="Confianza baja" value={String(lowQuality)} tone={lowQuality ? 'red' : 'green'} icon={<ClipboardList size={18} />} trend={`${adherenceAlerts} con adherencia <70%`} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Objetivo colectivo" title="Plan del día" subtitle="El MD es solo ubicación; la decisión sale de datos reales y disponibilidad." />
          <div className="soft-alert"><Target size={16} /> <strong>Campo:</strong> {objectiveText}</div>
          <div className="soft-alert"><CalendarDays size={16} /> <strong>Sesiones registradas:</strong> {daySessions.length} campo · <strong>Dato baja confianza:</strong> {lowQuality}</div>
        </div>

        <div className="card">
          <SectionHeader eyebrow="Criterios de decisión" title="Qué se cruza en esta vista" subtitle="Permite individualizar sin perder el objetivo colectivo." />
          <div className="tag-list">
            <span className="tag">wellness</span>
            <span className="tag">dolor/mapa corporal</span>
            <span className="tag">disponibilidad por componente</span>
            <span className="tag">campo ejecutado</span>
            <span className="tag">minutos/rol competitivo</span>
            <span className="tag">historial reciente</span>
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Riesgo predictivo" title="Semáforo pre-sesión" subtitle="ARC, wellness, dolor, retorno a velocidad y readaptación." />
        <div className="table-scroll">
          <table className="pro-table compact-table">
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Semáforo</th>
                <th>Score</th>
                <th>Factores</th>
                <th>Alertas</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((row) => row.predictiveRisk.score > 0 || row.player.status === 'Readaptación')
                .slice(0, 12)
                .map((row) => (
                  <tr key={row.player.id}>
                    <td><Link href={`/jugadores/${row.player.id}`}><strong>{row.player.name}</strong></Link><br /><span className="muted">{row.player.position} · {row.player.status}</span></td>
                    <td><StatusBadge text={riskToneLabel(row.predictiveRisk.tone)} tone={row.predictiveRisk.tone} /></td>
                    <td><strong>{row.predictiveRisk.score}/100</strong></td>
                    <td>{row.predictiveRisk.factors.length ? row.predictiveRisk.factors.map((factor) => factor.label).join(' · ') : 'sin factor crítico'}</td>
                    <td>{row.predictiveRisk.alerts.length ? row.predictiveRisk.alerts.join(' · ') : 'sin alerta predictiva'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!rows.some((row) => row.predictiveRisk.score > 0 || row.player.status === 'Readaptación') ? <EmptyState title="Sin alertas predictivas" text="No hay jugadores con factores de riesgo multifactorial para la fecha seleccionada." icon="check" /> : null}
      </div>

      <div className="card">
        <SectionHeader eyebrow="Decisión pre/post" title="Decisión diaria por jugador" subtitle="Resume qué hacer hoy o qué ajustar en la próxima sesión." />
        {!rows.length ? <EmptyState title="Sin jugadores" text="Agrega jugadores o cambia la categoría activa." /> : null}
        <div className="table-scroll">
          <table className="pro-table compact-table">
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Decisión</th>
                <th>Riesgo</th>
                <th>Motivo</th>
                <th>Acción</th>
                <th>Calidad</th>
                <th>Confianza</th>
                <th>Compensatorio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.player.id} className="player-row-link">
                  <td><Link href={`/jugadores/${row.player.id}`}><strong>{row.player.name}</strong></Link><br /><span className="muted">{row.player.position} · {row.player.competitiveRole ?? 'rol s/d'}</span></td>
                  <td><StatusBadge text={row.decision} tone={decisionTone(row.decision)} /></td>
                  <td><StatusBadge text={`${row.predictiveRisk.score}/100 · ${riskToneLabel(row.predictiveRisk.tone)}`} tone={row.predictiveRisk.tone} /></td>
                  <td>{row.reason}</td>
                  <td>{row.action}</td>
                  <td><StatusBadge text={row.quality} tone={row.quality === 'Alta' ? 'green' : row.quality === 'Media' ? 'amber' : 'red'} /></td>
                  <td><StatusBadge text={`${row.dataConfidence.label} · ${row.dataConfidence.score}%`} tone={row.dataConfidence.label === 'Alta' ? 'green' : row.dataConfidence.label === 'Media' ? 'amber' : 'red'} /></td>
                  <td>{row.compensation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Planificado vs ejecutado" title="Campo por jugador" subtitle="Minutos, distancia y carga efectiva del día." />
        <div className="table-scroll">
          <table className="pro-table compact-table">
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Campo</th>
                <th>Neuromuscular</th>
                <th>RPE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.player.id}>
                  <td><Link href={`/jugadores/${row.player.id}`}><strong>{row.player.name}</strong></Link></td>
                  <td>{nf(row.plannedVsExecuted.fieldMinutes, ' min')} · {nf(row.plannedVsExecuted.distance, ' m')} · {nf(row.plannedVsExecuted.fieldLoad, ' UA')}</td>
                  <td>{nf(row.plannedVsExecuted.neuromuscular)} <span className="muted">ACC+DCC+SPR+RHIE</span></td>
                  <td>{row.internal?.rpe ?? 's/d'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Disponibilidad por componente" title="Qué acciones puede hacer cada jugador" subtitle="Adaptar sin sacar al jugador de todo el entrenamiento." />
        <div className="table-scroll">
          <table className="pro-table compact-table">
            <thead>
              <tr><th>Jugador</th><th>Sprint</th><th>COD</th><th>Contacto</th><th>Excéntrica</th><th>Reactiva</th><th>Golpeo</th><th>Razón</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const c = row.componentAvailability;
                return (
                  <tr key={row.player.id}>
                    <td><Link href={`/jugadores/${row.player.id}`}><strong>{row.player.name}</strong></Link></td>
                    <td><StatusBadge text={c.sprint} tone={componentStatusTone(c.sprint)} /></td>
                    <td><StatusBadge text={c.cod} tone={componentStatusTone(c.cod)} /></td>
                    <td><StatusBadge text={c.contact} tone={componentStatusTone(c.contact)} /></td>
                    <td><StatusBadge text={c.eccentric} tone={componentStatusTone(c.eccentric)} /></td>
                    <td><StatusBadge text={c.reactive} tone={componentStatusTone(c.reactive)} /></td>
                    <td><StatusBadge text={c.kicking} tone={componentStatusTone(c.kicking)} /></td>
                    <td>{c.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Historial" title="Últimas respuestas relevantes" subtitle="Wellness, campo y mapa corporal recientes." />
        <div className="stack-list">
          {rows.filter((row) => row.history.length).slice(0, 12).map((row) => (
            <div className="soft-alert" key={row.player.id}>
              <div><History size={15} /> <Link href={`/jugadores/${row.player.id}`}><strong>{row.player.name}</strong></Link></div>
              <ul className="mini-list">{row.history.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
          {!rows.some((row) => row.history.length) ? <EmptyState title="Sin historial reciente" text="A medida que registres wellness, campo y mapa corporal, aquí aparecerá la evolución." /> : null}
        </div>
      </div>
    </div>
  );
}
