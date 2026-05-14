import { Activity, BarChart3, CalendarDays, HeartPulse, Scale, ShieldCheck, Trophy, UserRound, Zap } from 'lucide-react';
import { categoryLabel, formatBirthDateForDisplay } from '@/lib/labels';
import type { ClubCategory, Player } from '@/lib/types';
import { calculateAgeSafe, filterEmptyMetrics, formatPdfValue, formatPdfValueIfValid, getPdfSafeText, hasValidSectionData, hasValidValue, supportsGps } from '@/lib/report-utils';
import { PdfEvolutionChart, ReportBadge, ReportCover, ReportKpiCard, ReportLayout, ReportSection } from './report-ui';
import { groupAverage } from '@/lib/utils';
import type { ReactNode } from 'react';

type PlayerReportProps = {
  player: Player;
  category: ClubCategory | 'all' | string;
  generatedAt?: string;
  wellnessHistory: Array<{ date: string; value: number }>;
  internalHistory: Array<{ date: string; load: number; rpe: number; duration: number }>;
  externalHistory: Array<{ date: string; min: number; acc?: number; dcc?: number; sprints?: number; rhie?: number; ima?: number; rpe?: number; totalDistance?: number; playerLoad?: number; highSpeedDistance?: number; sprintDistance?: number }>;
  competitionHistory: Array<{ date: string; competitionName?: string; opponent: string; minutesPlayed: number; goals: number; assists: number; yellowCards: number; redCards: number; goalsConceded?: number; goalsPrevented?: number; penaltiesSaved?: number; crossesDefended?: number; footworkActions?: number }>;
  nutritionHistory: Array<{ date: string; weight: number; height: number; bodyFat: number; skinfoldSum: number; plan?: string; weightRange?: string; skinfoldRange?: string; fatPercentageRange?: string; muscleMassPercentage?: number; muscleMassRange?: string; imo?: number; diagnosis?: string; nutritionPlan?: string }>;
  cmjHistory: Array<{ date: string; value: number; power?: number; asymmetry?: number; rsi?: number }>;
  fmsHistory: Array<{ date: string; total: number; shoulderMobility?: number; squat?: number; legRaise?: number; hurdleStep?: number; lunge?: number; trunkStability?: number; rotaryStability?: number }>;
  neuromuscularHistory: Array<{ date: string; cmj: number; sj: number; reactiveJumps: number }>;
  className?: string;
};

type MetricItem = { label: string; value: ReactNode; note?: string; tone?: 'blue' | 'green' | 'amber' | 'red' | 'neutral' | 'dark'; icon?: typeof Activity };

type GridItem = { label: string; value: unknown; suffix?: string; decimals?: number };

const last = <T,>(rows: T[]) => rows.length ? rows[rows.length - 1] : undefined;

const validNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value !== 0;
const sum = <T,>(rows: T[], read: (row: T) => unknown) => rows.reduce((acc, row) => acc + (validNumber(read(row)) ? Number(read(row)) : 0), 0);
const fmt = (value: unknown, suffix = '', decimals?: number) => {
  if (!hasValidValue(value)) return null;
  if (typeof value === 'number' && Number.isFinite(value) && typeof decimals === 'number') return `${value.toFixed(decimals)}${suffix}`;
  return formatPdfValueIfValid(value, suffix, '');
};

function MetricGrid({ items, className = '' }: { items: GridItem[]; className?: string }) {
  const clean = items
    .map((item) => ({ ...item, rendered: fmt(item.value, item.suffix ?? '', item.decimals) }))
    .filter((item) => hasValidValue(item.rendered));
  if (!clean.length) return null;
  return (
    <div className={`pdf-report-feature-grid ${className}`}>
      {clean.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.rendered}</strong></div>)}
    </div>
  );
}

