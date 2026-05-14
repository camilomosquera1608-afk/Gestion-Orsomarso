'use client';

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Image from 'next/image';
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronsDown,
  ChevronsUp,
  ClipboardList,
  Download,
  Dumbbell,
  FileText,
  Gauge,
  HeartPulse,
  Percent,
  Ruler,
  Scale,
  ShieldCheck,
  Trophy,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { EmptyState, SectionHeader } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel, formatBirthDateForDisplay } from '@/lib/labels';
import { averageWellness, calculateInternalLoad } from '@/lib/utils';
import {
  calculateAgeSafe,
  formatPdfDate,
  formatPdfNumber,
  getPdfSafeText,
  hasValidSectionData,
  hasValidValue,
} from '@/lib/report-utils';
import type { ClubCategory, CompetitionRecord, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord, FMSRecord, NutritionRecord, Player } from '@/lib/types';

type Tone = 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'navy';
type ChartPoint = { label: string; value: number };
type BarItem = { label: string; value: number; suffix?: string; decimals?: number; icon?: LucideIcon };
type Kpi = { label: string; value: unknown; note?: string; icon: LucideIcon; tone?: Tone; suffix?: string; decimals?: number };

const todayInputDate = () => new Date().toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const defaultStartDate = () => addDays(new Date(), -60).toISOString().slice(0, 10);
const inRange = (date: string, startDate: string, endDate: string) => (!startDate || date >= startDate) && (!endDate || date <= endDate);
const sortByDate = <T extends { date: string }>(rows: T[]) => [...rows].sort((a, b) => a.date.localeCompare(b.date));
const last = <T,>(rows: T[]) => rows.length ? rows[rows.length - 1] : undefined;
const asNumber = (value: unknown) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};
const sum = <T,>(rows: T[], read: (row: T) => unknown) => rows.reduce((total, row) => total + asNumber(read(row)), 0);
const avg = (values: number[], decimals = 1) => {
  const clean = values.filter((value) => Number.isFinite(value) && value !== 0);
  if (!clean.length) return 0;
  const value = clean.reduce((total, item) => total + item, 0) / clean.length;
  return Number(value.toFixed(decimals));
};
const max = (values: number[]) => values.filter((value) => Number.isFinite(value) && value !== 0).reduce((current, value) => Math.max(current, value), 0);
const uniqueBy = <T,>(rows: T[], readKey: (row: T) => string) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = readKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const formatMetric = (value: unknown, suffix = '', decimals = 0) => {
  if (!hasValidValue(value)) return '';
  if (typeof value === 'number') return `${formatPdfNumber(value, decimals)}${suffix}`;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).trim() !== '') return `${formatPdfNumber(numeric, decimals)}${suffix}`;
  return `${getPdfSafeText(value, '')}${suffix}`;
};

const pointSeries = <T extends { date: string }>(rows: T[], read: (row: T) => unknown): ChartPoint[] => rows
  .map((row) => ({ label: row.date.slice(5), value: asNumber(read(row)) }))
  .filter((point) => Number.isFinite(point.value) && point.value !== 0);

function toneForValue(kind: 'status' | 'wellness' | 'default', value: unknown): Tone {
  if (kind === 'status') return String(value) === 'Disponible' ? 'green' : String(value) === 'Lesionado' ? 'red' : 'amber';
  if (kind === 'wellness') {
    const num = asNumber(value);
    if (!num) return 'navy';
    if (num < 3) return 'red';
    if (num < 4) return 'amber';
    return 'green';
  }
  return 'blue';
}

