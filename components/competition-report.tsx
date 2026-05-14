import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bus,
  CalendarDays,
  ChevronsDown,
  ChevronsUp,
  ClipboardList,
  Flag,
  Gauge,
  HeartPulse,
  Home,
  Medal,
  PieChart,
  Ruler,
  Repeat2,
  Shield,
  ShieldCheck,
  Target,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import { fieldLabel } from '@/lib/report-utils';
import { CompetitionReportData, CompetitionReportPlayerRow, CompetitionReportTone } from '@/lib/competition-report';
import { ClubCategory } from '@/lib/types';
import type { EyeballMatchStats } from './eyeball-importer';

type Props = {
  report: CompetitionReportData;
  category: ClubCategory;
  className?: string;
  compact?: boolean;
  eyeballStats?: EyeballMatchStats | null;
  eyeballFirstHalfStats?: EyeballMatchStats | null;
  eyeballSecondHalfStats?: EyeballMatchStats | null;
};

type IconComponent = typeof Users;
type ChartItem = { name: string; value: number; sub?: string; context?: string; acc?: number; dcc?: number; rhie?: number };
type EyeballRow = { stat: string; rival: string | number; orso: string | number; unit?: '%' | ''; rawStat?: string; index?: number };

const C = {
  blue: '#1557d6',
  blueDark: '#173b85',
  red: '#c1121f',
  green: '#059669',
  amber: '#d97706',
  ink: '#06152f',
  gray: '#64748b',
};

const toneForResult = (result: string): CompetitionReportTone => {
  if (result === 'Victoria') return 'green';
  if (result === 'Derrota') return 'red';
  if (result === 'Empate') return 'blue';
  return 'neutral';
};

const formatDate = (date: string) => date || 'Sin fecha';
const numberFmt = (value: number, digits = 0) => Number.isFinite(value) ? value.toLocaleString('es-CO', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '0';
const toneClass = (tone: CompetitionReportTone = 'neutral') => `pdf-report-tone-${tone}`;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const pct = (value: number, max: number) => max > 0 ? clamp(Math.round((value / max) * 100)) : 0;
const normalizeText = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9% ]/g, ' ').replace(/\s+/g, ' ').trim();
const truncateName = (name: string) => {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[1]?.[0] ?? ''}. ${parts[2] ?? ''}`.trim();
};

const playerInitials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'OR';
const playerLastName = (name: string) => name.split(' ').filter(Boolean).slice(-1)[0]?.toUpperCase() ?? name.toUpperCase();
const valueOrDash = (value: number, digits = 0, suffix = '') => value > 0 ? `${numberFmt(value, digits)}${suffix}` : '—';

/* Fix #3 — Semáforo de portada con lógica correcta */
const getControlColor = (possession: number, passPrecision: number): CompetitionReportTone => {
  if (possession >= 55 && passPrecision >= 72) return 'green';
  if (possession >= 48 && passPrecision >= 65) return 'amber';
  return 'red';
};
const getOffensiveColor = (conversion: number, shots: number): CompetitionReportTone => {
  if (conversion >= 25 && shots >= 8) return 'green';
  if (conversion >= 15) return 'amber';
  return 'red';
};
const getDefensiveColor = (errors: number, goalsConceded: number): CompetitionReportTone => {
  if (errors <= 5 && goalsConceded === 0) return 'green';
  if (errors <= 10) return 'amber';
  return 'red';
};

/* Fix #5 — Umbral mínimo antes de marcar ventaja/desventaja */
const isAdvantage = (orso: number, rival: number, isPercentage = false) => {
  const diff = Math.abs(orso - rival);
  const threshold = isPercentage ? 3 : Math.max(2, Math.abs(rival) * 0.08);
  return orso > rival && diff >= threshold;
};
const hasMeaningfulGap = (orso: number, rival: number, isPercentage = false) => isAdvantage(orso, rival, isPercentage) || isAdvantage(rival, orso, isPercentage);
const isPercentageStat = (label: string) => /%|posesi|precision|precisi|conversion|tasa|efectividad|dominio/i.test(label);

/* Fix #6 — Errores con acento crítico */
const errorToneClass = (value: number) => value > 10 ? 'fd-v2-error-high' : value > 6 ? 'fd-v2-error-medium' : '';
const rowHasGps = (row: CompetitionReportPlayerRow) => row.totalDistance > 0 || row.playerLoad > 0 || row.highSpeedDistance > 0 || row.sprintDistance > 0 || row.acc > 0 || row.dcc > 0 || row.rhie > 0 || row.maxVelocity > 0 || row.metersPerMinute > 0;
const gpsTypeTone = (type: string) => {
  const key = normalizeText(type);
  if (key.includes('partido') || key === 'md') return 'green';
  if (key.includes('md 3')) return 'blue';
  if (key.includes('cdef')) return 'neutral';
  if (key.includes('deci')) return 'amber';
  return 'neutral';
};
const metricCellClass = (value: number, values: number[]) => {
  if (!value) return 'fd-v2-muted-cell';
  const clean = values.filter((item) => item > 0);
  if (!clean.length) return '';
  const max = Math.max(...clean);
  const avg = clean.reduce((acc, item) => acc + item, 0) / clean.length;
  if (value >= max * 0.95) return 'fd-v2-heat-high';
  if (value >= avg * 0.85) return 'fd-v2-heat-mid';
  return 'fd-v2-heat-low';
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
  if (typeof value === 'number') return numberFmt(value, digits);
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
};

const allEyeballRows = (stats?: EyeballMatchStats | null): Array<EyeballRow & { section: string }> => {
  if (!stats) return [];
  return Object.entries(stats.sections).flatMap(([section, rows]) => rows.map((row) => ({ ...row, section })));
};

const sectionRows = (stats: EyeballMatchStats | null | undefined, sectionName: string): Array<EyeballRow & { section: string }> => {
  if (!stats) return [];
  const normalizedTarget = normalizeText(sectionName);
  const entry = Object.entries(stats.sections).find(([section]) => normalizeText(section) === normalizedTarget);
  return entry ? entry[1].map((row) => ({ ...row, section: entry[0] })) : [];
};

const getSectionStat = (stats: EyeballMatchStats | null | undefined, sectionName: string, names: string[]) => {
  const normalized = names.map(normalizeText);
  return sectionRows(stats, sectionName).find((row) => {
    const name = normalizeText(row.stat);
    return normalized.some((needle) => name === needle || name.includes(needle));
  }) ?? null;
};

const combineRows = (...sets: Array<Array<EyeballRow & { section: string }>>) => {
  const unique = new Map<string, EyeballRow & { section: string }>();
  sets.flat().forEach((row) => unique.set(`${row.section}-${row.stat}-${row.index ?? ''}`, row));
  return Array.from(unique.values());
};

const compareText = (row: EyeballRow) => {
  const o = statNumber(row.orso);
  const r = statNumber(row.rival);
  const lowerBetter = isLowerBetter(row.stat);
  if (o === r) return 'Equilibrado';
  return lowerBetter ? (o < r ? 'Ventaja Orsomarso' : 'Ventaja rival') : (o > r ? 'Ventaja Orsomarso' : 'Ventaja rival');
};

const findEyeballStat = (stats: EyeballMatchStats | null | undefined, names: string[], preferredSections: string[] = []) => {
  if (!stats) return null;
  const normalized = names.map(normalizeText);
  const rows = preferredSections.length ? combineRows(...preferredSections.map((section) => sectionRows(stats, section))) : allEyeballRows(stats);
  const exact = rows.find((row) => normalized.some((needle) => normalizeText(row.stat) === needle));
  if (exact) return exact;
  return rows.find((row) => normalized.some((needle) => normalizeText(row.stat).includes(needle))) ?? null;
};

const pickEyeballRows = (stats: EyeballMatchStats | null | undefined, patterns: string[], limit = 12) => {
  if (!stats) return [];
  const normalized = patterns.map(normalizeText);
  const rows = allEyeballRows(stats).filter((row) => {
    const key = `${normalizeText(row.section)} ${normalizeText(row.stat)}`;
    return normalized.some((needle) => key.includes(needle));
  });
  const unique = new Map<string, EyeballRow & { section: string }>();
  rows.forEach((row) => unique.set(`${row.section}-${row.stat}`, row));
  return Array.from(unique.values()).slice(0, limit);
};

const isLowerBetter = (label: string) => /faltas|errores|errados|perdidos|perdidas|rojas|amarillas|fuera de juego|goles recibidos|concedidos/i.test(label);

function IconBadge({ icon: Icon, tone = 'blue' }: { icon: IconComponent; tone?: CompetitionReportTone }) {
  return <span className={`pdf-report-icon ${toneClass(tone)}`}><Icon size={15} strokeWidth={2.4} /></span>;
}

function ReportBadge({ text, tone = 'neutral' }: { text: string; tone?: CompetitionReportTone }) {
  return <span className={`pdf-report-badge ${toneClass(tone)}`}>{text}</span>;
}

function ReportSection({ icon, eyebrow, title, subtitle, children, className = '' }: { icon: IconComponent; eyebrow?: string; title: string; subtitle?: string; children: ReactNode; className?: string }) {
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

function EmptyReportState({ text }: { text: string }) {
  return <div className="pdf-report-empty"><AlertTriangle size={14} /> <span>{text}</span></div>;
}

function PlayerBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: CompetitionReportTone }) {
  return <span className={`pdf-report-small-badge ${toneClass(tone)}`}>{children}</span>;
}

function ReportKpi({ icon, label, value, note, tone = 'blue' }: { icon: IconComponent; label: string; value: string | number; note?: string; tone?: CompetitionReportTone }) {
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

function HorizontalBar({ item, maxValue, color, formatter, rank }: { item: ChartItem; maxValue: number; color: string; formatter?: (value: number) => string; rank?: number }) {
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

function BarPanel({ title, subtitle, items, color, formatter }: { title: string; subtitle?: string; items: ChartItem[]; color: string; formatter?: (value: number) => string }) {
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

function NeuroRankPanel({ items }: { items: ChartItem[] }) {
  if (!items.length) return <EmptyReportState text="Sin datos neuromusculares." />;
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="competition-chart-panel fd-v2-ranking-panel">
      <div className="competition-chart-heading"><span style={{ background: C.red }} /><div><strong>Neuromuscular</strong><small>ACC + DCC + RHIE</small></div></div>
      <div className="competition-chart-list">
        {items.map((item, index) => {
          const acc = item.acc ?? 0;
          const dcc = item.dcc ?? 0;
          const rhie = item.rhie ?? 0;
          const total = Math.max(acc + dcc + rhie, 1);
          return (
            <div className="competition-chart-row fd-v2-neuro-row" key={`neuro-${item.name}`}>
              <div className="competition-chart-player"><strong>{truncateName(item.name)} {index === 0 ? <em>TOP</em> : null}</strong><span>{item.sub}</span></div>
              <div className="fd-v2-neuro-track" style={{ width: `${Math.max(8, pct(item.value, maxValue))}%` }}>
                <i style={{ width: `${pct(acc, total)}%` }} />
                <b style={{ width: `${pct(dcc, total)}%` }} />
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

function DonutComparison({ title, orso, rival, unit = '' }: { title: string; orso: string | number; rival: string | number; unit?: string }) {
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

function MiniLineChart({ title, first, second, firstRival, secondRival, icon: Icon = Activity }: { title: string; first: string | number; second: string | number; firstRival: string | number; secondRival: string | number; icon?: IconComponent }) {
  /* Fix #5 — Gráficos 1T vs 2T legibles */
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
  const chartId = `area-${normalizeText(title).replace(/\s+/g, '-')}`;
  return (
    <div className="fd-line-card fd-v2-line-card">
      <div className="fd-v2-line-title"><Icon size={16} /><strong>{title}</strong><span className={trendClass}>{trend}</span></div>
      <svg viewBox="0 0 210 120" role="img" aria-label={title}>
        <defs><linearGradient id={chartId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1557d6" stopOpacity="0.16" /><stop offset="100%" stopColor="#1557d6" stopOpacity="0.02" /></linearGradient></defs>
        {[18, 50, 82].map((gy, index) => <line key={`grid-${title}-${index}`} x1="34" y1={gy} x2="194" y2={gy} className="grid" />)}
        {steps.map((step, index) => <text key={`axis-${title}-${index}`} x="5" y={84 - index * 32}>{step}</text>)}
        <path d={`M42 ${o1} L186 ${o2} L186 86 L42 86 Z`} className="area" fill={`url(#${chartId})`} />
        <path d={`M42 ${o1} L186 ${o2}`} className="orso" />
        <path d={`M42 ${r1} L186 ${r2}`} className="rival" />
        <circle cx="42" cy={o1} r="4" className="orso-dot" /><circle cx="186" cy={o2} r="5" className="orso-dot last" />
        <circle cx="42" cy={r1} r="3.5" className="rival-dot" /><circle cx="186" cy={r2} r="3.5" className="rival-dot" />
        <text x="42" y={Math.max(12, o1 - 8)} className="value" textAnchor="middle">{valueText(first)}</text>
        <text x="186" y={Math.max(12, o2 - 10)} className="value" textAnchor="middle">{valueText(second)}</text>
        <text x="42" y={Math.max(12, r1 - 8)} className="rvalue" textAnchor="middle">{valueText(firstRival)}</text>
        <text x="186" y={Math.max(12, r2 - 8)} className="rvalue" textAnchor="middle">{valueText(secondRival)}</text>
        <text x="40" y="109" className="date" transform="rotate(30 40 109)">1T</text><text x="182" y="109" className="date" transform="rotate(30 182 109)">2T</text>
      </svg>
      <div className="fd-v2-line-foot"><span>Orsomarso</span><b>{valueText(second)}</b><small>Rival {valueText(secondRival)}</small></div>
    </div>
  );
}

