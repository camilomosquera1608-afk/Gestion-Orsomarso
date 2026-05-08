import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bus,
  CalendarDays,
  ClipboardList,
  FileText,
  Flag,
  HeartPulse,
  Home,
  Medal,
  PieChart,
  Repeat2,
  Shield,
  ShieldCheck,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import { formatMatchScore } from '@/lib/performance-helpers';
import { CompetitionReportData, CompetitionReportPlayerRow, CompetitionReportTone } from '@/lib/competition-report';
import { ClubCategory } from '@/lib/types';
import type { EyeballMatchStats } from './eyeball-importer';

type Props = {
  report: CompetitionReportData;
  category: ClubCategory;
  className?: string;
  compact?: boolean;
  eyeballStats?: EyeballMatchStats | null;
};

type IconComponent = typeof Users;
type ChartItem = { name: string; value: number; sub?: string };
type EyeballRow = { stat: string; rival: string | number; orso: string | number };

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

const findEyeballStat = (stats: EyeballMatchStats | null | undefined, names: string[]) => {
  if (!stats) return null;
  const normalized = names.map(normalizeText);
  for (const row of allEyeballRows(stats)) {
    const name = normalizeText(row.stat);
    if (normalized.some((needle) => name.includes(needle))) return row;
  }
  return null;
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

function ReportSection({ icon, eyebrow, title, subtitle, children, className = '' }: { icon: IconComponent; eyebrow: string; title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`pdf-report-section fd-report-page ${className}`}>
      <div className="pdf-report-section-heading fd-section-heading">
        <IconBadge icon={icon} tone="blue" />
        <div>
          <span>{eyebrow}</span>
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

function HorizontalBar({ item, maxValue, color, formatter }: { item: ChartItem; maxValue: number; color: string; formatter?: (value: number) => string }) {
  const width = Math.max(3, pct(item.value, maxValue));
  return (
    <div className="competition-chart-row">
      <div className="competition-chart-player">
        <strong>{truncateName(item.name)}</strong>
        {item.sub ? <span>{item.sub}</span> : null}
      </div>
      <div className="competition-chart-track"><span style={{ width: `${width}%`, background: color }} /></div>
      <strong className="competition-chart-value">{formatter ? formatter(item.value) : numberFmt(item.value)}</strong>
    </div>
  );
}

function BarPanel({ title, subtitle, items, color, formatter }: { title: string; subtitle?: string; items: ChartItem[]; color: string; formatter?: (value: number) => string }) {
  if (!items.length) return <EmptyReportState text="Sin datos suficientes para graficar." />;
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="competition-chart-panel">
      <div className="competition-chart-heading">
        <span style={{ background: color }} />
        <div><strong>{title}</strong>{subtitle ? <small>{subtitle}</small> : null}</div>
      </div>
      <div className="competition-chart-list">
        {items.map((item) => <HorizontalBar key={`${title}-${item.name}`} item={item} maxValue={maxValue} color={color} formatter={formatter} />)}
      </div>
    </div>
  );
}

function ComparisonStat({ label, orso, rival, lowerBetter = false }: { label: string; orso: string | number; rival: string | number; lowerBetter?: boolean }) {
  const o = statNumber(orso);
  const r = statNumber(rival);
  const total = Math.max(o + r, 1);
  const oWidth = pct(o, total);
  const orsoWins = o === r ? false : lowerBetter ? o < r : o > r;
  const rivalWins = o === r ? false : lowerBetter ? r < o : r > o;
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
        <thead><tr><th>Estadística</th><th>Rival</th><th>Orsomarso</th><th>Lectura</th></tr></thead>
        <tbody>
          {rows.map((row) => {
            const o = statNumber(row.orso);
            const r = statNumber(row.rival);
            const lowerBetter = isLowerBetter(row.stat);
            const advantage = o === r ? 'Equilibrado' : lowerBetter ? (o < r ? 'Ventaja Orsomarso' : 'Ventaja rival') : (o > r ? 'Ventaja Orsomarso' : 'Ventaja rival');
            return <tr key={`${row.stat}-${row.rival}-${row.orso}`}><td><strong>{row.stat}</strong></td><td>{valueText(row.rival)}</td><td>{valueText(row.orso)}</td><td>{advantage}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayerTable({ rows }: { rows: CompetitionReportPlayerRow[] }) {
  if (!rows.length) return <EmptyReportState text="Sin planilla." />;
  return (
    <table className="pdf-report-table competition-report-table-modern competition-report-heat-table fd-roster-table">
      <thead>
        <tr>
          <th>Jugador</th><th>Pos.</th><th>Rol</th><th>MIN</th><th>G/A</th><th>TA/TR</th><th>Estado médico</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={row.medicalStatus === 'Lesionado' ? 'pdf-report-row-alert' : undefined}>
            <td><strong>{row.name}</strong></td>
            <td>{row.position}</td>
            <td><PlayerBadge tone={row.role === 'Titular' ? 'green' : 'blue'}>{row.role}</PlayerBadge></td>
            <td>{row.minutes || '-'}</td>
            <td>{row.production}</td>
            <td>{row.discipline}</td>
            <td><PlayerBadge tone={row.medicalStatus === 'Lesionado' ? 'red' : 'green'}>{row.medicalStatus}</PlayerBadge></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CompetitionAnalyticsCover({ report, category, eyeballStats }: { report: CompetitionReportData; category: ClubCategory; eyeballStats?: EyeballMatchStats | null }) {
  const match = report.match;
  const resultTone = toneForResult(report.resultType);
  return (
    <section className="fd-cover pdf-report-cover">
      <div className="fd-cover-logo"><span>Orsomarso</span><strong>Analytics</strong></div>
      <div className="fd-cover-main">
        <span>Informe estadístico partido</span>
        <h1>{categoryLabel(category)}</h1>
        <p>{match.competitionName || 'Competencia'} · {formatDate(match.date)}</p>
      </div>
      <div className="fd-cover-match">
        <div><img src="/orsomarso-crest.jpg" alt="Orsomarso SC" /><strong>Orsomarso</strong></div>
        <b>VS</b>
        <div><span className="fd-rival-crest">{match.opponent.slice(0, 2).toUpperCase()}</span><strong>{match.opponent}</strong></div>
      </div>
      <div className="fd-cover-score"><strong>{report.score}</strong><ReportBadge text={report.resultType} tone={resultTone} /></div>
      <div className="fd-cover-meta">
        <span>{match.venue ?? 'Local'}</span>
        <span>{report.microcycle?.name ?? 'Sin microciclo'}</span>
        <span>{eyeballStats ? 'Eyeball integrado' : 'Eyeball pendiente'}</span>
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

function LineupPitch({ rows }: { rows: CompetitionReportPlayerRow[] }) {
  const starters = rows.filter((row) => row.role === 'Titular');
  const group = (name: string) => starters.filter((row) => positionGroup(row.position) === name).slice(0, name === 'Arquero' ? 1 : 5);
  const lines = [
    { label: 'Ataque', rows: group('Ataque') },
    { label: 'Mediocampo', rows: group('Mediocampo') },
    { label: 'Defensa', rows: group('Defensa') },
    { label: 'Arquero', rows: group('Arquero') },
  ];
  return (
    <div className="fd-pitch">
      <div className="fd-pitch-title">P-4-2-3-1</div>
      {lines.map((line) => (
        <div className="fd-pitch-line" key={line.label}>
          {line.rows.length ? line.rows.map((row) => <span key={row.id}>{truncateName(row.name)}</span>) : <span className="muted">-</span>}
        </div>
      ))}
    </div>
  );
}

function LineupSection({ report }: { report: CompetitionReportData }) {
  return (
    <ReportSection icon={Users} eyebrow="Informe partido" title="Alineación del partido" subtitle="Planilla oficial del partido con minutos, producción, disciplina y estado médico.">
      <div className="fd-lineup-grid">
        <LineupPitch rows={report.rows} />
        <PlayerTable rows={report.rows} />
      </div>
    </ReportSection>
  );
}

function EyeballKpiStrip({ stats }: { stats?: EyeballMatchStats | null }) {
  const possession = findEyeballStat(stats, ['posesiones', 'posesion']);
  const passPrecision = findEyeballStat(stats, ['precision de pases', 'precisión de pases']);
  const shots = findEyeballStat(stats, ['remates totales', 'tiros totales']);
  const shotsOnTarget = findEyeballStat(stats, ['remates a puerta', 'tiros a puerta']);
  const recoveries = findEyeballStat(stats, ['recuperaciones']);
  const turnovers = findEyeballStat(stats, ['balones perdidos', 'perdidas']);
  const xg = findEyeballStat(stats, ['xg']);
  const conversion = findEyeballStat(stats, ['conversion', 'conversión']);
  const cards = findEyeballStat(stats, ['tarjetas amarillas']);
  const rows = [
    { icon: PieChart, label: 'Posesión', value: possession?.orso ?? (stats ? `${numberFmt(stats.possession)}%` : '-'), note: 'Eyeball', tone: 'blue' as CompetitionReportTone },
    { icon: Repeat2, label: 'Precisión pases', value: passPrecision?.orso ?? (stats ? `${numberFmt(stats.passPrecision)}%` : '-'), note: 'Eficiencia', tone: 'green' as CompetitionReportTone },
    { icon: Target, label: 'Remates', value: shots?.orso ?? '-', note: shotsOnTarget ? `A puerta: ${valueText(shotsOnTarget.orso)}` : 'Ataque', tone: 'amber' as CompetitionReportTone },
    { icon: Zap, label: 'xG', value: xg?.orso ?? '-', note: 'Amenaza ofensiva', tone: 'blue' as CompetitionReportTone },
    { icon: Trophy, label: 'Conversión', value: conversion?.orso ?? (stats ? `${numberFmt(stats.conversionRate)}%` : '-'), note: 'Finalización', tone: 'green' as CompetitionReportTone },
    { icon: ShieldCheck, label: 'Recuperaciones', value: recoveries?.orso ?? '-', note: 'Fase defensiva', tone: 'dark' as CompetitionReportTone },
    { icon: AlertTriangle, label: 'Pérdidas', value: turnovers?.orso ?? '-', note: 'Control balón', tone: 'red' as CompetitionReportTone },
    { icon: Flag, label: 'Amarillas', value: cards?.orso ?? '-', note: 'Disciplina', tone: 'amber' as CompetitionReportTone },
  ];
  return <div className="pdf-report-kpi-grid competition-kpi-grid competition-kpi-grid-clean fd-stat-kpis">{rows.map((row) => <ReportKpi key={row.label} icon={row.icon} label={row.label} value={valueText(row.value)} note={row.note} tone={row.tone} />)}</div>;
}

function MatchDynamicsSection({ stats }: { stats?: EyeballMatchStats | null }) {
  if (!stats) {
    return <ReportSection icon={BarChart3} eyebrow="Informe partido" title="Dinámicas del partido"><EmptyReportState text="Importa el CSV Eyeball para construir las dinámicas del partido." /></ReportSection>;
  }
  const dynamicRows = pickEyeballRows(stats, ['posesion', 'posesiones', 'precision', 'pases', 'xg', 'remates', 'recuperaciones', 'balones perdidos', 'duelos'], 10);
  return (
    <ReportSection icon={BarChart3} eyebrow="Informe partido" title="Dinámicas del partido" subtitle="Comparativo Orsomarso vs rival construido con los indicadores disponibles del CSV Eyeball.">
      <div className="fd-score-strip">
        <div><span>{stats.rivalName}</span><strong>{stats.goalsAgainst}</strong></div>
        <b>Marcador Eyeball</b>
        <div><span>Orsomarso</span><strong>{stats.goalsFor}</strong></div>
      </div>
      <EyeballKpiStrip stats={stats} />
      <div className="eyeball-comparison-card fd-main-comparison">
        <div className="eyeball-comparison-head"><span>{stats.rivalName}</span><strong>Indicadores principales</strong><span>Orsomarso</span></div>
        {dynamicRows.map((row) => <ComparisonStat key={`${row.section}-${row.stat}`} label={row.stat} orso={row.orso} rival={row.rival} lowerBetter={isLowerBetter(row.stat)} />)}
      </div>
    </ReportSection>
  );
}

function GeneralStatsSection({ stats }: { stats?: EyeballMatchStats | null }) {
  if (!stats) return null;
  const rows = allEyeballRows(stats).slice(0, 28);
  return (
    <ReportSection icon={ClipboardList} eyebrow="Informe partido" title="Estadísticas generales" subtitle="Tabla comparativa general con las estadísticas disponibles en el archivo Eyeball.">
      <EyeballComparisonTable rows={rows} />
    </ReportSection>
  );
}

function TacticalBlock({ icon, eyebrow, title, subtitle, stats, patterns, empty }: { icon: IconComponent; eyebrow: string; title: string; subtitle?: string; stats?: EyeballMatchStats | null; patterns: string[]; empty: string }) {
  const rows = pickEyeballRows(stats, patterns, 18);
  if (!rows.length) return null;
  const chartItems = rows.slice(0, 8).map((row) => ({ name: row.stat, value: statNumber(row.orso), sub: row.section }));
  return (
    <ReportSection icon={icon} eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <div className="fd-tactical-grid">
        <BarPanel title={title} subtitle="Orsomarso" items={chartItems} color={eyebrow.includes('Defens') ? C.green : eyebrow.includes('Pases') ? C.blue : C.red} formatter={(v) => numberFmt(v, Number.isInteger(v) ? 0 : 1)} />
        <EyeballComparisonTable rows={rows} title="Comparativo" />
      </div>
      {!rows.length ? <EmptyReportState text={empty} /> : null}
    </ReportSection>
  );
}

function EyeballSectionCards({ stats }: { stats?: EyeballMatchStats | null }) {
  if (!stats) return null;
  const sectionEntries = Object.entries(stats.sections).filter(([, rows]) => rows.length);
  const important = sectionEntries.filter(([section]) => !/general|resumen/i.test(section)).slice(0, 6);
  if (!important.length) return null;
  return (
    <ReportSection icon={FileText} eyebrow="Informe partido" title="Bloques complementarios Eyeball" subtitle="Resumen por categorías del archivo CSV importado.">
      <div className="eyeball-sections-grid fd-sections-grid">
        {important.map(([section, rows]) => (
          <div key={section} className="eyeball-section-card">
            <div className="eyeball-section-title">{section}</div>
            {rows.slice(0, 7).map((row) => <ComparisonStat key={`${section}-${row.stat}`} label={row.stat} orso={row.orso} rival={row.rival} lowerBetter={isLowerBetter(row.stat)} />)}
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

function IntegratedReading({ report, eyeballStats }: { report: CompetitionReportData; eyeballStats?: EyeballMatchStats | null }) {
  const result = report.resultType;
  const passPrecision = eyeballStats ? numberFmt(eyeballStats.passPrecision) : '-';
  const possession = eyeballStats ? numberFmt(eyeballStats.possession) : '-';
  const conversion = eyeballStats ? numberFmt(eyeballStats.conversionRate) : '-';
  return (
    <ReportSection icon={ShieldCheck} eyebrow="Lectura integrada" title="Conclusión competitiva" subtitle="Síntesis ejecutiva del rendimiento post partido con base en los datos Eyeball disponibles.">
      <div className="competition-integrated-grid fd-conclusion-grid">
        <div><span>Resultado</span><strong>{result}</strong><p>Marcador oficial del partido: {report.score}.</p></div>
        <div><span>Control</span><strong>{possession}%</strong><p>Posesión registrada por Eyeball para Orsomarso.</p></div>
        <div><span>Eficiencia</span><strong>{passPrecision}%</strong><p>Precisión de pase colectiva del equipo.</p></div>
        <div><span>Finalización</span><strong>{conversion}%</strong><p>Tasa de conversión reportada en el CSV.</p></div>
        <div><span>Planilla</span><strong>{report.stats.players}</strong><p>Jugadores registrados en la competencia.</p></div>
        <div><span>Seguimiento</span><strong>{report.stats.medical ? 'Médico' : 'Normal'}</strong><p>{report.stats.medical ? `${report.stats.medical} incidencia(s) médica(s).` : 'Sin incidencias médicas registradas.'}</p></div>
      </div>
    </ReportSection>
  );
}

export function CompetitionReportTemplate({ report, category, className = '', compact = false, eyeballStats = null }: Props) {
  const match = report.match;
  const resultTone = toneForResult(report.resultType);
  const VenueIcon = match.venue === 'Visitante' ? Bus : Home;
  const microcycleLabel = report.microcycle
    ? report.microcycle.startDate && report.microcycle.endDate
      ? `${report.microcycle.name} · ${report.microcycle.startDate} - ${report.microcycle.endDate}`
      : report.microcycle.name
    : 'Sin microciclo asignado';
  const compactHistory = report.recentMatches.slice(0, 4);
  const offensivePatterns = ['xg', 'goles', 'remates', 'tiros', 'conversion', 'shot on target', 'penaltis', 'asistencias', 'palo'];
  const passingPatterns = ['posesion', 'posesiones', 'pases', 'precision', 'progresivos', 'centros', 'zona'];
  const lossesPatterns = ['balones perdidos', 'perdidas', 'pase errado', 'mal control', 'interceptado', 'fuera de juego'];
  const defensivePatterns = ['recuperaciones', 'duelos', 'anticipacion', 'despejes', 'entradas', 'bloqueados', 'faltas'];
  const setPiecePatterns = ['tiros de esquina', 'saques de banda', 'tiros libres', 'reinicios', 'centros'];

  return (
    <article className={`pdf-report-document competition-report-document competition-report-premium-v2 fd-competition-report ${compact ? 'pdf-report-compact' : ''} ${className}`}>
      {!compact ? <CompetitionAnalyticsCover report={report} category={category} eyeballStats={eyeballStats} /> : null}
      <header className="pdf-report-header competition-report-topline fd-report-topline">
        <div className="pdf-report-brand"><img src="/orsomarso-crest.jpg" alt="Orsomarso SC" /><div><span>Orsomarso SC Performance</span><h1>Informe estadístico partido</h1><p>{categoryLabel(category)} · {report.generatedAt}</p></div></div>
        <div className="pdf-report-header-meta"><strong>{formatDate(match.date)}</strong><span>{match.venue ?? 'Local'} · {microcycleLabel}</span></div>
      </header>
      <section className="pdf-report-hero competition-report-hero-premium competition-report-hero-clean fd-match-hero">
        <div className="pdf-report-team-block"><span>Equipo</span><strong>Orsomarso SC</strong></div>
        <div className="pdf-report-score-block"><span>Marcador</span><strong>{report.score}</strong><ReportBadge text={report.resultType} tone={resultTone} /></div>
        <div className="pdf-report-team-block right"><span>Rival</span><strong>{match.opponent}</strong></div>
        <div className="pdf-report-hero-meta"><span><CalendarDays size={13} /> {formatDate(match.date)}</span><span><VenueIcon size={13} /> {match.venue ?? 'Local'}</span><span><ShieldCheck size={13} /> {microcycleLabel}</span><span><Users size={13} /> {categoryLabel(category)}</span></div>
      </section>
      <ReportSection icon={FileText} eyebrow="Informe partido" title="Resumen ejecutivo"><p className="pdf-report-summary fd-summary-text">{eyeballStats ? `Informe post partido basado en datos Eyeball importados. Orsomarso SC registra ${report.score} frente a ${match.opponent}, con posesión ${numberFmt(eyeballStats.possession)}%, precisión de pases ${numberFmt(eyeballStats.passPrecision)}% y conversión ${numberFmt(eyeballStats.conversionRate)}%.` : report.executiveSummary}</p></ReportSection>
      <LineupSection report={report} />
      <MatchDynamicsSection stats={eyeballStats} />
      <GeneralStatsSection stats={eyeballStats} />
      <TacticalBlock icon={Target} eyebrow="Acciones ofensivas" title="Acciones ofensivas" subtitle="xG, remates, goles, conversión y finalización." stats={eyeballStats} patterns={offensivePatterns} empty="Sin datos ofensivos." />
      <TacticalBlock icon={Repeat2} eyebrow="Pases" title="Pases y circulación" subtitle="Posesión, precisión de pase, zonas y progresión." stats={eyeballStats} patterns={passingPatterns} empty="Sin datos de pase." />
      <TacticalBlock icon={AlertTriangle} eyebrow="Balones perdidos" title="Balones perdidos" subtitle="Pérdidas por tipo, zona o causa reportada por Eyeball." stats={eyeballStats} patterns={lossesPatterns} empty="Sin datos de pérdidas." />
      <TacticalBlock icon={ShieldCheck} eyebrow="Defensivo" title="Recuperaciones, duelos y acciones defensivas" subtitle="Comportamiento defensivo disponible en el CSV Eyeball." stats={eyeballStats} patterns={defensivePatterns} empty="Sin datos defensivos." />
      <TacticalBlock icon={Flag} eyebrow="Pelota quieta" title="Acciones de pelota quieta" subtitle="Centros, tiros libres, tiros de esquina, saques de banda y reinicios." stats={eyeballStats} patterns={setPiecePatterns} empty="Sin datos de pelota quieta." />
      <EyeballSectionCards stats={eyeballStats} />
      <IntegratedReading report={report} eyeballStats={eyeballStats} />
      <div className="pdf-report-two-columns compact-blocks competition-report-bottom-grid fd-report-bottom">
        <ReportSection icon={Shield} eyebrow="Portería" title="Porteros">{report.goalkeepers.length ? <PlayerTable rows={report.goalkeepers} /> : <EmptyReportState text="Sin registros de portería." />}</ReportSection>
        <ReportSection icon={HeartPulse} eyebrow="Área médica" title="Incidencias médicas">{report.medicalRows.length ? (<table className="pdf-report-table compact"><thead><tr><th>Jugador</th><th>Estado</th><th>Observación</th></tr></thead><tbody>{report.medicalRows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.medicalStatus}</td><td>{row.medicalObservation || '-'}</td></tr>)}</tbody></table>) : <EmptyReportState text="Sin incidencias." />}</ReportSection>
      </div>
      <div className="pdf-report-two-columns compact-blocks competition-report-bottom-grid fd-report-bottom">
        <ReportSection icon={AlertTriangle} eyebrow="Disciplina" title="Disciplina">{report.disciplinedRows.length ? (<table className="pdf-report-table compact"><thead><tr><th>Jugador</th><th>Amarillas</th><th>Roja</th></tr></thead><tbody>{report.disciplinedRows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.yellowCards}</td><td>{row.redCards}</td></tr>)}</tbody></table>) : <EmptyReportState text="Sin tarjetas." />}</ReportSection>
        <ReportSection icon={CalendarDays} eyebrow="Historial" title="Historial reciente">{compactHistory.length ? (<table className="pdf-report-table compact"><thead><tr><th>Fecha</th><th>Rival</th><th>Marcador</th><th>Resultado</th></tr></thead><tbody>{compactHistory.map((item) => <tr key={item.id}><td>{item.date}</td><td>{item.opponent}</td><td>{formatMatchScore(item)}</td><td>{item.resultType ?? '-'}</td></tr>)}</tbody></table>) : <EmptyReportState text="Sin historial." />}</ReportSection>
      </div>
      {match.observation?.trim() ? (<ReportSection icon={FileText} eyebrow="Observación" title="Observación general"><p className="pdf-report-summary">{match.observation}</p></ReportSection>) : null}
      <footer className="pdf-report-footer"><span>Orsomarso SC Performance</span><span>{categoryLabel(category)} · Informe estadístico partido</span></footer>
    </article>
  );
}
