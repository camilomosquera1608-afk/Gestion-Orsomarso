import type { ReactNode } from 'react';

type KpiTone = 'neutral' | 'blue' | 'green' | 'yellow' | 'amber' | 'red' | 'dark';

export const KpiCard = ({
  label,
  value,
  trend,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  trend?: string;
  icon?: ReactNode;
  tone?: KpiTone;
}) => (
  <div className={`card kpi premium-kpi kpi-${tone === 'yellow' ? 'amber' : tone}`}>
    <div className="kpi-topline">
      <span className="kpi-label">{label}</span>
      {icon ? <span className="kpi-icon">{icon}</span> : null}
    </div>
    <span className="kpi-value">{value}</span>
    {trend ? <span className="kpi-trend">{trend}</span> : null}
  </div>
);
