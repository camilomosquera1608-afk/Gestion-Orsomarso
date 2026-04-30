import { Activity, AlertTriangle, BarChart3, CalendarDays, Clock, Gauge, Target, Users, Zap } from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import type { ClubCategory, DailyWellnessRecord, Microcycle, Player, SessionParticipation, TrainingSessionType } from '@/lib/types';
import { formatPdfDate, formatPdfNumber, getPdfSafeText, supportsGps, pluralize, reportDash } from '@/lib/report-utils';
import { ReportBadge, ReportCover, ReportEmptyState, ReportInsightBox, ReportKpiCard, ReportLayout, ReportSection } from './report-ui';
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
  totalDistance?: number;
  maxVelocity?: number;
  playerLoad?: number;
  highSpeedDistance?: number;
  sprintDistance?: number;
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
  wellnessRecords?: DailyWellnessRecord[];
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
const safeNumber = (value: number | undefined) => Number.isFinite(Number(value)) ? Number(value) : 0;
const sum = (values: Array<number | undefined>) => values.reduce<number>((acc, value) => acc + safeNumber(value), 0);
const max = (values: Array<number | undefined>) => values.reduce<number>((acc, value) => Math.max(acc, safeNumber(value)), 0);
const clamp = (value: number, min = 0, maxValue = 100) => Math.max(min, Math.min(maxValue, value));
const percent = (value: number, reference: number) => reference > 0 ? clamp(Math.round((value / reference) * 100)) : 0;
const wellnessAverage = (record?: DailyWellnessRecord) => {
  if (!record) return 0;
  const values = [record.sleep, record.fatigue, record.stress, record.musclePain, record.mood].filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? values.reduce((acc, value) => acc + value, 0) / values.length : 0;
};
const toneByPercent = (value: number): 'green' | 'amber' | 'red' => value >= 80 ? 'green' : value >= 55 ? 'amber' : 'red';
const playerShortName = (name: string) => {
  const parts = getPdfSafeText(name, '').split(' ').filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts[1]?.[0] ?? ''}.`;
};

function ReportGauge({ label, value, tone = 'blue' }: { label: string; value: number; tone?: 'blue' | 'green' | 'amber' | 'red' }) {
  return (
    <div className={`catapult-gauge catapult-gauge-${tone}`}>
      <div className="catapult-gauge-ring" style={{ ['--value' as string]: `${clamp(value)}%` }}><strong>{clamp(value)}%</strong></div>
      <span>{label}</span>
    </div>
  );
}

function MetricBar({ label, value, reference, valueLabel }: { label: string; value: number; reference: number; valueLabel?: string }) {
  const width = percent(value, reference);
  return (
    <div className="catapult-metric-bar">
      <div><span>{label}</span><strong>{valueLabel ?? formatPdfNumber(value, value % 1 ? 1 : 0)}</strong></div>
      <i><em style={{ width: `${width}%` }} /></i>
      <small>{width}%</small>
    </div>
  );
}

function SessionComparisonChart({ rows, mode }: { rows: SessionReportRow[]; mode: 'gps' | 'internal' }) {
  const visible = rows.slice(0, 18);
  const maxVolume = mode === 'gps' ? Math.max(1, max(visible.map((row) => row.totalDistance))) : Math.max(1, max(visible.map((row) => row.min * row.rpe)));
  const maxIntensity = mode === 'gps'
    ? Math.max(1, max(visible.map((row) => row.min > 0 && row.totalDistance ? row.totalDistance / row.min : 0)))
    : Math.max(1, max(visible.map((row) => row.rpe)));
  return (
    <div className="catapult-chart">
      <div className="catapult-chart-legend"><span><i />Volumen</span><span><i />Intensidad</span></div>
      <div className="catapult-bars">
        {visible.map((row) => {
          const volume = mode === 'gps' ? Number(row.totalDistance ?? 0) : row.min * row.rpe;
          const intensity = mode === 'gps' ? (row.min > 0 && row.totalDistance ? row.totalDistance / row.min : 0) : row.rpe;
          return (
            <div className="catapult-bar-item" key={row.player.id}>
              <div className="catapult-bar-pair">
                <span className="volume" style={{ height: `${Math.max(5, percent(volume, maxVolume))}%` }}><b>{Math.round(percent(volume, maxVolume))}</b></span>
                <span className="intensity" style={{ height: `${Math.max(5, percent(intensity, maxIntensity))}%` }}><b>{Math.round(percent(intensity, maxIntensity))}</b></span>
              </div>
              <small>{playerShortName(row.player.name)}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SessionReportTemplate({ date, category, microcycle, sessionNumber, sessionType, objective, observation, rows, absentPlayers, wellnessRecords = [], dataQualityPercent = 0, generatedAt = new Date().toLocaleString('es-CO'), className = '', compact = false }: Props) {
  const gpsEnabled = supportsGps(category);
  const registeredRows = rows.filter((row) => row.selected || row.min > 0 || row.rpe > 0 || Number(row.totalDistance ?? 0) > 0 || Number(row.playerLoad ?? 0) > 0);
  const totalLoad = registeredRows.reduce((acc, row) => acc + (row.min || 0) * (row.rpe || 0), 0);
  const avgMin = avg(registeredRows.map((row) => row.min));
  const avgRpe = avg(registeredRows.map((row) => row.rpe));
  const totalDistance = sum(registeredRows.map((row) => row.totalDistance));
  const totalPlayerLoad = sum(registeredRows.map((row) => row.playerLoad));
  const totalHighSpeed = sum(registeredRows.map((row) => row.highSpeedDistance));
  const totalSprintDistance = sum(registeredRows.map((row) => row.sprintDistance));
  const totalAccDcc = sum(registeredRows.map((row) => row.acc + row.dcc));
  const maxVelocity = max(registeredRows.map((row) => row.maxVelocity));
  const avgDistancePerMin = avg(registeredRows.map((row) => row.min > 0 && row.totalDistance ? row.totalDistance / row.min : 0));
  const avgPlayerLoadPerMin = avg(registeredRows.map((row) => row.min > 0 && row.playerLoad ? row.playerLoad / row.min : 0));
  const avgAcc = avg(registeredRows.map((row) => row.acc));
  const avgDcc = avg(registeredRows.map((row) => row.dcc));
  const avgSprints = avg(registeredRows.map((row) => row.sprints));
  const highRpeRows = registeredRows.filter((row) => row.rpe >= 8);
  const incompleteRows = registeredRows.filter((row) => !row.min || !row.rpe);
  const wellnessByPlayer = new Map(wellnessRecords.map((record) => [record.playerId, record]));
  const wellnessValues = registeredRows.map((row) => wellnessAverage(wellnessByPlayer.get(row.player.id))).filter((value) => value > 0);
  const avgWellness = avg(wellnessValues);
  const lowWellnessRows = registeredRows.filter((row) => {
    const value = wellnessAverage(wellnessByPlayer.get(row.player.id));
    return value > 0 && value < 3.2;
  });
  const microcycleText = microcycle ? `${getPdfSafeText(microcycle.name, 'Microciclo')}${microcycle.startDate && microcycle.endDate ? ` · ${formatPdfDate(microcycle.startDate)} - ${formatPdfDate(microcycle.endDate)}` : ''}` : 'Sin microciclo asignado';
  const volumeScore = gpsEnabled ? percent(totalDistance, Math.max(1, registeredRows.length * 6200)) : percent(totalLoad, Math.max(1, registeredRows.length * 650));
  const intensityScore = gpsEnabled ? percent(avgDistancePerMin, 95) : percent(avgRpe, 10);
  const wellnessScore = percent(avgWellness, 5);
  const generalScore = gpsEnabled ? Math.round((volumeScore + intensityScore + percent(totalAccDcc, Math.max(1, registeredRows.length * 120))) / 3) : Math.round((volumeScore + intensityScore + wellnessScore) / 3);
  const participationScore = registeredRows.length + absentPlayers.length ? percent(registeredRows.length, registeredRows.length + absentPlayers.length) : 0;
  const executiveText = registeredRows.length
    ? gpsEnabled
      ? `Sesión ${sessionNumber || '—'} de ${categoryLabel(category)} con ${pluralize(registeredRows.length, 'jugador registrado', 'jugadores registrados')}. Carga externa: ${formatPdfNumber(totalDistance)} m, Player Load ${formatPdfNumber(totalPlayerLoad)}, ${formatPdfNumber(totalHighSpeed)} m de alta velocidad y velocidad máxima ${formatPdfNumber(maxVelocity, 1)} km/h.`
      : `Sesión ${sessionNumber || '—'} de ${categoryLabel(category)} con ${pluralize(registeredRows.length, 'jugador registrado', 'jugadores registrados')}. Lectura interna: ${Math.round(avgMin)} min promedio, RPE ${avgRpe.toFixed(1)}, carga interna ${Math.round(totalLoad)} UA y wellness ${avgWellness ? avgWellness.toFixed(1) : 'sin registro'}.`
    : 'Sin registros para análisis de sesión.';

  return (
    <ReportLayout title="Informe de sesión" subtitle={`${formatPdfDate(date)} · Sesión ${sessionNumber || '—'}`} category={category} generatedAt={generatedAt} className={`session-report-document catapult-session-report ${compact ? 'pdf-report-compact' : ''} ${className}`}>
      {!compact ? (
        <ReportCover
          title={gpsEnabled ? 'Informe Catapult U20' : 'Informe de sesión'}
          subject={sessionTypeLabel(sessionType)}
          subtitle={microcycleText}
          meta={[formatPdfDate(date), categoryLabel(category), `Sesión ${sessionNumber || '—'}`]}
          metrics={gpsEnabled ? [
            { label: 'Distancia', value: formatPdfNumber(totalDistance), note: 'm', tone: 'blue' },
            { label: 'Player Load', value: formatPdfNumber(totalPlayerLoad), note: 'Carga externa', tone: 'green' },
            { label: 'Vel. máx.', value: formatPdfNumber(maxVelocity, 1), note: 'km/h', tone: 'amber' },
            { label: 'Participación', value: `${participationScore}%`, note: 'Registrados', tone: toneByPercent(participationScore) },
          ] : [
            { label: 'Jugadores', value: registeredRows.length, note: 'Registrados', tone: 'blue' },
            { label: 'Carga interna', value: Math.round(totalLoad), note: 'UA', tone: 'green' },
            { label: 'RPE prom.', value: avgRpe.toFixed(1), note: 'Promedio', tone: 'amber' },
            { label: 'Wellness', value: avgWellness ? avgWellness.toFixed(1) : '—', note: 'Promedio', tone: avgWellness >= 3.7 ? 'green' : avgWellness >= 3.2 ? 'amber' : 'red' },
          ]}
        />
      ) : null}

      <section className="pdf-report-hero session-report-hero catapult-report-top">
        <div className="session-hero-main">
          <span>{gpsEnabled ? 'Catapult U20' : 'Carga interna'}</span>
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

      <div className="catapult-summary-grid">
        <ReportSection icon={Gauge} eyebrow="Resumen" title={gpsEnabled ? 'Comparación MD' : 'Resumen interno'}>
          <div className="catapult-gauge-row">
            <ReportGauge label="Volumen" value={volumeScore} tone={toneByPercent(volumeScore)} />
            <ReportGauge label="General" value={generalScore} tone={toneByPercent(generalScore)} />
            <ReportGauge label={gpsEnabled ? 'Intensidad' : 'Wellness'} value={gpsEnabled ? intensityScore : wellnessScore} tone={toneByPercent(gpsEnabled ? intensityScore : wellnessScore)} />
          </div>
          <div className="catapult-metric-list">
            {gpsEnabled ? <>
              <MetricBar label="Distancia (m)" value={totalDistance} reference={registeredRows.length * 6200} valueLabel={formatPdfNumber(totalDistance)} />
              <MetricBar label="HS Dist (m)" value={totalHighSpeed} reference={registeredRows.length * 650} valueLabel={formatPdfNumber(totalHighSpeed)} />
              <MetricBar label="Accel+Decel" value={totalAccDcc} reference={registeredRows.length * 120} valueLabel={formatPdfNumber(totalAccDcc)} />
              <MetricBar label="m/min" value={avgDistancePerMin} reference={95} valueLabel={formatPdfNumber(avgDistancePerMin, 1)} />
              <MetricBar label="Player Load/min" value={avgPlayerLoadPerMin} reference={10} valueLabel={formatPdfNumber(avgPlayerLoadPerMin, 1)} />
              <MetricBar label="Sprint Dist (m)" value={totalSprintDistance} reference={registeredRows.length * 240} valueLabel={formatPdfNumber(totalSprintDistance)} />
            </> : <>
              <MetricBar label="Carga interna (UA)" value={totalLoad} reference={registeredRows.length * 650} valueLabel={formatPdfNumber(totalLoad)} />
              <MetricBar label="Min promedio" value={avgMin} reference={100} valueLabel={formatPdfNumber(avgMin)} />
              <MetricBar label="RPE promedio" value={avgRpe} reference={10} valueLabel={formatPdfNumber(avgRpe, 1)} />
              <MetricBar label="Wellness promedio" value={avgWellness} reference={5} valueLabel={avgWellness ? formatPdfNumber(avgWellness, 1) : '—'} />
            </>}
          </div>
        </ReportSection>
        <ReportSection icon={Users} eyebrow="Participación" title="Participación del deportista">
          <div className="catapult-donut-wrap">
            <div className="catapult-donut" style={{ ['--value' as string]: `${participationScore}%` }}><strong>{participationScore}%</strong><span>Registrados</span></div>
            <div className="catapult-donut-legend"><span><i />Registrados ({registeredRows.length})</span><span><i />Pendientes ({absentPlayers.length})</span></div>
          </div>
        </ReportSection>
      </div>

      <ReportSection icon={BarChart3} eyebrow={gpsEnabled ? 'Volumen & Intensidad' : 'Carga interna & wellness'} title={gpsEnabled ? 'Volumen e intensidad por jugador' : 'Combinación RPE, minutos y wellness'}>
        {registeredRows.length ? <SessionComparisonChart rows={registeredRows} mode={gpsEnabled ? 'gps' : 'internal'} /> : <ReportEmptyState text="Sin registros." />}
      </ReportSection>

      <ReportSection icon={Activity} eyebrow="Resumen" title="Lectura de sesión">
        <p className="pdf-report-summary">{executiveText}</p>
        {objective?.trim() ? <ReportInsightBox><strong>Objetivo:</strong> {getPdfSafeText(objective)}</ReportInsightBox> : null}
        {observation?.trim() ? <ReportInsightBox tone="neutral"><strong>Observación:</strong> {getPdfSafeText(observation)}</ReportInsightBox> : null}
      </ReportSection>

      <ReportSection icon={Gauge} eyebrow="Indicadores" title={gpsEnabled ? 'Métricas disponibles U20' : 'Indicadores U17/U15'}>
        <div className="pdf-report-kpi-grid session-kpi-grid">
          <ReportKpiCard icon={Users} label="Registrados" value={registeredRows.length} note="Jugadores" tone="blue" />
          <ReportKpiCard icon={AlertTriangle} label="Pendientes" value={absentPlayers.length} note="Jugadores" tone={absentPlayers.length ? 'amber' : 'green'} />
          <ReportKpiCard icon={Clock} label="MIN prom." value={Math.round(avgMin)} note="Promedio" tone="dark" />
          <ReportKpiCard icon={Activity} label="RPE prom." value={avgRpe.toFixed(1)} note="Promedio" tone="amber" />
          <ReportKpiCard icon={Zap} label="Carga interna" value={Math.round(totalLoad)} note="UA" tone="blue" />
          <ReportKpiCard icon={Gauge} label="Wellness" value={avgWellness ? avgWellness.toFixed(1) : '—'} note="Promedio" tone={avgWellness >= 3.7 ? 'green' : avgWellness >= 3.2 ? 'amber' : 'red'} />
          {gpsEnabled ? <ReportKpiCard icon={Zap} label="Distancia" value={formatPdfNumber(totalDistance)} note="m" tone="green" /> : null}
          {gpsEnabled ? <ReportKpiCard icon={Zap} label="PL total" value={formatPdfNumber(totalPlayerLoad)} note="Player Load" tone="green" /> : null}
          {gpsEnabled ? <ReportKpiCard icon={Zap} label="Vel. máx." value={formatPdfNumber(maxVelocity, 1)} note="km/h" tone="amber" /> : null}
          {gpsEnabled ? <ReportKpiCard icon={Zap} label="HS dist." value={formatPdfNumber(totalHighSpeed)} note="m" tone="green" /> : null}
          {gpsEnabled ? <ReportKpiCard icon={Zap} label="Sprints prom." value={Math.round(avgSprints)} note="GPS" tone="green" /> : null}
          {gpsEnabled ? <ReportKpiCard icon={Zap} label="ACC/DCC prom." value={`${Math.round(avgAcc)}/${Math.round(avgDcc)}`} note="GPS" tone="green" /> : null}
        </div>
      </ReportSection>

      <ReportSection icon={Users} eyebrow="Asistencia" title="Participación individual">
        {registeredRows.length ? (
          <table className="pdf-report-table session-report-table catapult-report-table">
            <thead>
              <tr>
                <th>Jugador</th><th>Posición</th><th>Part.</th><th>MIN</th><th>RPE</th><th>Carga</th>{!gpsEnabled ? <th>Wellness</th> : null}{gpsEnabled ? <><th>Dist.</th><th>PL</th><th>Vel.</th><th>HS</th><th>Spr.</th><th>ACC</th><th>DCC</th><th>RHIE</th><th>IMA</th></> : null}<th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {registeredRows.map((row) => {
                const wellness = wellnessAverage(wellnessByPlayer.get(row.player.id));
                return (
                  <tr key={row.player.id}>
                    <td><strong>{row.player.name}</strong></td>
                    <td>{row.player.position}</td>
                    <td><ReportBadge tone={row.participation === 'Completa' ? 'green' : row.participation === 'No participa' ? 'red' : 'amber'}>{row.participation}</ReportBadge></td>
                    <td>{reportDash(row.min)}</td>
                    <td>{reportDash(row.rpe)}</td>
                    <td>{reportDash(row.min * row.rpe)}</td>
                    {!gpsEnabled ? <td>{wellness ? wellness.toFixed(1) : '—'}</td> : null}
                    {gpsEnabled ? <><td>{reportDash(row.totalDistance)}</td><td>{reportDash(row.playerLoad)}</td><td>{reportDash(row.maxVelocity)}</td><td>{reportDash(row.highSpeedDistance)}</td><td>{reportDash(row.sprints)}</td><td>{reportDash(row.acc)}</td><td>{reportDash(row.dcc)}</td><td>{reportDash(row.rhie)}</td><td>{reportDash(row.ima)}</td></> : null}
                    <td><ReportBadge tone={row.player.status === 'Disponible' ? 'green' : row.player.status === 'Lesionado' ? 'red' : row.player.status === 'Readaptación' ? 'blue' : 'amber'}>{row.player.status}</ReportBadge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <ReportEmptyState text="Sin registros." />}
      </ReportSection>

      <div className="pdf-report-two-columns compact-blocks">
        <ReportSection icon={AlertTriangle} eyebrow="Alertas" title="Alertas">
          {highRpeRows.length || incompleteRows.length || absentPlayers.length || lowWellnessRows.length ? (
            <div className="pdf-report-note-list">
              {highRpeRows.length ? <div><AlertTriangle size={14} /><span>{pluralize(highRpeRows.length, 'jugador', 'jugadores')} con RPE alto.</span></div> : null}
              {lowWellnessRows.length ? <div><AlertTriangle size={14} /><span>{pluralize(lowWellnessRows.length, 'jugador', 'jugadores')} con wellness bajo.</span></div> : null}
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
