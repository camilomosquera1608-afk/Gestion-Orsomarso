import { Activity, AlertTriangle, BarChart3, CalendarDays, HeartPulse, Scale, ShieldCheck, Trophy, UserRound, Zap } from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import type { ClubCategory, Player } from '@/lib/types';
import { calculateAgeSafe, formatPdfValue, getPdfSafeText, reportDash, supportsGps } from '@/lib/report-utils';
import { ReportBadge, ReportEmptyState, ReportInsightBox, ReportKpiCard, ReportLayout, ReportSection } from './report-ui';
import { groupAverage } from '@/lib/utils';

type PlayerReportProps = {
  player: Player;
  category: ClubCategory | 'all' | string;
  generatedAt?: string;
  wellnessHistory: Array<{ date: string; value: number }>;
  internalHistory: Array<{ date: string; load: number; rpe: number; duration: number }>;
  externalHistory: Array<{ date: string; min: number; acc?: number; dcc?: number; sprints?: number; rhie?: number; ima?: number; rpe?: number }>;
  competitionHistory: Array<{ date: string; competitionName?: string; opponent: string; minutesPlayed: number; goals: number; assists: number; yellowCards: number; redCards: number; goalsConceded?: number; goalsPrevented?: number }>;
  nutritionHistory: Array<{ date: string; weight: number; height: number; bodyFat: number; skinfoldSum: number; plan: string; weightRange?: string; skinfoldRange?: string; fatPercentageRange?: string; muscleMassPercentage?: number; muscleMassRange?: string; imo?: number; diagnosis?: string; nutritionPlan?: string }>;
  cmjHistory: Array<{ date: string; value: number }>;
  fmsHistory: Array<{ date: string; total: number }>;
  neuromuscularHistory: Array<{ date: string; cmj: number; sj: number; reactiveJumps: number }>;
  className?: string;
};

const last = <T,>(rows: T[]) => rows.length ? rows[rows.length - 1] : undefined;

