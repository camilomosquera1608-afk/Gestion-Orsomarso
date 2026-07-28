'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { AlertTriangle, HeartPulse, ShieldCheck, TrendingUp } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { buildAbruptLoadAlerts, buildLoadWellnessRelation, buildReturnToPlayAlerts, buildWeeklyMonotonyFatigue, type LogicInsight } from '@/lib/logic-insights';
import { buildPlayerDecisionContext } from '@/lib/player-decision';
import { getCanonicalPlayers } from '@/lib/relational-data';
import { buildAcwrData } from '@/lib/strategic-helpers';
import { riskToneLabel } from '@/lib/predictive-risk';

const toneClass = (tone: string): 'red' | 'amber' | 'green' | 'blue' =>
  tone === 'red' ? 'red' : tone === 'yellow' || tone === 'amber' ? 'amber' : tone === 'green' ? 'green' : 'blue';

const InsightList = ({ title, subtitle, items }: { title: string; subtitle: string; items: LogicInsight[] }) => (
  <div className="card">
    <SectionHeader eyebrow="Complemento" title={title} subtitle={subtitle} />
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
      {!items.length ? <EmptyState icon="check" title="Sin alertas relevantes" text="No se detectaron señales con la información disponible." /> : null}
    </div>
  </div>
);

export default function InjuryRiskPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const scopedLabel = activeCategory === 'all' ? 'Todas' : categoryLabel(activeCategory as any);
  const referenceDate = filters.date;
  const rankingCategory = (activeCategory === 'all' ? 'all' : activeCategory) as any;

  const scopedPlayers = useMemo(
    () =>
      getCanonicalPlayers(
        data,
        data.players.filter((player) => activeCategory === 'all' || player.category === activeCategory),
      ),
    [data, activeCategory],
  );

  const decisionRows = useMemo(
    () =>
      scopedPlayers
        .map((player) => ({
          player,
          ctx: buildPlayerDecisionContext({ data, player, date: referenceDate }),
        }))
        .sort((a, b) => b.ctx.profile.riskScore - a.ctx.profile.riskScore),
    [data, scopedPlayers, referenceDate],
  );

  const acwr = buildAcwrData(data, activeCategory, referenceDate);
  const abrupt = buildAbruptLoadAlerts({
    players: scopedPlayers,
    internalLoads: data.internalLoads,
    externalLoads: data.externalLoads,
    referenceDate,
    category: rankingCategory,
    limit: 8,
  });
  const loadWellness = buildLoadWellnessRelation({
    players: scopedPlayers,
    wellness: data.wellness,
    internalLoads: data.internalLoads,
    externalLoads: data.externalLoads,
    date: referenceDate,
    category: rankingCategory,
    limit: 8,
  });
  const rtp = buildReturnToPlayAlerts({
    players: scopedPlayers,
    internalLoads: data.internalLoads,
    externalLoads: data.externalLoads,
    competitionRecords: data.competitionRecords,
    referenceDate,
    category: rankingCategory,
    limit: 8,
  });
  const monotony = buildWeeklyMonotonyFatigue({
    players: scopedPlayers,
    internalLoads: data.internalLoads,
    externalLoads: data.externalLoads,
    referenceDate,
    category: rankingCategory,
  });

  const red = decisionRows.filter((row) => row.ctx.profile.riskTone === 'red' || row.ctx.predictive.tone === 'red').length;
  const amber = decisionRows.filter((row) => row.ctx.profile.riskTone === 'amber' || row.ctx.predictive.tone === 'amber').length;
  const green = decisionRows.length - red - amber;
  const acwrDanger = acwr.filter((row) => row.zone === 'danger').length;

  return (
    <div className="grid risk-page">
      <AppHero heroClass="hero-riesgo" title="Riesgo y disponibilidad" subtitle={`Motor unificado · ${scopedLabel} · ${referenceDate}`} />
      <GlobalFiltersBar />

      <div className="grid grid-4">
        <KpiCard label="Sin alerta crítica" value={String(green)} tone="green" icon={<ShieldCheck size={18} />} trend="Perfil estable" />
        <KpiCard label="Precaución" value={String(amber)} tone="amber" icon={<HeartPulse size={18} />} trend="Seguimiento" />
        <KpiCard label="Riesgo alto" value={String(red)} tone={red ? 'red' : 'green'} icon={<AlertTriangle size={18} />} trend="Semáforo unificado" />
        <KpiCard label="ACWR riesgo" value={String(acwrDanger)} tone={acwrDanger ? 'red' : 'green'} icon={<TrendingUp size={18} />} trend="Carga aguda/crónica" />
      </div>

      <div className="card">
        <SectionHeader
          eyebrow="Motor unificado"
          title="Decisión por jugador"
          subtitle="Misma lógica que plan diario, carga e informes (buildPlayerDecisionContext)."
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
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {decisionRows.map(({ player, ctx }) => (
                <tr key={player.id}>
                  <td><Link href={`/jugadores/${player.id}`}><strong>{player.name}</strong></Link><br /><span className="muted-line">{player.position}</span></td>
                  <td><StatusBadge text={String(ctx.profile.riskScore)} tone={ctx.profile.riskTone} /></td>
                  <td>{ctx.scientific.state}</td>
                  <td><StatusBadge text={riskToneLabel(ctx.predictive.tone)} tone={ctx.predictive.tone} /></td>
                  <td>{ctx.profile.acwr.primary.rolling.toFixed(2)}</td>
                  <td className="muted-line">{ctx.scientific.reasons[0] ?? ctx.scientific.nextFocus[0] ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="ACWR" title="Carga aguda/crónica" subtitle="Últimos 7 días vs promedio de 28 días." />
          <div className="table-wrap">
            <table className="professional-table">
              <thead><tr><th>Jugador</th><th>Aguda</th><th>Crónica</th><th>Ratio</th><th>Zona</th></tr></thead>
              <tbody>
                {acwr.slice(0, 18).map((row) => (
                  <tr key={row.player.id}>
                    <td><Link href={`/jugadores/${row.player.id}`}><strong>{row.player.name}</strong></Link></td>
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
        <div className="card">
          <SectionHeader eyebrow="Acceso" title="Vistas relacionadas" subtitle="Profundiza sin cambiar de criterio." />
          <div className="quick-action-grid">
            <Link className="quick-action-card" href="/plan-diario"><strong>Plan diario</strong><span>Decisión pre-sesión</span></Link>
            <Link className="quick-action-card" href="/carga"><strong>Centro de carga</strong><span>Resumen y dominios</span></Link>
            <Link className="quick-action-card" href="/disponibilidad"><strong>Disponibilidad</strong><span>Estado médico</span></Link>
            <Link className="quick-action-card" href="/adherencia"><strong>Adherencia</strong><span>Calidad del dato</span></Link>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <InsightList title="Aumento brusco de carga" subtitle="Análisis complementario (7d vs 7d previos)." items={abrupt} />
        <InsightList title="Carga + wellness" subtitle="Cruce exigencia vs recuperación reportada." items={loadWellness} />
      </div>
      <div className="grid grid-2">
        <InsightList title="Retorno progresivo" subtitle="Lesionados, molestias o readaptación." items={rtp} />
        <InsightList title="Monotonía semanal" subtitle="Distribución de carga y fatiga acumulada." items={[monotony]} />
      </div>
    </div>
  );
}
