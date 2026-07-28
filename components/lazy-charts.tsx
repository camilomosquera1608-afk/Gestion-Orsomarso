'use client';

import dynamic from 'next/dynamic';

const loading = () => (
  <div className="chart-skeleton" style={{ width: '100%', height: '100%', minHeight: 280, display: 'grid', placeItems: 'center' }}>
    <span className="muted-line">Cargando gráfico…</span>
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
  { ssr: false, loading: () => <div className="p-4">Cargando reporte…</div> },
);

export const LazySessionReport = dynamic(
  () => import('./session-report').then((mod) => ({ default: mod.SessionReportTemplate })),
  { ssr: false, loading: () => <div className="p-4">Cargando reporte de sesión…</div> },
);

export const LazyPlayerComparison = dynamic(
  () => import('./player-comparison').then((mod) => ({ default: mod.PlayerComparison })),
  { ssr: false, loading: () => <div className="p-4">Cargando comparación…</div> },
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
