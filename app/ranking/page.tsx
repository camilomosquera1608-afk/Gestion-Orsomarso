'use client';

import Link from 'next/link';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';

export default function RankingPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const players = data.players.filter((player) => activeCategory === 'all' || player.category === activeCategory);

  const bestGoals = [...players].map((player) => ({ id: player.id, name: player.name, value: data.competitionRecords.filter((r) => r.playerId === player.id).reduce((acc, r) => acc + r.goals, 0) })).sort((a,b)=>b.value-a.value).slice(0,5);
  const bestAssists = [...players].map((player) => ({ id: player.id, name: player.name, value: data.competitionRecords.filter((r) => r.playerId === player.id).reduce((acc, r) => acc + r.assists, 0) })).sort((a,b)=>b.value-a.value).slice(0,5);
  const bestNutrition = [...players].map((player) => {
    const row = data.nutritionRecords.filter((r) => r.playerId === player.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
    return { id: player.id, name: player.name, value: row ? row.skinfoldSum : 9999 };
  }).sort((a,b)=>a.value-b.value).slice(0,5);
  const bestFms = [...players].map((player) => {
    const row = data.fmsRecords.filter((r) => r.playerId === player.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const total = row ? row.shoulderMobility + row.squat + row.legRaise + row.hurdleStep + row.lunge + row.trunkStability + row.rotaryStability : 0;
    return { id: player.id, name: player.name, value: total };
  }).sort((a,b)=>b.value-a.value).slice(0,5);
  const bestNeuro = [...players].map((player) => {
    const row = data.neuromuscularRecords.filter((r) => r.playerId === player.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
    return { id: player.id, name: player.name, value: row ? row.cmj : 0 };
  }).sort((a,b)=>b.value-a.value).slice(0,5);

  const sections = [
    ['Goles', bestGoals, 'goles'],
    ['Asistencias', bestAssists, 'asistencias'],
    ['Mejor en nutrición', bestNutrition, 'Σ pliegues'],
    ['Mejor en FMS', bestFms, 'pts'],
    ['Mejor en perfil neuromuscular', bestNeuro, 'CMJ'],
  ] as const;

  return (
    <div className="grid">
      <AppHero title="Ranking de rendimiento" subtitle={`Lectura comparativa · ${master ? 'Global' : categoryLabel(activeCategory)}`} />
      <GlobalFiltersBar />
      <div className="toolbar card">
        <div>
          <span className="section-eyebrow">Análisis comparativo</span>
          <h3 style={{ margin: 0 }}>Top rendimiento por módulo</h3>
          <div className="muted-line">Usa los filtros para revisar categorías, posiciones o jugadores específicos.</div>
        </div>
        <div className="btn-row">
          <StatusBadge tone="blue" text={master ? 'Usuario Maestro' : `Categoría ${categoryLabel(activeCategory)}`} />
          <Link className="btn secondary" href="/informes">Ir a informes</Link>
        </div>
      </div>
      <div className="grid grid-2">
        {sections.map(([title, rows, suffix]) => (
          <div key={title} className="card">
            <SectionHeader eyebrow="Top 5" title={title} subtitle="Ranking con acceso directo a ficha individual." />
            <div className="grid" style={{ gap: 10 }}>
              {rows.map((row, index) => (
                <Link key={`${title}-${row.name}`} className="mini-stat-card player-status-link" href={`/jugadores/${row.id}`}>
                  <div className="toolbar" style={{ padding: 0 }}>
                    <strong>{index + 1}. {row.name}</strong>
                    <span className="status-badge ui-tone-blue">{row.value} {suffix}</span>
                  </div>
                </Link>
              ))}
              {!rows.length ? <EmptyState title="No hay datos para este ranking" text="Carga registros suficientes para construir el comparativo." /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
