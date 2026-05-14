'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Download,
  Dumbbell,
  FileText,
  HeartPulse,
  Scale,
  ShieldCheck,
  Trophy,
  UserRound,
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
type BarItem = { label: string; value: number; suffix?: string; decimals?: number };
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
          const width = Math.max(4, Math.min(100, (Math.abs(item.value) / peak) * 100));
          return (
            <div className="scout-bar-row" key={item.label}>
              <b>{item.label}</b>
              <i><em style={{ width: `${width}%` }} /></i>
              <strong>{formatMetric(item.value, item.suffix ?? '', item.decimals ?? 0)}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineChartCard({ title, subtitle, points, tone = 'blue', suffix = '', decimals = 0 }: { title: string; subtitle?: string; points: ChartPoint[]; tone?: Tone; suffix?: string; decimals?: number }) {
  const clean = points.filter((point) => Number.isFinite(point.value) && point.value !== 0);
  if (clean.length < 2) return null;
  const values = clean.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = Math.max(1, maxValue - minValue);
  const width = 360;
  const height = 150;
  const x = (index: number) => 24 + (index / Math.max(1, clean.length - 1)) * (width - 48);
  const y = (value: number) => 108 - ((value - minValue) / span) * 72;
  const linePath = clean.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${x(clean.length - 1).toFixed(1)} 112 L 24 112 Z`;
  const latest = clean[clean.length - 1];
  return (
    <div className={`scout-chart-card scout-chart-${tone}`}>
      <div className="scout-chart-head"><strong>{title}</strong><span>{subtitle ?? `${clean[0].label} - ${latest.label}`}</span></div>
      <svg className="scout-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1="24" y1="112" x2="336" y2="112" />
        <line x1="24" y1="32" x2="24" y2="112" />
        <path d={areaPath} className="area" />
        <path d={linePath} className="line" />
        {clean.map((point, index) => <circle key={`${title}-${point.label}-${index}`} cx={x(index)} cy={y(point.value)} r="4" />)}
        <text x="24" y="136" fill="#64748b" fontSize="10" fontWeight="800">{clean[0].label}</text>
        <text x="336" y="136" fill="#64748b" fontSize="10" fontWeight="800" textAnchor="end">{latest.label}</text>
      </svg>
      <div className="scout-chart-foot">
        <span>Último registro</span>
        <strong>{formatMetric(latest.value, suffix, decimals)}</strong>
      </div>
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

function DataTable({ columns, rows }: { columns: string[]; rows: Array<Record<string, unknown>> }) {
  const cleanRows = rows.filter((row) => Object.values(row).some((value) => hasValidValue(value)));
  if (!cleanRows.length) return null;
  return (
    <div className="fd-table-wrap">
      <table className="pdf-report-table compact scout-table">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {cleanRows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column}>{hasValidValue(row[column]) ? String(row[column]) : ''}</td>)}
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

  const competitionRows = report.competition.slice(-8).reverse().map((record) => ({
    Fecha: formatPdfDate(record.date),
    Rival: record.opponent,
    Min: hasValidValue(record.minutesPlayed) ? formatMetric(record.minutesPlayed, ' min') : '',
    G: hasValidValue(record.goals) ? record.goals : '',
    A: hasValidValue(record.assists) ? record.assists : '',
    PL: formatMetric(record.playerLoad, '', 0),
    DCC: hasValidValue(record.dcc) ? record.dcc : '',
  }));

  const gpsRows = report.external.slice(-8).reverse().map((record) => ({
    Fecha: formatPdfDate(record.date),
    Tipo: record.movementModule === 'competencia' ? 'Competencia' : record.sessionType ?? 'Sesión',
    Min: hasValidValue(record.min) ? formatMetric(record.min, ' min') : '',
    Distancia: formatMetric(record.totalDistance, ' m', 0),
    PL: formatMetric(record.playerLoad, '', 0),
    HSR: formatMetric(record.hsr ?? record.highSpeedDistance, ' m', 0),
    Sprint: formatMetric(record.sprintDistance, ' m', 0),
    RHIE: hasValidValue(record.rhie) ? record.rhie : '',
  }));

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
  const generatedAt = new Date().toLocaleString('es-CO');

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
            <button type="button" className="btn" onClick={() => window.print()}><FileText size={16} /> Exportar PDF</button>
          </div>
        </div>
        <div className="small-row">Estado Supabase: {syncStatus === 'syncing' ? 'guardando en segundo plano' : syncStatus === 'error' ? 'revisar conexión' : 'listo'}</div>
      </section>

      <article className="scout-report-document">
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
            { icon: ShieldCheck, label: 'Estado', value: player.status, note: 'Disponibilidad', tone: player.status === 'Disponible' ? 'green' : 'amber' },
            { icon: Trophy, label: 'Partidos', value: matches, note: formatMetric(matchMinutes, ' min'), tone: 'navy' },
            { icon: Activity, label: 'Carga interna', value: internalTotal, note: 'UA acumulada', tone: 'blue' },
            { icon: Zap, label: 'Player Load', value: playerLoad, note: 'GPS total', tone: 'cyan' },
            { icon: BarChart3, label: 'Distancia', value: totalDistance, suffix: ' m', note: 'GPS total', tone: 'green' },
            { icon: HeartPulse, label: 'Wellness', value: wellnessAverage, note: latestWellness?.date ? `Último: ${formatPdfDate(latestWellness.date)}` : undefined, tone: 'amber', decimals: 1 },
            { icon: Scale, label: 'Peso valoración', value: latestNutrition?.weight, suffix: ' kg', note: latestNutrition?.date ? formatPdfDate(latestNutrition.date) : undefined, tone: 'blue', decimals: 1 },
            { icon: Dumbbell, label: 'CMJ', value: cmjValue, suffix: ' cm', note: latestCmj?.date ? formatPdfDate(latestCmj.date) : latestNeuro?.date ? formatPdfDate(latestNeuro.date) : undefined, tone: 'green', decimals: 1 },
          ]} />
        </Section>

        {(hasValidSectionData(matches, matchMinutes, goals, assists) || hasValidSectionData(totalDistance, playerLoad, hsr, sprint, acc, dcc, rhie)) ? (
          <Section eyebrow="Mapa deportivo" title="Competencia y carga externa">
            <div className="scout-visual-grid">
              <RingCard title="Minutos jugados vs. disponibles" value={matchMinutes} maxValue={maxPossibleMinutes} suffix=" min" tone="blue" />
              <RingCard title="Wellness promedio / 5" value={wellnessAverage} maxValue={5} tone="green" decimals={1} />
              <BarsCard title="Producción competitiva" subtitle="Totales" tone="navy" items={[
                { label: 'Min', value: matchMinutes, suffix: ' min' },
                { label: 'Goles', value: goals },
                { label: 'Asist', value: assists },
                { label: 'TA', value: yellows },
                { label: 'TR', value: reds },
              ]} />
              <BarsCard title="GPS integrado" subtitle="Entreno + partido" tone="cyan" items={[
                { label: 'Dist', value: totalDistance, suffix: ' m' },
                { label: 'PL', value: playerLoad },
                { label: 'HSR', value: hsr, suffix: ' m' },
                { label: 'Sprint', value: sprint, suffix: ' m' },
                { label: 'ACC', value: acc },
                { label: 'DCC', value: dcc },
                { label: 'RHIE', value: rhie },
              ]} />
            </div>
          </Section>
        ) : null}

        <Section eyebrow="Evolución" title="Gráficos del período">
          <div className="scout-visual-grid">
            <LineChartCard title="Player Load" points={pointSeries(report.external, (record) => record.playerLoad)} tone="cyan" />
            <LineChartCard title="Distancia" points={pointSeries(report.external, (record) => record.totalDistance)} suffix=" m" tone="green" />
            <LineChartCard title="Carga interna" points={report.internal.map((record) => ({ label: record.date.slice(5), value: calculateInternalLoad(record) })).filter((point) => point.value !== 0)} suffix=" UA" tone="blue" />
            <LineChartCard title="Wellness" points={report.wellness.map((record) => ({ label: record.date.slice(5), value: averageWellness(record) })).filter((point) => point.value !== 0)} decimals={1} tone="amber" />
            <LineChartCard title="Peso" points={pointSeries(report.nutrition, (record) => record.weight)} suffix=" kg" decimals={1} tone="blue" />
            <LineChartCard title="% grasa" points={pointSeries(report.nutrition, (record) => record.bodyFat)} suffix="%" decimals={1} tone="red" />
            <LineChartCard title="CMJ" points={pointSeries(report.cmj, (record) => record.value)} suffix=" cm" decimals={1} tone="green" />
            <LineChartCard title="FMS" points={report.fms.map((record) => ({ label: record.date.slice(5), value: record.shoulderMobility + record.squat + record.legRaise + record.hurdleStep + record.lunge + record.trunkStability + record.rotaryStability })).filter((point) => point.value !== 0)} suffix=" pts" tone="navy" />
          </div>
        </Section>

        {(hasEvaluation || hasMedical) ? (
          <Section eyebrow="Perfil integral" title="Valoraciones, nutrición y disponibilidad">
            <div className="scout-visual-grid">
              {hasEvaluation ? <BarsCard title="Última valoración" subtitle={latestNutrition?.date ? formatPdfDate(latestNutrition.date) : 'Registros'} tone="green" items={latestEvaluationItems.map((item) => ({ label: item.label, value: typeof item.value === 'number' ? item.value : Number.NaN, suffix: item.suffix, decimals: item.decimals }))} /> : null}
              {latestNutrition ? (
                <div className="scout-donut-card">
                  <div className="scout-chart-head"><strong>Nutrición</strong><span>{formatPdfDate(latestNutrition.date)}</span></div>
                  <BioStrip items={latestEvaluationItems.filter((item) => typeof item.value !== 'number')} />
                  {hasValidValue(latestNutrition.diagnosis) ? <p className="pdf-manual-note">{getPdfSafeText(latestNutrition.diagnosis, '')}</p> : null}
                </div>
              ) : null}
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
                  <div className="scout-chart-head"><strong>Área médica</strong><span>Datos manuales</span></div>
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

        {(competitionRows.length || gpsRows.length) ? (
          <Section eyebrow="Detalle" title="Registros del período">
            <div className="pdf-report-two-columns compact-blocks">
              <div>
                <div className="scout-section-title"><span>Competencia</span><h2>Últimos partidos</h2></div>
                <DataTable columns={['Fecha', 'Rival', 'Min', 'G', 'A', 'PL', 'DCC']} rows={competitionRows} />
              </div>
              <div>
                <div className="scout-section-title"><span>Carga</span><h2>GPS integrado</h2></div>
                <DataTable columns={['Fecha', 'Tipo', 'Min', 'Distancia', 'PL', 'HSR', 'Sprint', 'RHIE']} rows={gpsRows} />
              </div>
            </div>
          </Section>
        ) : null}

        {player.position === 'Portero' && hasValidSectionData(
          sum(report.competition, (record) => record.goalsConceded),
          sum(report.competition, (record) => record.goalsPrevented),
          sum(report.competition, (record) => record.penaltiesSaved),
          sum(report.competition, (record) => record.crossesDefended),
          sum(report.competition, (record) => record.footworkActions),
        ) ? (
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

        <footer className="scout-report-footer">
          <span>Orsomarso SC - Performance</span>
          <span>{player.name} - {formatPdfDate(startDate)} / {formatPdfDate(endDate)}</span>
        </footer>
      </article>
    </div>
  );
}
