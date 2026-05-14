import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, FileText, LucideIcon } from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import { getPdfSafeText, reportDash } from '@/lib/report-utils';

export type ReportTone = 'blue' | 'green' | 'amber' | 'red' | 'neutral' | 'dark';

export type ReportCoverMetric = {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: ReportTone;
};

export const reportToneClass = (tone: ReportTone = 'neutral') => `pdf-report-tone-${tone}`;

export function ReportLayout({ title, subtitle, category, generatedAt, children, className = '' }: { title: string; subtitle?: string; category?: string; generatedAt?: string; children: ReactNode; className?: string }) {
  return (
    <article className={`pdf-report-document premium-report-document ${className}`}>
      <ReportHeader title={title} subtitle={subtitle} category={category} generatedAt={generatedAt} />
      {children}
      <ReportFooter category={category} />
    </article>
  );
}

export function ReportHeader({ title, subtitle, category, generatedAt }: { title: string; subtitle?: string; category?: string; generatedAt?: string }) {
  const meta = [category ? categoryLabel(category) : undefined, generatedAt ? getPdfSafeText(generatedAt, '') : undefined].filter(Boolean).join(' · ');
  return (
    <header className="pdf-report-header premium-report-header">
      <div className="pdf-report-brand">
        <img src="/orsomarso-crest.jpg" alt="Orsomarso SC" width={52} height={52} />
        <div>
          <span>Orsomarso Performance</span>
          <h1>{getPdfSafeText(title, 'Informe')}</h1>
          {meta ? <p>{meta}</p> : null}
        </div>
      </div>
      {subtitle ? <div className="pdf-report-header-meta"><strong>{getPdfSafeText(subtitle)}</strong></div> : null}
    </header>
  );
}

export function ReportFooter({ category }: { category?: string }) {
  return (
    <footer className="pdf-report-footer premium-report-footer">
      <span>Orsomarso Performance</span>
      <span>{category ? categoryLabel(category) : 'Informe institucional'}</span>
    </footer>
  );
}