export function PlayerReportTemplate({ player, category, generatedAt = new Date().toLocaleString('es-CO'), wellnessHistory, internalHistory, externalHistory, competitionHistory, nutritionHistory, cmjHistory, fmsHistory, neuromuscularHistory, className = '' }: PlayerReportProps) {
  const playerCategory = player.category ?? (category === 'all' ? 'Sub20' : category) as ClubCategory;
  const gpsEnabled = supportsGps(playerCategory);
  const latestWellness = last(wellnessHistory);
  const latestInternal = last(internalHistory);
  const latestExternal = gpsEnabled ? last(externalHistory) : undefined;
  const latestNutrition = last(nutritionHistory);
  const latestCmj = last(cmjHistory);
  const latestFms = last(fmsHistory);
  const latestNeuro = last(neuromuscularHistory);
  const minutes = competitionHistory.reduce((acc, row) => acc + (row.minutesPlayed || 0), 0);
  const goals = competitionHistory.reduce((acc, row) => acc + (row.goals || 0), 0);
  const assists = competitionHistory.reduce((acc, row) => acc + (row.assists || 0), 0);
  const yellows = competitionHistory.reduce((acc, row) => acc + (row.yellowCards || 0), 0);
  const reds = competitionHistory.reduce((acc, row) => acc + (row.redCards || 0), 0);
  const ge = competitionHistory.reduce((acc, row) => acc + (row.goalsConceded || 0), 0);
  const ev = competitionHistory.reduce((acc, row) => acc + (row.goalsPrevented || 0), 0);
  const initials = player.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const ageLabel = calculateAgeSafe(player.birthDate, player.age);
  const wellnessAvg = groupAverage(wellnessHistory.map((row) => row.value).filter((value) => value > 0));
  const internalTotal = internalHistory.reduce((acc, row) => acc + (row.load || 0), 0);
  const executiveText = `${getPdfSafeText(player.name, 'Jugador')} pertenece a ${categoryLabel(playerCategory)} y se encuentra en estado ${getPdfSafeText(player.status, 'sin estado')}.`;

  return (
    <ReportLayout title="Perfil 360" subtitle={player.name} category={playerCategory} generatedAt={generatedAt} className={`player-report-document ${className}`}>
      <section className="pdf-report-hero player-report-hero">
        <div className="player-report-avatar"><span>{initials}</span></div>
        <div className="player-report-core">
          <span>Jugador</span>
          <h2>{player.name}</h2>
          <p>{player.position} · {categoryLabel(playerCategory)} · {ageLabel}</p>
          <div className="pdf-report-chip-list compact"><ReportBadge tone={player.status === 'Disponible' ? 'green' : player.status === 'Lesionado' ? 'red' : player.status === 'Readaptación' ? 'blue' : 'amber'}>{player.status}</ReportBadge><ReportBadge tone="blue">{player.position}</ReportBadge></div>
        </div>
        <div className="player-report-meta">
          <div><CalendarDays size={14} /><span>Último wellness</span><strong>{latestWellness?.date ?? '—'}</strong></div>
          <div><Activity size={14} /><span>Última carga</span><strong>{latestInternal?.date ?? latestExternal?.date ?? '—'}</strong></div>
        </div>
      </section>

      <ReportSection icon={UserRound} eyebrow="Resumen" title="Resumen">
        <p className="pdf-report-summary">{executiveText}</p>
      </ReportSection>

      <ReportSection icon={BarChart3} eyebrow="Métricas" title="Estado reciente">
        <div className="pdf-report-kpi-grid player-report-kpis">
          <ReportKpiCard icon={HeartPulse} label="Wellness" value={wellnessAvg ? wellnessAvg.toFixed(1) : '—'} note={latestWellness?.date ?? 'Sin registro'} tone={wellnessAvg && wellnessAvg < 3.2 ? 'amber' : 'green'} />
          <ReportKpiCard icon={Activity} label="Carga interna" value={Math.round(internalTotal)} note="UA" tone="blue" />
          <ReportKpiCard icon={Trophy} label="Partidos" value={competitionHistory.length} note={`${minutes} min`} tone="dark" />
          <ReportKpiCard icon={Scale} label="Peso" value={latestNutrition ? formatPdfValue(latestNutrition.weight, ' kg') : '—'} note={latestNutrition?.date ?? 'Nutrición'} tone="blue" />
          <ReportKpiCard icon={Zap} label="CMJ" value={latestCmj ? `${latestCmj.value} cm` : latestNeuro ? `${latestNeuro.cmj} cm` : '—'} note={latestCmj?.date ?? latestNeuro?.date ?? 'Sin registro'} tone="green" />
          <ReportKpiCard icon={ShieldCheck} label="FMS" value={latestFms ? `${latestFms.total} pts` : '—'} note={latestFms?.date ?? 'Funcional'} tone="blue" />
          {gpsEnabled ? <ReportKpiCard icon={Zap} label="GPS último" value={latestExternal ? `${latestExternal.min} min` : '—'} note={latestExternal?.date ?? 'GPS'} tone="green" /> : null}
        </div>
      </ReportSection>

      <div className="pdf-report-two-columns compact-blocks">
        <ReportSection icon={Trophy} eyebrow="Competencia" title="Competencia">
          <div className="pdf-report-feature-grid">
            <div><span>Partidos</span><strong>{competitionHistory.length}</strong></div>
            <div><span>Minutos</span><strong>{minutes}</strong></div>
            <div><span>Goles</span><strong>{goals}</strong></div>
            <div><span>Asistencias</span><strong>{assists}</strong></div>
            <div><span>TA</span><strong>{yellows}</strong></div>
            <div><span>TR</span><strong>{reds}</strong></div>
            {player.position === 'Portero' ? <div><span>GE</span><strong>{ge}</strong></div> : null}
            {player.position === 'Portero' ? <div><span>EV</span><strong>{ev}</strong></div> : null}
          </div>
        </ReportSection>
        <ReportSection icon={HeartPulse} eyebrow="Área médica" title="Disponibilidad">
          <ReportInsightBox tone={player.status === 'Disponible' ? 'green' : player.status === 'Lesionado' ? 'red' : 'amber'}>
            <strong>{player.status}</strong><br />
            {player.injuryArea || player.injuryType || player.injurySeverity ? `${reportDash(player.injuryArea)} · ${reportDash(player.injuryType)} · ${reportDash(player.injurySeverity)}` : 'Sin observaciones.'}
          </ReportInsightBox>
        </ReportSection>
      </div>

      <ReportSection icon={Scale} eyebrow="Valoraciones" title="Valoraciones">
        <div className="pdf-report-feature-grid">
          <div><span>Nutrición</span><strong>{latestNutrition ? `${formatPdfValue(latestNutrition.weight, ' kg')} · ${formatPdfValue(latestNutrition.bodyFat, '%')}` : '—'}</strong></div>
          <div><span>CMJ</span><strong>{latestCmj ? formatPdfValue(latestCmj.value, ' cm') : latestNeuro ? formatPdfValue(latestNeuro.cmj, ' cm') : '—'}</strong></div>
          <div><span>FMS</span><strong>{latestFms ? formatPdfValue(latestFms.total, ' pts') : '—'}</strong></div>
          <div><span>Neuromuscular</span><strong>{latestNeuro ? `SJ ${latestNeuro.sj} · Reactivos ${latestNeuro.reactiveJumps}` : '—'}</strong></div>
        </div>
        {!latestNutrition && !latestCmj && !latestFms && !latestNeuro ? <ReportEmptyState text="Sin registros." /> : null}
      </ReportSection>

      {gpsEnabled ? (
        <ReportSection icon={Zap} eyebrow="GPS U20" title="Carga externa">
          {latestExternal ? (
            <div className="pdf-report-feature-grid">
              <div><span>Fecha</span><strong>{latestExternal.date}</strong></div>
              <div><span>MIN</span><strong>{latestExternal.min}</strong></div>
              <div><span>ACC</span><strong>{reportDash(latestExternal.acc)}</strong></div>
              <div><span>DCC</span><strong>{reportDash(latestExternal.dcc)}</strong></div>
              <div><span>Sprints</span><strong>{reportDash(latestExternal.sprints)}</strong></div>
              <div><span>RHIE</span><strong>{reportDash(latestExternal.rhie)}</strong></div>
            </div>
          ) : <ReportEmptyState text="Sin registros." />}
        </ReportSection>
      ) : null}

      <ReportSection icon={AlertTriangle} eyebrow="Recomendación" title="Recomendación">
        <ReportInsightBox tone={player.status === 'Lesionado' ? 'red' : latestWellness && latestWellness.value < 3.2 ? 'amber' : 'blue'}>
          {player.status === 'Lesionado'
            ? 'Seguimiento médico prioritario.'
            : latestWellness && latestWellness.value < 3.2
              ? 'Controlar recuperación y carga reciente.'
              : competitionHistory.length === 0
                ? 'Sin competencia registrada.'
                : 'Seguimiento regular.'}
        </ReportInsightBox>
      </ReportSection>
    </ReportLayout>
  );
}
