import { Activity, AlertTriangle, CalendarDays, Clock, Gauge, Target, Users, Zap } from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import type { ClubCategory, Microcycle, Player, SessionParticipation, TrainingSessionType } from '@/lib/types';
import { formatPdfDate, getPdfSafeText, supportsGps, pluralize, reportDash } from '@/lib/report-utils';
import { ReportBadge, ReportEmptyState, ReportInsightBox, ReportKpiCard, ReportLayout, ReportSection } from './report-ui';
import { groupAverage } from '@/lib/utils';

type SessionReportRow = {
  player: Player;
  selected: boolean;
  participation: SessionParticipation;
  min: number;
  rpe: number;
  acc: number;
  dcc: number;
  sprints: number;
  rhie: number;
  ima: number;
};

type Props = {
  date: string;
  category: ClubCategory;
  microcycle?: Microcycle;
  sessionNumber?: string | number;
  sessionType: TrainingSessionType;
  objective?: string;
  observation?: string;
  rows: SessionReportRow[];
  absentPlayers: Player[];
  dataQualityPercent?: number;
  generatedAt?: string;
  className?: string;
  compact?: boolean;
};

const sessionTypeLabel = (value: TrainingSessionType) => ({
  cdef: 'Recuperación',
  cdEf: 'Ejecución',
  cdeF: 'Condición física',
  Cdef: 'Comunicación',
}[value] ?? value);

const avg = (values: number[]) => groupAverage(values.filter((value) => Number.isFinite(value) && value > 0));

