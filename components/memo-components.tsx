import { memo, useMemo } from 'react';
import { KpiCard } from './kpi-card';
import { StatusBadge } from './pro-ui';

// Memoized KPI Card - optimiza re-renders cuando props no cambian
export const MemoKpiCard = memo(KpiCard);

// Memoized Status Badge - optimiza re-renders en listas
export const MemoStatusBadge = memo(StatusBadge);

// Memoized Player Row - optimiza listas largas de jugadores
interface PlayerRowProps {
  name: string;
  position: string;
  value: number;
  statusText: string;
}

export const MemoPlayerRow = memo(({ name, position, value, statusText }: PlayerRowProps) => {
  const formattedValue = useMemo(() => value.toLocaleString('es-CO', { maximumFractionDigits: 1 }), [value]);
  
  return (
    <div className="flex items-center justify-between p-2 border-b">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-sm text-gray-500">{position}</div>
      </div>
      <div className="text-right">
        <div className="font-semibold">{formattedValue}</div>
        <MemoStatusBadge text={statusText} />
      </div>
    </div>
  );
});

// Memoized Chart Container - optimiza gráficos que no cambian frecuentemente
interface ChartContainerProps {
  title: string;
  children: React.ReactNode;
  height?: number;
}

export const MemoChartContainer = memo(({ title, children, height = 300 }: ChartContainerProps) => {
  const style = useMemo(() => ({ height: `${height}px` }), [height]);
  
  return (
    <div className="bg-white rounded-lg shadow p-4" style={style}>
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
});

// Memoized Stat Card - optimiza tarjetas de estadísticas
interface StatCardProps {
  label: string;
  value: number | string;
  change?: number;
  unit?: string;
}

export const MemoStatCard = memo(({ label, value, change, unit = '' }: StatCardProps) => {
  const displayValue = useMemo(() => {
    if (typeof value === 'number') {
      return value.toLocaleString('es-CO');
    }
    return value;
  }, [value]);
  
  const changeColor = useMemo(() => {
    if (!change) return 'text-gray-500';
    return change > 0 ? 'text-green-600' : 'text-red-600';
  }, [change]);
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{displayValue}{unit}</div>
      {change !== undefined && (
        <div className={`text-sm ${changeColor}`}>
          {change > 0 ? '+' : ''}{change}%
        </div>
      )}
    </div>
  );
});
