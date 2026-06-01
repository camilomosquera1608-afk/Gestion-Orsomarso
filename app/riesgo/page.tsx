'use client';

import { useMemo } from 'react';
import { AlertTriangle, Activity, HeartPulse, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { categoryLabel } from '@/lib/labels';
import {
  buildAbruptLoadAlerts,
  buildAvailabilityIndex,
  buildLoadWellnessRelation,
  buildPlayerReadinessSemaphores,
  buildReturnToPlayAlerts,
  buildWeeklyMonotonyFatigue,
  type LogicInsight,
} from '@/lib/logic-insights';
import { buildPlayerDecisionContext } from '@/lib/player-decision';
import { getCanonicalPlayers } from '@/lib/relational-data';
import { buildAcwrData } from '@/lib/strategic-helpers';
import { riskToneLabel } from '@/lib/predictive-risk';

const toneClass = (tone: string): 'red' | 'amber' | 'green' | 'blue' => tone === 'red' ? 'red' : tone === 'yellow' ? 'amber' : tone === 'green' ? 'green' : 'blue';

const InsightList = ({ title, subtitle, items }: { title: string; subtitle: string; items: LogicInsight[] }) => (
  <div className="card">
    <SectionHeader eyebrow="Prevención" title={title} subtitle={subtitle} />
    <div className="alert-center-list">
      {items.map((item) => (
        <div key={item.id} className={`alert-center-row ui-tone-${toneClass(item.tone)}`}>
          <div className="alert-center-icon"><AlertTriangle size={18} /></div>
          <div>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </div>
          {item.value ? <StatusBadge text={item.value} tone={toneClass(item.tone)} /> : null}
        </div>
      ))}
      {!items.length ? <EmptyState icon="check" title="Sin alertas relevantes" text="No se detectaron señales críticas con la información disponible." /> : null}
    </div>
  </div>
);

export default function InjuryRiskPage() {
  const { data, filters } = useApp();
  const activeCategory = filters.category || 'all';
  const scopedLabel = activeCategory === 'all' ? 'Todas' : categoryLabel(activeCategory as any);
  const referenceDate = filters.date;
  const readiness = buildPlayerReadinessSemaphores({
    players: data.players,
    wellness: data.wellness,
    internalLoads: data.internalLoads,
    externalLoads: data.externalLoads,
    competitionRecords: data.competitionRecords,
    referenceDate,
    category: activeCategory as any,
    limit: 999,
  });
  const availability = buildAvailabilityIndex({
    players: data.players,
    wellness: data.wellness,
    internalLoads: data.internalLoads,
    externalLoads: data.externalLoads,
    competitionRecords: data.competitionRecords,
    referenceDate,
    category: activeCategory as any,
  });
  const abrupt = buildAbruptLoadAlerts({
    players: data.players,
    internalLoads: data.internalLoads,
    externalLoads: data.externalLoads,
    competitionRecords: data.competitionRecords,
    referenceDate,
    category: activeCategory as any,
    limit: 8,
  });
  const loadWellness = buildLoadWellnessRelation({
    players: data.players,
    wellness: data.wellness,
    internalLoads: data.internalLoads,
    externalLoads: data.externalLoads,
    competitionRecords: data.competitionRecords,
    date: referenceDate,
    category: activeCategory as any,
    limit: 8,
  });
  const rtp = buildReturnToPlayAlerts({
    players: data.players,
    competitionRecords: data.competitionRecords,
    internalLoads: data.internalLoads,
    externalLoads: data.externalLoads,
    referenceDate,
    category: activeCategory as any,
    limit: 8,
  });
  const monotony = buildWeeklyMonotonyFatigue({
    players: data.players,
    internalLoads: data.internalLoads,
    externalLoads: data.externalLoads,
    competitionRecords: data.competitionRecords,
    referenceDate,
    category: activeCategory as any,
  });
  const acwr = buildAcwrData(data, activeCategory, referenceDate);
  const scopedPlayers = useMemo(
    () =>
      getCanonicalPlayers(
        data,
        data.players.filter(
          (player) => activeCategory === 'all' || player.category === activeCategory,
        ),
      ),
    [data, activeCategory],
  );
  const decisionHighlights = useMemo(
    () =>
      scopedPlayers
        .map((player) => ({
          player,
          ctx: buildPlayerDecisionContext({ data, player, date: referenceDate }),
        }))
        .sort((a, b) => b.ctx.profile.riskScore - a.ctx.profile.riskScore)
        .slice(0, 10),
    [data, scopedPlayers, referenceDate],
  );
  const red = readiness.filter((row) => row.tone === 'red').length;
  const yellow = readiness.filter((row) => row.tone === 'yellow').length;
  const green = readiness.filter((row) => row.tone === 'green').length;
  const acwrDanger = acwr.filter((row) => row.zone === 'danger').length;

  return (
    <div className="grid risk-page">
      <AppHero heroClass="hero-riesgo" title="Riesgo y disponibilidad" subtitle={`Maximizar rendimiento minimizando exposición a lesión · ${scopedLabel}`} />
      <GlobalFiltersBar />

      <div className="grid grid-4">
        <KpiCard label="Disponibilidad" value={availability.value ?? '0%'} tone={availability.tone === 'red' ? 'red' : availability.tone === 'yellow' ? 'amber' : 'green'} icon={<ShieldCheck size={18} />} trend="Índice combinado" />
        <KpiCard label="Jugadores en riesgo" value={String(red)} tone={red ? 'red' : 'green'} icon={<AlertTriangle size={18} />} trend="Semáforo rojo" />
        <KpiCard label="Precaución" value={String(yellow)} tone="amber" icon={<HeartPulse size={18} />} trend="Requieren seguimiento" />
        <KpiCard label="ACWR riesgo" value={String(acwrDanger)} tone={acwrDanger ? 'red' : 'green'} icon={<TrendingUp size={18} />} trend="Carga aguda/crónica" />
      </div>

      <div className="card risk-control-card">
        <SectionHeader eyebrow="Control semanal" title="Resumen preventivo" subtitle="Combina carga, wellness, retorno progresivo y disponibilidad deportiva." />
        <div className="grid grid-3">
          <div className="risk-mini-card"><span>Disponibles</span><strong>{green}</strong><p>Jugadores en verde.</p></div>
          <div className="risk-mini-card"><span>Monotonía</span><strong>{monotony.value}</strong><p>{monotony.description}</p></div>
          <div className="risk-mini-card"><span>ACWR</span><strong>{acwrDanger}</strong><p>Jugadores fuera de zona segura por acumulación o salto de carga.</p></div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Semáforo" title="Disponibilidad por jugador" subtitle="Ordenado de mayor riesgo a menor riesgo." />
          <div className="table-wrap">
            <table className="professional-table">
              <thead><tr><th>Jugador</th><th>Posición</th><th>Disponibilidad</th><th>Detalle</th></tr></thead>
              <tbody>
                {readiness.slice(0, 18).map((row) => (
                  <tr key={row.playerId}>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.position}</td>
                    <td><StatusBadge text={`${row.label} · ${Math.round(row.score)}%`} tone={toneClass(row.tone)} /></td>
                    <td>{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <SectionHeader eyebrow="ACWR" title="Carga aguda/crónica" subtitle="Últimos 7 días vs promedio semanal de 28 días." />
          <div className="table-wrap">
            <table className="professional-table">
              <thead><tr><th>Jugador</th><th>Aguda</th><th>Crónica</th><th>Ratio</th><th>Zona</th></tr></thead>
              <tbody>
                {acwr.slice(0, 18).map((row) => (
                  <tr key={row.player.id}>
                    <td><strong>{row.player.name}</strong></td>
                    <td>{Math.round(row.acute)}</td>
                    <td>{Math.round(row.chronic)}</td>
                    <td>{row.ratio}</td>
                    <td><StatusBadge text={row.zoneLabel} tone={row.zone === 'danger' ? 'red' : row.zone === 'warning' ? 'amber' : row.zone === 'safe' ? 'green' : 'neutral'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <InsightList title="Aumento brusco de carga" subtitle="Jugadores con salto de carga en los últimos 7 días." items={abrupt} />
        <InsightList title="Carga + wellness" subtitle="Cruce entre exigencia y recuperación reportada." items={loadWellness} />
      </div>
      <div className="grid grid-2">
        <InsightList title="Retorno progresivo" subtitle="Control para lesionados, molestias o readaptación." items={rtp} />
        <InsightList title="Monotonía semanal" subtitle="Distribución de carga y posible fatiga acumulada." items={[monotony]} />
      </div>

      <div className="card">
        <SectionHeader
          eyebrow="Motor unificado"
          title="Decisión científica + predictiva"
          subtitle="Misma lógica que plan diario y ficha individual (buildPlayerDecisionContext)."
        />
        <div className="table-wrap">
          <table className="professional-table">
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Riesgo perfil</th>
                <th>Decisión carga</th>
                <th>Predictivo</th>
                <th>ACWR</th>
              </tr>
            </thead>
            <tbody>
              {decisionHighlights.map(({ player, ctx }) => (
                <tr key={player.id}>
                  <td><strong>{player.name}</strong></td>
                  <td><StatusBadge text={`${ctx.profile.riskScore}`} tone={ctx.profile.riskTone} /></td>
                  <td>{ctx.scientific.state}</td>
                  <td><StatusBadge text={riskToneLabel(ctx.predictive.tone)} tone={ctx.predictive.tone} /></td>
                  <td>{ctx.profile.acwr.primary.rolling.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
