
'use client';

import { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Download, Footprints, Gauge, HeartPulse, Printer, ShieldCheck, TrendingUp, Weight } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { EmptyState, SectionHeader } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { downloadCsv } from '@/lib/export';
import { categoryLabel } from '@/lib/labels';
import { buildPlayerPeriodReport, type PeriodReportMetricRow } from '@/lib/player-period-report';

const addDays = (date: string, days: number) => {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const formatNumber = (value: unknown, decimals = 1) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('es-CO', { maximumFractionDigits: decimals });
};

const asNumber = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 0;
};

const calcAge = (birthDate?: string) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type ReportSectionKey = 'internal' | 'external' | 'strength' | 'competition' | 'evaluations';

const SECTION_LABELS: Record<ReportSectionKey, string> = {
  internal: 'Carga interna',
  external: 'GPS / carga externa',
  strength: 'Fuerza',
  competition: 'Competencia',
  evaluations: 'Valoraciones',
};

const DEFAULT_SECTIONS: Record<ReportSectionKey, boolean> = {
  internal: true,
  external: true,
  strength: false,
  competition: false,
  evaluations: false,
};

const readSummary = (rows: PeriodReportMetricRow[], key: string) => {
  const found = rows.find((row) => String(row.indicador) === key);
  return asNumber(found?.valor);
};

const compactDate = (date: string) => {
  if (!date || date.length < 10) return date || '—';
  return `${date.slice(5, 7)}/${date.slice(8, 10)}`;
};

const toDailySeries = (rows: PeriodReportMetricRow[], valueKey: string, mode: 'sum' | 'max' | 'avg' = 'sum') => {
  const bucket = new Map<string, number[]>();
  rows.forEach((row) => {
    const date = String(row.fecha ?? '');
    const value = asNumber(row[valueKey]);
    if (!date || value <= 0) return;
    const current = bucket.get(date) ?? [];
    current.push(value);
    bucket.set(date, current);
  });
  return Array.from(bucket.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => {
      let value = values.reduce((total, item) => total + item, 0);
      if (mode === 'max') value = Math.max(...values);
      if (mode === 'avg') value = value / values.length;
      return { label: compactDate(date), value };
    });
};

const sumRows = (rows: PeriodReportMetricRow[], key: string) => rows.reduce((total, row) => total + asNumber(row[key]), 0);
const maxRows = (rows: PeriodReportMetricRow[], key: string) => rows.reduce((max, row) => Math.max(max, asNumber(row[key])), 0);

function SectionToggles({ sections, onChange }: { sections: Record<ReportSectionKey, boolean>; onChange: (key: ReportSectionKey, value: boolean) => void }) {
  return (
    <div className="player-period-selector-grid">
      {(Object.keys(SECTION_LABELS) as ReportSectionKey[]).map((key) => (
        <label key={key} className={`player-period-selector ${sections[key] ? 'active' : ''}`}>
          <input type="checkbox" checked={sections[key]} onChange={(event) => onChange(key, event.target.checked)} />
          <span>{SECTION_LABELS[key]}</span>
        </label>
      ))}
    </div>
  );
}

function ScoutKpi({ label, value, note, icon: Icon, tone = 'blue' }: { label: string; value: string | number; note?: string; icon: typeof Gauge; tone?: 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'navy' }) {
  return (
    <div className={`scout-kpi scout-kpi-${tone}`}>
      <span><Icon size={17} /></span>
      <div>
        <small>{label}</small>
        <strong>{value || '—'}</strong>
        {note ? <em>{note}</em> : null}
      </div>
    </div>
  );
}

function RingMetric({ label, value, max = 5, unit = '', tone = 'blue' }: { label: string; value: number; max?: number; unit?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }) {
  const percent = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <div className={`scout-ring scout-ring-${tone}`} style={{ ['--ring-value' as string]: `${percent}%` }}>
      <div className="scout-ring-visual"><strong>{formatNumber(value, 1)}</strong><span>{unit}</span></div>
      <small>{label}</small>
    </div>
  );
}

function HorizontalChart({ title, data, unit = '', tone = 'blue', maxItems = 6 }: { title: string; data: { label: string; value: number }[]; unit?: string; tone?: 'blue' | 'cyan' | 'green' | 'amber' | 'red'; maxItems?: number }) {
  const items = data.filter((item) => item.value > 0).slice(-maxItems);
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className={`scout-chart-card scout-chart-${tone}`}>
      <div className="scout-chart-head"><strong>{title}</strong><span>{items.length} datos</span></div>
      {items.length ? (
        <div className="scout-bars">
          {items.map((item, index) => (
            <div className="scout-bar-row" key={`${title}-${item.label}-${index}`}>
              <b>{item.label}</b>
              <i><em style={{ width: `${Math.max(4, Math.min(100, (item.value / max) * 100))}%` }} /></i>
              <strong>{formatNumber(item.value, unit === ' m' ? 0 : 1)}{unit}</strong>
            </div>
          ))}
        </div>
      ) : <p className="scout-empty">Sin datos registrados.</p>}
    </div>
  );
}

