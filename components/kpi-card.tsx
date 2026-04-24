export const KpiCard = ({ label, value, trend }: { label: string; value: string; trend?: string }) => (
  <div className="card kpi">
    <span className="kpi-label">{label}</span>
    <span className="kpi-value">{value}</span>
    {trend ? <span className="kpi-trend">{trend}</span> : null}
  </div>
);
