'use client';

import dynamic from 'next/dynamic';

const loading = () => (
  <div className="chart-skeleton shimmer" style={{ width: '100%', height: '100%', minHeight: 280, borderRadius: 'var(--radius-md)' }}>
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)' }}>
      <span>Cargando gráfico…</span>
    </div>
  </div>
);

const cardLoading = (text = 'Cargando…') => (
  <div className="card shimmer" style={{ minHeight: 200, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-lg)' }}>
    <span className="muted-line">{text}</span>
  </div>
);

export const LazyBarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  { ssr: false, loading },
);

export const LazyLineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  { ssr: false, loading },
);

export const LazyPieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  { ssr: false, loading },
);

export const LazyAreaChart = dynamic(
  () => import('recharts').then((mod) => mod.AreaChart),
  { ssr: false, loading },
);

export const LazyCompetitionReport = dynamic(
  () => import('./competition-report').then((mod) => ({ default: mod.CompetitionReportTemplate })),
  { ssr: false, loading: () => cardLoading('Cargando reporte…') },
);

export const LazySessionReport = dynamic(
  () => import('./session-report').then((mod) => ({ default: mod.SessionReportTemplate })),
  { ssr: false, loading: () => cardLoading('Cargando reporte de sesión…') },
);

export const LazyPlayerComparison = dynamic(
  () => import('./player-comparison').then((mod) => ({ default: mod.PlayerComparison })),
  { ssr: false, loading: () => cardLoading('Cargando comparación…') },
);

export {
  Bar,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  Area,
} from 'recharts';
