import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Bus,
  CalendarDays,
  Clock,
  ClipboardList,
  FileText,
  HeartPulse,
  Home,
  Medal,
  Shield,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  Zap,
} from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import { formatMatchScore } from '@/lib/performance-helpers';
import { CompetitionReportData, CompetitionReportPlayerRow, CompetitionReportTone } from '@/lib/competition-report';
import { ClubCategory } from '@/lib/types';
import { ReportCover } from './report-ui';

type Props = {
  report: CompetitionReportData;
  category: ClubCategory;
  className?: string;
  compact?: boolean;
};

type IconComponent = typeof Users;

const toneForResult = (result: string): CompetitionReportTone => {
  if (result === 'Victoria') return 'green';
  if (result === 'Derrota') return 'red';
  if (result === 'Empate') return 'blue';
  return 'neutral';
};

const formatDate = (date: string) => date || 'Sin fecha';
const toneClass = (tone: CompetitionReportTone = 'neutral') => `pdf-report-tone-${tone}`;

function IconBadge({ icon: Icon, tone = 'blue' }: { icon: IconComponent; tone?: CompetitionReportTone }) {
  return <span className={`pdf-report-icon ${toneClass(tone)}`}><Icon size={15} strokeWidth={2.4} /></span>;
}

function ReportBadge({ text, tone = 'neutral' }: { text: string; tone?: CompetitionReportTone }) {
  return <span className={`pdf-report-badge ${toneClass(tone)}`}>{text}</span>;
}

