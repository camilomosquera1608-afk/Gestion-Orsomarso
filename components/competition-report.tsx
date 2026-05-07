import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bus,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartPulse,
  Home,
  Medal,
  Shield,
  ShieldCheck,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import { formatMatchScore } from '@/lib/performance-helpers';
import { CompetitionReportData, CompetitionReportPlayerRow, CompetitionReportTone } from '@/lib/competition-report';
import { ClubCategory } from '@/lib/types';
import { ReportCover } from './report-ui';
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

const C = {
  blue: '#1557d6', blueDark: '#173b85', red: '#c1121f', green: '#059669', amber: '#d97706',
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
const truncateName = (name: string) => {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[1]?.[0] ?? ''}. ${parts[2] ?? ''}`.trim();
};

function IconBadge({ icon: Icon, tone = 'blue' }: { icon: IconComponent; tone?: CompetitionReportTone }) {
  return <span className={`pdf-report-icon ${toneClass(tone)}`}><Icon size={15} strokeWidth={2.4} /></span>;
}

function ReportBadge({ text, tone = 'neutral' }: { text: string; tone?: CompetitionReportTone }) {
  return <span className={`pdf-report-badge ${toneClass(tone)}`}>{text}</span>;
}

function ReportSection({ icon, eyebrow, title, subtitle, children, className = '' }: { icon: IconComponent; eyebrow: string; title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`pdf-report-section ${className}`}>
      <div className="pdf-report-section-heading">
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

function ReportKpi({ icon, label, value, note, tone = 'blue' }: { icon: IconComponent; label: string; value: string | number; note?: string; tone?: CompetitionReportTone }) {
  return (
    <div className="pdf-report-kpi competition-report-kpi-clean">
      <IconBadge icon={icon} tone={tone} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note ? <small>{note}</small> : null}
      </div>
    </div>
  );
}

function EmptyReportState({ text }: { text: string }) {
  return <div className="pdf-report-empty"><AlertTriangle size={14} /> <span>{text}</span></div>;
}

function PlayerBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: CompetitionReportTone }) {
  return <span className={`pdf-report-small-badge ${toneClass(tone)}`}>{children}</span>;
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

function PlayerTable({ rows }: { rows: CompetitionReportPlayerRow[] }) {
  if (!rows.length) return <EmptyReportState text="Sin planilla." />;
  return (
    <table className="pdf-report-table competition-report-table-modern competition-report-heat-table">
      <thead>
        <tr>
          <th>Jugador</th><th>Pos.</th><th>Rol</th><th>MIN</th><th>Dist.</th><th>m/min</th><th>HSR</th><th>Spr. dist.</th><th>ACC</th><th>DCC</th><th>Spr.</th><th>PL</th><th>Vmax</th><th>G/A</th><th>TA/TR</th><th>Médico</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={row.medicalStatus === 'Lesionado' ? 'pdf-report-row-alert' : undefined}>
            <td><strong>{row.name}</strong></td>
            <td>{row.position}</td>
            <td><PlayerBadge tone={row.role === 'Titular' ? 'green' : 'blue'}>{row.role}</PlayerBadge></td>
            <td>{row.minutes || '-'}</td>
            <td>{row.totalDistance ? numberFmt(row.totalDistance) : '-'}</td>
            <td>{row.metersPerMinute || '-'}</td>
            <td>{row.highSpeedDistance ? numberFmt(row.highSpeedDistance) : '-'}</td>
            <td>{row.sprintDistance ? numberFmt(row.sprintDistance) : '-'}</td>
            <td>{row.acc || '-'}</td>
            <td>{row.dcc || '-'}</td>
            <td>{row.sprints || '-'}</td>
            <td>{row.playerLoad ? numberFmt(row.playerLoad) : '-'}</td>
            <td>{row.maxVelocity ? numberFmt(row.maxVelocity, 1) : '-'}</td>
            <td>{row.production}</td>
            <td>{row.discipline}</td>
            <td><PlayerBadge tone={row.medicalStatus === 'Lesionado' ? 'red' : 'green'}>{row.medicalStatus}</PlayerBadge></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const statNumber = (value: string | number | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(String(value).replace('%', '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const findEyeballStat = (stats: EyeballMatchStats, names: string[]) => {
  const normalized = names.map((name) => name.toLowerCase());
  for (const rows of Object.values(stats.sections)) {
    const found = rows.find((row) => normalized.some((needle) => row.stat.toLowerCase().includes(needle)));
    if (found) return found;
  }
  return null;
};

function ComparisonStat({ label, orso, rival, lowerBetter = false }: { label: string; orso: string | number; rival: string | number; lowerBetter?: boolean }) {
  const o = statNumber(orso);
  const r = statNumber(rival);
  const total = Math.max(o + r, 1);
  const oWidth = pct(o, total);
  const orsoWins = o === r ? false : lowerBetter ? o < r : o > r;
  const rivalWins = o === r ? false : lowerBetter ? r < o : r > o;
  return (
    <div className="eyeball-comparison-row">
      <strong className={rivalWins ? 'winner' : ''}>{typeof rival === 'number' ? numberFmt(rival, Number.isInteger(rival) ? 0 : 1) : rival}</strong>
      <div>
        <span>{label}</span>
        <div className="eyeball-comparison-track"><i style={{ width: `${100 - oWidth}%` }} className={rivalWins ? 'active-rival' : ''} /><b style={{ width: `${oWidth}%` }} className={orsoWins ? 'active-orso' : ''} /></div>
      </div>
      <strong className={orsoWins ? 'winner' : ''}>{typeof orso === 'number' ? numberFmt(orso, Number.isInteger(orso) ? 0 : 1) : orso}</strong>
    </div>
  );
}

function EyeballReportBlock({ stats }: { stats?: EyeballMatchStats | null }) {
  if (!stats) {
    return (
      <ReportSection icon={FileText} eyebrow="Eyeball" title="Análisis táctico Eyeball" subtitle="Importa el CSV Eyeball para integrar el componente táctico al PDF.">
        <EmptyReportState text="Sin CSV Eyeball cargado para este partido." />
      </ReportSection>
    );
  }
  const possession = findEyeballStat(stats, ['posesión', 'posesiones']);
  const passPrecision = findEyeballStat(stats, ['precisión de pases', 'precision de pases']);
  const conversion = findEyeballStat(stats, ['conversión', 'conversion']);
  const shots = findEyeballStat(stats, ['tiros totales', 'remates', 'tiros']);
  const shotsOnTarget = findEyeballStat(stats, ['tiros a puerta', 'remates a puerta']);
  const duels = findEyeballStat(stats, ['duelos', 'duelos ganados']);
  const usefulRows = [possession, passPrecision, conversion, shots, shotsOnTarget, duels].filter(Boolean) as NonNullable<ReturnType<typeof findEyeballStat>>[];
  const sectionEntries = Object.entries(stats.sections).filter(([, rows]) => rows.length).slice(0, 4);

  return (
    <ReportSection icon={BarChart3} eyebrow="Eyeball" title="Análisis táctico comparativo" subtitle="Datos integrados desde el CSV Eyeball del partido.">
      <div className="eyeball-premium-hero">
        <div><span>Rival</span><strong>{stats.rivalName}</strong></div>
        <div className="eyeball-score-card"><small>Marcador Eyeball</small><strong>{stats.goalsAgainst} - {stats.goalsFor}</strong></div>
        <div className="right"><span>Orsomarso SC</span><strong>{stats.orsomarso}</strong></div>
      </div>
      <div className="eyeball-kpi-strip">
        <div><span>Posesión</span><strong>{numberFmt(stats.possession)}%</strong><small>control de balón</small></div>
        <div><span>Precisión pase</span><strong>{numberFmt(stats.passPrecision)}%</strong><small>eficiencia colectiva</small></div>
        <div><span>Conversión</span><strong>{numberFmt(stats.conversionRate)}%</strong><small>finalización</small></div>
      </div>
      {usefulRows.length ? (
        <div className="eyeball-comparison-card">
          <div className="eyeball-comparison-head"><span>{stats.rivalName}</span><strong>Indicadores clave</strong><span>Orsomarso</span></div>
          {usefulRows.map((row) => <ComparisonStat key={row.stat} label={row.stat} orso={row.orso} rival={row.rival} lowerBetter={/faltas|errores|fuera/i.test(row.stat)} />)}
        </div>
      ) : null}
      <div className="eyeball-sections-grid">
        {sectionEntries.map(([section, rows]) => (
          <div key={section} className="eyeball-section-card">
            <div className="eyeball-section-title">{section}</div>
            {rows.slice(0, 6).map((row) => <ComparisonStat key={`${section}-${row.stat}`} label={row.stat} orso={row.orso} rival={row.rival} lowerBetter={/faltas|errores|fuera/i.test(row.stat)} />)}
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

function IntegratedReading({ report, eyeballStats }: { report: CompetitionReportData; eyeballStats?: EyeballMatchStats | null }) {
  const fieldCount = Math.max(1, report.rows.filter((row) => !row.isGoalkeeper).length);
  const avgDistance = report.stats.totalDistance / fieldCount;
  const intensity = report.stats.avgMetersPerMinute >= 90 ? 'Alta' : report.stats.avgMetersPerMinute >= 75 ? 'Media' : 'Controlada';
  const tacticalNote = eyeballStats ? `Posesión ${numberFmt(eyeballStats.possession)}%, precisión de pase ${numberFmt(eyeballStats.passPrecision)}% y conversión ${numberFmt(eyeballStats.conversionRate)}%.` : 'Sin CSV Eyeball integrado.';
  return (
    <ReportSection icon={ShieldCheck} eyebrow="Lectura integrada" title="GPS + Eyeball" subtitle="Cruce físico-táctico del rendimiento del partido.">
      <div className="competition-integrated-grid">
        <div><span>Volumen físico</span><strong>{numberFmt(avgDistance)} m/jugador</strong><p>Distancia promedio de jugadores de campo.</p></div>
        <div><span>Intensidad</span><strong>{intensity}</strong><p>{report.stats.avgMetersPerMinute || '-'} m/min promedio de campo.</p></div>
        <div><span>Respuesta táctica</span><strong>{eyeballStats ? 'Integrada' : 'Pendiente'}</strong><p>{tacticalNote}</p></div>
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
  const fieldRows = report.rows.filter((row) => !row.isGoalkeeper);
  const byDistance = [...fieldRows].filter((row) => row.totalDistance > 0).sort((a, b) => b.totalDistance - a.totalDistance).slice(0, 10).map((row) => ({ name: row.name, value: row.totalDistance, sub: `${row.minutes || 0} min` }));
  const byHsr = [...fieldRows].filter((row) => row.highSpeedDistance > 0).sort((a, b) => b.highSpeedDistance - a.highSpeedDistance).slice(0, 10).map((row) => ({ name: row.name, value: row.highSpeedDistance, sub: `${row.metersPerMinute || 0} m/min` }));
  const bySprint = [...fieldRows].filter((row) => row.sprintDistance > 0).sort((a, b) => b.sprintDistance - a.sprintDistance).slice(0, 10).map((row) => ({ name: row.name, value: row.sprintDistance, sub: `${row.sprints || 0} sprints` }));
  const byVmax = [...fieldRows].filter((row) => row.maxVelocity > 0).sort((a, b) => b.maxVelocity - a.maxVelocity).slice(0, 10).map((row) => ({ name: row.name, value: row.maxVelocity, sub: `${row.totalDistance ? numberFmt(row.totalDistance) : 0} m` }));

  return (
    <article className={`pdf-report-document competition-report-document competition-report-premium-v2 ${compact ? 'pdf-report-compact' : ''} ${className}`}>
      {!compact ? (
        <ReportCover
          title="Informe postpartido"
          subject={`Orsomarso SC ${report.score} ${match.opponent}`}
          subtitle={`${formatDate(match.date)} · ${categoryLabel(category)} · ${match.venue ?? 'Local'}`}
          meta={[microcycleLabel, report.resultType, report.generatedAt]}
          metrics={[
            { label: 'Resultado', value: report.resultType, note: 'Marcador', tone: resultTone },
            { label: 'Jugadores', value: report.stats.players, note: 'Planilla', tone: 'blue' },
            { label: 'Distancia', value: `${numberFmt(report.stats.totalDistance)} m`, note: 'GPS campo', tone: 'dark' },
            { label: 'Eyeball', value: eyeballStats ? 'Integrado' : 'Pendiente', note: 'CSV táctico', tone: eyeballStats ? 'green' : 'amber' },
          ]}
        />
      ) : null}
      <header className="pdf-report-header competition-report-topline">
        <div className="pdf-report-brand"><img src="/orsomarso-crest.jpg" alt="Orsomarso SC" /><div><span>Orsomarso SC Performance</span><h1>Informe de competencia</h1><p>{categoryLabel(category)} · {report.generatedAt}</p></div></div>
        <div className="pdf-report-header-meta"><strong>{formatDate(match.date)}</strong><span>{match.venue ?? 'Local'} · {microcycleLabel}</span></div>
      </header>
      <section className="pdf-report-hero competition-report-hero-premium competition-report-hero-clean">
        <div className="pdf-report-team-block"><span>Equipo</span><strong>Orsomarso SC</strong></div>
        <div className="pdf-report-score-block"><span>Marcador</span><strong>{report.score}</strong><ReportBadge text={report.resultType} tone={resultTone} /></div>
        <div className="pdf-report-team-block right"><span>Rival</span><strong>{match.opponent}</strong></div>
        <div className="pdf-report-hero-meta"><span><CalendarDays size={13} /> {formatDate(match.date)}</span><span><VenueIcon size={13} /> {match.venue ?? 'Local'}</span><span><ShieldCheck size={13} /> {microcycleLabel}</span><span><Users size={13} /> {categoryLabel(category)}</span></div>
      </section>
      <ReportSection icon={FileText} eyebrow="Resumen" title="Resumen ejecutivo"><p className="pdf-report-summary">{report.executiveSummary}</p></ReportSection>
      <ReportSection icon={Medal} eyebrow="Resumen" title="Indicadores generales del partido">
        <div className="pdf-report-kpi-grid competition-kpi-grid competition-kpi-grid-clean">
          <ReportKpi icon={Users} label="Jugadores" value={report.stats.players} note="Planilla" tone="blue" />
          <ReportKpi icon={Zap} label="Goles" value={report.stats.goals} note="Ataque" tone="green" />
          <ReportKpi icon={Medal} label="Asistencias" value={report.stats.assists} note="Ataque" tone="blue" />
          <ReportKpi icon={Shield} label="Porteros" value={report.stats.goalkeepers} note="Portería" tone="dark" />
          <ReportKpi icon={Zap} label="Distancia" value={`${numberFmt(report.stats.totalDistance)} m`} note="GPS total" tone="dark" />
          <ReportKpi icon={Zap} label="m/min" value={report.stats.avgMetersPerMinute || '-'} note="Promedio campo" tone="blue" />
          <ReportKpi icon={Zap} label="HSR" value={`${numberFmt(report.stats.highSpeedDistance)} m`} note="Alta velocidad" tone="amber" />
          <ReportKpi icon={Zap} label="Sprint dist." value={`${numberFmt(report.stats.sprintDistance)} m`} note="Sprint distance" tone="red" />
          <ReportKpi icon={Zap} label="ACC/DCC" value={`${report.stats.acc}/${report.stats.dcc}`} note=">3 m/s2" tone="amber" />
          <ReportKpi icon={Zap} label="Player Load" value={numberFmt(report.stats.playerLoad)} note="Carga externa" tone="blue" />
          <ReportKpi icon={Zap} label="Vmax" value={report.stats.maxVelocity ? `${numberFmt(report.stats.maxVelocity, 1)} km/h` : '-'} note="Máxima" tone="green" />
          <ReportKpi icon={HeartPulse} label="Médico" value={report.stats.medical} note="Incidencias" tone={report.stats.medical ? 'red' : 'green'} />
        </div>
      </ReportSection>
      <ReportSection icon={BarChart3} eyebrow="GPS" title="Distribución individual GPS" subtitle="Gráficas tipo informe de sesión: volumen, alta velocidad, sprint e intensidad máxima.">
        <div className="competition-chart-grid">
          <BarPanel title="Distancia total" subtitle="m" items={byDistance} color={C.blueDark} formatter={(v) => numberFmt(v)} />
          <BarPanel title="HSR" subtitle="m alta velocidad" items={byHsr} color={C.amber} formatter={(v) => numberFmt(v)} />
          <BarPanel title="Sprint distance" subtitle="m sprint" items={bySprint} color={C.red} formatter={(v) => numberFmt(v)} />
          <BarPanel title="Velocidad máxima" subtitle="km/h" items={byVmax} color={C.green} formatter={(v) => numberFmt(v, 1)} />
        </div>
      </ReportSection>
      <EyeballReportBlock stats={eyeballStats} />
      <IntegratedReading report={report} eyeballStats={eyeballStats} />
      <ReportSection icon={ClipboardList} eyebrow="Planilla" title="Tabla descriptiva GPS + planilla" subtitle="Valores físicos, producción ofensiva, disciplina e incidencias médicas."><PlayerTable rows={report.rows} /></ReportSection>
      <div className="pdf-report-two-columns compact-blocks competition-report-bottom-grid">
        <ReportSection icon={Shield} eyebrow="Portería" title="Porteros">{report.goalkeepers.length ? <PlayerTable rows={report.goalkeepers} /> : <EmptyReportState text="Sin registros de portería." />}</ReportSection>
        <ReportSection icon={HeartPulse} eyebrow="Área médica" title="Incidencias médicas">{report.medicalRows.length ? (<table className="pdf-report-table compact"><thead><tr><th>Jugador</th><th>Estado</th><th>Observación</th></tr></thead><tbody>{report.medicalRows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.medicalStatus}</td><td>{row.medicalObservation || '-'}</td></tr>)}</tbody></table>) : <EmptyReportState text="Sin incidencias." />}</ReportSection>
      </div>
      <div className="pdf-report-two-columns compact-blocks competition-report-bottom-grid">
        <ReportSection icon={AlertTriangle} eyebrow="Disciplina" title="Disciplina">{report.disciplinedRows.length ? (<table className="pdf-report-table compact"><thead><tr><th>Jugador</th><th>Amarillas</th><th>Roja</th></tr></thead><tbody>{report.disciplinedRows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.yellowCards}</td><td>{row.redCards}</td></tr>)}</tbody></table>) : <EmptyReportState text="Sin tarjetas." />}</ReportSection>
        <ReportSection icon={CalendarDays} eyebrow="Historial" title="Historial reciente">{compactHistory.length ? (<table className="pdf-report-table compact"><thead><tr><th>Fecha</th><th>Rival</th><th>Marcador</th><th>Resultado</th></tr></thead><tbody>{compactHistory.map((item) => <tr key={item.id}><td>{item.date}</td><td>{item.opponent}</td><td>{formatMatchScore(item)}</td><td>{item.resultType ?? '-'}</td></tr>)}</tbody></table>) : <EmptyReportState text="Sin historial." />}</ReportSection>
      </div>
      {match.observation?.trim() ? (<ReportSection icon={FileText} eyebrow="Observación" title="Observación general"><p className="pdf-report-summary">{match.observation}</p></ReportSection>) : null}
      <footer className="pdf-report-footer"><span>Orsomarso SC Performance</span><span>{categoryLabel(category)} · Informe de competencia</span></footer>
    </article>
  );
}
