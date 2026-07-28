import type { ReactNode } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import type { CompetitionReportTone } from '@/lib/competition-report';

type IconComponent = typeof Activity;

export const C = {
  blue: '#1557d6',
  blueDark: '#173b85',
  red: '#c1121f',
  green: '#059669',
  amber: '#d97706',
  ink: '#06152f',
  gray: '#64748b',
};

const toneClass = (tone: CompetitionReportTone = 'neutral') => `pdf-report-tone-${tone}`;
const numberFmt = (value: number, digits = 0) => Number.isFinite(value) ? value.toLocaleString('es-CO', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '0';
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const pct = (value: number, max: number) => max > 0 ? clamp(Math.round((value / max) * 100)) : 0;
const truncateName = (name: string) => {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[1]?.[0] ?? ''}. ${parts[2] ?? ''}`.trim();
};
const statNumber = (value: string | number | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const raw = String(value).replace('%', '').trim();
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, '')
      : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
const valueText = (value: string | number | undefined, digits = 0) => {
  if (typeof value === 'number') return numberFmt(value);
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
};

export type ChartItem = { name: string; value: number; sub?: string; context?: string; acc?: number; dcc?: number; sprints?: number; rhie?: number };

export function IconBadge({ icon: Icon, tone = 'blue' }: { icon: IconComponent; tone?: CompetitionReportTone }) {
  return <span className={`pdf-report-icon ${toneClass(tone)}`}><Icon size={15} strokeWidth={2.4} /></span>;
}

export function ReportBadge({ text, tone = 'neutral' }: { text: string; tone?: CompetitionReportTone }) {
  return <span className={`pdf-report-badge ${toneClass(tone)}`}>{text}</span>;
}

export function ReportSection({ icon, eyebrow, title, subtitle, children, className = '' }: { icon: IconComponent; eyebrow?: string; title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`pdf-report-section fd-report-page ${className}`}>
      <div className="pdf-report-section-heading fd-section-heading">
        <IconBadge icon={icon} tone="blue" />
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function EmptyReportState({ text }: { text: string }) {
  return <div className="pdf-report-empty"><AlertTriangle size={14} /> <span>{text}</span></div>;
}

export function PlayerBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: CompetitionReportTone }) {
  return <span className={`pdf-report-small-badge ${toneClass(tone)}`}>{children}</span>;
}

export function ReportKpi({ icon, label, value, note, tone = 'blue' }: { icon: IconComponent; label: string; value: string | number; note?: string; tone?: CompetitionReportTone }) {
  return (
    <div className="pdf-report-kpi competition-report-kpi-clean fd-kpi">
      <IconBadge icon={icon} tone={tone} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note ? <small>{note}</small> : null}
      </div>
    </div>
  );
}

export function HorizontalBar({ item, maxValue, color, formatter, rank }: { item: ChartItem; maxValue: number; color: string; formatter?: (value: number) => string; rank?: number }) {
  const width = Math.max(3, pct(item.value, maxValue));
  const rankColor = rank === 0 ? C.ink : rank !== undefined && rank < 5 ? C.blue : '#93c5fd';
  const barColor = color || rankColor;
  return (
    <div className="competition-chart-row fd-v2-rank-row">
      <div className="competition-chart-player">
        <strong>{truncateName(item.name)} {rank === 0 ? <em>TOP</em> : null}</strong>
        {item.sub ? <span>{item.sub}</span> : null}
      </div>
      <div className="competition-chart-track"><span style={{ width: `${width}%`, background: barColor }} /></div>
      <strong className="competition-chart-value">{formatter ? formatter(item.value) : numberFmt(item.value)}</strong>
    </div>
  );
}

export function BarPanel({ title, subtitle, items, color, formatter }: { title: string; subtitle?: string; items: ChartItem[]; color: string; formatter?: (value: number) => string }) {
  if (!items.length) return <EmptyReportState text="Sin datos suficientes para graficar." />;
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="competition-chart-panel fd-v2-ranking-panel">
      <div className="competition-chart-heading">
        <span style={{ background: color }} />
        <div><strong>{title}</strong>{subtitle ? <small>{subtitle}</small> : null}</div>
      </div>
      <div className="competition-chart-list">
        {items.map((item, index) => <HorizontalBar key={`${title}-${item.name}`} item={item} maxValue={maxValue} color={index === 0 ? C.ink : index < 5 ? color : '#93c5fd'} formatter={formatter} rank={index} />)}
      </div>
    </div>
  );
}

export function NeuroRankPanel({ items }: { items: ChartItem[] }) {
  if (!items.length) return <EmptyReportState text="Sin datos neuromusculares." />;
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="competition-chart-panel fd-v2-ranking-panel">
      <div className="competition-chart-heading"><span style={{ background: C.red }} /><div><strong>Neuromuscular</strong><small>ACC + DCC + Sprint Eff. + RHIE</small></div></div>
      <div className="competition-chart-list">
        {items.map((item, index) => {
          const acc = item.acc ?? 0;
          const dcc = item.dcc ?? 0;
          const sprints = item.sprints ?? 0;
          const rhie = item.rhie ?? 0;
          const total = Math.max(acc + dcc + sprints + rhie, 1);
          return (
            <div className="competition-chart-row fd-v2-neuro-row" key={`neuro-${item.name}`}>
              <div className="competition-chart-player"><strong>{truncateName(item.name)} {index === 0 ? <em>TOP</em> : null}</strong><span>{item.sub}</span></div>
              <div className="fd-v2-neuro-track" style={{ width: `${Math.max(8, pct(item.value, maxValue))}%` }}>
                <i style={{ width: `${pct(acc, total)}%` }} />
                <b style={{ width: `${pct(dcc, total)}%` }} />
                <em style={{ width: `${pct(sprints, total)}%` }} />
                <u style={{ width: `${pct(rhie, total)}%` }} />
              </div>
              <strong className="competition-chart-value">{numberFmt(item.value)}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DonutComparison({ title, orso, rival, unit = '' }: { title: string; orso: string | number; rival: string | number; unit?: string }) {
  const o = statNumber(orso);
  const r = statNumber(rival);
  const total = Math.max(o + r, 1);
  const oPct = clamp((o / total) * 100);
  const background = `conic-gradient(${C.blue} 0 ${oPct}%, #ef4444 ${oPct}% 100%)`;
  return (
    <div className="fd-donut-card">
      <div className="fd-donut" style={{ background }}><span>{valueText(orso)}{unit}</span></div>
      <div>
        <strong>{title}</strong>
        <p><b>Orsomarso</b> {valueText(orso)}{unit} · <b>Rival</b> {valueText(rival)}{unit}</p>
      </div>
    </div>
  );
}

export function MiniLineChart({ title, first, second, firstRival, secondRival, icon: Icon = Activity }: { title: string; first: string | number; second: string | number; firstRival: string | number; secondRival: string | number; icon?: IconComponent }) {
  const oFirst = statNumber(first);
  const oSecond = statNumber(second);
  const rFirst = statNumber(firstRival);
  const rSecond = statNumber(secondRival);
  const values = [oFirst, oSecond, rFirst, rSecond];
  const max = Math.max(...values, 1);
  const steps = [0, Math.round(max / 2), Math.round(max)];
  const y = (value: number) => 82 - pct(value, max) * 0.64;
  const o1 = y(oFirst);
  const o2 = y(oSecond);
  const r1 = y(rFirst);
  const r2 = y(rSecond);
  const trend = oSecond > oFirst ? '↑' : oSecond < oFirst ? '↓' : '→';
  const trendClass = oSecond > oFirst ? 'up' : oSecond < oFirst ? 'down' : 'flat';
  const chartId = `area-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="fd-line-card fd-v2-line-card">
      <div className="fd-v2-line-title"><Icon size={16} /><strong>{title}</strong><span className={trendClass}>{trend}</span></div>
      <svg className="fd-v2-half-chart" viewBox="0 0 210 120" role="img" aria-label={title}>
        <defs>
          <linearGradient id={`${chartId}-orso`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.blue} stopOpacity="0.3" />
            <stop offset="100%" stopColor={C.blue} stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id={`${chartId}-rival`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {steps.map((step, i) => (
          <g key={i}>
            <line x1="40" y1={y(step)} x2="190" y2={y(step)} stroke="#e2e8f0" strokeWidth="1" />
            <text x="35" y={y(step) + 3} fontSize="9" fill="#94a3b8" textAnchor="end">{step}</text>
          </g>
        ))}
        <path d={`M 60 ${o1} L 125 ${o2} L 125 82 L 60 82 Z`} fill={`url(#${chartId}-orso)`} />
        <path d={`M 60 ${r1} L 125 ${r2} L 125 82 L 60 82 Z`} fill={`url(#${chartId}-rival)`} />
        <polyline points={`60,${o1} 125,${o2}`} fill="none" stroke={C.blue} strokeWidth="2.5" />
        <polyline points={`60,${r1} 125,${r2}`} fill="none" stroke="#ef4444" strokeWidth="2.5" />
        <circle cx="60" cy={o1} r="3" fill={C.blue} />
        <circle cx="125" cy={o2} r="3" fill={C.blue} />
        <circle cx="60" cy={r1} r="3" fill="#ef4444" />
        <circle cx="125" cy={r2} r="3" fill="#ef4444" />
        <text x="60" y="95" fontSize="8" fill="#64748b" textAnchor="middle">1T</text>
        <text x="125" y="95" fontSize="8" fill="#64748b" textAnchor="middle">2T</text>
      </svg>
      <div className="fd-v2-line-legend">
        <span><b>Orsomarso</b> {valueText(first)} → {valueText(second)}</span>
        <span><b>Rival</b> {valueText(firstRival)} → {valueText(secondRival)}</span>
      </div>
    </div>
  );
}