export function ReportCover({
  kicker = 'Orsomarso Performance',
  title,
  subject,
  subtitle,
  meta = [],
  metrics = [],
  tone = 'blue',
  className = '',
}: {
  kicker?: string;
  title: string;
  subject?: string;
  subtitle?: string;
  meta?: Array<string | undefined | null | false>;
  metrics?: ReportCoverMetric[];
  tone?: ReportTone;
  className?: string;
}) {
  const safeMeta = meta.map((item) => getPdfSafeText(item, '')).filter(Boolean);
  return (
    <section className={`pdf-report-cover pdf-report-cover-${tone} ${className}`}>
      <div className="pdf-report-cover-mark">
        <img src="/orsomarso-crest.jpg" alt="Orsomarso SC" width={92} height={92} />
        <span>{getPdfSafeText(kicker, 'Orsomarso Performance')}</span>
      </div>
      <div className="pdf-report-cover-main">
        <span>{getPdfSafeText(title, 'Informe')}</span>
        <h2>{getPdfSafeText(subject || title, 'Informe')}</h2>
        {subtitle ? <p>{getPdfSafeText(subtitle)}</p> : null}
      </div>
      {safeMeta.length ? (
        <div className="pdf-report-cover-meta">
          {safeMeta.map((item) => <span key={item}>{item}</span>)}
        </div>
      ) : null}
      {metrics.length ? (
        <div className="pdf-report-cover-kpis">
          {metrics.map((metric) => (
            <div key={`${metric.label}-${String(metric.value)}`} className={`pdf-report-cover-kpi ${reportToneClass(metric.tone ?? 'neutral')}`}>
              <span>{getPdfSafeText(metric.label, 'Dato')}</span>
              <strong>{typeof metric.value === 'string' || typeof metric.value === 'number' ? reportDash(metric.value) : metric.value ?? '—'}</strong>
              {metric.note ? <small>{getPdfSafeText(metric.note, '')}</small> : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="pdf-report-cover-footer">
        <span>Documento institucional</span>
        <span>Rendimiento deportivo</span>
      </div>
    </section>
  );
}

export function ReportSection({ icon: Icon = FileText, eyebrow, title, subtitle, children, className = '' }: { icon?: LucideIcon; eyebrow?: string; title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`pdf-report-section premium-report-section ${className}`}>
      <div className="pdf-report-section-heading">
        <span className="pdf-report-icon pdf-report-tone-blue"><Icon size={15} strokeWidth={2.4} /></span>
        <div>
          {eyebrow ? <span>{getPdfSafeText(eyebrow, '')}</span> : null}
          <h3>{getPdfSafeText(title, 'Sección')}</h3>
          {subtitle ? <p>{getPdfSafeText(subtitle, '')}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ReportBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: ReportTone }) {
  return <span className={`pdf-report-badge ${reportToneClass(tone)}`}>{children || '—'}</span>;
}

export function ReportKpiCard({ icon: Icon = CheckCircle2, label, value, note, tone = 'blue' }: { icon?: LucideIcon; label: string; value: ReactNode; note?: string; tone?: ReportTone }) {
  return (
    <div className="pdf-report-kpi premium-report-kpi">
      <span className={`pdf-report-icon ${reportToneClass(tone)}`}><Icon size={15} strokeWidth={2.4} /></span>
      <div>
        <span>{getPdfSafeText(label, 'Dato')}</span>
        <strong>{typeof value === 'string' || typeof value === 'number' ? reportDash(value) : value ?? '—'}</strong>
        {note ? <small>{getPdfSafeText(note, '')}</small> : null}
      </div>
    </div>
  );
}

export function ReportEmptyState({ text = 'Sin registros.', compact = false }: { text?: string; compact?: boolean }) {
  return <div className={`pdf-report-empty ${compact ? 'compact' : ''}`}><AlertTriangle size={14} /><span>{getPdfSafeText(text, 'Sin registros.')}</span></div>;
}

export function ReportInsightBox({ children, tone = 'blue' }: { children: ReactNode; tone?: ReportTone }) {
  return <div className={`pdf-report-insight ${reportToneClass(tone)}`}>{children}</div>;
}

export function ReportComparisonBar({ label, value, max = 100, note }: { label: string; value: number; max?: number; note?: string }) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
  const percent = Math.max(0, Math.min(100, (safeValue / safeMax) * 100));
  return (
    <div className="pdf-report-comparison-bar">
      <div>
        <span>{getPdfSafeText(label, 'Indicador')}</span>
        <strong>{reportDash(safeValue)}</strong>
      </div>
      <i><em style={{ width: `${percent}%` }} /></i>
      {note ? <small>{getPdfSafeText(note, '')}</small> : null}
    </div>
  );
}


export type PdfChartPoint = { label: string; value: number; note?: string };

export function PdfSectionHeader({ icon: Icon = FileText, eyebrow, title, subtitle }: { icon?: LucideIcon; eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="pdf-report-section-heading pdf-section-header-pro">
      <span className="pdf-report-icon pdf-report-tone-blue"><Icon size={15} strokeWidth={2.4} /></span>
      <div>
        {eyebrow ? <span>{getPdfSafeText(eyebrow, '')}</span> : null}
        <h3>{getPdfSafeText(title, 'Sección')}</h3>
        {subtitle ? <p>{getPdfSafeText(subtitle, '')}</p> : null}
      </div>
    </div>
  );
}

export function PdfMetricCard(props: { icon?: LucideIcon; label: string; value: ReactNode; note?: string; tone?: ReportTone }) {
  return <ReportKpiCard {...props} />;
}

export function PdfChartBlock({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="pdf-chart-block">
      <div className="pdf-chart-block-head">
        <strong>{getPdfSafeText(title, 'Gráfico')}</strong>
        {subtitle ? <span>{getPdfSafeText(subtitle, '')}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function PdfEvolutionChart({ title, points, suffix = '', decimals = 0 }: { title: string; points: PdfChartPoint[]; suffix?: string; decimals?: number }) {
  const clean = points.filter((point) => Number.isFinite(point.value));
  if (clean.length < 2) return null;
  const values = clean.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const width = 320;
  const height = 120;
  const x = (index: number) => 22 + (index / Math.max(1, clean.length - 1)) * (width - 44);
  const y = (value: number) => 92 - ((value - min) / span) * 62;
  const d = clean.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ');
  const lastPoint = clean[clean.length - 1];
  const firstPoint = clean[0];
  const delta = lastPoint.value - firstPoint.value;
  const formattedLast = `${lastPoint.value.toFixed(decimals)}${suffix}`;
  const formattedDelta = `${delta >= 0 ? '+' : ''}${delta.toFixed(decimals)}${suffix}`;
  return (
    <PdfChartBlock title={title} subtitle={`${clean[0].label} - ${lastPoint.label}`}>
      <div className="pdf-evolution-chart">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          <line x1="22" y1="92" x2="298" y2="92" className="axis" />
          <line x1="22" y1="30" x2="22" y2="92" className="axis" />
          <path d={d} className="line" />
          {clean.map((point, index) => <circle key={`${title}-${point.label}-${index}`} cx={x(index)} cy={y(point.value)} r="3.5" className="dot" />)}
          <text x="22" y="111" className="tick">{clean[0].label}</text>
          <text x="298" y="111" textAnchor="end" className="tick">{lastPoint.label}</text>
        </svg>
        <div className="pdf-evolution-meta">
          <span>Actual</span><strong>{formattedLast}</strong><small>Δ {formattedDelta}</small>
        </div>
      </div>
    </PdfChartBlock>
  );
}

export function PdfPlayerSummary({ name, meta, status, children }: { name: string; meta?: string; status?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pdf-player-summary-card">
      <div><span>Jugador</span><strong>{getPdfSafeText(name, 'Jugador')}</strong>{meta ? <small>{getPdfSafeText(meta, '')}</small> : null}</div>
      {status ? <div className="pdf-player-summary-status">{status}</div> : null}
      {children}
    </div>
  );
}

export function PdfCompetitionGpsTable({ rows }: { rows: Array<{ name: string; minutes?: number; totalDistance?: number; playerLoad?: number; hsr?: number; sprint?: number; acc?: number; dcc?: number; rhie?: number }> }) {
  if (!rows.length) return <ReportEmptyState text="Sin datos GPS." />;
  return (
    <div className="fd-table-wrap">
      <table className="pdf-report-table compact pdf-gps-table">
        <thead><tr><th>Jugador</th><th>MIN</th><th>Dist.</th><th>PL</th><th>HSR</th><th>Sprint</th><th>ACC</th><th>DCC</th><th>RHIE</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{reportDash(row.minutes)}</td><td>{reportDash(row.totalDistance)}</td><td>{reportDash(row.playerLoad)}</td><td>{reportDash(row.hsr)}</td><td>{reportDash(row.sprint)}</td><td>{reportDash(row.acc)}</td><td>{reportDash(row.dcc)}</td><td>{reportDash(row.rhie)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
