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
import { FAT_PERCENTAGE_RANGES, formatNutritionText, formatNutritionValue, getNutritionPlanLabel, getNutritionRangeLabel, normalizeNutritionRecord } from '@/lib/nutrition';
import { EvaluationReportData, EvaluationReportTone } from '@/lib/evaluations-report';
import { PdfEvolutionChart, ReportCover } from './report-ui';

type Props = {
  report: EvaluationReportData;
  className?: string;
  compact?: boolean;
};

type IconComponent = typeof Activity;

const toneClass = (tone: EvaluationReportTone = 'neutral') => `pdf-report-tone-${tone}`;
const dash = (value: unknown) => (value === undefined || value === null || value === '' ? '-' : String(value));
const numberDash = (value: number | undefined, decimals = 1) => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(decimals) : '-');
const manualText = (value: unknown) => String(value ?? '').trim();
const chartDate = (date: string) => date ? date.slice(5) : '-';

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
  const latestNutrition = report.latestNutrition ? normalizeNutritionRecord(report.latestNutrition) : undefined;
  const latestNeuromuscular = report.latestNeuromuscular;
  const latestCmj = report.latestCmj;
  const latestFms = report.latestFms;
  const playerInitials = player?.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || categoryLabel(report.category).slice(0, 2).toUpperCase();
  const hasEvaluationHistory = report.nutritionHistory.length > 0 || report.cmjHistory.length > 0;
  const nutritionChronological = report.nutritionHistory.slice().reverse().map((record) => normalizeNutritionRecord(record));
  const manualDiagnosis = manualText(latestNutrition?.diagnosis);
  const hasEvolutionCharts = nutritionChronological.length > 1 || report.cmjHistory.length > 1 || report.neuromuscularHistory.length > 1;

  return (
    <article className={`pdf-report-document evaluations-report-document ${compact ? 'pdf-report-compact' : ''} ${className}`}>
      {!compact ? (
        <ReportCover
          title="Informe de valoraciones"
          subject={player?.name ?? categoryLabel(report.category)}
          subtitle={`${categoryLabel(report.category)} · ${report.mode === 'individual' ? 'Individual' : 'Grupal'}`}
          meta={[`Corte ${report.referenceDate}`, report.generatedAt]}
          metrics={[
            { label: 'Bloques', value: [report.latestNutrition, report.latestNeuromuscular, report.latestCmj, report.latestFms].filter(Boolean).length, note: 'Registrados', tone: 'blue' },
            { label: 'Jugadores', value: report.mode === 'individual' ? 1 : report.group.players, note: 'Cobertura', tone: 'dark' },
            { label: 'Nutrición', value: latestNutrition ? 'Disponible' : 'Sin registro', note: latestNutrition?.date ?? 'Control', tone: latestNutrition ? 'green' : 'neutral' },
            { label: 'CMJ', value: latestCmj ? `${latestCmj.value} cm` : latestNeuromuscular ? `${latestNeuromuscular.cmj} cm` : 'Sin registro', note: 'Potencia', tone: latestCmj || latestNeuromuscular ? 'green' : 'neutral' },
          ]}
        />
      ) : null}
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


      <ReportSection icon={Activity} eyebrow="Métricas" title="Métricas">
        <div className="pdf-report-kpi-grid evaluation-kpi-grid">
          <ReportKpi icon={Scale} label="Peso" value={latestNutrition ? formatNutritionValue(latestNutrition.weight, ' kg') : '-'} note={latestNutrition?.date ?? 'Sin registro'} tone="blue" />
          <ReportKpi icon={Ruler} label="Talla" value={latestNutrition ? formatNutritionValue(latestNutrition.height, ' cm') : '-'} note="Antropometría" tone="dark" />
          <ReportKpi icon={Percent} label="Grasa" value={latestNutrition ? formatNutritionValue(latestNutrition.bodyFat, '%') : '-'} note="Composición" tone="amber" />
          <ReportKpi icon={TrendingUp} label="IMO" value={latestNutrition ? formatNutritionValue(latestNutrition.imo) : '-'} note="Índice morfológico" tone="dark" />
          <ReportKpi icon={Zap} label="CMJ" value={latestCmj ? `${latestCmj.value} cm` : latestNeuromuscular ? `${latestNeuromuscular.cmj} cm` : '-'} note={latestCmj?.date ?? latestNeuromuscular?.date ?? 'Sin registro'} tone="green" />
          <ReportKpi icon={Activity} label="FMS" value={latestFms ? `${latestFms.total} pts` : '-'} note="Funcional" tone="blue" />
          <ReportKpi icon={TrendingUp} label="Cobertura" value={`${report.group.nutrition}/${report.group.players}`} note="Grupo" tone="neutral" />
        </div>
      </ReportSection>

      <div className="pdf-report-two-columns">
        <ReportSection icon={Scale} eyebrow="Nutrición" title="Nutrición">
          {latestNutrition ? (
            <div className="pdf-nutrition-block">
              <div className="pdf-report-feature-grid nutrition-report-grid">
                <div><span>Fecha</span><strong>{latestNutrition.date}</strong></div>
                <div><span>Talla</span><strong>{formatNutritionValue(latestNutrition.height, ' cm')}</strong></div>
                <div><span>Peso</span><strong>{formatNutritionValue(latestNutrition.weight, ' kg')}</strong></div>
                <div><span>Rango peso</span><strong>{formatNutritionText(latestNutrition.weightRange)}</strong></div>
                <div><span>Sumatoria grasa</span><strong>{formatNutritionValue(latestNutrition.skinfoldSum)}</strong></div>
                <div><span>Rango sumatoria</span><strong>{getNutritionRangeLabel(latestNutrition.skinfoldRange)}</strong></div>
                <div><span>% grasa</span><strong>{formatNutritionValue(latestNutrition.bodyFat, '%')}</strong></div>
                <div><span>Rango % grasa</span><strong>{getNutritionRangeLabel(latestNutrition.fatPercentageRange)}</strong></div>
                <div><span>% masa muscular</span><strong>{formatNutritionValue(latestNutrition.muscleMassPercentage, '%')}</strong></div>
                <div><span>Rango masa</span><strong>{getNutritionRangeLabel(latestNutrition.muscleMassRange)}</strong></div>
                <div><span>IMO</span><strong>{formatNutritionValue(latestNutrition.imo)}</strong></div>
                <div><span>Plan</span><strong>{getNutritionPlanLabel(latestNutrition.plan)}</strong></div>
              </div>
              {manualDiagnosis ? (
                <div className="pdf-nutrition-diagnosis">
                  <span>Diagnóstico manual</span>
                  <p>{manualDiagnosis}</p>
                </div>
              ) : null}
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


      <ReportSection icon={Percent} eyebrow="Rangos" title="Rangos de % grasa">
        <div className="pdf-fat-range-strip">
          {FAT_PERCENTAGE_RANGES.map((range) => <span key={range}>{range}</span>)}
        </div>
      </ReportSection>

      {hasEvolutionCharts ? (
        <ReportSection icon={TrendingUp} eyebrow="Evolución" title="Evolución de datos cargados">
          <div className="pdf-chart-grid">
            <PdfEvolutionChart title="Peso" suffix=" kg" decimals={1} points={nutritionChronological.map((row) => ({ label: chartDate(row.date), value: row.weight }))} />
            <PdfEvolutionChart title="IMO" decimals={1} points={nutritionChronological.map((row) => ({ label: chartDate(row.date), value: row.imo ?? 0 }))} />
            <PdfEvolutionChart title="% grasa" suffix="%" decimals={1} points={nutritionChronological.map((row) => ({ label: chartDate(row.date), value: row.bodyFat }))} />
            <PdfEvolutionChart title="% masa muscular" suffix="%" decimals={1} points={nutritionChronological.filter((row) => typeof row.muscleMassPercentage === 'number').map((row) => ({ label: chartDate(row.date), value: row.muscleMassPercentage ?? 0 }))} />
            <PdfEvolutionChart title="CMJ" suffix=" cm" decimals={1} points={report.cmjHistory.slice().reverse().map((row) => ({ label: chartDate(row.date), value: row.value }))} />
            <PdfEvolutionChart title="CMJ neuromuscular" suffix=" cm" decimals={1} points={report.neuromuscularHistory.slice().reverse().map((row) => ({ label: chartDate(row.date), value: row.cmj }))} />
          </div>
        </ReportSection>
      ) : null}

      <ReportSection icon={TrendingUp} eyebrow="Histórico" title="Histórico" >
        {hasEvaluationHistory ? (
          <div className="pdf-report-two-columns">
            <MiniHistoryTable
              rows={report.nutritionHistory.map((record) => { const row = normalizeNutritionRecord(record); return { fecha: row.date, peso: formatNutritionValue(row.weight, ' kg'), grasa: formatNutritionValue(row.bodyFat, '%'), masa: formatNutritionValue(row.muscleMassPercentage, '%'), plan: getNutritionPlanLabel(row.plan) }; })}
              columns={[{ key: 'fecha', label: 'Fecha' }, { key: 'peso', label: 'Peso' }, { key: 'grasa', label: '% grasa' }, { key: 'masa', label: '% masa' }]}
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
