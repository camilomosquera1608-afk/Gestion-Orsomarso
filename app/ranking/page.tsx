'use client';

import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';

export default function RankingPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const players = data.players.filter((player) => activeCategory === 'all' || player.category === activeCategory);

  const bestGoals = [...players].map((player) => ({ name: player.name, value: data.competitionRecords.filter((r) => r.playerId === player.id).reduce((acc, r) => acc + r.goals, 0) })).sort((a,b)=>b.value-a.value).slice(0,5);
  const bestAssists = [...players].map((player) => ({ name: player.name, value: data.competitionRecords.filter((r) => r.playerId === player.id).reduce((acc, r) => acc + r.assists, 0) })).sort((a,b)=>b.value-a.value).slice(0,5);
  const bestNutrition = [...players].map((player) => {
    const row = data.nutritionRecords.filter((r) => r.playerId === player.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
    return { name: player.name, value: row ? row.skinfoldSum : 9999 };
  }).sort((a,b)=>a.value-b.value).slice(0,5);
  const bestFms = [...players].map((player) => {
    const row = data.fmsRecords.filter((r) => r.playerId === player.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const total = row ? row.shoulderMobility + row.squat + row.legRaise + row.hurdleStep + row.lunge + row.trunkStability + row.rotaryStability : 0;
    return { name: player.name, value: total };
  }).sort((a,b)=>b.value-a.value).slice(0,5);
  const bestNeuro = [...players].map((player) => {
    const row = data.neuromuscularRecords.filter((r) => r.playerId === player.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
    return { name: player.name, value: row ? row.cmj : 0 };
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
      <AppHero title="Ranking" subtitle={`Orsomarso SC Performance · ${master ? 'Global' : categoryLabel(activeCategory)}`} />
      <GlobalFiltersBar />
      <div className="card"><p>Usa los filtros para ver ranking por categoría y microciclo. El usuario Maestro puede revisar una vista global.</p></div><div className="grid grid-2">
        {sections.map(([title, rows, suffix]) => (
          <div key={title} className="card">
            <h3>{title}</h3>
            <div className="grid" style={{ gap: 10 }}>
              {rows.map((row, index) => (
                <div key={`${title}-${row.name}`} className="mini-stat-card">
                  <strong>{index + 1}. {row.name}</strong>
                  <div className="muted-line">{row.value} {suffix}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
