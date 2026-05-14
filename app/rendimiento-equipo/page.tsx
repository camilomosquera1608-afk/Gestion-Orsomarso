'use client';

import Link from 'next/link';
import { BarChart3, Goal, LineChart as LineChartIcon, ShieldCheck, Trophy, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { formatMatchScore } from '@/lib/performance-helpers';
import type { CompetitionMatchSummary } from '@/lib/types';
import type { EyeballMatchStats, EyeballRow } from '@/components/eyeball-importer';

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value || value === '-') return 0;
  const n = Number(String(value).replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const average = (values: number[]) => {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
};

const isEyeballStats = (value: unknown): value is EyeballMatchStats => {
  if (!value || typeof value !== 'object') return false;
  const stats = value as Partial<EyeballMatchStats>;
  return stats.sourceFormat === 'eyeball-team-stats' && !!stats.sections;
};

const findStat = (stats: EyeballMatchStats | undefined, statName: string) => {
  if (!stats) return 0;
  const target = statName.trim().toLowerCase();
  const rows = Object.values(stats.sections).flat() as EyeballRow[];
  const row = rows.find((item) => item.stat.trim().toLowerCase() === target || item.rawStat?.trim().toLowerCase() === target);
  return toNumber(row?.orso);
};

const resultTone = (match: CompetitionMatchSummary) => {
  if (match.resultType === 'Victoria') return 'green';
  if (match.resultType === 'Derrota') return 'red';
  return 'amber';
};

export default function TeamPerformancePage() {
  const { data, filters, isLoading } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const matches = data.competitionMatchSummaries
    .filter((match) => activeCategory === 'all' || match.category === activeCategory)
    .filter((match) => isEyeballStats(match.eyeballStats))
    .sort((a, b) => a.date.localeCompare(b.date));

  const rows = matches.map((match) => {
    const stats = match.eyeballStats as EyeballMatchStats;
    const shots = findStat(stats, 'Tiros');
    const shotsOnTarget = findStat(stats, 'Tiros a puerta');
    const entriesArea = findStat(stats, 'Entradas al área') || findStat(stats, 'Entradas al area');
    const recoveries = findStat(stats, 'Recuperaciones');
    const losses = findStat(stats, 'Pérdidas') || findStat(stats, 'Perdidas');
    return {
      id: match.id,
      fecha: match.date.slice(5),
      date: match.date,
      rival: match.opponent,
      marcador: formatMatchScore(match),
      resultado: match.resultType ?? '—',
      posesion: stats.possession || findStat(stats, 'Posesión') || findStat(stats, 'Posesion'),
      precision: stats.passPrecision || findStat(stats, 'Precisión de pases') || findStat(stats, 'Precision de pases'),
      conversion: stats.conversionRate || findStat(stats, 'Tasa de conversión de tiros') || findStat(stats, 'Tasa de conversion de tiros'),
      gf: match.goalsFor ?? stats.goalsFor ?? 0,
      ga: match.goalsAgainst ?? stats.goalsAgainst ?? 0,
      tiros: shots,
      tirosPuerta: shotsOnTarget,
      entradasArea: entriesArea,
      recuperaciones: recoveries,
      perdidas: losses,
      match,
    };
  });

  const latest = rows.at(-1);
  const wins = rows.filter((row) => row.resultado === 'Victoria').length;
  const draws = rows.filter((row) => row.resultado === 'Empate').length;
  const losses = rows.filter((row) => row.resultado === 'Derrota').length;
  const goalsFor = rows.reduce((sum, row) => sum + row.gf, 0);
  const goalsAgainst = rows.reduce((sum, row) => sum + row.ga, 0);
  const avgPossession = average(rows.map((row) => row.posesion));
  const avgPrecision = average(rows.map((row) => row.precision));
  const avgConversion = average(rows.map((row) => row.conversion));

  if (isLoading) {
    return (
      <div className="grid">
        <AppHero title="Rendimiento del equipo" subtitle="Cargando datos de competencia…" heroClass="hero-competencia" />
        <div className="card" style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Sincronizando con Supabase…</div>
      </div>
    );
  }

  return (
    <div className="grid team-performance-page">
      <AppHero
        title="Rendimiento del equipo"
        subtitle={`Lectura visual partido a partido desde métricas Eyeball · ${activeCategory === 'all' ? 'Todas las categorías' : categoryLabel(activeCategory)}`}
        heroClass="hero-competencia"
      />
      <GlobalFiltersBar />

      {!rows.length ? (
        <div className="card">
          <EmptyState title="Sin métricas Eyeball cargadas" text="Carga el CSV de Eyeball en Competencia para construir el rendimiento colectivo partido a partido." />
          <div className="btn-row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <Link href="/competencia" className="btn">Ir a Competencia</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-4">
            <KpiCard label="Partidos analizados" value={String(rows.length)} tone="dark" icon={<Trophy size={18} />} trend={`${wins}V · ${draws}E · ${losses}D`} />
            <KpiCard label="Goles" value={`${goalsFor}-${goalsAgainst}`} tone="blue" icon={<Goal size={18} />} trend="GF-GC" />
            <KpiCard label="Posesión media" value={`${avgPossession.toFixed(1)}%`} tone="green" icon={<BarChart3 size={18} />} trend="Eyeball" />
            <KpiCard label="Precisión pase" value={`${avgPrecision.toFixed(1)}%`} tone="amber" icon={<TrendingUp size={18} />} trend={`Conv. ${avgConversion.toFixed(1)}%`} />
          </div>

          <div className="grid grid-2">
            <div className="card">
              <SectionHeader eyebrow="Evolución" title="Control del partido" subtitle="Posesión, precisión y conversión por partido." />
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="posesion" name="Posesión %" stroke="#1557d6" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="precision" name="Precisión pase %" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="conversion" name="Conversión %" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <SectionHeader eyebrow="Producción" title="Goles y volumen ofensivo" subtitle="Relación entre marcador, tiros y tiros a puerta." />
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="gf" name="Goles favor" fill="#1557d6" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="ga" name="Goles contra" fill="#ef4444" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="tirosPuerta" name="Tiros a puerta" fill="#16a34a" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {latest ? (
            <div className="card">
              <SectionHeader eyebrow="Último partido" title={`${latest.rival} · ${latest.marcador}`} subtitle="Resumen visual de métricas Eyeball cargadas manualmente." />
              <div className="grid grid-4">
                <KpiCard label="Resultado" value={latest.resultado} tone={latest.resultado === 'Victoria' ? 'green' : latest.resultado === 'Derrota' ? 'red' : 'amber'} icon={<ShieldCheck size={18} />} trend={latest.date} />
                <KpiCard label="Tiros / a puerta" value={`${latest.tiros}/${latest.tirosPuerta}`} tone="blue" trend="Ofensivo" />
                <KpiCard label="Entradas al área" value={latest.entradasArea ? String(latest.entradasArea) : '—'} tone="green" trend="Profundidad" />
                <KpiCard label="Recup. / pérdidas" value={`${latest.recuperaciones || '—'} / ${latest.perdidas || '—'}`} tone="amber" trend="Transiciones" />
              </div>
            </div>
          ) : null}

          <div className="card">
            <SectionHeader eyebrow="Histórico" title="Partidos con Eyeball" subtitle="Tabla limpia para revisar consistencia del equipo." />
            <div className="professional-table-wrap">
              <table className="professional-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Rival</th>
                    <th>Marcador</th>
                    <th>Resultado</th>
                    <th>Posesión</th>
                    <th>Precisión pase</th>
                    <th>Conversión</th>
                    <th>Tiros</th>
                    <th>Tiros puerta</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice().reverse().map((row) => (
                    <tr key={row.id}>
                      <td>{row.date}</td>
                      <td><strong>{row.rival}</strong></td>
                      <td>{row.marcador}</td>
                      <td><StatusBadge text={row.resultado} tone={resultTone(row.match)} /></td>
                      <td>{row.posesion ? `${row.posesion}%` : '—'}</td>
                      <td>{row.precision ? `${row.precision}%` : '—'}</td>
                      <td>{row.conversion ? `${row.conversion}%` : '—'}</td>
                      <td>{row.tiros || '—'}</td>
                      <td>{row.tirosPuerta || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