function LineChart({ title, data, unit = '', tone = 'blue' }: { title: string; data: { label: string; value: number }[]; unit?: string; tone?: 'blue' | 'cyan' | 'green' | 'amber' | 'red' }) {
  const points = data.filter((item) => item.value > 0).slice(-10);
  const max = Math.max(...points.map((item) => item.value), 1);
  const min = Math.min(...points.map((item) => item.value), 0);
  const range = Math.max(max - min, 1);
  const width = 560;
  const height = 176;
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - ((point.value - min) / range) * (height - 30) - 16;
    return { ...point, x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  return (
    <div className={`scout-chart-card scout-chart-${tone}`}>
      <div className="scout-chart-head"><strong>{title}</strong><span>{points.length} datos</span></div>
      {points.length ? (
        <>
          <svg className="scout-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
            <defs>
              <linearGradient id={`fill-${title.replace(/\W/g, '')}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <line x1="0" y1={height - 16} x2={width} y2={height - 16} />
            <line x1="0" y1="16" x2="0" y2={height - 16} />
            <path className="area" d={`${path} L ${width} ${height - 16} L 0 ${height - 16} Z`} />
            <path className="line" d={path} />
            {coords.map((point, index) => <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="4" />)}
          </svg>
          <div className="scout-chart-foot"><span>{points[0]?.label}</span><strong>{formatNumber(points.at(-1)?.value)}{unit}</strong><span>{points.at(-1)?.label}</span></div>
        </>
      ) : <p className="scout-empty">Sin datos registrados.</p>}
    </div>
  );
}

function DonutSplit({ title, items }: { title: string; items: { label: string; value: number; color: string }[] }) {
  const filtered = items.filter((item) => item.value > 0);
  const total = filtered.reduce((sum, item) => sum + item.value, 0);
  let acc = 0;
  const gradient = filtered.length
    ? filtered.map((item) => {
      const start = (acc / total) * 100;
      acc += item.value;
      const end = (acc / total) * 100;
      return `${item.color} ${start}% ${end}%`;
    }).join(', ')
    : '#e2e8f0 0% 100%';
  return (
    <div className="scout-donut-card">
      <div className="scout-chart-head"><strong>{title}</strong><span>{formatNumber(total, 0)} total</span></div>
      <div className="scout-donut-layout">
        <div className="scout-donut" style={{ background: `conic-gradient(${gradient})` }}><strong>{formatNumber(total, 0)}</strong><span>Total</span></div>
        <div className="scout-donut-legend">
          {items.map((item) => (
            <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{formatNumber(item.value, 0)}</strong></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlayerPeriodReportPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const players = data.players
    .filter((player) => activeCategory === 'all' || player.category === activeCategory)
    .sort((a, b) => a.name.localeCompare(b.name));

  const defaultPlayerId = filters.playerId !== 'all' && players.some((player) => player.id === filters.playerId)
    ? filters.playerId
    : players[0]?.id ?? '';
  const [playerId, setPlayerId] = useState(defaultPlayerId);
  const [endDate, setEndDate] = useState(filters.date);
  const [startDate, setStartDate] = useState(addDays(filters.date, -28));
  const [sections, setSections] = useState<Record<ReportSectionKey, boolean>>(DEFAULT_SECTIONS);

  const report = useMemo(() => buildPlayerPeriodReport(data, playerId, startDate, endDate), [data, playerId, startDate, endDate]);

  if (!players.length) {
    return <EmptyState title="No hay jugadores disponibles" text="Agrega jugadores al plantel para exportar reportes por periodo." />;
  }

  const safePlayerName = report?.player.name.replaceAll(' ', '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? 'jugador';
  const fileName = `reporte_jugador_${safePlayerName}_${startDate}_${endDate}.csv`;
  const playerAge = calcAge(report?.player.birthDate) ?? report?.player.age ?? null;
  const selectedCsvRows = (report?.csvRows ?? []).filter((row) => {
    const section = normalize(String(row.seccion ?? ''));
    if (section === 'ficha' || section === 'resumen') return true;
    if (section.includes('wellness')) return true;
    if (section.includes('carga interna')) return sections.internal;
    if (section.includes('gps')) return sections.external;
    if (section.includes('fuerza')) return sections.strength;
    if (section.includes('competencia')) return sections.competition;
    if (section.includes('valoraciones')) return sections.evaluations;
    return true;
  });

  const summaryRows = report?.summaryRows ?? [];
  const wellnessAvg = readSummary(summaryRows, 'Wellness promedio');
  const wellnessCount = readSummary(summaryRows, 'Registros wellness');
  const rpeAvg = readSummary(summaryRows, 'RPE promedio');
  const internalTotal = readSummary(summaryRows, 'Carga interna total UA');
  const durationTotal = readSummary(summaryRows, 'Duracion total entrenamiento min');
  const distanceTotal = readSummary(summaryRows, 'Distancia total m');
  const playerLoadTotal = readSummary(summaryRows, 'Player Load total');
  const accTotal = readSummary(summaryRows, 'ACC total');
  const dccTotal = readSummary(summaryRows, 'DCC total');
  const sprintsTotal = readSummary(summaryRows, 'Sprints total');
  const rhieTotal = readSummary(summaryRows, 'RHIE total');
  const hsrTotal = readSummary(summaryRows, 'HSR total m');
  const sprintDistanceTotal = readSummary(summaryRows, 'Sprint total m');
  const vmax = readSummary(summaryRows, 'Velocidad maxima km/h');
  const forceTotal = readSummary(summaryRows, 'Carga fuerza percibida total UA');
  const compMinutes = readSummary(summaryRows, 'Minutos competencia total');

  const internalTrend = report ? toDailySeries(report.internalRows, 'carga_interna_ua', 'sum') : [];
  const rpeTrend = report ? toDailySeries(report.internalRows, 'rpe', 'avg') : [];
  const distanceTrend = report ? toDailySeries(report.externalRows, 'distancia_m', 'sum') : [];
  const playerLoadTrend = report ? toDailySeries(report.externalRows, 'player_load', 'sum') : [];
  const strengthTrend = report ? toDailySeries(report.strengthRows, 'carga_percibida_ua', 'sum') : [];
  const competitionTrend = report ? toDailySeries(report.competitionRows, 'minutos', 'sum') : [];
  const evaluationTrend = report ? toDailySeries(report.evaluationRows, 'cmj', 'max') : [];

  return (
    <div className="grid report-page player-period-page">
      <AppHero
        title="Reporte visual por jugador"
        subtitle="Informe premium por periodo para seguimiento, convocatoria y presentación externa."
        heroClass="hero-informes"
      />

      <section className="card no-print">
        <div className="form-grid three-cols">
          <label>Jugador
            <select className="select" value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
              {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </label>
          <label>Desde
            <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>Hasta
            <input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
        <SectionHeader eyebrow="Contenido" title="Selecciona qué bloques incluir" subtitle="Competencia, fuerza y valoraciones solo aparecen si las activas." />
        <SectionToggles sections={sections} onChange={(key, value) => setSections((current) => ({ ...current, [key]: value }))} />
        <div className="btn-row mt-3">
          <button type="button" className="btn secondary" onClick={() => report && downloadCsv(fileName, selectedCsvRows)}>
            <Download size={16} /> Exportar CSV
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
      </section>

      {report ? (
        <article className="scout-report-document">
          <section className="scout-cover-card">
            <div className="scout-cover-bg" />
            <header className="scout-cover-top">
              <div className="scout-brand-lockup">
                <img src="/orsomarso-crest.jpg" alt="Orsomarso SC" />
                <div><span>Orsomarso SC</span><strong>Reporte individual</strong></div>
              </div>
              <div className="scout-period"><span>Periodo evaluado</span><strong>{startDate} · {endDate}</strong></div>
            </header>
            <div className="scout-player-hero">
              <div className="scout-player-photo"><img src={report.player.photo || '/orsomarso-crest.jpg'} alt={report.player.name} /></div>
              <div className="scout-player-title">
                <span>{report.player.category ? categoryLabel(report.player.category) : 'Sin categoría'}</span>
                <h1>{report.player.name}</h1>
                <div>
                  <b>{report.player.position}</b>
                  {report.player.secondaryPosition ? <b>Sec. {report.player.secondaryPosition}</b> : null}
                  <b>Pie {report.player.dominantFoot ?? 'sin definir'}</b>
                  {report.player.jerseyNumber ? <b>#{report.player.jerseyNumber}</b> : null}
                </div>
              </div>
            </div>
            <div className="scout-bio-strip">
              <div><span>Fecha nacimiento</span><strong>{report.player.birthDate ?? '—'}</strong></div>
              <div><span>Edad</span><strong>{playerAge ? `${playerAge} años` : '—'}</strong></div>
              <div><span>Estatura</span><strong>{report.player.height ? `${report.player.height} cm` : '—'}</strong></div>
              <div><span>Peso</span><strong>{report.player.weight ? `${report.player.weight} kg` : '—'}</strong></div>
            </div>
          </section>

          <section className="scout-section scout-section-main">
            <div className="scout-section-title">
              <span>Estado del periodo</span>
              <h2>Indicadores principales</h2>
            </div>
            <div className="scout-kpi-grid">
              <ScoutKpi icon={HeartPulse} tone="red" label="Wellness promedio" value={formatNumber(wellnessAvg)} note={`${formatNumber(wellnessCount, 0)} registros`} />
              <ScoutKpi icon={Gauge} tone="amber" label="RPE promedio" value={formatNumber(rpeAvg)} note="Entrenamientos con RPE" />
              <ScoutKpi icon={CalendarDays} tone="navy" label="Minutos entrenamiento" value={`${formatNumber(durationTotal, 0)} min`} note="Total periodo" />
              {sections.external ? <ScoutKpi icon={Footprints} tone="cyan" label="Distancia GPS" value={`${formatNumber(distanceTotal, 0)} m`} note="Total periodo" /> : null}
              {sections.external ? <ScoutKpi icon={BarChart3} tone="blue" label="Player Load" value={formatNumber(playerLoadTotal)} note="Total periodo" /> : null}
              {sections.external ? <ScoutKpi icon={TrendingUp} tone="green" label="Velocidad máxima" value={`${formatNumber(vmax)} km/h`} note="Mejor registro" /> : null}
              {sections.strength ? <ScoutKpi icon={Weight} tone="amber" label="Fuerza percibida" value={`${formatNumber(forceTotal, 0)} UA`} note="Total periodo" /> : null}
              {sections.competition ? <ScoutKpi icon={ShieldCheck} tone="green" label="Minutos competencia" value={`${formatNumber(compMinutes, 0)} min`} note="Solo partidos seleccionados" /> : null}
            </div>
          </section>

          <section className="scout-section scout-visual-grid">
            <div className="scout-section-title scout-title-wide">
              <span>Visualización del periodo</span>
              <h2>Gráficas de carga y disponibilidad</h2>
            </div>
            <RingMetric label="Wellness promedio" value={wellnessAvg} max={5} tone={wellnessAvg >= 4 ? 'green' : wellnessAvg >= 3 ? 'amber' : 'red'} />
            <RingMetric label="RPE promedio" value={rpeAvg} max={10} tone={rpeAvg <= 5 ? 'green' : rpeAvg <= 7 ? 'amber' : 'red'} />
            {sections.internal ? <LineChart title="Carga interna diaria" data={internalTrend} unit=" UA" tone="blue" /> : null}
            {sections.internal ? <HorizontalChart title="RPE por día" data={rpeTrend} tone="amber" /> : null}
            {sections.external ? <LineChart title="Distancia GPS diaria" data={distanceTrend} unit=" m" tone="cyan" /> : null}
            {sections.external ? <HorizontalChart title="Player Load diario" data={playerLoadTrend} tone="blue" /> : null}
            {sections.external ? <DonutSplit title="Carga neuromuscular" items={[{ label: 'ACC', value: accTotal, color: '#1557d6' }, { label: 'DCC', value: dccTotal, color: '#ef4444' }, { label: 'Sprints', value: sprintsTotal, color: '#f59e0b' }, { label: 'RHIE', value: rhieTotal, color: '#10b981' }]} /> : null}
            {sections.external ? <DonutSplit title="Exposición velocidad" items={[{ label: 'HSR m', value: hsrTotal, color: '#0ea5e9' }, { label: 'Sprint m', value: sprintDistanceTotal, color: '#f97316' }]} /> : null}
            {sections.strength ? <LineChart title="Fuerza percibida" data={strengthTrend} unit=" UA" tone="red" /> : null}
            {sections.competition ? <HorizontalChart title="Minutos en competencia" data={competitionTrend} unit=" min" tone="green" /> : null}
            {sections.evaluations ? <HorizontalChart title="Valoraciones CMJ" data={evaluationTrend} tone="green" /> : null}
          </section>

          <footer className="scout-report-footer">
            <span>Orsomarso SC · Departamento de rendimiento</span>
            <span>{report.player.name} · {startDate} a {endDate}</span>
          </footer>
        </article>
      ) : <EmptyState title="No se pudo generar el reporte" text="Selecciona un jugador y un rango de fechas válido." />}
    </div>
  );
}