function KpiGrid({ items }: { items: Kpi[] }) {
  const clean = items.filter((item) => hasValidValue(item.value));
  if (!clean.length) return null;
  return (
    <div className="scout-kpi-grid">
      {clean.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className={`scout-kpi scout-kpi-${item.tone ?? 'blue'}`}>
            <span><Icon size={18} /></span>
            <div>
              <small>{item.label}</small>
              <strong>{formatMetric(item.value, item.suffix ?? '', item.decimals ?? 0)}</strong>
              {item.note ? <em>{item.note}</em> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GpsAveragesGrid({ sessions, totalDistance, playerLoad, acc, dcc, rhie }: { sessions: number; totalDistance: number; playerLoad: number; acc: number; dcc: number; rhie: number }) {
  if (!sessions) return null;
  const items: Kpi[] = [
    { icon: Ruler, label: 'Dist/sesión', value: totalDistance / sessions, suffix: ' m', note: 'prom/sesión', tone: 'blue' },
    { icon: Zap, label: 'PL/sesión', value: playerLoad / sessions, note: 'prom/sesión', tone: 'cyan' },
    { icon: ChevronsUp, label: 'ACC/sesión', value: acc / sessions, note: 'prom/sesión', tone: 'green' },
    { icon: ChevronsDown, label: 'DCC/sesión', value: dcc / sessions, note: 'prom/sesión', tone: 'amber' },
    { icon: Activity, label: 'RHIE/sesión', value: rhie / sessions, note: 'prom/sesión', tone: 'navy' },
  ];
  return <div className="scout-gps-average-strip"><KpiGrid items={items} /></div>;
}

function Section({ eyebrow, title, children, className = '' }: { eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`scout-section ${className}`}>
      <div className="scout-section-title">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function BioStrip({ items }: { items: Array<{ label: string; value: unknown; suffix?: string; decimals?: number }> }) {
  const clean = items.filter((item) => hasValidValue(item.value));
  if (!clean.length) return null;
  return (
    <div className="scout-bio-strip">
      {clean.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{formatMetric(item.value, item.suffix ?? '', item.decimals ?? 0)}</strong>
        </div>
      ))}
    </div>
  );
}

function BarsCard({ title, subtitle, items, tone = 'blue' }: { title: string; subtitle?: string; items: BarItem[]; tone?: Tone }) {
  const clean = items.filter((item) => hasValidValue(item.value));
  if (!clean.length) return null;
  const peak = Math.max(1, ...clean.map((item) => Math.abs(item.value)));
  return (
    <div className={`scout-chart-card scout-chart-${tone}`}>
      <div className="scout-chart-head"><strong>{title}</strong>{subtitle ? <span>{subtitle}</span> : null}</div>
      <div className="scout-bars">
        {clean.map((item) => {
          const Icon = item.icon;
          const width = Math.max(0.8, Math.min(100, (Math.abs(item.value) / peak) * 100));
          return (
            <div className="scout-bar-row" key={item.label}>
              <b>{Icon ? <Icon size={14} /> : null}{item.label}</b>
              <i><em style={{ width: `${width}%` }} /></i>
              <strong>{formatMetric(item.value, item.suffix ?? '', item.decimals ?? 0)}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineChartCard({ title, subtitle, points, tone = 'blue', suffix = '', decimals = 0, icon: Icon = Activity }: { title: string; subtitle?: string; points: ChartPoint[]; tone?: Tone; suffix?: string; decimals?: number; icon?: LucideIcon }) {
  const clean = points.filter((point) => Number.isFinite(point.value) && point.value !== 0);
  if (clean.length < 2) return null;
  const values = clean.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = Math.max(1, (maxValue - minValue) * 0.12);
  const low = Math.max(0, minValue - padding);
  const high = maxValue + padding;
  const span = Math.max(1, high - low);
  const width = 430;
  const height = 205;
  const plot = { left: 46, right: 20, top: 28, bottom: 48 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const x = (index: number) => plot.left + (index / Math.max(1, clean.length - 1)) * plotWidth;
  const y = (value: number) => plot.top + ((high - value) / span) * plotHeight;
  const linePath = clean.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${x(clean.length - 1).toFixed(1)} ${(plot.top + plotHeight).toFixed(1)} L ${plot.left} ${(plot.top + plotHeight).toFixed(1)} Z`;
  const latest = clean[clean.length - 1];
  const yTicks = [high, low + span * 0.66, low + span * 0.33, low];
  const gradientId = `grad-${title.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
  return (
    <div className={`scout-chart-card scout-chart-${tone} scout-line-card-pro`}>
      <div className="scout-chart-head scout-chart-head-icon"><strong><Icon size={16} />{title}</strong><span>{subtitle ?? `${clean[0].label} - ${latest.label}`}</span></div>
      <svg className="scout-line-chart scout-line-chart-pro" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.20" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yTicks.map((tick, index) => {
          const yy = y(tick);
          return <g key={`${title}-tick-${index}`}><line x1={plot.left} y1={yy} x2={width - plot.right} y2={yy} className="grid" /><text x={plot.left - 8} y={yy + 3} textAnchor="end" className="axis-label">{formatMetric(tick, suffix, decimals)}</text></g>;
        })}
        <path d={areaPath} fill={`url(#${gradientId})`} className="area" />
        <path d={linePath} className="line" />
        {clean.map((point, index) => {
          const latestPoint = index === clean.length - 1;
          return (
            <g key={`${title}-${point.label}-${index}`}>
              <circle cx={x(index)} cy={y(point.value)} r={latestPoint ? 5.5 : 3.8} className={latestPoint ? 'dot latest' : 'dot'} />
              <text x={x(index)} y={Math.max(12, y(point.value) - 9)} textAnchor="middle" className="point-label">{formatMetric(point.value, suffix, decimals)}</text>
              <text x={x(index)} y={height - 14} transform={`rotate(30 ${x(index)} ${height - 14})`} textAnchor="start" className="x-label">{point.label}</text>
            </g>
          );
        })}
        <rect x={width - 116} y="6" width="96" height="25" rx="12" className="last-badge" />
        <text x={width - 68} y="22" textAnchor="middle" className="last-badge-text">{formatMetric(latest.value, suffix, decimals)}</text>
      </svg>
    </div>
  );
}

function RingCard({ title, value, maxValue, suffix = '', tone = 'blue', decimals = 0 }: { title: string; value: number; maxValue: number; suffix?: string; tone?: Tone; decimals?: number }) {
  if (!hasValidValue(value) || !hasValidValue(maxValue)) return null;
  const pct = Math.max(0, Math.min(100, (value / maxValue) * 100));
  return (
    <div className={`scout-ring scout-ring-${tone}`} style={{ ['--ring-value' as string]: `${pct}%` }}>
      <div className="scout-ring-visual"><strong>{formatMetric(value, suffix, decimals)}</strong><span>{Math.round(pct)}%</span></div>
      <small>{title}</small>
    </div>
  );
}

function WellnessGauge({ value }: { value: number }) {
  if (!hasValidValue(value)) return null;
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div className="scout-wellness-gauge-card">
      <div className="scout-chart-head scout-chart-head-icon"><strong><HeartPulse size={16} />Wellness</strong><span>Escala 0-5</span></div>
      <div className="scout-wellness-gauge" style={{ ['--wellness-value' as string]: `${pct}%` } as CSSProperties}>
        <div className="scout-wellness-gauge-inner"><strong>{formatMetric(value, '', 1)}</strong><span>/ 5</span></div>
      </div>
      <div className="scout-zone-legend"><span><i className="zone-red" />0-3</span><span><i className="zone-amber" />3-4</span><span><i className="zone-green" />4-5</span></div>
    </div>
  );
}

function ReferenceBar({ label, value, min, max, optimalMin, optimalMax, suffix = '', decimals = 0, icon: Icon = Activity }: { label: string; value: unknown; min: number; max: number; optimalMin: number; optimalMax: number; suffix?: string; decimals?: number; icon?: LucideIcon }) {
  if (!hasValidValue(value)) return null;
  const numeric = asNumber(value);
  const span = Math.max(1, max - min);
  const left = Math.max(0, Math.min(100, ((numeric - min) / span) * 100));
  const optimalLeft = Math.max(0, Math.min(100, ((optimalMin - min) / span) * 100));
  const optimalWidth = Math.max(0, Math.min(100 - optimalLeft, ((optimalMax - optimalMin) / span) * 100));
  return (
    <div className="scout-reference-row">
      <div className="scout-reference-label"><Icon size={14} /><span>{label}</span><strong>{formatMetric(numeric, suffix, decimals)}</strong></div>
      <div className="scout-reference-track">
        <i className="red left" /><i className="amber left" /><i className="green" style={{ left: `${optimalLeft}%`, width: `${optimalWidth}%` }} /><i className="amber right" /><i className="red right" />
        <em style={{ left: `${left}%` }} />
      </div>
      <div className="scout-reference-scale"><span>{formatMetric(min, suffix, decimals)}</span><span>{formatMetric(max, suffix, decimals)}</span></div>
    </div>
  );
}

function PhysicalProfileCard({ nutrition, position }: { nutrition?: NutritionRecord; position: string }) {
  if (!nutrition) return null;
  const isCenterBack = position.toLowerCase().includes('central');
  const weight = isCenterBack ? { min: 68, max: 90, optimalMin: 72, optimalMax: 84 } : { min: 55, max: 95, optimalMin: 65, optimalMax: 82 };
  return (
    <div className="scout-donut-card scout-physical-profile">
      <div className="scout-chart-head scout-chart-head-icon"><strong><Scale size={16} />Valoración física</strong><span>{formatPdfDate(nutrition.date)}</span></div>
      <ReferenceBar icon={Ruler} label="Talla" value={nutrition.height} min={165} max={200} optimalMin={176} optimalMax={190} suffix=" cm" />
      <ReferenceBar icon={Scale} label="Peso" value={nutrition.weight} min={weight.min} max={weight.max} optimalMin={weight.optimalMin} optimalMax={weight.optimalMax} suffix=" kg" decimals={1} />
      <ReferenceBar icon={Percent} label="% grasa" value={nutrition.bodyFat} min={5} max={15} optimalMin={5.7} optimalMax={7.8} suffix="%" decimals={1} />
      <ReferenceBar icon={Dumbbell} label="% muscular" value={nutrition.muscleMassPercentage} min={40} max={60} optimalMin={48} optimalMax={56} suffix="%" decimals={1} />
    </div>
  );
}

function NutritionCard({ nutrition }: { nutrition?: NutritionRecord }) {
  if (!nutrition) return null;
  const plan = nutrition.plan;
  const fatRange = nutrition.fatPercentageRange;
  return (
    <div className="scout-donut-card scout-nutrition-card">
      <div className="scout-chart-head scout-chart-head-icon"><strong><Utensils size={16} />Nutrición</strong><span>{formatPdfDate(nutrition.date)}</span></div>
      <div className="scout-pill-grid">
        {hasValidValue(fatRange) ? <span className="scout-status-pill green"><Percent size={13} />{fatRange}</span> : null}
        {hasValidValue(plan) ? <span className="scout-status-pill blue"><ClipboardList size={13} />{plan}</span> : null}
      </div>
      {hasValidValue(nutrition.diagnosis) ? <p className="pdf-manual-note">{getPdfSafeText(nutrition.diagnosis, '')}</p> : null}
    </div>
  );
}

function EmptyCompetitionState() {
  return <div className="scout-empty-card"><Trophy size={22} /><strong>Sin competencias en el período</strong><span>No hay partidos registrados para el rango seleccionado.</span></div>;
}

function CompetitionPills({ rows }: { rows: CompetitionRecord[] }) {
  if (!rows.length) return <EmptyCompetitionState />;
  return (
    <div className="scout-match-pills">
      {rows.slice(-6).reverse().map((record) => (
        <div className="scout-match-pill" key={`${record.date}-${record.matchId ?? record.opponent}`}>
          <span>{formatPdfDate(record.date)}</span><strong>{record.opponent || 'Rival'}</strong><em>{hasValidValue(record.minutesPlayed) ? `${record.minutesPlayed} min` : 'Registro'}</em>
        </div>
      ))}
    </div>
  );
}

function GpsDataTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return null;
  const visibleColumns = ['Fecha', 'Tipo', 'Min', 'Distancia', 'PL', 'm/min', 'ACC', 'DCC', 'Vmax', 'RHIE'].filter((column) => rows.some((row) => hasValidValue(row[column])));
  return (
    <div className="fd-table-wrap">
      <table className="pdf-report-table compact scout-table scout-gps-heat-table">
        <thead><tr>{visibleColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{visibleColumns.map((column) => <td key={column} className={String(row[`${column}Tone`] ?? '')}>{hasValidValue(row[column]) ? String(row[column]) : <span className="scout-muted-cell">—</span>}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}


function DataTable({ columns, rows }: { columns: string[]; rows: Array<Record<string, unknown>> }) {
  const cleanRows = rows.filter((row) => Object.values(row).some((value) => hasValidValue(value)));
  if (!cleanRows.length) return null;
  const visibleColumns = columns.filter((column) => cleanRows.some((row) => hasValidValue(row[column])));
  if (!visibleColumns.length) return null;
  return (
    <div className="fd-table-wrap">
      <table className="pdf-report-table compact scout-table">
        <thead><tr>{visibleColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {cleanRows.map((row, index) => (
            <tr key={index}>
              {visibleColumns.map((column) => <td key={column}>{hasValidValue(row[column]) ? String(row[column]) : ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerPhoto({ player }: { player: Player }) {
  if (player.photo && player.photo.trim()) {
    return <Image src={player.photo} alt={player.name} width={145} height={176} unoptimized />;
  }
  const initials = player.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <div className="scout-photo-fallback">{initials}</div>;
}

export default function PlayerPeriodReportPage() {
  const { data, filters, setFilters, syncStatus, isLoading } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(todayInputDate());
  const reportRef = useRef<HTMLElement | null>(null);

  const categoryPlayers = useMemo(
    () => data.players.filter((player) => activeCategory === 'all' || player.category === activeCategory),
    [data.players, activeCategory],
  );
  const selectedPlayerId = filters.playerId === 'all' ? categoryPlayers[0]?.id ?? data.players[0]?.id ?? '' : filters.playerId;
  const player = data.players.find((item) => item.id === selectedPlayerId) ?? categoryPlayers[0] ?? data.players[0];

  const report = useMemo(() => {
    if (!player) return null;
    const wellness = sortByDate(data.wellness.filter((record) => record.playerId === player.id && inRange(record.date, startDate, endDate)));
    const internal = sortByDate(data.internalLoads.filter((record) => record.playerId === player.id && inRange(record.date, startDate, endDate)));
    const external = sortByDate(data.externalLoads.filter((record) => record.playerId === player.id && inRange(record.date, startDate, endDate)));
    const competition = sortByDate(data.competitionRecords.filter((record) => record.playerId === player.id && inRange(record.date, startDate, endDate)));
    const nutrition = sortByDate(data.nutritionRecords.filter((record) => record.playerId === player.id && inRange(record.date, startDate, endDate)));
    const cmj = sortByDate(data.cmjRecords.filter((record) => record.playerId === player.id && inRange(record.date, startDate, endDate)));
    const neuromuscular = sortByDate(data.neuromuscularRecords.filter((record) => record.playerId === player.id && inRange(record.date, startDate, endDate)));
    const fms = sortByDate(data.fmsRecords.filter((record) => record.playerId === player.id && inRange(record.date, startDate, endDate)));
    const strength = sortByDate((data.strengthSessions ?? []).filter((sessionItem) => inRange(sessionItem.date, startDate, endDate) && ((sessionItem.playerIds ?? []).includes(player.id) || (sessionItem.responses ?? []).some((response) => response.playerId === player.id))));
    return { wellness, internal, external, competition, nutrition, cmj, neuromuscular, fms, strength };
  }, [data, player, startDate, endDate]);

  if (isLoading) return <EmptyState title="Cargando datos" text="Preparando el reporte del jugador." />;
  if (!player || !report) return <EmptyState title="No hay jugadores disponibles" text="Agrega jugadores al plantel para generar el reporte." />;

  const category = (player.category ?? (activeCategory === 'all' ? 'Sub20' : activeCategory)) as ClubCategory;
  const latestWellness = last(report.wellness);
  const latestInternal = last(report.internal);
  const latestExternal = last(report.external);
  const latestNutrition = last(report.nutrition);
  const latestCmj = last(report.cmj);
  const latestNeuro = last(report.neuromuscular);
  const latestFms = last(report.fms);

  const wellnessValues = report.wellness.map((record: DailyWellnessRecord) => averageWellness(record));
  const internalLoads = report.internal.map((record: DailyInternalLoadRecord) => calculateInternalLoad(record));
  const wellnessAverage = avg(wellnessValues, 1);
  const internalTotal = internalLoads.reduce((total, value) => total + value, 0);
  const totalDistance = sum(report.external, (record: DailyExternalLoadRecord) => record.totalDistance);
  const playerLoad = sum(report.external, (record: DailyExternalLoadRecord) => record.playerLoad);
  const hsr = sum(report.external, (record: DailyExternalLoadRecord) => record.hsr ?? record.highSpeedDistance);
  const sprint = sum(report.external, (record: DailyExternalLoadRecord) => record.sprintDistance);
  const acc = sum(report.external, (record: DailyExternalLoadRecord) => record.acc);
  const dcc = sum(report.external, (record: DailyExternalLoadRecord) => record.dcc);
  const rhie = sum(report.external, (record: DailyExternalLoadRecord) => record.rhie);
  const externalMinutes = sum(report.external, (record: DailyExternalLoadRecord) => record.min);
  const gpsSessions = report.external.filter((record: DailyExternalLoadRecord) => hasValidSectionData(record.totalDistance, record.playerLoad, record.acc, record.dcc, record.rhie)).length;
  const avgMmin = avg(report.external.map((record: DailyExternalLoadRecord) => {
    const explicit = Number(record.distancePerMin);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const min = asNumber(record.min);
    return min > 0 ? asNumber(record.totalDistance) / min : 0;
  }), 1);
  const matchMinutes = sum(report.competition, (record: CompetitionRecord) => record.minutesPlayed);
  const matches = report.competition.length;
  const goals = sum(report.competition, (record: CompetitionRecord) => record.goals);
  const assists = sum(report.competition, (record: CompetitionRecord) => record.assists);
  const yellows = sum(report.competition, (record: CompetitionRecord) => record.yellowCards);
  const reds = sum(report.competition, (record: CompetitionRecord) => record.redCards);
  const maxPossibleMinutes = matches * 90;
  const latestFmsTotal = latestFms
    ? latestFms.shoulderMobility + latestFms.squat + latestFms.legRaise + latestFms.hurdleStep + latestFms.lunge + latestFms.trunkStability + latestFms.rotaryStability
    : 0;
  const cmjValue = latestCmj?.value ?? latestNeuro?.cmj ?? 0;
  const manualMedicalNotes = String(player.medicalNotes ?? '').trim();
  const medicalDetails = [player.injuryArea, player.injuryType, player.injurySeverity, player.returnDate].filter((item) => hasValidValue(item)).join(' · ');

  const csvRows = [
    { seccion: 'Ficha', jugador: player.name, categoria: categoryLabel(category), posicion: player.position, periodo_inicio: startDate, periodo_fin: endDate },
    ...report.wellness.map((record) => ({ seccion: 'Wellness', fecha: record.date, promedio: averageWellness(record) })),
    ...report.internal.map((record) => ({ seccion: 'Carga interna', fecha: record.date, duracion: record.duration, rpe: record.rpe, carga: calculateInternalLoad(record) })),
    ...report.external.map((record) => ({ seccion: 'GPS / Carga externa', fecha: record.date, minutos: record.min, distancia: record.totalDistance ?? '', player_load: record.playerLoad ?? '', hsr: record.hsr ?? record.highSpeedDistance ?? '', sprint: record.sprintDistance ?? '', acc: record.acc, dcc: record.dcc, rhie: record.rhie })),
    ...report.competition.map((record) => ({ seccion: 'Competencia', fecha: record.date, rival: record.opponent, minutos: record.minutesPlayed, goles: record.goals, asistencias: record.assists })),
    ...report.nutrition.map((record) => ({ seccion: 'Nutricion', fecha: record.date, peso: record.weight, talla: record.height, grasa: record.bodyFat, masa_muscular: record.muscleMassPercentage ?? '', imo: record.imo ?? '' })),
  ];

  const competitionRows = uniqueBy(report.competition.slice(-10).reverse(), (record) => `${record.date}-${record.matchId ?? record.opponent ?? ''}-${record.minutesPlayed ?? ''}`).map((record) => ({
    Fecha: formatPdfDate(record.date),
    Rival: record.opponent,
    Min: hasValidValue(record.minutesPlayed) ? formatMetric(record.minutesPlayed, ' min') : '',
    G: hasValidValue(record.goals) ? record.goals : '',
    A: hasValidValue(record.assists) ? record.assists : '',
    PL: formatMetric(record.playerLoad, '', 0),
    DCC: hasValidValue(record.dcc) ? record.dcc : '',
  }));

  const uniqueGpsRecords = uniqueBy(report.external.slice(-12).reverse(), (record) => `${record.date}-${record.sessionId ?? ''}-${record.movementModule ?? ''}-${record.min ?? ''}-${Math.round(record.totalDistance ?? 0)}-${Math.round(record.playerLoad ?? 0)}`);
  const gpsTone = (value: unknown, values: number[]) => {
    const num = asNumber(value);
    const clean = values.filter((item) => Number.isFinite(item) && item > 0);
    if (!num || !clean.length) return '';
    const peak = Math.max(...clean);
    const ratio = peak > 0 ? num / peak : 0;
    if (ratio >= 0.75) return 'heat-green';
    if (ratio >= 0.45) return 'heat-amber';
    return 'heat-red';
  };
  const gpsHeatValues = {
    PL: uniqueGpsRecords.map((record) => asNumber(record.playerLoad)),
    Distancia: uniqueGpsRecords.map((record) => asNumber(record.totalDistance)),
    ACC: uniqueGpsRecords.map((record) => asNumber(record.acc)),
    DCC: uniqueGpsRecords.map((record) => asNumber(record.dcc)),
    RHIE: uniqueGpsRecords.map((record) => asNumber(record.rhie)),
    Vmax: uniqueGpsRecords.map((record) => asNumber(record.maxVelocity)),
    'm/min': uniqueGpsRecords.map((record) => {
      const min = asNumber(record.min);
      return min > 0 ? asNumber(record.totalDistance) / min : asNumber(record.distancePerMin);
    }),
  };
  const gpsRows = uniqueGpsRecords.map((record) => {
    const min = asNumber(record.min);
    const mmin = min > 0 ? asNumber(record.totalDistance) / min : asNumber(record.distancePerMin);
    return {
      Fecha: formatPdfDate(record.date),
      Tipo: record.movementModule === 'competencia' ? 'Competencia' : record.sessionType ?? 'Sesión',
      Min: hasValidValue(record.min) ? formatMetric(record.min, ' min') : '',
      Distancia: formatMetric(record.totalDistance, ' m', 0),
      PL: formatMetric(record.playerLoad, '', 0),
      'm/min': formatMetric(mmin, '', 1),
      ACC: hasValidValue(record.acc) ? record.acc : '',
      DCC: hasValidValue(record.dcc) ? record.dcc : '',
      Vmax: formatMetric(record.maxVelocity, ' km/h', 1),
      RHIE: hasValidValue(record.rhie) ? record.rhie : '',
      DistanciaTone: gpsTone(record.totalDistance, gpsHeatValues.Distancia),
      PLTone: gpsTone(record.playerLoad, gpsHeatValues.PL),
      'm/minTone': gpsTone(mmin, gpsHeatValues['m/min']),
      ACCTone: gpsTone(record.acc, gpsHeatValues.ACC),
      DCCTone: gpsTone(record.dcc, gpsHeatValues.DCC),
      VmaxTone: gpsTone(record.maxVelocity, gpsHeatValues.Vmax),
      RHIETone: gpsTone(record.rhie, gpsHeatValues.RHIE),
    };
  });

  const latestEvaluationItems = [
    { label: 'Fecha valoración', value: latestNutrition?.date ? formatPdfDate(latestNutrition.date) : '' },
    { label: 'Talla', value: latestNutrition?.height, suffix: ' cm' },
    { label: 'Peso', value: latestNutrition?.weight, suffix: ' kg', decimals: 1 },
    { label: 'IMO', value: latestNutrition?.imo, decimals: 1 },
    { label: 'Sumatoria grasa', value: latestNutrition?.skinfoldSum, suffix: ' mm', decimals: 1 },
    { label: '% grasa', value: latestNutrition?.bodyFat, suffix: '%', decimals: 1 },
    { label: '% masa muscular', value: latestNutrition?.muscleMassPercentage, suffix: '%', decimals: 1 },
    { label: 'Rango % grasa', value: latestNutrition?.fatPercentageRange },
    { label: 'Plan nutricional', value: latestNutrition?.plan },
    { label: 'CMJ', value: cmjValue, suffix: ' cm', decimals: 1 },
    { label: 'SJ', value: latestNeuro?.sj, suffix: ' cm', decimals: 1 },
    { label: 'FMS total', value: latestFmsTotal, suffix: ' pts' },
  ];

  const hasEvaluation = hasValidSectionData(latestNutrition, cmjValue, latestNeuro, latestFmsTotal);
  const hasMedical = player.status !== 'Disponible' || hasValidSectionData(medicalDetails, manualMedicalNotes, player.allergies, player.chronicConditions);
  const generatedAt = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });

  const playerLoadPoints = pointSeries(report.external, (record) => record.playerLoad);
  const distancePoints = pointSeries(report.external, (record) => record.totalDistance);
  const internalPoints = report.internal.map((record) => ({ label: record.date.slice(5), value: calculateInternalLoad(record) })).filter((point) => point.value !== 0);
  const wellnessPoints = report.wellness.map((record) => ({ label: record.date.slice(5), value: averageWellness(record) })).filter((point) => point.value !== 0);
  const weightPoints = pointSeries(report.nutrition, (record) => record.weight);
  const bodyFatPoints = pointSeries(report.nutrition, (record) => record.bodyFat);
  const cmjPoints = pointSeries(report.cmj, (record) => record.value);
  const fmsPoints = report.fms.map((record) => ({ label: record.date.slice(5), value: record.shoulderMobility + record.squat + record.legRaise + record.hurdleStep + record.lunge + record.trunkStability + record.rotaryStability })).filter((point) => point.value !== 0);
  const hasEvolution = [playerLoadPoints, distancePoints, internalPoints, wellnessPoints, weightPoints, bodyFatPoints, cmjPoints, fmsPoints].some((points) => points.length >= 2);
  const hasSportMap = hasValidSectionData(matches, matchMinutes, goals, assists) || hasValidSectionData(totalDistance, playerLoad, hsr, sprint, acc, dcc, rhie);
  const hasDetails = Boolean(competitionRows.length || gpsRows.length);
  const hasGoalkeeper = player.position === 'Portero' && hasValidSectionData(
    sum(report.competition, (record) => record.goalsConceded),
    sum(report.competition, (record) => record.goalsPrevented),
    sum(report.competition, (record) => record.penaltiesSaved),
    sum(report.competition, (record) => record.crossesDefended),
    sum(report.competition, (record) => record.footworkActions),
  );

  const openPrintDossier = () => {
    if (typeof window === 'undefined' || !reportRef.current) return;
    const reportHtml = reportRef.current.outerHTML;
    const styles = Array.from(document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=900');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Reporte jugador - ${player.name}</title>${styles}<style>@page{size:A4 portrait;margin:0}html,body{margin:0!important;background:#fff!important}.scout-report-document{box-shadow:none!important;border:0!important;margin:0 auto!important}.no-print,.tnav,.sidebar,.mobile-bottom-nav{display:none!important}</style></head><body class="pdf-print-window">${reportHtml}<script>setTimeout(function(){window.focus();window.print();setTimeout(function(){window.close();},250);},650);<\/script></body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="grid report-page player-period-page">
      <AppHero
        title="Reporte jugador"
        subtitle="Informe integral por período para cuerpo técnico, federación y scouts."
        heroClass="hero-informes"
      />

      <section className="card no-print">
        <SectionHeader eyebrow="Reporte" title="Configurar informe individual" subtitle="Selecciona jugador y rango de fechas. El PDF solo imprime datos reales del período." />
        <div className="filters filters-wide">
          <label className="field"><span>Jugador</span><select className="select" value={selectedPlayerId} onChange={(event) => setFilters({ playerId: event.target.value })}>{categoryPlayers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="field"><span>Desde</span><input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label className="field"><span>Hasta</span><input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          <div className="btn-row align-end">
            <button type="button" className="btn secondary" onClick={() => downloadCsv(`reporte-jugador-${player.name.replaceAll(' ', '_')}-${startDate}-${endDate}.csv`, csvRows)}><Download size={16} /> CSV</button>
            <button type="button" className="btn" onClick={openPrintDossier}><FileText size={16} /> Exportar PDF</button>
          </div>
        </div>
        <div className="small-row">Estado Supabase: {syncStatus === 'syncing' ? 'guardando en segundo plano' : syncStatus === 'error' ? 'revisar conexión' : 'listo'}</div>
      </section>

      <article ref={reportRef} className="scout-report-document premium-dossier">
        <div className="scout-page scout-page-cover">
        <section className="scout-cover-card scout-cover-bg">
          <div className="scout-cover-top">
            <div className="scout-brand-lockup">
              <Image src="/orsomarso-crest.jpg" alt="Orsomarso SC" width={56} height={56} />
              <div><span>Orsomarso SC</span><strong>Performance Dossier</strong></div>
            </div>
            <div className="scout-period"><span>Período evaluado</span><strong>{formatPdfDate(startDate)} - {formatPdfDate(endDate)}</strong><span>{generatedAt}</span></div>
          </div>
          <div className="scout-player-hero">
            <div className="scout-player-photo"><PlayerPhoto player={player} /></div>
            <div className="scout-player-title">
              <span>Informe individual del jugador</span>
              <h1>{player.name}</h1>
              <div>
                <b>{player.position}</b>
                <b>{categoryLabel(category)}</b>
                <b>{calculateAgeSafe(player.birthDate, player.age)}</b>
                <b>{player.status}</b>
              </div>
            </div>
          </div>
          <BioStrip items={[
            { label: 'Nacimiento', value: formatBirthDateForDisplay(player.birthDate) },
            { label: 'Estatura', value: player.height, suffix: ' cm' },
            { label: 'Peso ficha', value: player.weight, suffix: ' kg' },
            { label: 'Pie dominante', value: player.dominantFoot },
          ]} />
        </section>

        <Section eyebrow="Resumen del período" title="Indicadores principales" className="scout-section-main">
          <KpiGrid items={[
            { icon: ShieldCheck, label: 'Estado', value: player.status, note: 'Disponibilidad', tone: toneForValue('status', player.status) },
            { icon: Trophy, label: 'Partidos', value: matches, note: formatMetric(matchMinutes, ' min'), tone: 'navy' },
            { icon: Activity, label: 'Carga interna', value: internalTotal, note: 'UA acumulada', tone: 'blue' },
            { icon: Zap, label: 'Player Load', value: playerLoad, note: 'GPS total', tone: 'cyan' },
            { icon: Ruler, label: 'Distancia', value: totalDistance, suffix: ' m', note: 'GPS total', tone: 'green' },
            { icon: HeartPulse, label: 'Wellness', value: wellnessAverage, note: latestWellness?.date ? `Último: ${formatPdfDate(latestWellness.date)}` : undefined, tone: toneForValue('wellness', wellnessAverage), decimals: 1 },
            { icon: Scale, label: 'Peso valoración', value: latestNutrition?.weight, suffix: ' kg', note: latestNutrition?.date ? formatPdfDate(latestNutrition.date) : undefined, tone: 'blue', decimals: 1 },
            { icon: Dumbbell, label: 'CMJ', value: cmjValue, suffix: ' cm', note: latestCmj?.date ? formatPdfDate(latestCmj.date) : latestNeuro?.date ? formatPdfDate(latestNeuro.date) : undefined, tone: 'green', decimals: 1 },
          ]} />
          <GpsAveragesGrid sessions={gpsSessions} totalDistance={totalDistance} playerLoad={playerLoad} acc={acc} dcc={dcc} rhie={rhie} />
        </Section>
        </div>

        {hasSportMap ? (
          <div className="scout-page scout-page-performance">
          <Section eyebrow="Mapa deportivo" title="Competencia y carga externa" className="scout-section-feature">
            <div className="scout-visual-grid">
              <RingCard title="Minutos jugados vs. disponibles" value={matchMinutes} maxValue={maxPossibleMinutes} suffix=" min" tone="blue" />
              <WellnessGauge value={wellnessAverage} />
              <BarsCard title="Producción competitiva" subtitle="Totales" tone="navy" items={[
                { label: 'Min', value: matchMinutes, suffix: ' min', icon: CalendarDays },
                { label: 'Goles', value: goals, icon: Trophy },
                { label: 'Asist', value: assists, icon: Activity },
                { label: 'TA', value: yellows, icon: ShieldCheck },
                { label: 'TR', value: reds, icon: ShieldCheck },
              ]} />
              <BarsCard title="GPS integrado" subtitle="Entreno + partido" tone="cyan" items={[
                { label: 'Dist', value: totalDistance, suffix: ' m', icon: Ruler },
                { label: 'PL', value: playerLoad, icon: Zap },
                { label: 'HSR', value: hsr, suffix: ' m', icon: Activity },
                { label: 'Sprint', value: sprint, suffix: ' m', icon: Activity },
                { label: 'ACC', value: acc, icon: ChevronsUp },
                { label: 'DCC', value: dcc, icon: ChevronsDown },
                { label: 'RHIE', value: rhie, icon: Activity },
              ]} />
            </div>
          </Section>
          </div>
        ) : null}

        {gpsSessions ? (
          <div className="scout-page scout-page-gps-averages">
            <Section eyebrow="GPS" title="Promedios GPS del período" className="scout-section-feature">
              <KpiGrid items={[
                { icon: Ruler, label: 'Dist/sesión', value: totalDistance / gpsSessions, suffix: ' m', note: 'prom/sesión', tone: 'blue' },
                { icon: Zap, label: 'PL/sesión', value: playerLoad / gpsSessions, note: 'prom/sesión', tone: 'cyan' },
                { icon: ChevronsUp, label: 'ACC/sesión', value: acc / gpsSessions, note: 'prom/sesión', tone: 'green' },
                { icon: ChevronsDown, label: 'DCC/sesión', value: dcc / gpsSessions, note: 'prom/sesión', tone: 'amber' },
                { icon: Activity, label: 'RHIE/sesión', value: rhie / gpsSessions, note: 'prom/sesión', tone: 'navy' },
                { icon: Gauge, label: 'm/min prom', value: avgMmin, note: 'promedio', tone: 'blue', decimals: 1 },
              ]} />
            </Section>
          </div>
        ) : null}

        {hasEvolution ? (
          <div className="scout-page scout-page-evolution">
        <Section eyebrow="Evolución" title="Gráficos del período" className="scout-section-feature">
          <div className="scout-visual-grid">
            <LineChartCard title="Player Load" points={playerLoadPoints} tone="cyan" icon={Zap} />
            <LineChartCard title="Distancia" points={distancePoints} suffix=" m" tone="green" icon={Ruler} />
            <LineChartCard title="Carga interna" points={internalPoints} suffix=" UA" tone="blue" icon={Activity} />
            <LineChartCard title="Wellness" points={wellnessPoints} decimals={1} tone="amber" icon={HeartPulse} />
            <LineChartCard title="Peso" points={weightPoints} suffix=" kg" decimals={1} tone="blue" icon={Scale} />
            <LineChartCard title="% grasa" points={bodyFatPoints} suffix="%" decimals={1} tone="red" icon={Percent} />
            <LineChartCard title="CMJ" points={cmjPoints} suffix=" cm" decimals={1} tone="green" icon={Dumbbell} />
            <LineChartCard title="FMS" points={fmsPoints} suffix=" pts" tone="navy" icon={ShieldCheck} />
          </div>
        </Section>
          </div>
        ) : null}

        {(hasEvaluation || hasMedical || hasDetails || hasGoalkeeper) ? (
          <div className="scout-page scout-page-profile">
        {(hasEvaluation || hasMedical) ? (
          <Section eyebrow="Perfil integral" title="Valoraciones, nutrición y disponibilidad">
            <div className="scout-visual-grid">
              {latestNutrition ? <PhysicalProfileCard nutrition={latestNutrition} position={player.position} /> : null}
              {latestNutrition ? <NutritionCard nutrition={latestNutrition} /> : null}
              {hasValidSectionData(cmjValue, latestNeuro?.sj, latestFmsTotal) ? (
                <BarsCard title="CMJ / FMS" subtitle="Últimos registros" tone="amber" items={[
                  { label: 'CMJ', value: cmjValue, suffix: ' cm', decimals: 1 },
                  { label: 'SJ', value: latestNeuro?.sj ?? 0, suffix: ' cm', decimals: 1 },
                  { label: 'React', value: latestNeuro?.reactiveJumps ?? 0 },
                  { label: 'FMS', value: latestFmsTotal, suffix: ' pts' },
                ]} />
              ) : null}
              {hasMedical ? (
                <div className="scout-donut-card">
                  <div className="scout-chart-head scout-chart-head-icon"><strong><HeartPulse size={16} />Área médica</strong><span>Datos manuales</span></div>
                  <BioStrip items={[
                    { label: 'Estado', value: player.status !== 'Disponible' ? player.status : '' },
                    { label: 'Detalle', value: medicalDetails },
                    { label: 'Alergias', value: player.allergies },
                    { label: 'Condiciones', value: player.chronicConditions },
                  ]} />
                  {manualMedicalNotes ? <p className="pdf-manual-note">{getPdfSafeText(manualMedicalNotes, '')}</p> : null}
                </div>
              ) : null}
            </div>
          </Section>
        ) : null}

        {hasDetails ? (
          <Section eyebrow="Detalle" title="Registros del período">
            <div className="pdf-report-two-columns compact-blocks">
              <div>
                <div className="scout-section-title scout-section-title-icon"><span>Competencia</span><h2><Trophy size={17} />Últimos partidos</h2></div>
                <CompetitionPills rows={report.competition} />
                <DataTable columns={['Fecha', 'Rival', 'Min', 'G', 'A', 'PL', 'DCC']} rows={competitionRows} />
              </div>
              <div>
                <div className="scout-section-title scout-section-title-icon"><span>Carga</span><h2><BarChart3 size={17} />GPS integrado</h2></div>
                <GpsDataTable rows={gpsRows} />
              </div>
            </div>
          </Section>
        ) : null}

        {hasGoalkeeper ? (
          <Section eyebrow="Portero" title="Indicadores específicos">
            <KpiGrid items={[
              { icon: ShieldCheck, label: 'Goles encajados', value: sum(report.competition, (record) => record.goalsConceded), tone: 'red' },
              { icon: ShieldCheck, label: 'Goles evitados', value: sum(report.competition, (record) => record.goalsPrevented), tone: 'green' },
              { icon: ShieldCheck, label: 'Penaltis atajados', value: sum(report.competition, (record) => record.penaltiesSaved), tone: 'blue' },
              { icon: ShieldCheck, label: 'Centros defendidos', value: sum(report.competition, (record) => record.crossesDefended), tone: 'cyan' },
              { icon: ShieldCheck, label: 'Juego de pies', value: sum(report.competition, (record) => record.footworkActions), tone: 'navy' },
            ]} />
          </Section>
        ) : null}
          </div>
        ) : null}

        <footer className="scout-report-footer">
          <span>Orsomarso SC - Performance</span>
          <span>{player.name} - {formatPdfDate(startDate)} / {formatPdfDate(endDate)}</span>
        </footer>
      </article>
    </div>
  );
}