function RadarPanel({ title, rows }: { title: string; rows: Array<{ label: string; orso: string | number; rival: string | number }> }) {
  const clean = rows.slice(0, 5).filter((row) => statNumber(row.orso) > 0 || statNumber(row.rival) > 0);
  if (clean.length < 3) return null;
  const points = clean.map((row, index) => {
    const angle = (-90 + (360 / clean.length) * index) * (Math.PI / 180);
    const max = Math.max(statNumber(row.orso), statNumber(row.rival), 1);
    const radius = 11 + (statNumber(row.orso) / max) * 33;
    return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`;
  }).join(' ');
  return (
    <div className="fd-radar-card">
      <strong>{title}</strong>
      <svg viewBox="0 0 100 100" aria-label={title}>
        <polygon points="50,12 86,38 72,82 28,82 14,38" className="grid" />
        <polygon points={points} className="shape" />
        {clean.map((row, index) => {
          const angle = (-90 + (360 / clean.length) * index) * (Math.PI / 180);
          return <text key={row.label} x={50 + Math.cos(angle) * 44} y={52 + Math.sin(angle) * 44}>{row.label.slice(0, 10)}</text>;
        })}
      </svg>
    </div>
  );
}

function PitchZonePanel({ title, zones }: { title: string; zones: Array<{ label: string; value: string | number }> }) {
  const clean = zones.filter((zone) => statNumber(zone.value) > 0).slice(0, 3);
  if (!clean.length) return null;
  const max = Math.max(...clean.map((zone) => statNumber(zone.value)), 1);
  return (
    <div className="fd-zone-pitch-card">
      <strong>{title}</strong>
      <div className="fd-zone-pitch">
        {clean.map((zone, index) => <div key={zone.label} style={{ opacity: 0.35 + (statNumber(zone.value) / max) * 0.55 }}><span>{zone.label}</span><b>{valueText(zone.value)}</b></div>)}
      </div>
    </div>
  );
}

function ComparisonStat({ label, orso, rival, lowerBetter = false }: { label: string; orso: string | number; rival: string | number; lowerBetter?: boolean }) {
  const o = statNumber(orso);
  const r = statNumber(rival);
  const total = Math.max(o + r, 1);
  const oWidth = pct(o, total);
  const percentage = isPercentageStat(label);
  const meaningful = hasMeaningfulGap(o, r, percentage);
  const orsoWins = meaningful && (lowerBetter ? o < r : o > r);
  const rivalWins = meaningful && (lowerBetter ? r < o : r > o);
  return (
    <div className="eyeball-comparison-row fd-comparison-row">
      <strong className={rivalWins ? 'winner rival' : ''}>{valueText(rival, Number.isInteger(r) ? 0 : 1)}</strong>
      <div>
        <span>{label}</span>
        <div className="eyeball-comparison-track"><i style={{ width: `${100 - oWidth}%` }} className={rivalWins ? 'active-rival' : ''} /><b style={{ width: `${oWidth}%` }} className={orsoWins ? 'active-orso' : ''} /></div>
      </div>
      <strong className={orsoWins ? 'winner' : ''}>{valueText(orso, Number.isInteger(o) ? 0 : 1)}</strong>
    </div>
  );
}

function EyeballComparisonTable({ rows, title }: { rows: EyeballRow[]; title?: string }) {
  if (!rows.length) return <EmptyReportState text="Sin datos Eyeball para esta sección." />;
  return (
    <div className="fd-table-wrap">
      {title ? <h4>{title}</h4> : null}
      <table className="pdf-report-table fd-eyeball-table">
        <thead><tr><th>Estadística</th><th>Rival</th><th>Orsomarso</th></tr></thead>
        <tbody>
          {rows.map((row) => {
            /* Fix #2 — Errores con contexto visual */
            const isErrorRow = normalizeText(row.stat).includes('errores');
            const errorValue = statNumber(row.orso);
            const errorClass = isErrorRow ? errorToneClass(errorValue) : '';
            const o = statNumber(row.orso);
            const r = statNumber(row.rival);
            const lowerBetter = isLowerBetter(row.stat);
            const percentage = isPercentageStat(row.stat);
            const meaningful = hasMeaningfulGap(o, r, percentage);
            const orsoWins = meaningful && (lowerBetter ? o < r : o > r);
            const rivalWins = meaningful && (lowerBetter ? r < o : r > o);
            return (
              <tr key={`${row.stat}-${row.rival}-${row.orso}`}>
                <td><strong>{row.stat}</strong></td>
                <td className={rivalWins ? 'fd-v2-rival-win' : ''}>{rivalWins ? '▲ ' : orsoWins ? '▼ ' : ''}{valueText(row.rival)}</td>
                <td className={`${errorClass} ${orsoWins ? 'fd-v2-orso-win' : ''}`.trim()}>{orsoWins ? '▲ ' : rivalWins ? '▼ ' : ''}{valueText(row.orso)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayerTable({ rows }: { rows: CompetitionReportPlayerRow[] }) {
  if (!rows.length) return <EmptyReportState text="Sin planilla." />;
  const sorted = rows.slice().sort((a, b) => {
    const roleOrder = (role: string) => (role === 'Titular' ? 0 : role === 'Suplente' ? 1 : 2);
    return roleOrder(a.role) - roleOrder(b.role) || (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.name.localeCompare(b.name);
  });
  return (
    <div className="fd-table-wrap">
      <table className="pdf-report-table competition-report-table-modern official-lineup-table">
        <thead>
          <tr>
            <th>N°</th><th>Jugador</th><th>Posición</th><th>Convocatoria</th><th>Minutos</th><th>Goles</th><th>Asistencias</th><th>T. Amarillas</th><th>T. Rojas</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={row.id} className={row.role === 'Suplente' ? 'official-substitute-row' : 'official-starter-row'}>
              <td>{row.jerseyNumber ?? index + 1}</td>
              <td><strong>{row.name}</strong></td>
              <td>{row.position}</td>
              <td>{row.role}</td>
              <td>{row.minutes || '-'}</td>
              <td>{row.isGoalkeeper ? '-' : row.goals || 0}</td>
              <td>{row.isGoalkeeper ? '-' : row.assists || 0}</td>
              <td className={row.yellowCards > 0 ? 'card-yellow' : undefined}>{row.yellowCards || 0}</td>
              <td className={row.redCards > 0 ? 'card-red' : undefined}>{row.redCards || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RivalCrest({ match, className = '' }: { match: CompetitionReportData['match']; className?: string }) {
  return match.opponentLogo ? <img className={className} src={match.opponentLogo} alt={match.opponent} /> : <span className={`fd-rival-crest ${className}`}>{match.opponent.slice(0, 2).toUpperCase()}</span>;
}

function performanceChipData(stats?: EyeballMatchStats | null) {
  const shots = statNumber(getSectionStat(stats, 'Ofensivo', ['Disparos en total'])?.orso ?? 0);
  const conversion = statNumber(getSectionStat(stats, 'Ofensivo', ['Tasa de conversión de tiros'])?.orso ?? stats?.conversionRate ?? 0);
  const errors = statNumber(findEyeballStat(stats, ['Errores'], ['Defensivo', 'Resumen'])?.orso ?? 0);
  const goalsAgainst = statNumber(stats?.goalsAgainst ?? 0);
  const possession = statNumber(getSectionStat(stats, 'Resumen', ['Posesión', 'Posesiones'])?.orso ?? stats?.possession ?? 0);
  const passPrecision = statNumber(getSectionStat(stats, 'Distribución', ['Precisión de pases'])?.orso ?? stats?.passPrecision ?? 0);
  const offensiveTone = getOffensiveColor(conversion, shots);
  const defensiveTone = getDefensiveColor(errors, goalsAgainst);
  const controlTone = getControlColor(possession, passPrecision);
  return [
    { icon: Target, label: 'Ofensiva', tone: offensiveTone, value: `${numberFmt(conversion, 1)}% conv. · ${shots} rem.` },
    { icon: ShieldCheck, label: 'Defensiva', tone: defensiveTone, value: `${errors} errores · ${goalsAgainst} GC` },
    { icon: BarChart3, label: 'Control', tone: controlTone, value: `${numberFmt(possession, 1)}% pos. · ${numberFmt(passPrecision, 1)}% pase` },
  ];
}

function PerformanceTrafficChips({ stats }: { stats?: EyeballMatchStats | null }) {
  /* Fix #6 — Semáforo de rendimiento en portada */
  return (
    <div className="fd-v2-traffic-chips">
      {performanceChipData(stats).map(({ icon: Icon, label, tone, value }) => (
        <div key={label} className={`fd-v2-traffic-chip fd-v2-traffic-${tone}`}>
          <Icon size={17} /><strong>{label}</strong><span>{value}</span>
        </div>
      ))}
    </div>
  );
}

function CompetitionPerformanceCover({ report, category, eyeballStats }: { report: CompetitionReportData; category: ClubCategory; eyeballStats?: EyeballMatchStats | null }) {
  const match = report.match;
  const resultTone = toneForResult(report.resultType);
  return (
    <section className="fd-cover pdf-report-cover orso-match-cover competition-cover">
      <div className="fd-cover-logo"><span>Orsomarso SC</span><strong>Departamento de Rendimiento</strong></div>
      <div className="fd-cover-main">
        <span>Informe estadístico de competencia</span>
        <h1>{categoryLabel(category)}</h1>
        <p>{match.competitionName || 'Competencia'} · {formatDate(match.date)} · {match.venue ?? 'Local'}</p>
      </div>
      <div className="fd-cover-match">
        <div><img src="/orsomarso-crest.jpg" alt="Orsomarso SC" /><strong>Orsomarso SC</strong></div>
        <b>VS</b>
        <div><RivalCrest match={match} className="fd-rival-crest" /><strong>{match.opponent}</strong></div>
      </div>
      <div className="fd-cover-score"><strong>{report.score}</strong><ReportBadge text={report.resultType} tone={resultTone} /></div>
      <PerformanceTrafficChips stats={eyeballStats} />
      <div className="fd-cover-meta">
        <span>{match.venue ?? 'Local'}</span>
        <span>{categoryLabel(category)}</span>
        <span>{match.competitionName || 'Competencia'}</span>
      </div>
    </section>
  );
}

const positionGroup = (position: string) => {
  const key = normalizeText(position);
  if (/por|arquero|portero/.test(key)) return 'Arquero';
  if (/def|central|lateral|dfc|ld|li/.test(key)) return 'Defensa';
  if (/vol|medio|mcd|mco|mc|mediocampista/.test(key)) return 'Mediocampo';
  if (/ext|del|dc|ed|ei|atac/.test(key)) return 'Ataque';
  return 'Otros';
};

/* Fix #1 — Portero incorrecto en campo */
const isEligibleFieldStarter = (row: CompetitionReportPlayerRow) => {
  if (row.role !== 'Titular') return false;
  if (row.isGoalkeeper || positionGroup(row.position) === 'Arquero') return row.minutes > 0;
  return true;
};

type PitchSlot = { id: string; label: string; x: number; y: number; playerId?: string };
const fallbackPitchSlots = (rows: CompetitionReportPlayerRow[]): PitchSlot[] => {
  const starters = rows.filter(isEligibleFieldStarter);
  const goalkeeper = starters.find((row) => (row.isGoalkeeper || positionGroup(row.position) === 'Arquero') && row.minutes > 0);
  const byGroup = (name: string) => starters.filter((row) => positionGroup(row.position) === name && !(name === 'Arquero'));
  return [
    ...byGroup('Ataque').slice(0, 4).map((row, index) => ({ id: `a${index}`, label: row.position, playerId: row.playerId, x: [25, 50, 75, 50][index] ?? 50, y: [24, 16, 24, 32][index] ?? 24 })),
    ...byGroup('Mediocampo').slice(0, 5).map((row, index) => ({ id: `m${index}`, label: row.position, playerId: row.playerId, x: [18, 36, 50, 64, 82][index] ?? 50, y: [50, 55, 47, 55, 50][index] ?? 52 })),
    ...byGroup('Defensa').slice(0, 4).map((row, index) => ({ id: `d${index}`, label: row.position, playerId: row.playerId, x: [18, 39, 61, 82][index] ?? 50, y: [72, 76, 76, 72][index] ?? 74 })),
    ...(goalkeeper ? [{ id: 'gk', label: goalkeeper.position, playerId: goalkeeper.playerId, x: 50, y: 91 }] : []),
  ];
};

/* Fix #14 — Fallback de foto de jugador con iniciales, nunca escudo del club */
function PlayerAvatar({ row, size = 36 }: { row: CompetitionReportPlayerRow; size?: number }) {
  const photoUrl = String(row.photoUrl ?? '').trim();
  const initials = playerInitials(row.name);
  return (
    <span className="fd-v2-avatar-shell" style={{ width: size, height: size }}>
      <span className="fd-v2-avatar-initials" style={{ width: size, height: size, fontSize: size * 0.33 }}>{initials}</span>
      {photoUrl ? <img src={photoUrl} alt={row.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : null}
    </span>
  );
}

function LineupPitch({ report }: { report: CompetitionReportData }) {
  const starters = report.rows.filter(isEligibleFieldStarter);
  const manualSlots = report.match.lineupSlots?.length ? report.match.lineupSlots.filter((slot) => slot.playerId) : [];
  /* Fix #2 — Suplentes fuera del campo */
  const configured = report.match.lineupSlots?.length
    ? manualSlots.filter((slot) => {
        const row = report.rows.find((item) => item.playerId === slot.playerId);
        return row ? isEligibleFieldStarter(row) : false;
      })
    : fallbackPitchSlots(report.rows);
  const byId = (playerId?: string) => report.rows.find((row) => row.playerId === playerId && isEligibleFieldStarter(row));
  return (
    <div className="fd-pitch orso-lineup-pitch fd-v2-pitch">
      <div className="fd-pitch-title">{report.match.lineupFormation || 'Alineación'}</div>
      <div className="fd-v2-grass" />
      <svg className="fd-v2-pitch-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect x="4" y="4" width="92" height="92" rx="3" />
        <line x1="4" y1="50" x2="96" y2="50" />
        <circle cx="50" cy="50" r="10" />
        <rect x="24" y="4" width="52" height="16" />
        <rect x="34" y="4" width="32" height="7" />
        <circle cx="50" cy="16" r="1" />
        <rect x="24" y="80" width="52" height="16" />
        <rect x="34" y="89" width="32" height="7" />
        <circle cx="50" cy="84" r="1" />
      </svg>
      {configured.map((slot) => {
        const row = byId(slot.playerId);
        if (!row) return null;
        return (
          <div key={slot.id} className="orso-pitch-player fd-v2-field-player" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
            <div className="fd-v2-player-photo"><PlayerAvatar row={row} size={36} />{row.yellowCards > 0 ? <i className="yellow" /> : null}{row.redCards > 0 ? <i className="red" /> : null}</div>
            <b>{row.jerseyNumber ?? '—'}</b>
            {/* Fix #13 — Apellido sin puntos suspensivos */}
            <strong>{fieldLabel(row.name).toUpperCase()}</strong>
          </div>
        );
      })}
      {!configured.length && starters.length ? <EmptyReportState text="Sin posiciones de alineación configuradas." /> : null}
    </div>
  );
}

function LineupRosterCards({ rows }: { rows: CompetitionReportPlayerRow[] }) {
  const sorted = rows.slice().sort((a, b) => {
    const roleOrder = (role: string) => (role === 'Titular' ? 0 : role === 'Suplente' ? 1 : 2);
    return roleOrder(a.role) - roleOrder(b.role) || (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.name.localeCompare(b.name);
  });
  return (
    <div className="fd-v2-roster-list">
      {sorted.map((row, index) => {
        const isSubHeader = index > 0 && sorted[index - 1]?.role !== row.role && row.role === 'Suplente';
        const inactiveSub = row.role === 'Suplente' && row.minutes <= 0;
        return (
          <div key={row.id} className={`fd-v2-roster-card ${row.role === 'Suplente' ? 'sub' : 'starter'} ${inactiveSub ? 'inactive-sub' : ''}`}>
            {isSubHeader ? <div className="fd-v2-roster-separator">SUPLENTES</div> : null}
            <PlayerAvatar row={row} size={28} />
            <b>{row.jerseyNumber ?? '—'}</b>
            <strong>{row.name}</strong>
            {inactiveSub ? <div className="fd-v2-min-bar empty" /> : <div className="fd-v2-min-bar"><i style={{ width: `${pct(row.minutes, 93)}%` }} /></div>}
            <span>{row.minutes || 0} min</span>
            <div className="fd-v2-roster-chips">
              {row.yellowCards > 0 ? <em className="yellow">TA {row.yellowCards}</em> : null}
              {row.redCards > 0 ? <em className="red">TR {row.redCards}</em> : null}
              {row.goals > 0 ? <em className="goal">⚽ {row.goals}</em> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LineupSection({ report }: { report: CompetitionReportData }) {
  const positioned = report.match.lineupSlots?.filter((slot) => report.rows.some((row) => row.playerId === slot.playerId && isEligibleFieldStarter(row))).length ?? 0;
  return (
    <ReportSection icon={Users} title="Alineación del partido" subtitle={`${report.match.lineupFormation || 'Formación'} · ${positioned || report.starters.length} jugadores ubicados`} className="competition-lineup-page fd-v2-lineup-page">
      <div className="fd-lineup-grid orso-lineup-grid fd-v2-lineup-layout">
        <LineupPitch report={report} />
        <LineupRosterCards rows={report.rows} />
      </div>
    </ReportSection>
  );
}

function EyeballKpiStrip({ stats }: { stats?: EyeballMatchStats | null }) {
  const possession = getSectionStat(stats, 'Resumen', ['Posesión', 'Posesiones']);
  const passPrecision = getSectionStat(stats, 'Distribución', ['Precisión de pases']);
  const shots = getSectionStat(stats, 'Ofensivo', ['Disparos en total']);
  const shotsOnTarget = getSectionStat(stats, 'Ofensivo', ['Tiros a puerta']);
  const recoveries = getSectionStat(stats, 'Defensivo', ['Recuperaciones']);
  const blocks = getSectionStat(stats, 'Defensivo', ['Bloqueos']);
  const conversion = getSectionStat(stats, 'Ofensivo', ['Tasa de conversión de tiros']);
  const passes = getSectionStat(stats, 'Distribución', ['Pases']);
  const rows = [
    { icon: PieChart, label: 'Posesión', value: possession?.orso ?? (stats ? `${numberFmt(stats.possession)}%` : '-'), note: undefined, tone: 'blue' as CompetitionReportTone },
    { icon: Repeat2, label: 'Precisión pase', value: passPrecision?.orso ?? (stats ? `${numberFmt(stats.passPrecision)}%` : '-'), note: undefined, tone: 'green' as CompetitionReportTone },
    { icon: Target, label: 'Disparos', value: shots?.orso ?? '-', note: shotsOnTarget ? `A puerta ${valueText(shotsOnTarget.orso)}` : undefined, tone: 'amber' as CompetitionReportTone },
    { icon: Trophy, label: 'Conversión', value: conversion?.orso ?? (stats ? `${numberFmt(stats.conversionRate)}%` : '-'), note: undefined, tone: 'green' as CompetitionReportTone },
    { icon: ShieldCheck, label: 'Recuperaciones', value: recoveries?.orso ?? '-', note: undefined, tone: 'dark' as CompetitionReportTone },
    { icon: Flag, label: 'Bloqueos', value: blocks?.orso ?? '-', note: undefined, tone: 'blue' as CompetitionReportTone },
    { icon: ClipboardList, label: 'Pases', value: passes?.orso ?? '-', note: undefined, tone: 'neutral' as CompetitionReportTone },
  ];
  return <div className="pdf-report-kpi-grid competition-kpi-grid competition-kpi-grid-clean fd-stat-kpis">{rows.map((row) => <ReportKpi key={row.label} icon={row.icon} label={row.label} value={valueText(row.value)} note={row.note} tone={row.tone} />)}</div>;
}

function MatchDynamicsSection({ stats }: { stats?: EyeballMatchStats | null }) {
  if (!stats) {
    return <ReportSection icon={BarChart3} title="Dinámica general"><EmptyReportState text="Sin datos Eyeball cargados." /></ReportSection>;
  }
  const possession = getSectionStat(stats, 'Resumen', ['Posesión', 'Posesiones']);
  const passPrecision = getSectionStat(stats, 'Distribución', ['Precisión de pases']);
  const conversion = getSectionStat(stats, 'Ofensivo', ['Tasa de conversión de tiros']);
  const shots = getSectionStat(stats, 'Ofensivo', ['Disparos en total']);
  const recoveries = getSectionStat(stats, 'Defensivo', ['Recuperaciones']);
  const blocks = getSectionStat(stats, 'Defensivo', ['Bloqueos']);
  const passSuccess = getSectionStat(stats, 'Distribución', ['Pases exitosos']);
  const dynamicRows = pickEyeballRows(stats, ['posesion', 'precision', 'pases exitosos', 'pases$', 'remates', 'recuperaciones', 'bloqueos', 'duelos'], 9);
  const radarRows = [
    { label: 'Control', orso: possession?.orso ?? stats.possession, rival: possession?.rival ?? 100 - stats.possession },
    { label: 'Pases', orso: passPrecision?.orso ?? stats.passPrecision, rival: passPrecision?.rival ?? 0 },
    { label: 'Ataque', orso: shots?.orso ?? 0, rival: shots?.rival ?? 0 },
    { label: 'Defensa', orso: recoveries?.orso ?? 0, rival: recoveries?.rival ?? 0 },
    { label: 'Eficiencia', orso: conversion?.orso ?? stats.conversionRate, rival: conversion?.rival ?? 0 },
  ];
  return (
    <ReportSection icon={BarChart3} title="Dinámica general">
      <div className="fd-score-strip fd-score-strip-clean">
        {/* Fix #3 — Orsomarso siempre a la izquierda */}
        <div><span>Orsomarso</span><strong>{stats.goalsFor}</strong></div>
        <b>Marcador</b>
        <div><span>{stats.rivalName}</span><strong>{stats.goalsAgainst}</strong></div>
      </div>
      <PerformanceTrafficChips stats={stats} />
      <EyeballKpiStrip stats={stats} />
      <div className="fd-visual-grid">
        {possession ? <DonutComparison title="Posesión" orso={possession.orso} rival={possession.rival} /> : null}
        {passPrecision ? <DonutComparison title="Precisión de pase" orso={passPrecision.orso} rival={passPrecision.rival} /> : null}
        {conversion ? <DonutComparison title="Conversión" orso={conversion.orso} rival={conversion.rival} /> : null}
        <RadarPanel title="Perfil colectivo" rows={radarRows} />
        <PitchZonePanel title="Dominio por tercios" zones={[
          { label: 'Tercio defensivo', value: findEyeballStat(stats, ['Pases exitosos en el tercer defensivo'])?.orso ?? 0 },
          { label: 'Medio campo', value: findEyeballStat(stats, ['Pases exitosos en el medio campo'])?.orso ?? 0 },
          { label: 'Último tercio', value: findEyeballStat(stats, ['Pases exitosos en el último tercio'])?.orso ?? 0 },
        ]} />
        <PitchZonePanel title="Volumen de acciones" zones={[
          { label: 'Pases', value: passSuccess?.orso ?? 0 },
          { label: 'Remates', value: shots?.orso ?? 0 },
          { label: 'Bloqueos', value: blocks?.orso ?? 0 },
        ]} />
      </div>
      <div className="eyeball-comparison-card fd-main-comparison">
        <div className="eyeball-comparison-head"><span>{stats.rivalName}</span><strong>Indicadores principales</strong><span>Orsomarso</span></div>
        {dynamicRows.map((row) => <ComparisonStat key={`${row.section}-${row.stat}`} label={row.stat} orso={row.orso} rival={row.rival} lowerBetter={isLowerBetter(row.stat)} />)}
      </div>
    </ReportSection>
  );
}


function PeriodComparisonSection({ first, second }: { first?: EyeballMatchStats | null; second?: EyeballMatchStats | null }) {
  if (!first && !second) return null;
  const statDefs = [
    { section: 'Resumen', names: ['Posesión', 'Posesiones'], label: 'Posesión' },
    { section: 'Distribución', names: ['Precisión de pases'], label: 'Precisión pase' },
    { section: 'Ofensivo', names: ['Disparos en total'], label: 'Remates' },
    { section: 'Ofensivo', names: ['Tiros a puerta'], label: 'A puerta' },
    { section: 'Ofensivo', names: ['Tasa de conversión de tiros'], label: 'Conversión' },
    { section: 'Defensivo', names: ['Recuperaciones'], label: 'Recuperaciones' },
    { section: 'Defensivo', names: ['Entradas exitosas'], label: 'Entradas exitosas' },
    { section: 'Distribución', names: ['Pases exitosos'], label: 'Pases exitosos' },
  ];
  const rows = statDefs.map((def) => {
    const firstRow = getSectionStat(first, def.section, def.names);
    const secondRow = getSectionStat(second, def.section, def.names);
    return { label: def.label, first: firstRow?.orso ?? '-', second: secondRow?.orso ?? '-', firstRival: firstRow?.rival ?? '-', secondRival: secondRow?.rival ?? '-' };
  }).filter((row) => row.first !== '-' || row.second !== '-');
  if (!rows.length) return null;
  const aggregatePeriodValues = (a: string | number, b: string | number) => {
    const values = [a, b].filter((value) => value !== '-' && value !== undefined && value !== null) as Array<string | number>;
    if (!values.length) return 0;
    const isPercent = values.some((value) => String(value).includes('%'));
    const total = values.reduce<number>((acc, value) => acc + statNumber(value), 0);
    return isPercent ? Number((total / values.length).toFixed(1)) : total;
  };
  const chartRows = rows.map((row) => ({ stat: row.label, rival: aggregatePeriodValues(row.firstRival, row.secondRival), orso: aggregatePeriodValues(row.first, row.second) }));
  return (
    <ReportSection icon={BarChart3} title="Primer tiempo vs segundo tiempo">
      <div className="period-line-grid">
        {rows.slice(0, 6).map((row) => <MiniLineChart key={`line-${row.label}`} title={row.label} first={row.first} second={row.second} firstRival={row.firstRival} secondRival={row.secondRival} icon={row.label.includes('Poses') ? PieChart : row.label.includes('pase') || row.label.includes('Pases') ? Repeat2 : row.label.includes('Remate') || row.label.includes('puerta') || row.label.includes('Convers') ? Target : row.label.includes('Recuper') ? ShieldCheck : Activity} />)}
      </div>
      <div className="period-report-grid">
        <div className="fd-table-wrap">
          <table className="pdf-report-table fd-eyeball-table">
            <thead><tr><th>Indicador</th><th>Orsomarso 1T</th><th>Orsomarso 2T</th><th>Rival 1T</th><th>Rival 2T</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.label}><td><strong>{row.label}</strong></td><td>{valueText(row.first)}</td><td>{valueText(row.second)}</td><td>{valueText(row.firstRival)}</td><td>{valueText(row.secondRival)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="eyeball-comparison-card fd-main-comparison">
          <div className="eyeball-comparison-head"><span>Rival</span><strong>Promedio / acumulado</strong><span>Orsomarso</span></div>
          {chartRows.map((row) => <ComparisonStat key={row.stat} label={row.stat} orso={row.orso} rival={row.rival} lowerBetter={isLowerBetter(row.stat)} />)}
        </div>
      </div>
    </ReportSection>
  );
}

function GeneralStatsSection({ stats }: { stats?: EyeballMatchStats | null }) {
  if (!stats) return null;
  const rows = sectionRows(stats, 'Resumen');
  if (!rows.length) return null;
  return (
    <ReportSection icon={ClipboardList} title="Estadísticas generales">
      <div className="orso-summary-grid">
        {rows.slice(0, 8).map((row) => (
          <div key={`${row.stat}-${row.index}`} className="orso-summary-card">
            <span>{row.stat}</span>
            <strong>{valueText(row.orso)}</strong>
            <small>Rival: {valueText(row.rival)}</small>
          </div>
        ))}
      </div>
      <EyeballComparisonTable rows={rows} />
    </ReportSection>
  );
}

function TacticalBlock({ icon, eyebrow, title, subtitle, stats, sectionName, patterns, empty, color }: { icon: IconComponent; eyebrow: string; title: string; subtitle?: string; stats?: EyeballMatchStats | null; sectionName?: string; patterns?: string[]; empty: string; color?: string }) {
  const rows = sectionName ? sectionRows(stats, sectionName) : pickEyeballRows(stats, patterns ?? [], 18);
  if (!rows.length) return null;
  const chartItems = rows.slice(0, 9).map((row) => ({ name: row.stat, value: statNumber(row.orso), sub: valueText(row.orso) }));
  const selectedColor = color ?? (eyebrow.includes('Defens') ? C.green : eyebrow.includes('Pases') ? C.blue : C.red);
  return (
    <ReportSection icon={icon} title={title}>
      <div className="fd-tactical-grid orso-tactical-clean-grid">
        <BarPanel title={title} subtitle="Orsomarso" items={chartItems} color={selectedColor} formatter={(v) => numberFmt(v, Number.isInteger(v) ? 0 : 1)} />
        <EyeballComparisonTable rows={rows} title="Comparativo" />
      </div>
      {!rows.length ? <EmptyReportState text={empty} /> : null}
    </ReportSection>
  );
}

function KeyPassDistributionSection({ stats }: { stats?: EyeballMatchStats | null }) {
  const distribution = sectionRows(stats, 'Distribución');
  if (!distribution.length) return null;
  /* Fix #16 — Distribución completa reducida a 10 indicadores relevantes en PDF */
  const priorityPassStats = [
    'pases exitosos', 'pases', 'precision de pases', 'precisión de pases', 'pases clave',
    'pases exitosos ultimo tercio', 'pases exitosos último tercio', 'pases exitosos medio campo',
    'pases largos exitosos', 'pases hacia adelante exitosos', 'centros exitosos', 'dominio territorial',
  ];
  const priorityRows = priorityPassStats
    .map((needle) => distribution.find((row) => normalizeText(row.stat) === needle || normalizeText(row.stat).includes(needle)))
    .filter((row): row is EyeballRow & { section: string } => Boolean(row));
  const uniquePriorityRows = Array.from(new Map(priorityRows.map((row) => [normalizeText(row.stat), row])).values()).slice(0, 10);
  const volumeRows = distribution.filter((row) => /pases$|pases exitosos$|precision|precisión|posesion|dominio/i.test(row.stat));
  const progressionRows = distribution.filter((row) => /ultimo tercio|último tercio|medio campo|tercer defensivo|hacia adelante|progres/i.test(row.stat));
  const directionRows = distribution.filter((row) => /laterales|atr[aá]s|largos|media distancia|cortos|centros/i.test(row.stat));
  return (
    <ReportSection icon={Repeat2} title="Pases y circulación">
      <div className="orso-distribution-panels">
        <BarPanel title="Volumen y precisión" subtitle="Orsomarso" items={volumeRows.slice(0, 6).map((row) => ({ name: row.stat, value: statNumber(row.orso), sub: valueText(row.orso) }))} color={C.blue} />
        <BarPanel title="Progresión territorial" subtitle="Último tercio y campo" items={progressionRows.slice(0, 7).map((row) => ({ name: row.stat, value: statNumber(row.orso), sub: valueText(row.orso) }))} color={C.green} />
        <BarPanel title="Dirección y longitud" subtitle="Tipos de pase" items={directionRows.slice(0, 8).map((row) => ({ name: row.stat, value: statNumber(row.orso), sub: valueText(row.orso) }))} color={C.amber} />
      </div>
      <EyeballComparisonTable rows={uniquePriorityRows.length ? uniquePriorityRows : distribution.slice(0, 10)} title="Distribución principal" />
    </ReportSection>
  );
}

function IntegratedPlayerTable({ rows }: { rows: CompetitionReportPlayerRow[] }) {
  /* Fix #19 — Tabla individual dividida en técnico y físico */
  if (!rows.length) return <EmptyReportState text="Sin planilla para tabla integrada." />;
  const sorted = rows.slice().sort((a, b) => {
    const roleOrder = (role: string) => (role === 'Titular' ? 0 : role === 'Suplente' ? 1 : 2);
    return roleOrder(a.role) - roleOrder(b.role) || (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.name.localeCompare(b.name);
  });
  const hasSprintData = sorted.some((row) => row.sprintDistance > 0);
  const metricValues = {
    distance: sorted.map((row) => row.totalDistance),
    mpm: sorted.map((row) => row.metersPerMinute),
    hsr: sorted.map((row) => row.highSpeedDistance),
    sprint: sorted.map((row) => row.sprintDistance),
    acc: sorted.map((row) => row.acc),
    dcc: sorted.map((row) => row.dcc),
    rhie: sorted.map((row) => row.rhie),
    vmax: sorted.map((row) => row.maxVelocity),
    pl: sorted.map((row) => row.playerLoad),
  };
  const gpsValue = (row: CompetitionReportPlayerRow, key: keyof typeof metricValues, value: number, digits = 0, suffix = '') => {
    /* Fix #9 — Portero sin GPS con nota explícita */
    if (row.isGoalkeeper && row.minutes > 0 && !rowHasGps(row)) return <span className="fd-v2-no-gps">Sin GPS</span>;
    return <span className={metricCellClass(value, metricValues[key])}>{valueOrDash(value, digits, suffix)}</span>;
  };
  return (
    <div className="fd-v2-integrated-split">
      <div className="fd-table-wrap">
        <span className="fd-v2-table-chip">TÉCNICO</span>
        <table className="pdf-report-table competition-report-table-modern fd-v2-gps-detail-table fd-v2-technical-table">
          <thead><tr><th>Jugador</th><th>Pos</th><th>Tipo</th><th>MIN</th><th>G</th><th>A</th><th>TA</th><th>TR</th></tr></thead>
          <tbody>{sorted.map((row) => <tr key={`tech-${row.id}`}><td><strong>{row.name}</strong></td><td>{row.position}</td><td><span className={`fd-v2-type-chip ${toneClass(gpsTypeTone(row.role))}`}>{row.role}</span></td><td>{row.minutes || '—'}</td><td>{row.goals || '—'}</td><td>{row.assists || '—'}</td><td className={row.yellowCards > 0 ? 'card-yellow' : undefined}>{row.yellowCards || '—'}</td><td className={row.redCards > 0 ? 'card-red' : undefined}>{row.redCards || '—'}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="fd-table-wrap">
        <span className="fd-v2-table-chip physical">FÍSICO</span>
        <table className="pdf-report-table competition-report-table-modern competition-report-heat-table fd-v2-gps-detail-table fd-v2-physical-table">
          <thead><tr><th>Jugador</th><th>Dist</th><th>m/min</th><th>HSR</th>{hasSprintData ? <th>Sprint</th> : null}<th>ACC</th><th>DCC</th><th>RHIE</th><th>Vmax</th><th>PL</th></tr></thead>
          <tbody>{sorted.map((row) => <tr key={`phys-${row.id}`}><td><strong>{row.name}</strong>{row.isGoalkeeper && row.minutes > 0 && !rowHasGps(row) ? <small>Sin GPS</small> : null}</td><td>{gpsValue(row, 'distance', row.totalDistance, 0, ' m')}</td><td>{gpsValue(row, 'mpm', row.metersPerMinute)}</td><td>{gpsValue(row, 'hsr', row.highSpeedDistance, 0, ' m')}</td>{hasSprintData ? <td>{gpsValue(row, 'sprint', row.sprintDistance, 0, ' m')}</td> : null}<td>{gpsValue(row, 'acc', row.acc)}</td><td>{gpsValue(row, 'dcc', row.dcc)}</td><td>{gpsValue(row, 'rhie', row.rhie)}</td><td>{gpsValue(row, 'vmax', row.maxVelocity, 1)}</td><td>{gpsValue(row, 'pl', row.playerLoad)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function GoalkeeperPerformanceSection({ rows }: { rows: CompetitionReportPlayerRow[] }) {
  const keepers = rows.filter((row) => row.isGoalkeeper);
  /* Fix #1 — Porteros condicional */
  const totalActions = keepers.reduce((acc, row) => acc + row.goalsPrevented + row.penaltiesSaved + row.crossesDefended + row.footworkActions, 0);
  if (!keepers.length || totalActions <= 0) return null;
  return (
    <ReportSection icon={Shield} title="Rendimiento de porteros" subtitle="Goles evitados, penaltis atajados, centros defendidos y juego de pies.">
      <div className="pdf-report-kpi-grid competition-kpi-grid competition-kpi-grid-clean fd-stat-kpis">
        <ReportKpi icon={ShieldCheck} label="Goles evitados" value={numberFmt(keepers.reduce((acc, row) => acc + row.goalsPrevented, 0))} note="Total porteros" tone="green" />
        <ReportKpi icon={Target} label="Penaltis atajados" value={numberFmt(keepers.reduce((acc, row) => acc + row.penaltiesSaved, 0))} note="Competencia" tone="blue" />
        <ReportKpi icon={Flag} label="Centros defendidos" value={numberFmt(keepers.reduce((acc, row) => acc + row.crossesDefended, 0))} note="Área propia" tone="amber" />
        <ReportKpi icon={Repeat2} label="Juego de pies" value={numberFmt(keepers.reduce((acc, row) => acc + row.footworkActions, 0))} note="Acciones" tone="dark" />
      </div>
      <div className="fd-table-wrap">
        <table className="pdf-report-table competition-report-table-modern compact">
          <thead><tr><th>Portero</th><th>MIN</th><th>GE</th><th>Goles evitados</th><th>Penaltis atajados</th><th>Centros defendidos</th><th>Juego de pies</th><th>Disciplina</th></tr></thead>
          <tbody>{keepers.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.minutes || '-'}</td><td>{row.goalsConceded || 0}</td><td>{row.goalsPrevented || 0}</td><td>{row.penaltiesSaved || 0}</td><td>{row.crossesDefended || 0}</td><td>{row.footworkActions || 0}</td><td>{row.discipline}</td></tr>)}</tbody>
        </table>
      </div>
    </ReportSection>
  );
}

function GpsSummaryMetric({ icon: Icon, label, value, note, width, tone = 'blue' }: { icon: IconComponent; label: string; value: string | number; note?: string; width: number; tone?: CompetitionReportTone }) {
  /* Fix #4 — GPS con referencia visual */
  return (
    <div className={`fd-v2-gps-kpi ${toneClass(tone)}`}>
      <Icon size={16} />
      <div><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}<i><b style={{ width: `${clamp(width)}%` }} /></i></div>
    </div>
  );
}

function GpsPhysicalSection({ report }: { report: CompetitionReportData }) {
  /* Fix #20 — Carga física del partido unificada */
  const rows = report.rows.filter((row) => row.totalDistance > 0 || row.playerLoad > 0 || row.minutes > 0 || row.acc > 0 || row.dcc > 0 || row.rhie > 0);
  if (!rows.length) return null;
  const gpsRows = rows.filter(rowHasGps);
  const divisor = Math.max(gpsRows.length, 1);
  const distance = gpsRows.slice().sort((a, b) => b.totalDistance - a.totalDistance).slice(0, 10).map((row) => ({ name: row.name, value: row.totalDistance, sub: `${row.minutes || 0} min · ${row.metersPerMinute || 0} m/min` }));
  const playerLoad = gpsRows.slice().sort((a, b) => b.playerLoad - a.playerLoad).slice(0, 10).map((row) => ({ name: row.name, value: row.playerLoad, sub: `${row.minutes || 0} min · ${row.metersPerMinute || 0} m/min` }));
  const hsr = gpsRows.slice().sort((a, b) => b.highSpeedDistance - a.highSpeedDistance).slice(0, 10).map((row) => ({ name: row.name, value: row.highSpeedDistance, sub: `${row.metersPerMinute || 0} m/min` }));
  const neuromuscular = gpsRows.slice().sort((a, b) => (b.acc + b.dcc + b.rhie) - (a.acc + a.dcc + a.rhie)).slice(0, 10).map((row) => ({ name: row.name, value: row.acc + row.dcc + row.rhie, sub: `${row.metersPerMinute || 0} m/min`, acc: row.acc, dcc: row.dcc, rhie: row.rhie }));
  const avg = {
    distancia: report.stats.totalDistance / divisor,
    mmin: gpsRows.reduce((acc, row) => acc + row.metersPerMinute, 0) / divisor,
    hsr: report.stats.highSpeedDistance / divisor,
    sprint: report.stats.sprintDistance / divisor,
    acc: report.stats.acc / divisor,
    dcc: report.stats.dcc / divisor,
    rhie: report.stats.rhie / divisor,
    pl: report.stats.playerLoad / divisor,
  };
  const kpiValues = [report.stats.totalDistance, report.stats.avgMetersPerMinute, report.stats.highSpeedDistance, report.stats.sprintDistance, report.stats.acc + report.stats.dcc, report.stats.rhie, report.stats.playerLoad, gpsRows.length];
  const maxKpi = Math.max(...kpiValues, 1);
  return (
    <ReportSection icon={Zap} title="Carga física del partido" subtitle="GPS de equipo y rankings individuales integrados." className="competition-gps-section fd-v2-gps-physical-section">
      <div className="fd-v2-gps-kpi-grid">
        <GpsSummaryMetric icon={Ruler} label="Distancia total" value={`${numberFmt(report.stats.totalDistance)} m`} note={`Prom. jugador ${numberFmt(avg.distancia)} m`} width={pct(report.stats.totalDistance, maxKpi)} tone="blue" />
        <GpsSummaryMetric icon={Gauge} label="M/min promedio" value={report.stats.avgMetersPerMinute || '—'} note={`Prom. jugador ${numberFmt(avg.mmin)}`} width={pct(report.stats.avgMetersPerMinute, maxKpi)} tone="green" />
        <GpsSummaryMetric icon={Activity} label="HSR" value={`${numberFmt(report.stats.highSpeedDistance)} m`} note={`Prom. jugador ${numberFmt(avg.hsr)} m`} width={pct(report.stats.highSpeedDistance, maxKpi)} tone="amber" />
        <GpsSummaryMetric icon={Trophy} label="Sprint dist." value={`${numberFmt(report.stats.sprintDistance)} m`} note={`Prom. jugador ${numberFmt(avg.sprint)} m`} width={pct(report.stats.sprintDistance, maxKpi)} tone="red" />
        <GpsSummaryMetric icon={ChevronsUp} label="ACC" value={numberFmt(report.stats.acc)} note={`Prom. jugador ${numberFmt(avg.acc)}`} width={pct(report.stats.acc, maxKpi)} tone="dark" />
        <GpsSummaryMetric icon={ChevronsDown} label="DCC" value={numberFmt(report.stats.dcc)} note={`Prom. jugador ${numberFmt(avg.dcc)}`} width={pct(report.stats.dcc, maxKpi)} tone="dark" />
        <GpsSummaryMetric icon={Activity} label="RHIE" value={numberFmt(report.stats.rhie)} note={`Prom. jugador ${numberFmt(avg.rhie)}`} width={pct(report.stats.rhie, maxKpi)} tone="amber" />
        <GpsSummaryMetric icon={Zap} label="Player Load" value={numberFmt(report.stats.playerLoad)} note={`Prom. jugador ${numberFmt(avg.pl)}`} width={pct(report.stats.playerLoad, maxKpi)} tone="green" />
      </div>
      <div className="fd-v2-gps-divider" />
      <div className="competition-gps-chart-grid">
        <BarPanel title="Distancia total" subtitle="Top jugadores" items={distance} color={C.blueDark} formatter={(v) => `${numberFmt(v)} m`} />
        <BarPanel title="Player Load" subtitle="Carga del jugador" items={playerLoad} color={C.blue} formatter={(v) => numberFmt(v)} />
        <BarPanel title="HSR" subtitle="Alta intensidad" items={hsr} color={C.amber} formatter={(v) => `${numberFmt(v)} m`} />
        <NeuroRankPanel items={neuromuscular} />
      </div>
    </ReportSection>
  );
}

function ConclusionsSection({ stats }: { stats?: EyeballMatchStats | null }) {
  /* Fix #17 — Conclusiones con color semántico y deduplicación */
  if (!stats) return null;
  const equivalentKeys = [
    ['conversion', 'tasa conversion tiros', 'tasa de conversion de tiros', 'tasa de conversión de tiros'],
    ['posesion', 'posesiones', 'dominio territorial'],
    ['pases exitosos', 'volumen pases', 'pases'],
  ];
  const canonicalKey = (label: string) => {
    const normalized = normalizeText(label);
    const group = equivalentKeys.find((items) => items.some((item) => normalized.includes(normalizeText(item))));
    return group?.[0] ?? normalized;
  };
  const rows = allEyeballRows(stats).filter((row) => statNumber(row.orso) > 0 || statNumber(row.rival) > 0);
  const strengths: Array<{ label: string; value: string; key: string }> = [];
  const improvements: Array<{ label: string; value: string; key: string; priority?: number }> = [];
  const pushUnique = (target: typeof strengths, item: { label: string; value: string; key: string; priority?: number }) => {
    if (!target.some((existing) => existing.key === item.key)) target.push(item);
  };
  rows.forEach((row) => {
    const o = statNumber(row.orso);
    const r = statNumber(row.rival);
    const lowerBetter = isLowerBetter(row.stat);
    if (o === 0 && r === 0) return;
    const threshold = Math.max(2, Math.max(o, r) * 0.2);
    const key = canonicalKey(row.stat);
    if (lowerBetter) {
      if (r - o > threshold) pushUnique(strengths, { label: row.stat, value: `${valueText(row.orso)} vs ${valueText(row.rival)}`, key });
      if (o - r > threshold) pushUnique(improvements, { label: row.stat, value: `${valueText(row.orso)} vs ${valueText(row.rival)}`, key });
    } else {
      if (o - r > threshold) pushUnique(strengths, { label: row.stat, value: `${valueText(row.orso)} vs ${valueText(row.rival)}`, key });
      if (r - o > threshold) pushUnique(improvements, { label: row.stat, value: `${valueText(row.orso)} vs ${valueText(row.rival)}`, key });
    }
  });
  const conversion = findEyeballStat(stats, ['Tasa de conversión de tiros', 'Conversión'], ['Ofensivo']);
  const errors = findEyeballStat(stats, ['Errores'], ['Defensivo', 'Resumen']);
  if (conversion) {
    const target = statNumber(conversion.orso) >= statNumber(conversion.rival) ? strengths : improvements;
    pushUnique(target, { label: 'Conversión', value: `${valueText(conversion.orso)} vs ${valueText(conversion.rival)}`, key: 'conversion' });
  }
  if (errors) {
    const item = { label: 'Errores', value: `${valueText(errors.orso)} vs ${valueText(errors.rival)}`, key: 'errores', priority: 1 };
    if (statNumber(errors.orso) > 8) improvements.unshift(item);
    else pushUnique(statNumber(errors.orso) <= statNumber(errors.rival) ? strengths : improvements, item);
  }
  const takeTop = (items: Array<{ label: string; value: string; key: string; priority?: number }>) => Array.from(new Map(items.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).map((item) => [item.key, item])).values()).slice(0, 4);
  return (
    <ReportSection icon={ClipboardList} title="Conclusiones del partido" className="competition-conclusions-page fd-v2-conclusions-page">
      <div className="fd-v2-conclusion-grid">
        <div className="fd-v2-conclusion-card strengths"><h4><ThumbsUp size={16} /> Fortalezas</h4>{takeTop(strengths).map((item) => <span key={`str-${item.key}`}>{item.label}<b>{item.value}</b></span>)}</div>
        <div className="fd-v2-conclusion-card improvements"><h4><AlertTriangle size={16} /> Áreas de mejora</h4>{takeTop(improvements).map((item) => <span key={`imp-${item.key}`}>{item.label}<b>{item.value}</b></span>)}</div>
      </div>
    </ReportSection>
  );
}

export function CompetitionReportTemplate({ report, category, className = '', compact = false, eyeballStats = null, eyeballFirstHalfStats = null, eyeballSecondHalfStats = null }: Props) {
  const match = report.match;
  const resultTone = toneForResult(report.resultType);
  const VenueIcon = match.venue === 'Visitante' ? Bus : Home;
  const microcycleLabel = report.microcycle
    ? report.microcycle.startDate && report.microcycle.endDate
      ? `${report.microcycle.name} · ${report.microcycle.startDate} - ${report.microcycle.endDate}`
      : report.microcycle.name
    : 'Sin microciclo asignado';
  const setPiecePatterns = ['tiros de esquina', 'saques de banda', 'tiros libres', 'reinicios', 'centros'];

  return (
    <article className={`pdf-report-document competition-report-document competition-report-premium-v2 fd-competition-report ${compact ? 'pdf-report-compact' : ''} ${className}`}>
      {!compact ? <CompetitionPerformanceCover report={report} category={category} eyeballStats={eyeballStats} /> : null}
      <header className="pdf-report-header competition-report-topline fd-report-topline">
        <div className="pdf-report-brand"><img src="/orsomarso-crest.jpg" alt="Orsomarso SC" /><div><span>Departamento de Rendimiento</span><h1>Informe estadístico de competencia</h1><p>{categoryLabel(category)} · {report.generatedAt}</p></div></div>
        <div className="pdf-report-header-meta"><strong>{formatDate(match.date)}</strong><span>{match.venue ?? 'Local'} · {match.competitionName || 'Competencia'}</span></div>
      </header>
      <section className="pdf-report-hero competition-report-hero-premium competition-report-hero-clean fd-match-hero competition-match-header">
        <div className="pdf-report-team-block"><span>Equipo</span><strong>Orsomarso SC</strong></div>
        <div className="pdf-report-score-block"><span>Marcador</span><strong>{report.score}</strong><ReportBadge text={report.resultType} tone={resultTone} /></div>
        <div className="pdf-report-team-block right"><span>Rival</span><RivalCrest match={match} className="fd-rival-crest" /><strong>{match.opponent}</strong></div>
        <div className="pdf-report-hero-meta"><span><CalendarDays size={13} /> {formatDate(match.date)}</span><span><VenueIcon size={13} /> {match.venue ?? 'Local'}</span><span><Trophy size={13} /> {match.competitionName || 'Competencia'}</span><span><Users size={13} /> {categoryLabel(category)}</span></div>
      </section>
      <LineupSection report={report} />
      <GoalkeeperPerformanceSection rows={report.rows} />
      <MatchDynamicsSection stats={eyeballStats} />
      <PeriodComparisonSection first={eyeballFirstHalfStats} second={eyeballSecondHalfStats} />
      <GeneralStatsSection stats={eyeballStats} />
      <TacticalBlock icon={Target} eyebrow="Acciones ofensivas" title="Acciones ofensivas" stats={eyeballStats} sectionName="Ofensivo" empty="Sin datos ofensivos." color={C.red} />
      <KeyPassDistributionSection stats={eyeballStats} />
      <TacticalBlock icon={ShieldCheck} eyebrow="Defensivo" title="Recuperaciones, duelos y acciones defensivas" stats={eyeballStats} sectionName="Defensivo" empty="Sin datos defensivos." color={C.green} />
      <TacticalBlock icon={Flag} eyebrow="Pelota quieta" title="Acciones de pelota quieta" stats={eyeballStats} patterns={setPiecePatterns} empty="Sin datos de pelota quieta." color={C.amber} />
      <GpsPhysicalSection report={report} />
      <ReportSection icon={ClipboardList} title="Tabla individual integrada"><IntegratedPlayerTable rows={report.rows} /></ReportSection>
      {String(match.observation ?? '').trim() ? (
        <ReportSection icon={ClipboardList} title="Observaciones manuales del partido">
          <p className="pdf-manual-note">{String(match.observation ?? '').trim()}</p>
        </ReportSection>
      ) : null}

      <ConclusionsSection stats={eyeballStats} />

      {/* Fix #18 — Disciplina ya vive en alineación y tabla individual; no duplicar sección */}
      {report.medicalRows.length ? (
        <div className="pdf-report-two-columns compact-blocks competition-report-bottom-grid fd-report-bottom">
          <ReportSection icon={HeartPulse} title="Incidencias médicas"><table className="pdf-report-table compact"><thead><tr><th>Jugador</th><th>Estado</th><th>Observación</th></tr></thead><tbody>{report.medicalRows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.medicalStatus}</td><td>{row.medicalObservation || '-'}</td></tr>)}</tbody></table></ReportSection>
        </div>
      ) : null}
      <footer className="pdf-report-footer"><span>Departamento de Rendimiento</span><span>{categoryLabel(category)} · Informe estadístico de competencia</span></footer>
    </article>
  );
}
