import type { AppData, Player, TrainingSessionType } from './types';
import type { BodyMapRecord } from './body-map';
import { getBodyMapDecision } from './body-map';
import { computePlayerLoadRiskProfile, daysBetween } from './load-risk-engine';

export type LoadDecisionState = 'Carga completa' | 'Control preventivo' | 'Carga reducida' | 'Trabajo modificado' | 'No campo' | 'Compensatorio';
export type DecisionConfidence = 'Alta' | 'Media' | 'Baja';

export interface PlayerScientificLoadDecision {
  state: LoadDecisionState;
  percent: string;
  score: number;
  confidence: DecisionConfidence;
  reasons: string[];
  restrictions: string[];
  nextFocus: string[];
  metrics: {
    wellnessToday: number;
    wellnessBaseline: number;
    wellnessDelta: number;
    loadToday: number;
    load7d: number;
    chronicWeeklyLoad: number;
    acuteChronicRatio: number;
    minutes7d: number;
    hsr7d: number;
    sprint7d: number;
    daysSinceHighSpeed?: number;
    daysSinceSprint?: number;
    latestRpe?: number;
    externalToleranceLabel: string;
    competitiveLoadLabel: string;
    dataQuality: number;
  };
}

const num = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);
const uniq = <T,>(items: T[]) => Array.from(new Set(items));

const latestBodyMap = (playerId: string, records: BodyMapRecord[], referenceDate: string) => records
  .filter((record) => record.playerId === playerId && record.date <= referenceDate && record.status !== 'Cerrado')
  .sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`))[0];

const latestCompetitionLabel = (data: AppData, player: Player, date: string) => {
  const record = data.competitionRecords
    .filter((item) => item.playerId === player.id && item.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!record || daysBetween(record.date, date) > 2) return 'Sin partido reciente relevante.';
  const minutes = num(record.minutesPlayed);
  if (minutes >= 75) return 'Titular con alta exposicion competitiva: priorizar recuperacion.';
  if (minutes >= 45) return 'Minutos medios: complemento bajo si el readiness lo permite.';
  if (minutes > 0) return 'Pocos minutos: valorar compensatorio moderado.';
  return 'Sin minutos: candidato a compensatorio si no hay dolor o restriccion.';
};

const mdContextAdvice = (sessionType?: TrainingSessionType) =>
  sessionType
    ? `${sessionType}: usar solo como contexto; la decision sale de datos reales del jugador.`
    : 'Ajustar segun objetivo real de sesion, respuesta individual y datos disponibles.';

const rpeLabel = (profile: ReturnType<typeof computePlayerLoadRiskProfile>) => {
  const rpe = profile.thresholds.rpe.today;
  if (rpe === undefined) return 'Sin RPE reciente para contrastar carga interna/externa.';
  const neuromuscular = profile.thresholds.neuromuscular;
  if (rpe >= 7 && neuromuscular.outsideNormal && (neuromuscular.zScore ?? 0) > 1.5) return 'Carga neuromuscular alta y RPE alto: controlar fatiga real.';
  if (rpe >= 7 && profile.load.today.effectiveLoad < (profile.thresholds.srpe.mean ?? 0) * 0.75) return 'RPE alto con carga externa/interna baja: posible mala recuperacion.';
  if (rpe <= 4 && profile.load.today.effectiveLoad > (profile.thresholds.srpe.mean ?? 0) * 1.2) return 'Carga alta con RPE bajo: buena tolerancia aparente.';
  return 'Respuesta RPE coherente con la carga registrada.';
};

export const computePlayerScientificLoadDecision = (args: {
  player: Player;
  data: AppData;
  date: string;
  sessionType?: TrainingSessionType;
  bodyRecords?: BodyMapRecord[];
}): PlayerScientificLoadDecision => {
  const { player, data, date, sessionType, bodyRecords = [] } = args;
  const profile = computePlayerLoadRiskProfile({ data, player, date, bodyRecords });
  const latestBody = latestBodyMap(player.id, bodyRecords, date);
  const bodyDecision = latestBody ? getBodyMapDecision(latestBody) : undefined;
  const competitiveLoadLabel = latestCompetitionLabel(data, player, date);

  let state: LoadDecisionState = profile.decision;
  let percent = profile.decisionPercent;
  if (competitiveLoadLabel.includes('Sin minutos') && profile.riskScore < 30 && sessionType === 'MD+1') {
    state = 'Compensatorio';
    percent = '80-100%';
  }

  const restrictions = [
    ...(player.restrictions ?? []),
    ...(bodyDecision ? [bodyDecision.restriction] : []),
    ...(player.maxTrainingPercent && player.maxTrainingPercent < 100 ? [`Maximo permitido por ficha: ${player.maxTrainingPercent}% de sesion.`] : []),
  ];

  const load7d = sum(profile.load.last7.map((day) => day.effectiveLoad));
  const minutes7d = sum(profile.load.last7.map((day) => day.minutes));
  const hsr7d = sum(profile.load.last7.map((day) => day.hsr));
  const sprint7d = sum(profile.load.last7.map((day) => day.sprint));
  const latestRpe = profile.thresholds.rpe.today;

  const reasons = [
    ...profile.contributions.map((item) => item.label),
    ...(competitiveLoadLabel.includes('Sin partido') ? [] : [competitiveLoadLabel]),
  ];

  return {
    state,
    percent,
    score: Math.max(0, 100 - profile.riskScore),
    confidence: profile.dataConfidence.label,
    reasons: reasons.length ? uniq(reasons).slice(0, 6) : ['Sin alertas mayores: mantener plan con observacion de campo.'],
    restrictions: uniq(restrictions).filter(Boolean).slice(0, 5),
    nextFocus: uniq([mdContextAdvice(sessionType), ...(bodyDecision ? [bodyDecision.rationale] : []), ...profile.recommendations]).slice(0, 5),
    metrics: {
      wellnessToday: profile.wellness.today ?? 0,
      wellnessBaseline: profile.wellness.baseline ?? 0,
      wellnessDelta: profile.wellness.delta ?? 0,
      loadToday: profile.load.today.effectiveLoad,
      load7d,
      chronicWeeklyLoad: profile.acwr.primary.chronic,
      acuteChronicRatio: profile.acwr.primary.rolling,
      minutes7d,
      hsr7d,
      sprint7d,
      daysSinceHighSpeed: profile.velocity.daysSinceHighSpeed,
      daysSinceSprint: profile.velocity.daysSinceSprint,
      latestRpe,
      externalToleranceLabel: rpeLabel(profile),
      competitiveLoadLabel,
      dataQuality: profile.dataConfidence.score,
    },
  };
};