export function SessionReportTemplate({ date, category, microcycle, sessionNumber, sessionType, objective, observation, rows, absentPlayers, dataQualityPercent = 0, generatedAt = new Date().toLocaleString('es-CO'), className = '', compact = false }: Props) {
  const gpsEnabled = supportsGps(category);
  const registeredRows = rows.filter((row) => row.selected || row.min > 0 || row.rpe > 0);
  const totalLoad = registeredRows.reduce((acc, row) => acc + (row.min || 0) * (row.rpe || 0), 0);
  const avgMin = avg(registeredRows.map((row) => row.min));
  const avgRpe = avg(registeredRows.map((row) => row.rpe));
  const avgAcc = avg(registeredRows.map((row) => row.acc));
  const avgDcc = avg(registeredRows.map((row) => row.dcc));
  const avgSprints = avg(registeredRows.map((row) => row.sprints));
  const highRpeRows = registeredRows.filter((row) => row.rpe >= 8);
  const incompleteRows = registeredRows.filter((row) => !row.min || !row.rpe);
  const microcycleText = microcycle ? `${getPdfSafeText(microcycle.name, 'Microciclo')}${microcycle.startDate && microcycle.endDate ? ` · ${formatPdfDate(microcycle.startDate)} - ${formatPdfDate(microcycle.endDate)}` : ''}` : 'Sin microciclo asignado';
  const executiveText = registeredRows.length
    ? `Sesión ${sessionNumber || '—'} de ${categoryLabel(category)}. ${pluralize(registeredRows.length, 'jugador registrado', 'jugadores registrados')}, ${Math.round(avgMin)} minutos promedio, RPE ${avgRpe.toFixed(1)} y ${Math.round(totalLoad)} UA de carga interna total.`
    : 'Sin registros para análisis de sesión.';

  return (
    <ReportLayout title="Informe de sesión" subtitle={`${formatPdfDate(date)} · Sesión ${sessionNumber || '—'}`} category={category} generatedAt={generatedAt} className={`session-report-document ${compact ? 'pdf-report-compact' : ''} ${className}`}>
      <section className="pdf-report-hero session-report-hero">
        <div className="session-hero-main">
          <span>Sesión</span>
          <h2>{sessionTypeLabel(sessionType)}</h2>
          <p>{formatPdfDate(date)} · {microcycleText}</p>
        </div>
        <div className="session-hero-grid">
          <div><CalendarDays size={14} /><span>Fecha</span><strong>{formatPdfDate(date, '—')}</strong></div>
          <div><Target size={14} /><span>Sesión</span><strong>{sessionNumber || '—'}</strong></div>
          <div><Users size={14} /><span>Categoría</span><strong>{categoryLabel(category)}</strong></div>
          <div><Gauge size={14} /><span>Completitud</span><strong>{dataQualityPercent}%</strong></div>
        </div>
      </section>

      <ReportSection icon={Activity} eyebrow="Resumen" title="Resumen">
        <p className="pdf-report-summary">{executiveText}</p>
        {objective?.trim() ? <ReportInsightBox><strong>Objetivo:</strong> {getPdfSafeText(objective)}</ReportInsightBox> : null}
        {observation?.trim() ? <ReportInsightBox tone="neutral"><strong>Observación:</strong> {getPdfSafeText(observation)}</ReportInsightBox> : null}
      </ReportSection>

      <ReportSection icon={Gauge} eyebrow="Indicadores" title="Resumen de carga">
        <div className="pdf-report-kpi-grid session-kpi-grid">
          <ReportKpiCard icon={Users} label="Registrados" value={registeredRows.length} note="Registrados" tone="blue" />
          <ReportKpiCard icon={AlertTriangle} label="Pendientes" value={absentPlayers.length} note="Pendientes" tone={absentPlayers.length ? 'amber' : 'green'} />
          <ReportKpiCard icon={Clock} label="MIN prom." value={Math.round(avgMin)} note="Promedio" tone="dark" />
          <ReportKpiCard icon={Activity} label="RPE prom." value={avgRpe.toFixed(1)} note="Promedio" tone="amber" />
          <ReportKpiCard icon={Zap} label="Carga total" value={Math.round(totalLoad)} note="Carga" tone="blue" />
          <ReportKpiCard icon={Gauge} label="Calidad" value={`${dataQualityPercent}%`} note="Completitud" tone={dataQualityPercent >= 75 ? 'green' : dataQualityPercent >= 45 ? 'amber' : 'red'} />
          {gpsEnabled ? <ReportKpiCard icon={Zap} label="ACC prom." value={Math.round(avgAcc)} note="GPS" tone="green" /> : null}
          {gpsEnabled ? <ReportKpiCard icon={Zap} label="DCC prom." value={Math.round(avgDcc)} note="GPS" tone="green" /> : null}
          {gpsEnabled ? <ReportKpiCard icon={Zap} label="Sprints prom." value={Math.round(avgSprints)} note="GPS" tone="green" /> : null}
        </div>
      </ReportSection>

      <ReportSection icon={Users} eyebrow="Asistencia" title="Participación">
        {registeredRows.length ? (
          <table className="pdf-report-table session-report-table">
            <thead>
              <tr>
                <th>Jugador</th><th>Posición</th><th>Participación</th><th>MIN</th><th>RPE</th>{gpsEnabled ? <><th>ACC</th><th>DCC</th><th>Sprints</th><th>RHIE</th><th>IMA</th></> : null}<th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {registeredRows.map((row) => (
                <tr key={row.player.id}>
                  <td><strong>{row.player.name}</strong></td>
                  <td>{row.player.position}</td>
                  <td><ReportBadge tone={row.participation === 'Completa' ? 'green' : row.participation === 'No participa' ? 'red' : 'amber'}>{row.participation}</ReportBadge></td>
                  <td>{reportDash(row.min)}</td>
                  <td>{reportDash(row.rpe)}</td>
                  {gpsEnabled ? <><td>{reportDash(row.acc)}</td><td>{reportDash(row.dcc)}</td><td>{reportDash(row.sprints)}</td><td>{reportDash(row.rhie)}</td><td>{reportDash(row.ima)}</td></> : null}
                  <td><ReportBadge tone={row.player.status === 'Disponible' ? 'green' : row.player.status === 'Lesionado' ? 'red' : row.player.status === 'Readaptación' ? 'blue' : 'amber'}>{row.player.status}</ReportBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <ReportEmptyState text="Sin registros." />}
      </ReportSection>

      <div className="pdf-report-two-columns compact-blocks">
        <ReportSection icon={AlertTriangle} eyebrow="Alertas" title="Alertas">
          {highRpeRows.length || incompleteRows.length || absentPlayers.length ? (
            <div className="pdf-report-note-list">
              {highRpeRows.length ? <div><AlertTriangle size={14} /><span>{pluralize(highRpeRows.length, 'jugador', 'jugadores')} con RPE alto.</span></div> : null}
              {incompleteRows.length ? <div><AlertTriangle size={14} /><span>{pluralize(incompleteRows.length, 'registro incompleto', 'registros incompletos')} en la planilla.</span></div> : null}
              {absentPlayers.length ? <div><AlertTriangle size={14} /><span>{pluralize(absentPlayers.length, 'jugador pendiente', 'jugadores pendientes')} por registrar.</span></div> : null}
            </div>
          ) : <ReportEmptyState compact text="Sin alertas." />}
        </ReportSection>
        <ReportSection icon={Users} eyebrow="Pendientes" title="Pendientes">
          {absentPlayers.length ? <div className="pdf-report-chip-list">{absentPlayers.slice(0, 12).map((player) => <span key={player.id}>{player.name}</span>)}</div> : <ReportEmptyState compact text="Sin pendientes." />}
        </ReportSection>
      </div>
    </ReportLayout>
  );
}