function KpiGrid({ items }: { items: MetricItem[] }) {
  const clean = filterEmptyMetrics(items.map((item) => ({ ...item, value: item.value ?? '' })));
  if (!clean.length) return null;
  return (
    <div className="pdf-report-kpi-grid player-report-kpis">
      {clean.map((item) => <ReportKpiCard key={item.label} icon={item.icon ?? Activity} label={item.label} value={item.value} note={item.note} tone={item.tone ?? 'blue'} />)}
    </div>
  );
}

const chartPoints = (rows: Array<{ date: string }>, read: (row: any) => unknown) => rows
  .map((row) => ({ label: row.date.slice(5), value: Number(read(row)) }))
  .filter((point) => Number.isFinite(point.value) && point.value !== 0);

function ChartSection({ charts }: { charts: Array<{ title: string; suffix?: string; decimals?: number; points: { label: string; value: number }[] }> }) {
  const clean = charts.filter((chart) => chart.points.length >= 2);
  if (!clean.length) return null;
  return (
    <ReportSection icon={BarChart3} eyebrow="Evolución" title="Evolución de datos cargados">
      <div className="pdf-chart-grid">
        {clean.map((chart) => <PdfEvolutionChart key={chart.title} title={chart.title} suffix={chart.suffix ?? ''} decimals={chart.decimals ?? 0} points={chart.points} />)}
      </div>
    </ReportSection>
  );
}