function ReportSection({ icon, eyebrow, title, subtitle, children }: { icon: IconComponent; eyebrow: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="pdf-report-section">
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
    <div className="pdf-report-kpi">
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

function PlayerCards({ rows }: { rows: CompetitionReportPlayerRow[] }) {
  if (!rows.length) return <EmptyReportState text="Sin registros." />;
  return (
    <div className="pdf-report-player-grid">
      {rows.map((row) => (
        <div key={row.id} className={`pdf-report-player-card ${row.medicalStatus === 'Lesionado' ? 'alert' : ''}`}>
          <div className="pdf-report-player-main">
            <strong>{row.name}</strong>
            <span>{row.position}</span>
          </div>
          <div className="pdf-report-player-badges">
            <PlayerBadge tone={row.role === 'Titular' ? 'green' : 'blue'}>{row.role}</PlayerBadge>
            <PlayerBadge tone={row.isGoalkeeper ? 'dark' : 'neutral'}>{row.isGoalkeeper ? 'Portero' : 'Campo'}</PlayerBadge>
            <PlayerBadge tone={row.medicalStatus === 'Lesionado' ? 'red' : 'green'}>{row.medicalStatus}</PlayerBadge>
          </div>
          <div className="pdf-report-player-stats">
            <span><Clock size={12} /> {row.minutes} min</span>
            <span><Zap size={12} /> {row.production}</span>
            <span><Shield size={12} /> {row.discipline}</span>
          </div>
          {row.medicalObservation ? <p>{row.medicalObservation}</p> : null}
        </div>
      ))}
    </div>
  );
}

function PlayerTable({ rows }: { rows: CompetitionReportPlayerRow[] }) {
  if (!rows.length) return <EmptyReportState text="Sin planilla." />;
  return (
    <table className="pdf-report-table competition-report-table-modern">
      <thead>
        <tr>
          <th>Jugador</th>
          <th>Posición</th>
          <th>Rol</th>
          <th>MIN</th>
          <th>Producción</th>
          <th>Disciplina</th>
          <th>Estado médico</th>
          <th>Obs.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={row.medicalStatus === 'Lesionado' ? 'pdf-report-row-alert' : undefined}>
            <td><strong>{row.name}</strong></td>
            <td>{row.position}</td>
            <td><PlayerBadge tone={row.role === 'Titular' ? 'green' : 'blue'}>{row.role}</PlayerBadge></td>
            <td>{row.minutes}</td>
            <td>{row.production}</td>
            <td>{row.discipline}</td>
            <td><PlayerBadge tone={row.medicalStatus === 'Lesionado' ? 'red' : 'green'}>{row.medicalStatus}</PlayerBadge></td>
            <td>{row.medicalObservation || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CompetitionReportTemplate({ report, category, className = '', compact = false }: Props) {
  const match = report.match;
  const resultTone = toneForResult(report.resultType);
  const VenueIcon = match.venue === 'Visitante' ? Bus : Home;
  const microcycleLabel = report.microcycle
    ? report.microcycle.startDate && report.microcycle.endDate
      ? `${report.microcycle.name} · ${report.microcycle.startDate} - ${report.microcycle.endDate}`
      : report.microcycle.name
    : 'Sin microciclo asignado';
  const compactHistory = report.recentMatches.slice(0, 4);

  return (
    <article className={`pdf-report-document competition-report-document ${compact ? 'pdf-report-compact' : ''} ${className}`}>
      {!compact ? (
        <ReportCover
          title="Informe postpartido"
          subject={`Orsomarso SC ${report.score} ${match.opponent}`}
          subtitle={`${formatDate(match.date)} · ${categoryLabel(category)} · ${match.venue ?? 'Local'}`}
          meta={[microcycleLabel, report.resultType, report.generatedAt]}
          metrics={[
            { label: 'Resultado', value: report.resultType, note: 'Marcador', tone: resultTone },
            { label: 'Jugadores', value: report.stats.players, note: 'Planilla', tone: 'blue' },
            { label: 'Goles', value: report.stats.goals, note: 'Orsomarso', tone: 'green' },
          ]}
        />
      ) : null}
      <header className="pdf-report-header">
        <div className="pdf-report-brand">
          <img src="/orsomarso-crest.jpg" alt="Orsomarso SC" />
          <div>
            <span>Orsomarso SC Performance</span>
            <h1>Informe de competencia</h1>
            <p>{categoryLabel(category)} · {report.generatedAt}</p>
          </div>
        </div>
        <div className="pdf-report-header-meta">
          <strong>{formatDate(match.date)}</strong>
          <span>{match.venue ?? 'Local'} · {microcycleLabel}</span>
        </div>
      </header>

      <section className="pdf-report-hero competition-report-hero-premium">
        <div className="pdf-report-team-block">
          <span>Equipo</span>
          <strong>Orsomarso SC</strong>
        </div>
        <div className="pdf-report-score-block">
          <span>Marcador</span>
          <strong>{report.score}</strong>
          <ReportBadge text={report.resultType} tone={resultTone} />
        </div>
        <div className="pdf-report-team-block right">
          <span>Rival</span>
          <strong>{match.opponent}</strong>
        </div>
        <div className="pdf-report-hero-meta">
          <span><CalendarDays size={13} /> {formatDate(match.date)}</span>
          <span><VenueIcon size={13} /> {match.venue ?? 'Local'}</span>
          <span><ShieldCheck size={13} /> {microcycleLabel}</span>
          <span><Users size={13} /> {categoryLabel(category)}</span>
        </div>
      </section>

      <ReportSection icon={FileText} eyebrow="Resumen" title="Resumen">
        <p className="pdf-report-summary">{report.executiveSummary}</p>
      </ReportSection>

      <ReportSection icon={Medal} eyebrow="Resumen" title="Indicadores del partido">
        <div className="pdf-report-kpi-grid competition-kpi-grid">
          <ReportKpi icon={Users} label="Jugadores" value={report.stats.players} note="Planilla" tone="blue" />
          <ReportKpi icon={Trophy} label="Titulares" value={report.stats.starters} note="Titulares" tone="green" />
          <ReportKpi icon={UserRound} label="Suplentes" value={report.stats.substitutes} note="Suplentes" tone="neutral" />
          <ReportKpi icon={Zap} label="Goles" value={report.stats.goals} note="Ataque" tone="green" />
          <ReportKpi icon={Medal} label="Asistencias" value={report.stats.assists} note="Ataque" tone="blue" />
          <ReportKpi icon={Shield} label="Porteros" value={report.stats.goalkeepers} note="Portería" tone="dark" />
          <ReportKpi icon={ShieldCheck} label="EV" value={report.stats.goalsPrevented} note="Goles evitados" tone="blue" />
          <ReportKpi icon={AlertTriangle} label="TA" value={report.stats.yellowCards} note="Amarillas" tone="amber" />
          <ReportKpi icon={AlertTriangle} label="TR" value={report.stats.redCards} note="Rojas" tone="red" />
          <ReportKpi icon={HeartPulse} label="Lesionados" value={report.stats.medical} note="Médico" tone={report.stats.medical ? 'red' : 'green'} />
          <ReportKpi icon={Shield} label="GE" value={report.stats.goalsConceded} note="Portería" tone="neutral" />
        </div>
      </ReportSection>

      <ReportSection icon={ClipboardList} eyebrow="Planilla" title="Participación individual" subtitle="Los minutos se presentan únicamente por jugador.">
        <PlayerTable rows={report.rows} />
      </ReportSection>

      <div className="pdf-report-two-columns compact-blocks">
        <ReportSection icon={Trophy} eyebrow="Titulares" title="Titulares">
          <PlayerCards rows={report.starters} />
        </ReportSection>
        <ReportSection icon={UserRound} eyebrow="Suplentes" title="Suplentes">
          <PlayerCards rows={report.substitutes} />
        </ReportSection>
      </div>

      <div className="pdf-report-two-columns compact-blocks">
        <ReportSection icon={Shield} eyebrow="Portería" title="Porteros">
          <PlayerCards rows={report.goalkeepers} />
        </ReportSection>
        <ReportSection icon={HeartPulse} eyebrow="Área médica" title="Incidencias médicas">
          {report.medicalRows.length ? <PlayerCards rows={report.medicalRows} /> : <EmptyReportState text="Sin incidencias." />}
        </ReportSection>
      </div>

      <div className="pdf-report-two-columns compact-blocks">
        <ReportSection icon={AlertTriangle} eyebrow="Disciplina" title="Disciplina">
          {report.disciplinedRows.length ? (
            <table className="pdf-report-table compact">
              <thead><tr><th>Jugador</th><th>Amarillas</th><th>Roja</th></tr></thead>
              <tbody>{report.disciplinedRows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.yellowCards}</td><td>{row.redCards}</td></tr>)}</tbody>
            </table>
          ) : <EmptyReportState text="Sin tarjetas." />}
        </ReportSection>
        <ReportSection icon={CalendarDays} eyebrow="Historial" title="Historial">
          {compactHistory.length ? (
            <table className="pdf-report-table compact">
              <thead><tr><th>Fecha</th><th>Rival</th><th>Marcador</th><th>Resultado</th></tr></thead>
              <tbody>{compactHistory.map((item) => <tr key={item.id}><td>{item.date}</td><td>{item.opponent}</td><td>{formatMatchScore(item)}</td><td>{item.resultType ?? '-'}</td></tr>)}</tbody>
            </table>
          ) : <EmptyReportState text="Sin historial." />}
        </ReportSection>
      </div>

      {match.observation?.trim() ? (
        <ReportSection icon={FileText} eyebrow="Observación" title="Observación general">
          <p className="pdf-report-summary">{match.observation}</p>
        </ReportSection>
      ) : null}

      <footer className="pdf-report-footer">
        <span>Orsomarso SC Performance</span>
        <span>{categoryLabel(category)}</span>
      </footer>
    </article>
  );
}
