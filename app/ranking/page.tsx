'use client';

import Link from 'next/link';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';

export default function RankingPage() {
  const { data, filters, isLoading } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const players = data.players.filter((player) => activeCategory === 'all' || player.category === activeCategory);

  // Goles — solo jugadores con al menos 1 gol
  const bestGoals = [...players]
    .map((player) => ({
      id: player.id,
      name: player.name,
      value: data.competitionRecords.filter((r) => r.playerId === player.id).reduce((acc, r) => acc + r.goals, 0),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Asistencias — solo jugadores con al menos 1 asistencia
  const bestAssists = [...players]
    .map((player) => ({
      id: player.id,
      name: player.name,
      value: data.competitionRecords.filter((r) => r.playerId === player.id).reduce((acc, r) => acc + r.assists, 0),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Nutrición — solo jugadores con al menos una valoración nutricional
  const bestNutrition = [...players]
    .map((player) => {
      const row = data.nutritionRecords
        .filter((r) => r.playerId === player.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      return { id: player.id, name: player.name, value: row ? row.skinfoldSum : null };
    })
    .filter((row): row is { id: string; name: string; value: number } => row.value !== null)
    .sort((a, b) => a.value - b.value)
    .slice(0, 5);

  // FMS — solo jugadores con al menos un registro FMS
  const bestFms = [...players]
    .map((player) => {
      const row = data.fmsRecords
        .filter((r) => r.playerId === player.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!row) return null;
      const total = row.shoulderMobility + row.squat + row.legRaise + row.hurdleStep + row.lunge + row.trunkStability + row.rotaryStability;
      return { id: player.id, name: player.name, value: total };
    })
    .filter((row): row is { id: string; name: string; value: number } => row !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Neuromuscular (CMJ) — solo jugadores con al menos un registro
  const bestNeuro = [...players]
    .map((player) => {
      const row = data.neuromuscularRecords
        .filter((r) => r.playerId === player.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
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
        <AppHero title="Ranking de rendimiento" subtitle="Cargando datos…" />
        <div className="card" style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          Sincronizando con Supabase…
        </div>
      </div>
    );
  }

  return (
    <div className="grid">
      <AppHero title="Ranking de rendimiento" subtitle={`Lectura comparativa · ${master ? 'Global' : categoryLabel(activeCategory)}`} />
      <GlobalFiltersBar />
      <div className="toolbar card">
        <div>
          <span className="section-eyebrow">Análisis comparativo</span>
          <h3 style={{ margin: 0 }}>Top rendimiento por módulo</h3>
          <div className="muted-line">Solo aparecen jugadores con datos reales registrados en cada categoría.</div>
        </div>
        <div className="btn-row">
          <StatusBadge tone="blue" text={master ? 'Usuario Maestro' : `Categoría ${categoryLabel(activeCategory)}`} />
          <Link className="btn secondary" href="/informes">Ir a informes</Link>
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
              )) : (
                <EmptyState title="Sin datos aún" text={emptyText} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