export function PlayerReportTemplate({ player, category, generatedAt = new Date().toLocaleString('es-CO'), wellnessHistory, internalHistory, externalHistory, competitionHistory, nutritionHistory, cmjHistory, fmsHistory, neuromuscularHistory, className = '' }: PlayerReportProps) {
  const playerCategory = player.category ?? (category === 'all' ? 'Sub20' : category) as ClubCategory;
  const gpsEnabled = supportsGps(playerCategory);

  const validWellness = wellnessHistory.filter((row) => hasValidValue(row.value));
  const validInternal = internalHistory.filter((row) => hasValidSectionData(row.load, row.rpe, row.duration));
  const validExternal = (gpsEnabled ? externalHistory : []).filter((row) => hasValidSectionData(row.min, row.acc, row.dcc, row.sprints, row.rhie, row.ima, row.totalDistance, row.playerLoad, row.highSpeedDistance, row.sprintDistance));
  const validCompetition = competitionHistory.filter((row) => hasValidSectionData(row.minutesPlayed, row.goals, row.assists, row.yellowCards, row.redCards, row.goalsConceded, row.goalsPrevented, row.penaltiesSaved, row.crossesDefended, row.footworkActions));
  const validNutrition = nutritionHistory.filter((row) => hasValidSectionData(row.weight, row.height, row.bodyFat, row.skinfoldSum, row.imo, row.muscleMassPercentage, row.diagnosis, row.nutritionPlan));
  const validCmj = cmjHistory.filter((row) => hasValidSectionData(row.value, row.power, row.asymmetry, row.rsi));
  const validFms = fmsHistory.filter((row) => hasValidSectionData(row.total, row.shoulderMobility, row.squat, row.legRaise, row.hurdleStep, row.lunge, row.trunkStability, row.rotaryStability));
  const validNeuro = neuromuscularHistory.filter((row) => hasValidSectionData(row.cmj, row.sj, row.reactiveJumps));

  const latestWellness = last(validWellness);
  const latestInternal = last(validInternal);
  const latestExternal = last(validExternal);
  const latestNutrition = last(validNutrition);
  const latestCmj = last(validCmj);
  const latestFms = last(validFms);
  const latestNeuro = last(validNeuro);

  const minutes = sum(validCompetition, (row) => row.minutesPlayed);
  const goals = sum(validCompetition, (row) => row.goals);
  const assists = sum(validCompetition, (row) => row.assists);
  const yellows = sum(validCompetition, (row) => row.yellowCards);
  const reds = sum(validCompetition, (row) => row.redCards);
  const ge = sum(validCompetition, (row) => row.goalsConceded);
  const ev = sum(validCompetition, (row) => row.goalsPrevented);
  const penaltiesSaved = sum(validCompetition, (row) => row.penaltiesSaved);
  const crossesDefended = sum(validCompetition, (row) => row.crossesDefended);
  const footworkActions = sum(validCompetition, (row) => row.footworkActions);
  const internalTotal = sum(validInternal, (row) => row.load);
  const wellnessAvg = groupAverage(validWellness.map((row) => row.value).filter((value) => value > 0));
  const initials = player.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const ageLabel = calculateAgeSafe(player.birthDate, player.age);
  const manualMedicalNotes = String(player.medicalNotes ?? '').trim();
  const medicalSummaryItems = [player.injuryArea, player.injuryType, player.injurySeverity].map((item) => String(item ?? '').trim()).filter(Boolean);
  const nutritionPlan = latestNutrition?.nutritionPlan || latestNutrition?.plan;
  const hasEvaluations = Boolean(latestNutrition || latestCmj || latestFms || latestNeuro);
  const hasCompetition = validCompetition.length > 0;
  const hasMedical = player.status !== 'Disponible' || medicalSummaryItems.length > 0 || manualMedicalNotes.length > 0;
  const hasGps = gpsEnabled && Boolean(latestExternal);
  const statusTone: 'green' | 'red' | 'amber' = player.status === 'Disponible' ? 'green' : player.status === 'Lesionado' ? 'red' : 'amber';

  const coverMetrics = filterEmptyMetrics([
    { label: 'Estado', value: player.status, note: 'Disponibilidad', tone: statusTone },
    { label: 'Partidos', value: validCompetition.length, note: fmt(minutes, ' min') ?? undefined, tone: 'dark' as const },
    { label: 'Carga', value: Math.round(internalTotal), note: 'UA acumulada', tone: 'blue' as const },
    { label: 'Última valoración', value: latestNutrition?.date ?? latestCmj?.date ?? latestFms?.date ?? '', note: 'Control', tone: 'neutral' as const },
  ]);

  const charts = [
    { title: 'Wellness', decimals: 1, points: chartPoints(validWellness, (row) => row.value) },
    { title: 'Carga interna', suffix: ' UA', decimals: 0, points: chartPoints(validInternal, (row) => row.load) },
    { title: 'Peso', suffix: ' kg', decimals: 1, points: chartPoints(validNutrition, (row) => row.weight) },
    { title: 'IMO', decimals: 1, points: chartPoints(validNutrition, (row) => row.imo) },
    { title: '% grasa', suffix: '%', decimals: 1, points: chartPoints(validNutrition, (row) => row.bodyFat) },
    { title: '% masa muscular', suffix: '%', decimals: 1, points: chartPoints(validNutrition, (row) => row.muscleMassPercentage) },
    { title: 'Player Load', decimals: 0, points: chartPoints(validExternal, (row) => row.playerLoad) },
    { title: 'Distancia', suffix: ' m', decimals: 0, points: chartPoints(validExternal, (row) => row.totalDistance) },
    { title: 'Minutos competencia', suffix: ' min', decimals: 0, points: chartPoints(validCompetition, (row) => row.minutesPlayed) },
    { title: 'CMJ', suffix: ' cm', decimals: 1, points: chartPoints(validCmj, (row) => row.value) },
    { title: 'FMS', suffix: ' pts', decimals: 0, points: chartPoints(validFms, (row) => row.total) },
  ];

  return (
    <ReportLayout title="Informe individual del jugador" subtitle={player.name} category={playerCategory} generatedAt={generatedAt} className={`player-report-document ${className}`}>
      <ReportCover
        title="Informe individual del jugador"
        subject={player.name}
        subtitle={`${player.position} · ${categoryLabel(playerCategory)} · ${ageLabel}`}
        meta={[player.status, generatedAt]}
        metrics={coverMetrics}
      />

      <section className="pdf-report-hero player-report-hero">
        <div className="player-report-avatar"><span>{initials}</span></div>
        <div className="player-report-core">
          <span>Jugador</span>
          <h2>{player.name}</h2>
          <p>{player.position} · {categoryLabel(playerCategory)} · {ageLabel}</p>
          <div className="pdf-report-chip-list compact">
            <ReportBadge tone={player.status === 'Disponible' ? 'green' : player.status === 'Lesionado' ? 'red' : player.status === 'Readaptación' ? 'blue' : 'amber'}>{player.status}</ReportBadge>
            <ReportBadge tone="blue">{player.position}</ReportBadge>
          </div>
        </div>
        <div className="player-report-meta">
          {latestWellness ? <div><CalendarDays size={14} /><span>Último wellness</span><strong>{latestWellness.date}</strong></div> : null}
          {(latestInternal || latestExternal) ? <div><Activity size={14} /><span>Última carga</span><strong>{latestInternal?.date ?? latestExternal?.date}</strong></div> : null}
        </div>
      </section>

      <ReportSection icon={UserRound} eyebrow="Ficha" title="Datos básicos">
        <MetricGrid items={[
          { label: 'Fecha nacimiento', value: formatBirthDateForDisplay(player.birthDate) },
          { label: 'Edad', value: ageLabel },
          { label: 'Estatura', value: player.height, suffix: ' cm' },
          { label: 'Peso ficha', value: player.weight, suffix: ' kg' },
          { label: 'Dorsal', value: player.jerseyNumber },
          { label: 'Pie dominante', value: player.dominantFoot },
          { label: 'Rol competitivo', value: player.competitiveRole },
          { label: 'Estado', value: player.status },
        ]} />
      </ReportSection>

      <ReportSection icon={BarChart3} eyebrow="Métricas" title="Estado reciente">
        <KpiGrid items={[
          { icon: HeartPulse, label: 'Wellness', value: wellnessAvg ? wellnessAvg.toFixed(1) : '', note: latestWellness?.date, tone: wellnessAvg && wellnessAvg < 3.2 ? 'amber' : 'green' },
          { icon: Activity, label: 'Carga interna', value: Math.round(internalTotal), note: 'UA', tone: 'blue' },
          { icon: Trophy, label: 'Partidos', value: validCompetition.length, note: fmt(minutes, ' min') ?? undefined, tone: 'dark' },
          { icon: Scale, label: 'Peso valoración', value: latestNutrition ? fmt(latestNutrition.weight, ' kg') : '', note: latestNutrition?.date, tone: 'blue' },
          { icon: Zap, label: 'CMJ', value: latestCmj ? fmt(latestCmj.value, ' cm') : latestNeuro ? fmt(latestNeuro.cmj, ' cm') : '', note: latestCmj?.date ?? latestNeuro?.date, tone: 'green' },
          { icon: ShieldCheck, label: 'FMS', value: latestFms ? fmt(latestFms.total, ' pts') : '', note: latestFms?.date, tone: 'blue' },
          { icon: Zap, label: 'GPS último', value: latestExternal ? fmt(latestExternal.min, ' min') : '', note: latestExternal?.date, tone: 'green' },
        ]} />
      </ReportSection>

      {hasCompetition || hasMedical ? (
        <div className="pdf-report-two-columns compact-blocks">
          {hasCompetition ? (
            <ReportSection icon={Trophy} eyebrow="Competencia" title="Competencia">
              <MetricGrid items={[
                { label: 'Partidos', value: validCompetition.length },
                { label: 'Minutos', value: minutes, suffix: ' min' },
                { label: 'Goles', value: goals },
                { label: 'Asistencias', value: assists },
                { label: 'TA', value: yellows },
                { label: 'TR', value: reds },
                ...(player.position === 'Portero' ? [
                  { label: 'Goles encajados', value: ge },
                  { label: 'Goles evitados', value: ev },
                  { label: 'Penaltis atajados', value: penaltiesSaved },
                  { label: 'Centros defendidos', value: crossesDefended },
                  { label: 'Juego de pies', value: footworkActions },
                ] : []),
              ]} />
            </ReportSection>
          ) : null}
          {hasMedical ? (
            <ReportSection icon={HeartPulse} eyebrow="Área médica" title="Disponibilidad">
              <MetricGrid className="single" items={[
                { label: 'Estado', value: player.status !== 'Disponible' ? player.status : '' },
                { label: 'Detalle médico', value: medicalSummaryItems.join(' · ') },
              ]} />
              {manualMedicalNotes ? <p className="pdf-manual-note">{getPdfSafeText(manualMedicalNotes)}</p> : null}
            </ReportSection>
          ) : null}
        </div>
      ) : null}

      {hasEvaluations ? (
        <ReportSection icon={Scale} eyebrow="Valoraciones" title="Nutrición, CMJ y FMS">
          {latestNutrition ? (
            <>
              <MetricGrid items={[
                { label: 'Fecha valoración', value: latestNutrition.date },
                { label: 'Talla', value: latestNutrition.height, suffix: ' cm' },
                { label: 'Peso', value: latestNutrition.weight, suffix: ' kg' },
                { label: 'IMO', value: latestNutrition.imo, decimals: 1 },
                { label: 'Sumatoria grasa', value: latestNutrition.skinfoldSum, suffix: ' mm' },
                { label: '% grasa', value: latestNutrition.bodyFat, suffix: '%' },
                { label: '% masa muscular', value: latestNutrition.muscleMassPercentage, suffix: '%' },
                { label: 'Rango % grasa', value: latestNutrition.fatPercentageRange },
                { label: 'Plan nutricional', value: nutritionPlan },
              ]} />
              {latestNutrition.diagnosis ? <p className="pdf-manual-note">{getPdfSafeText(latestNutrition.diagnosis)}</p> : null}
            </>
          ) : null}
          {(latestCmj || latestNeuro || latestFms) ? (
            <MetricGrid className="pdf-metric-grid-spaced" items={[
              { label: 'CMJ', value: latestCmj?.value, suffix: ' cm' },
              { label: 'Potencia CMJ', value: latestCmj?.power },
              { label: 'Asimetría CMJ', value: latestCmj?.asymmetry, suffix: '%' },
              { label: 'RSI', value: latestCmj?.rsi },
              { label: 'CMJ neuromuscular', value: latestNeuro?.cmj, suffix: ' cm' },
              { label: 'SJ', value: latestNeuro?.sj, suffix: ' cm' },
              { label: 'Saltos reactivos', value: latestNeuro?.reactiveJumps },
              { label: 'FMS total', value: latestFms?.total, suffix: ' pts' },
              { label: 'Shoulder mobility', value: latestFms?.shoulderMobility },
              { label: 'Squat', value: latestFms?.squat },
              { label: 'Leg raise', value: latestFms?.legRaise },
              { label: 'Hurdle step', value: latestFms?.hurdleStep },
              { label: 'Lunge', value: latestFms?.lunge },
              { label: 'Trunk stability', value: latestFms?.trunkStability },
              { label: 'Rotary stability', value: latestFms?.rotaryStability },
            ]} />
          ) : null}
        </ReportSection>
      ) : null}

      <ChartSection charts={charts} />

      {hasGps ? (
        <ReportSection icon={Zap} eyebrow="GPS" title="Carga externa integrada">
          <MetricGrid items={[
            { label: 'Fecha', value: latestExternal?.date },
            { label: 'MIN', value: latestExternal?.min, suffix: ' min' },
            { label: 'Distancia', value: latestExternal?.totalDistance, suffix: ' m' },
            { label: 'Player Load', value: latestExternal?.playerLoad },
            { label: 'HSR', value: latestExternal?.highSpeedDistance, suffix: ' m' },
            { label: 'Sprint', value: latestExternal?.sprintDistance, suffix: ' m' },
            { label: 'ACC', value: latestExternal?.acc },
            { label: 'DCC', value: latestExternal?.dcc },
            { label: 'Sprints', value: latestExternal?.sprints },
            { label: 'RHIE', value: latestExternal?.rhie },
          ]} />
        </ReportSection>
      ) : null}
    </ReportLayout>
  );
}
