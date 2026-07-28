'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { buildAbruptLoadAlerts, buildDataInconsistencyAlerts, buildIntelligentRanking, buildPositionComparisonInsights, buildSelfComparisonInsights } from '@/lib/logic-insights';
import { buildPlayerDecisionContext } from '@/lib/player-decision';
import type { ClubCategory } from '@/lib/types';
import { getCanonicalPlayers } from '@/lib/relational-data';
import { riskToneLabel } from '@/lib/predictive-risk';

export default function RankingPage() {
  const { data, filters, isLoading } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const players = useMemo(
    () =>
      getCanonicalPlayers(
        data,
        data.players.filter((player) => activeCategory === 'all' || player.category === activeCategory),
      ),
    [data, activeCategory],
  );
  const rankingCategory = (activeCategory === 'all' ? 'all' : activeCategory) as ClubCategory | 'all';
  const intelligentRanking = buildIntelligentRanking({ data, players, referenceDate: filters.date, category: rankingCategory, limit: 10 });
  const riskRanking = useMemo(
    () =>
      players
        .map((player) => ({
          player,
          ctx: buildPlayerDecisionContext({ data, player, date: filters.date }),
        }))
        .sort((a, b) => b.ctx.profile.riskScore - a.ctx.profile.riskScore)
        .slice(0, 10),
    [data, players, filters.date],
  );
  const abruptLoadRanking = buildAbruptLoadAlerts({ players, internalLoads: data.internalLoads, externalLoads: data.externalLoads, referenceDate: filters.date, category: rankingCategory, limit: 5 });
  const selfComparison = buildSelfComparisonInsights({ players, internalLoads: data.internalLoads, externalLoads: data.externalLoads, referenceDate: filters.date, category: rankingCategory, limit: 5 });
  const positionComparison = buildPositionComparisonInsights({ players, externalLoads: data.externalLoads, referenceDate: filters.date, category: rankingCategory, limit: 5 });
  const dataInconsistencies = buildDataInconsistencyAlerts({ players, internalLoads: data.internalLoads, externalLoads: data.externalLoads, competitionRecords: data.competitionRecords, referenceDate: filters.date, category: rankingCategory, limit: 5 });

  const bestGoals = [...players]
    .map((player) => ({
      id: player.id,
      name: player.name,
      value: data.competitionRecords.filter((r) => r.playerId === player.id).reduce((acc, r) => acc + r.goals, 0),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const bestAssists = [...players]
    .map((player) => ({
      id: player.id,
      name: player.name,
      value: data.competitionRecords.filter((r) => r.playerId === player.id).reduce((acc, r) => acc + r.assists, 0),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const bestNutrition = [...players]
    .map((player) => {
      const row = data.nutritionRecords.filter((r) => r.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      return { id: player.id, name: player.name, value: row ? row.skinfoldSum : null };
    })
    .filter((row): row is { id: string; name: string; value: number } => row.value !== null)
    .sort((a, b) => a.value - b.value)
    .slice(0, 5);

  const bestFms = [...players]
    .map((player) => {
      const row = data.fmsRecords.filter((r) => r.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!row) return null;
      const total = row.shoulderMobility + row.squat + row.legRaise + row.hurdleStep + row.lunge + row.trunkStability + row.rotaryStability;
      return { id: player.id, name: player.name, value: total };
    })
    .filter((row): row is { id: string; name: string; value: number } => row !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const bestNeuro = [...players]
    .map((player) => {
      const row = data.neuromuscularRecords.filter((r) => r.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!row) return null;
      return { id: player.id, name: player.name, value: row.cmj };
    })
    .filter((row): row is { id: string; name: string; value: number } => row !== null && row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const sections = [
    { title: 'Goles', rows: bestGoals, suffix: 'goles', emptyText: 'Registra partidos con goles para ver este ranking.' },
    { title: 'Asistencias', rows: bestAssists, suffix: 'asist.', emptyText: 'Registra partidos con asistencias para ver este ranking.' },
    { title: 'Mejor en nutrición', rows: bestNutrition, suffix: 'Σ pliegues', emptyText: 'Carga valoraciones nutricionales para ver este ranking.' },
    { title: 'Mejor en FMS', rows: bestFms, suffix: 'pts', emptyText: 'Carga valoraciones FMS para ver este ranking.' },
    { title: 'Mejor en perfil neuromuscular', rows: bestNeuro, suffix: 'CMJ', emptyText: 'Carga valoraciones neuromusculares para ver este ranking.' },
  ];

  if (isLoading) {
    return (
      <div className="grid">
        <AppHero heroClass="hero-jugadores" title="Ranking de rendimiento" subtitle="Cargando datos…" />
        <div className="card" style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Sincronizando con Supabase…</div>
      </div>
    );
  }

  return (
    <div className="grid">
      <AppHero heroClass="hero-jugadores" title="Ranking de rendimiento" subtitle={`Lectura comparativa · ${master ? 'Global' : categoryLabel(activeCategory)}`} />
      <GlobalFiltersBar />
      <div className="toolbar card">
        <div>
          <span className="section-eyebrow">Análisis comparativo</span>
          <h3 style={{ margin: 0 }}>Top rendimiento por módulo</h3>
          <div className="muted-line">Riesgo unificado + rankings por datos registrados.</div>
        </div>
        <div className="btn-row">
          <StatusBadge tone="blue" text={master ? 'Usuario Maestro' : `Categoría ${categoryLabel(activeCategory)}`} />
          <Link className="btn secondary" href="/informes/jugador-periodo">Ir a reporte jugador</Link>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Motor unificado" title="Mayor riesgo de carga" subtitle="buildPlayerDecisionContext · misma lógica que plan diario y carga." />
          <div className="grid" style={{ gap: 10 }}>
            {riskRanking.length ? riskRanking.map(({ player, ctx }, index) => (
              <Link key={player.id} className="mini-stat-card player-status-link" href={`/jugadores/${player.id}`}>
                <div className="toolbar" style={{ padding: 0 }}>
                  <strong>{index + 1}. {player.name}</strong>
                  <span className={`status-badge ui-tone-${ctx.profile.riskTone}`}>{ctx.profile.riskScore} · {riskToneLabel(ctx.predictive.tone)}</span>
                </div>
                <div className="muted-line">{ctx.scientific.state} · ACWR {ctx.profile.acwr.primary.rolling.toFixed(2)}</div>
              </Link>
            )) : <EmptyState title="Sin jugadores" text="Ajusta categoría o fecha." />}
          </div>
        </div>
        <div className="card">
          <SectionHeader eyebrow="Ranking inteligente" title="Índice integral de rendimiento" subtitle="Competencia, carga, wellness, CMJ, FMS e intensidad GPS." />
          <div className="grid" style={{ gap: 10 }}>
            {intelligentRanking.length ? intelligentRanking.map((row, index) => (
              <Link key={row.id} className="mini-stat-card player-status-link" href={`/jugadores/${row.id}`}>
                <div className="toolbar" style={{ padding: 0 }}>
                  <strong>{index + 1}. {row.name}</strong>
                  <span className="status-badge ui-tone-blue">{Math.round(row.score)} pts</span>
                </div>
                <div className="muted-line">{row.detail}</div>
              </Link>
            )) : <EmptyState title="Sin datos suficientes" text="Carga competencia, valoraciones, wellness y sesiones." />}
          </div>
        </div>
      </div>
      <div className="card">
        <SectionHeader eyebrow="Complemento" title="Aumentos bruscos e incoherencias" subtitle="Análisis adicional; el semáforo principal usa el motor unificado." />
        <div className="grid" style={{ gap: 10 }}>
          {[...abruptLoadRanking, ...dataInconsistencies, ...selfComparison, ...positionComparison].slice(0, 6).map((insight) => (
            <div key={insight.id} className={`alert-item tone-${insight.tone === 'red' ? 'red' : insight.tone === 'yellow' ? 'yellow' : 'blue'}`}>
              <strong>{insight.title}</strong>{insight.value ? ` · ${insight.value}` : ''}<br />{insight.description}
            </div>
          ))}
          {![...abruptLoadRanking, ...dataInconsistencies, ...selfComparison, ...positionComparison].length ? (
            <EmptyState title="Sin desviaciones" text="No hay alertas complementarias para la fecha activa." />
          ) : null}
        </div>
      </div>
      <div className="grid grid-2">
        {sections.map(({ title, rows, suffix, emptyText }) => (
          <div key={title} className="card">
            <SectionHeader eyebrow="Top 5" title={title} subtitle="Solo jugadores con datos registrados." />
            <div className="grid" style={{ gap: 10 }}>
              {rows.length > 0 ? rows.map((row, index) => (
                <Link key={`${title}-${row.id}`} className="mini-stat-card player-status-link" href={`/jugadores/${row.id}`}>
                  <div className="toolbar" style={{ padding: 0 }}>
                    <strong>{index + 1}. {row.name}</strong>
                    <span className="status-badge ui-tone-blue">{row.value} {suffix}</span>
                  </div>
                </Link>
              )) : <EmptyState title="Sin datos aún" text={emptyText} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
