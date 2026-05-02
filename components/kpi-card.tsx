import type { ReactNode } from 'react';

type KpiTone = 'neutral' | 'blue' | 'green' | 'yellow' | 'amber' | 'red' | 'dark';

// FIX #2: La unidad aparece ahora JUNTO al número, no escondida abajo como "trend".
// Separamos value y unit para poder renderizarlos en la misma línea con tamaños distintos.
export const KpiCard = ({
  label,
  value,
  unit,
  trend,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  icon?: ReactNode;
  tone?: KpiTone;
}) => (
  <div className={`card kpi premium-kpi kpi-${tone === 'yellow' ? 'amber' : tone}`}>
    <div className="kpi-topline">
      <span className="kpi-label">{label}</span>
      {icon ? <span className="kpi-icon">{icon}</span> : null}
    </div>
    <div className="kpi-value-row">
      <span className="kpi-value">{value}</span>
      {unit ? <span className="kpi-unit">{unit}</span> : null}
    </div>
    {trend ? <span className="kpi-trend">{trend}</span> : null}
  </div>
);
