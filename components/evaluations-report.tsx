import type { ReactNode } from 'react';
import Image from 'next/image';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  FileText,
  Percent,
  Ruler,
  Scale,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Zap,
} from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import { EvaluationReportData, EvaluationReportTone } from '@/lib/evaluations-report';

type Props = {
  report: EvaluationReportData;
  className?: string;
  compact?: boolean;
};

type IconComponent = typeof Activity;

const toneClass = (tone: EvaluationReportTone = 'neutral') => `pdf-report-tone-${tone}`;
const dash = (value: unknown) => (value === undefined || value === null || value === '' ? '-' : String(value));
const numberDash = (value: number | undefined, decimals = 1) => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(decimals) : '-');

function IconBadge({ icon: Icon, tone = 'blue' }: { icon: IconComponent; tone?: EvaluationReportTone }) {
  return <span className={`pdf-report-icon ${toneClass(tone)}`}><Icon size={15} strokeWidth={2.4} /></span>;
}

function ReportKpi({ icon, label, value, note, tone = 'blue' }: { icon: IconComponent; label: string; value: string | number; note?: string; tone?: EvaluationReportTone }) {
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

function EmptyReportState({ text }: { text: string }) {
  return <div className="pdf-report-empty"><AlertTriangle size={14} /> <span>{text}</span></div>;
}

function MiniHistoryTable({ rows, columns }: { rows: Array<Record<string, string | number>>; columns: { key: string; label: string }[] }) {
  if (!rows.length) return <EmptyReportState text="Sin histórico." />;
  return (
    <table className="pdf-report-table compact">
      <thead>
        <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.slice(0, 6).map((row, index) => (
          <tr key={`${row.fecha ?? index}-${index}`}>{columns.map((column) => <td key={column.key}>{dash(row[column.key])}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export function EvaluationsReportTemplate({ report, className = '', compact = false }: Props) {
  const player = report.player;
  const latestNutrition = report.latestNutrition;
  const latestNeuromuscular = report.latestNeuromuscular;
  const latestCmj = report.latestCmj;
  const latestFms = report.latestFms;
  const playerInitials = player?.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || categoryLabel(report.category).slice(0, 2).toUpperCase();
  const hasEvaluationHistory = report.nutritionHistory.length > 0 || report.cmjHistory.length > 0;

  return (
    <article className={`pdf-report-document evaluations-report-document ${compact ? 'pdf-report-compact' : ''} ${className}`}>
      <header className="pdf-report-header">
        <div className="pdf-report-brand">
          <Image src="/orsomarso-crest.jpg" alt="Orsomarso SC" width={54} height={54} />
          <div>
            <span>Orsomarso SC Performance</span>
            <h1>Informe de valoraciones</h1>
            <p>{categoryLabel(report.category)} · {report.generatedAt}</p>
          </div>
        </div>
        <div className="pdf-report-header-meta">
          <strong>{report.referenceDate}</strong>
          <span>{report.mode === 'individual' ? 'Individual' : 'Grupal'}</span>
        </div>
      </header>

      <section className="pdf-report-hero evaluations-report-hero">
        <div className="evaluation-avatar"><span>{playerInitials}</span></div>
        <div className="evaluation-hero-main">
          <span>{report.mode === 'individual' ? 'Jugador' : 'Categoría'}</span>
          <h2>{player?.name ?? categoryLabel(report.category)}</h2>
          <p>{player ? `${player.position} - ${categoryLabel(player.category ?? report.category)} - ${player.status}` : `${report.group.players} jugadores registrados - ${categoryLabel(report.category)}`}</p>
        </div>
        <div className="evaluation-hero-meta">
          <div><CalendarDays size={14} /> Corte <strong>{report.referenceDate}</strong></div>
          <div><ClipboardList size={14} /> Bloques <strong>{[report.latestNutrition, report.latestNeuromuscular, report.latestCmj, report.latestFms].filter(Boolean).length}</strong></div>
        </div>
      </section>

      <ReportSection icon={FileText} eyebrow="Resumen" title="Resumen">
        <p className="pdf-report-summary">{report.executiveSummary}</p>
      </ReportSection>

      <ReportSection icon={Activity} eyebrow="Métricas" title="Métricas">
        <div className="pdf-report-kpi-grid evaluation-kpi-grid">
          <ReportKpi icon={Scale} label="Peso" value={latestNutrition ? `${latestNutrition.weight} kg` : '-'} note={latestNutrition?.date ?? 'Sin registro'} tone="blue" />
          <ReportKpi icon={Ruler} label="Estatura" value={latestNutrition ? `${latestNutrition.height} m` : '-'} note="Antropometría" tone="dark" />
          <ReportKpi icon={Percent} label="Grasa" value={latestNutrition ? `${latestNutrition.bodyFat}%` : '-'} note="Composición" tone="amber" />
          <ReportKpi icon={Zap} label="CMJ" value={latestCmj ? `${latestCmj.value} cm` : latestNeuromuscular ? `${latestNeuromuscular.cmj} cm` : '-'} note={latestCmj?.date ?? latestNeuromuscular?.date ?? 'Sin registro'} tone="green" />
          <ReportKpi icon={Activity} label="FMS" value={latestFms ? `${latestFms.total} pts` : '-'} note="Funcional" tone="blue" />
          <ReportKpi icon={TrendingUp} label="Cobertura" value={`${report.group.nutrition}/${report.group.players}`} note="Grupo" tone="neutral" />
        </div>
      </ReportSection>

      <div className="pdf-report-two-columns">
        <ReportSection icon={Scale} eyebrow="Nutrición" title="Composición corporal">
          {latestNutrition ? (
            <div className="pdf-report-feature-grid">
              <div><span>Fecha</span><strong>{latestNutrition.date}</strong></div>
              <div><span>Peso</span><strong>{latestNutrition.weight} kg</strong></div>
              <div><span>Estatura</span><strong>{latestNutrition.height} m</strong></div>
              <div><span>% grasa</span><strong>{latestNutrition.bodyFat}%</strong></div>
              <div><span>Pliegues</span><strong>{latestNutrition.skinfoldSum}</strong></div>
              <div><span>Plan</span><strong>{latestNutrition.plan}</strong></div>
            </div>
          ) : <EmptyReportState text="Sin registros." />}
        </ReportSection>

        <ReportSection icon={Zap} eyebrow="Neuromuscular" title="Perfil neuromuscular">
          {latestNeuromuscular ? (
            <div className="pdf-report-feature-grid">
              <div><span>Fecha</span><strong>{latestNeuromuscular.date}</strong></div>
              <div><span>CMJ</span><strong>{latestNeuromuscular.cmj}</strong></div>
              <div><span>SJ</span><strong>{latestNeuromuscular.sj}</strong></div>
              <div><span>Reactivos</span><strong>{latestNeuromuscular.reactiveJumps}</strong></div>
            </div>
          ) : <EmptyReportState text="Sin registros." />}
        </ReportSection>
      </div>

      <div className="pdf-report-two-columns">
        <ReportSection icon={TrendingUp} eyebrow="CMJ" title="Salto y potencia">
          {latestCmj ? (
            <div className="pdf-report-feature-grid single">
              <div><span>Última fecha</span><strong>{latestCmj.date}</strong></div>
              <div><span>Actual</span><strong>{latestCmj.value} cm</strong></div>
              <div><span>Anterior</span><strong>{numberDash(report.previousCmj?.value)} cm</strong></div>
            </div>
          ) : <EmptyReportState text="Sin registros." />}
        </ReportSection>

        <ReportSection icon={ShieldCheck} eyebrow="FMS" title="Funcional">
          {latestFms ? (
            <div className="pdf-report-feature-grid single">
              <div><span>Última fecha</span><strong>{latestFms.date}</strong></div>
              <div><span>Total FMS</span><strong>{latestFms.total} pts</strong></div>
              <div><span>Anterior</span><strong>{dash(report.previousFms?.total)}</strong></div>
            </div>
          ) : <EmptyReportState text="Sin registros." />}
        </ReportSection>
      </div>

      <ReportSection icon={AlertTriangle} eyebrow="Recomendación" title="Recomendación">
        <div className="pdf-report-note-list">
          {report.improvementNotes.map((note) => <div key={note}><AlertTriangle size={14} /><span>{note}</span></div>)}
        </div>
      </ReportSection>

      <ReportSection icon={TrendingUp} eyebrow="Histórico" title="Histórico" >
        {hasEvaluationHistory ? (
          <div className="pdf-report-two-columns">
            <MiniHistoryTable
              rows={report.nutritionHistory.map((row) => ({ fecha: row.date, peso: `${row.weight} kg`, grasa: `${row.bodyFat}%`, pliegues: row.skinfoldSum, plan: row.plan }))}
              columns={[{ key: 'fecha', label: 'Fecha' }, { key: 'peso', label: 'Peso' }, { key: 'grasa', label: '% grasa' }, { key: 'pliegues', label: 'Pliegues' }]}
            />
            <MiniHistoryTable
              rows={report.cmjHistory.map((row) => ({ fecha: row.date, cmj: `${row.value} cm`, estado: 'Registrado' }))}
              columns={[{ key: 'fecha', label: 'Fecha' }, { key: 'cmj', label: 'CMJ' }, { key: 'estado', label: 'Estado' }]}
            />
          </div>
        ) : <EmptyReportState text="Sin histórico." />}
      </ReportSection>

      <footer className="pdf-report-footer">
        <span>Orsomarso SC Performance</span>
        <span>{categoryLabel(report.category)}</span>
      </footer>
    </article>
  );
}
