'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Dumbbell, Gauge, History, ShieldAlert, Target, TimerReset, Users } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { formatDateShort } from '@/lib/operational-helpers';
import { readBodyMapRecords, type BodyMapRecord } from '@/lib/body-map';
import { buildDailyPlan, componentStatusTone, decisionTone } from '@/lib/daily-plan';
import { strengthDecision } from '@/lib/strength';

const pctText = (value?: number) => value === undefined ? 's/d' : `${value > 0 ? '+' : ''}${value}%`;
const nf = (value?: number, suffix = '') => Number.isFinite(Number(value)) ? `${Math.round(Number(value)).toLocaleString('es-CO')}${suffix}` : '—';

export default function DailyPlanPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const [bodyRecords, setBodyRecords] = useState<BodyMapRecord[]>([]);

  useEffect(() => setBodyRecords(readBodyMapRecords()), []);

  const rows = useMemo(() => buildDailyPlan(data, filters.date, bodyRecords, activeCategory), [data, filters.date, bodyRecords, activeCategory]);
  const daySessions = data.trainingSessionSummaries.filter((item) => item.date === filters.date && (activeCategory === 'all' || item.category === activeCategory));
  const dayStrength = (data.strengthSessions ?? []).filter((item) => item.date === filters.date && (activeCategory === 'all' || item.category === activeCategory));

  const complete = rows.filter((row) => row.decision === 'Carga completa').length;
  const controlled = rows.filter((row) => ['Control preventivo', 'Carga reducida'].includes(row.decision)).length;
  const modified = rows.filter((row) => ['Trabajo modificado', 'No campo'].includes(row.decision)).length;
  const compensatory = rows.filter((row) => row.decision === 'Compensatorio').length;
  const lowQuality = rows.filter((row) => row.quality === 'Baja').length;

  const objectiveText = daySessions.map((item) => item.objective).filter(Boolean).join(' · ') || 'Sin objetivo de campo registrado';

  return (
    <div className="grid daily-plan-page">
      <AppHero
        title="Plan diario unificado"
        subtitle={`Campo + fuerza + disponibilidad + respuesta individual · ${activeCategory === 'all' ? 'Todas' : categoryLabel(activeCategory)} · ${formatDateShort(filters.date)}`}
      />
      <GlobalFiltersBar />

      <div className="grid grid-4">
        <KpiCard label="Carga completa" value={String(complete)} tone="green" icon={<CheckCircle2 size={18} />} trend="Sin ajuste crítico" />
        <KpiCard label="Control/reducida" value={String(controlled)} tone="amber" icon={<Gauge size={18} />} trend="Seguimiento o ajuste" />
        <KpiCard label="Modificado/no campo" value={String(modified)} tone="red" icon={<ShieldAlert size={18} />} trend="Restricción alta" />
        <KpiCard label="Compensatorio" value={String(compensatory)} tone="blue" icon={<TimerReset size={18} />} trend="Subestimulación/minutos" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Objetivo colectivo" title="Plan del día" subtitle="El MD es solo ubicación; la decisión sale de datos reales y disponibilidad." />
          <div className="soft-alert"><Target size={16} /> <strong>Campo:</strong> {objectiveText}</div>
          <div className="soft-alert"><Dumbbell size={16} /> <strong>Fuerza:</strong> {dayStrength.length ? dayStrength.map((s) => `${s.group}: ${s.type} · ${s.intent ?? 'microdosis'} · ${s.movementPattern ?? 'movimiento'}`).join(' | ') : 'Sin fuerza planificada para el día.'}</div>
          <div className="soft-alert"><CalendarDays size={16} /> <strong>Sesiones registradas:</strong> {daySessions.length} campo · {dayStrength.length} fuerza · <strong>Dato baja confianza:</strong> {lowQuality}</div>
        </div>

        <div className="card">
          <SectionHeader eyebrow="Criterios de decisión" title="Qué se cruza en esta vista" subtitle="Permite individualizar sin perder el objetivo colectivo." />
          <div className="tag-list">
            <span className="tag">wellness</span>
            <span className="tag">dolor/mapa corporal</span>
            <span className="tag">disponibilidad por componente</span>
            <span className="tag">campo ejecutado</span>
            <span className="tag">fuerza planificada vs percibida</span>
            <span className="tag">minutos/rol competitivo</span>
            <span className="tag">historial reciente</span>
          </div>
        </div>
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
                <th>Motivo</th>
                <th>Acción concreta</th>
                <th>Calidad</th>
                <th>Compensatorio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.player.id}>
                  <td><strong>{row.player.name}</strong><br /><span className="muted">{row.player.position} · {row.player.competitiveRole ?? 'rol s/d'}</span></td>
                  <td><StatusBadge text={row.decision} tone={decisionTone(row.decision)} /></td>
                  <td>{row.reason}</td>
                  <td>{row.action}</td>
                  <td><StatusBadge text={row.quality} tone={row.quality === 'Alta' ? 'green' : row.quality === 'Media' ? 'amber' : 'red'} /></td>
                  <td>{row.compensation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Planificado vs ejecutado" title="Campo + fuerza por jugador" subtitle="Detecta quién se pasó, quién quedó corto y quién requiere ajuste." />
        <div className="table-scroll">
          <table className="pro-table compact-table">
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Campo</th>
                <th>Neuromuscular</th>
                <th>RPE</th>
                <th>Fuerza planificada</th>
                <th>Fuerza percibida</th>
                <th>Diferencia fuerza</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.player.id}>
                  <td><strong>{row.player.name}</strong></td>
                  <td>{nf(row.plannedVsExecuted.fieldMinutes, ' min')} · {nf(row.plannedVsExecuted.distance, ' m')} · {nf(row.plannedVsExecuted.fieldLoad, ' UA')}</td>
                  <td>{nf(row.plannedVsExecuted.neuromuscular)} <span className="muted">ACC+DCC+SPR+RHIE</span></td>
                  <td>{row.internal?.rpe ?? 's/d'}</td>
                  <td>{nf(row.plannedVsExecuted.strengthPlanned, ' UA')}</td>
                  <td>{row.plannedVsExecuted.strengthPerceived ? nf(row.plannedVsExecuted.strengthPerceived, ' UA') : 'sin respuesta'}</td>
                  <td><StatusBadge text={pctText(row.plannedVsExecuted.strengthDeltaPct)} tone={row.plannedVsExecuted.strengthDeltaPct === undefined ? 'neutral' : row.plannedVsExecuted.strengthDeltaPct >= 30 ? 'red' : row.plannedVsExecuted.strengthDeltaPct >= 15 ? 'amber' : 'green'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Disponibilidad por componente" title="Qué acciones puede hacer cada jugador" subtitle="Más útil que disponible/no disponible: permite adaptar sin sacar al jugador de todo." />
        <div className="table-scroll">
          <table className="pro-table compact-table">
            <thead>
              <tr><th>Jugador</th><th>Sprint</th><th>COD</th><th>Contacto</th><th>Excéntrica</th><th>Reactiva</th><th>Golpeo</th><th>Razón</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const c = row.componentAvailability;
                return <tr key={row.player.id}>
                  <td><strong>{row.player.name}</strong></td>
                  <td><StatusBadge text={c.sprint} tone={componentStatusTone(c.sprint)} /></td>
                  <td><StatusBadge text={c.cod} tone={componentStatusTone(c.cod)} /></td>
                  <td><StatusBadge text={c.contact} tone={componentStatusTone(c.contact)} /></td>
                  <td><StatusBadge text={c.eccentric} tone={componentStatusTone(c.eccentric)} /></td>
                  <td><StatusBadge text={c.reactive} tone={componentStatusTone(c.reactive)} /></td>
                  <td><StatusBadge text={c.kicking} tone={componentStatusTone(c.kicking)} /></td>
                  <td>{c.reason}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Fuerza" title="Alertas de fuerza planificada" subtitle="Compara intención de microdosis con percepción real." />
          {!dayStrength.length ? <EmptyState title="Sin fuerza planificada" text="Cuando el PF planifique fuerza, aquí aparecerá la tolerancia real." /> : null}
          <div className="stack-list">
            {dayStrength.map((session) => {
              const responses = session.responses ?? [];
              const high = responses.filter((r) => r.rpe - session.expectedRpe >= 2 || r.pain || r.completed !== 'Completa');
              return <div className="soft-alert" key={session.id}>
                <div><strong>{session.group} · {session.type}</strong> · {session.intent ?? 'microdosis'} · {session.movementPattern ?? 'movimiento'} · RPE esperado {session.expectedRpe}</div>
                <div className="muted">{responses.length} respuestas · {high.length} alerta(s)</div>
                {high.slice(0, 5).map((response) => {
                  const player = data.players.find((p) => p.id === response.playerId);
                  return <div key={response.id} className="small-row"><strong>{player?.name ?? 'Jugador'}</strong>: RPE {response.rpe} · {strengthDecision(session, response.rpe, response.completed, response.pain)}</div>;
                })}
              </div>;
            })}
          </div>
        </div>

        <div className="card">
          <SectionHeader eyebrow="Historial" title="Últimas respuestas relevantes" subtitle="Guarda la lógica de decisión y cómo respondió cada jugador." />
          <div className="stack-list">
            {rows.filter((row) => row.history.length).slice(0, 12).map((row) => (
              <div className="soft-alert" key={row.player.id}>
                <div><History size={15} /> <strong>{row.player.name}</strong></div>
                <ul className="mini-list">{row.history.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            ))}
            {!rows.some((row) => row.history.length) ? <EmptyState title="Sin historial reciente" text="A medida que registres wellness, fuerza, campo y mapa corporal, aquí aparecerá la evolución." /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
