import type { AppData, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord, Player, TrainingSessionType } from './types';
import { averageWellness, calculateInternalLoad, getPlayerDayLoad } from './utils';
import type { BodyMapRecord } from './body-map';
import { getBodyMapDecision } from './body-map';

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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const safeNumber = (value?: number) => Number.isFinite(Number(value)) ? Number(value) : 0;

const toDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const dayDiff = (date: string, referenceDate: string) => {
  const a = toDate(date);
  const b = toDate(referenceDate);
  if (!a || !b) return 9999;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

const inWindow = (date: string, referenceDate: string, minDays: number, maxDays: number) => {
  const diff = dayDiff(date, referenceDate);
  return diff >= minDays && diff <= maxDays;
};

const latestByDate = <T extends { date: string }>(items: T[], referenceDate: string) =>
  items.filter((item) => item.date <= referenceDate).sort((a, b) => b.date.localeCompare(a.date))[0];

const wellnessBaseline = (player: Player, wellness: DailyWellnessRecord[], referenceDate: string) => {
  const values = wellness
    .filter((record) => record.playerId === player.id && inWindow(record.date, referenceDate, 1, 28))
    .map(averageWellness)
    .filter((value) => value > 0);
  if (values.length >= 3) return Number(mean(values).toFixed(1));
  return safeNumber(player.baselineWellness);
};

const sumInternalLoad = (items: DailyInternalLoadRecord[]) =>
  items.reduce((sum, item) => sum + calculateInternalLoad(item), 0);

const externalIndex = (record: DailyExternalLoadRecord) => {
  const distanceComponent = safeNumber(record.totalDistance) / 10;
  const loadComponent = safeNumber(record.playerLoad);
  const neuromuscularComponent = safeNumber(record.acc) + safeNumber(record.dcc) + (safeNumber(record.sprints) * 4) + safeNumber(record.rhie);
  return distanceComponent + loadComponent + neuromuscularComponent;
};

const getVelocityExposure = (external: DailyExternalLoadRecord[], player: Player, referenceDate: string) => {
  const vmax = safeNumber(player.maxVelocityReference);
  const ordered = external
    .filter((record) => record.playerId === player.id && record.date <= referenceDate)
    .sort((a, b) => b.date.localeCompare(a.date));

  const isHighSpeed = (record: DailyExternalLoadRecord) => {
    if (vmax > 0 && safeNumber(record.maxVelocity) >= vmax * 0.85) return true;
    return safeNumber(record.highSpeedDistance ?? record.hsr) > 0;
  };
  const isSprint = (record: DailyExternalLoadRecord) => {
    if (vmax > 0 && safeNumber(record.maxVelocity) >= vmax * 0.9) return true;
    return safeNumber(record.sprints) > 0 || safeNumber(record.sprintDistance) > 0;
  };

  const lastHighSpeed = ordered.find(isHighSpeed);
  const lastSprint = ordered.find(isSprint);
  return {
    daysSinceHighSpeed: lastHighSpeed ? dayDiff(lastHighSpeed.date, referenceDate) : undefined,
    daysSinceSprint: lastSprint ? dayDiff(lastSprint.date, referenceDate) : undefined,
  };
};

const getLatestBodyMap = (playerId: string, bodyRecords: BodyMapRecord[], referenceDate: string) =>
  bodyRecords
    .filter((record) => record.playerId === playerId && record.date <= referenceDate && record.status !== 'Cerrado')
    .sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`))[0];

const mdContextAdvice = (sessionType?: TrainingSessionType) =>
  sessionType
    ? `${sessionType}: usar solo como contexto calendario; la decisión sale de los datos reales del jugador y no de una carga estimada por MD.`
    : 'Ajustar según objetivo real de sesión, respuesta individual y datos disponibles.';

const decideFromScore = (score: number): Pick<PlayerScientificLoadDecision, 'state' | 'percent'> => {
  if (score >= 88) return { state: 'Carga completa', percent: '90-100%' };
  if (score >= 74) return { state: 'Control preventivo', percent: '80-90%' };
  if (score >= 60) return { state: 'Carga reducida', percent: '60-75%' };
  if (score >= 40) return { state: 'Trabajo modificado', percent: '30-60%' };
  return { state: 'No campo', percent: '0-30%' };
};

export const computePlayerScientificLoadDecision = (args: {
  player: Player;
  data: AppData;
  date: string;
  sessionType?: TrainingSessionType;
  bodyRecords?: BodyMapRecord[];
}): PlayerScientificLoadDecision => {
  const { player, data, date, sessionType, bodyRecords = [] } = args;
  const playerWellness = data.wellness.filter((record) => record.playerId === player.id);
  const todayWellness = data.wellness.find((record) => record.playerId === player.id && record.date === date) ?? latestByDate(playerWellness, date);
  const wellnessToday = averageWellness(todayWellness);
  const baseline = wellnessBaseline(player, playerWellness, date);
  const wellnessDelta = wellnessToday && baseline ? Number((wellnessToday - baseline).toFixed(1)) : 0;

  const internal7 = data.internalLoads.filter((record) => record.playerId === player.id && inWindow(record.date, date, 0, 6));
  const internal28 = data.internalLoads.filter((record) => record.playerId === player.id && inWindow(record.date, date, 0, 27));
  const external7 = data.externalLoads.filter((record) => record.playerId === player.id && inWindow(record.date, date, 0, 6));
  const external28 = data.externalLoads.filter((record) => record.playerId === player.id && inWindow(record.date, date, 0, 27));

  const loadToday = getPlayerDayLoad(player.id, date, data);
  const load7d = internal7.length ? sumInternalLoad(internal7) : external7.reduce((sum, item) => sum + safeNumber(item.rpe) * safeNumber(item.min), 0);
  const load28 = internal28.length ? sumInternalLoad(internal28) : external28.reduce((sum, item) => sum + safeNumber(item.rpe) * safeNumber(item.min), 0);
  const chronicWeeklyLoad = load28 > 0 ? load28 / 4 : safeNumber(player.targetWeeklyLoad);
  const acuteChronicRatio = chronicWeeklyLoad > 0 ? Number((load7d / chronicWeeklyLoad).toFixed(2)) : 0;

  const minutes7d = external7.reduce((sum, item) => sum + safeNumber(item.min), 0);
  const hsr7d = external7.reduce((sum, item) => sum + safeNumber(item.highSpeedDistance ?? item.hsr), 0);
  const sprint7d = external7.reduce((sum, item) => sum + safeNumber(item.sprintDistance) + safeNumber(item.sprints) * 10, 0);
  const velocity = getVelocityExposure(data.externalLoads, player, date);

  const latestInternal = latestByDate(data.internalLoads.filter((record) => record.playerId === player.id), date);
  const latestExternal = latestByDate(data.externalLoads.filter((record) => record.playerId === player.id), date);
  const latestRpe = latestInternal?.rpe ?? latestExternal?.rpe;
  const avgExternalIndex28 = mean(external28.map(externalIndex).filter((value) => value > 0));
  const currentExternalIndex = latestExternal ? externalIndex(latestExternal) : 0;
  const externalRatio = avgExternalIndex28 > 0 ? currentExternalIndex / avgExternalIndex28 : 0;

  let externalToleranceLabel = 'Sin datos suficientes de RPE/carga externa.';
  if (latestRpe && externalRatio > 0) {
    if (externalRatio < 0.75 && latestRpe >= 7) externalToleranceLabel = 'RPE alto con carga externa baja: posible fatiga interna o mala recuperación.';
    else if (externalRatio >= 1.2 && latestRpe >= 7) externalToleranceLabel = 'Carga externa alta y RPE alto: sesión exigente real.';
    else if (externalRatio >= 1.2 && latestRpe <= 4) externalToleranceLabel = 'Carga externa alta con RPE bajo: buena tolerancia aparente.';
    else if (externalRatio < 0.75 && latestRpe <= 4) externalToleranceLabel = 'Carga baja y RPE bajo: recuperación o estímulo liviano.';
    else externalToleranceLabel = 'Respuesta RPE coherente con la carga registrada.';
  }

  const latestBody = getLatestBodyMap(player.id, bodyRecords, date);
  const bodyDecision = latestBody ? getBodyMapDecision(latestBody) : undefined;

  const lastCompetition = latestByDate(data.competitionRecords.filter((record) => record.playerId === player.id), date);
  let competitiveLoadLabel = 'Sin partido reciente relevante.';
  if (lastCompetition && dayDiff(lastCompetition.date, date) <= 2) {
    const min = safeNumber(lastCompetition.minutesPlayed);
    if (min >= 75) competitiveLoadLabel = 'Titular con alta exposición competitiva: priorizar recuperación.';
    else if (min >= 45) competitiveLoadLabel = 'Minutos medios: complemento bajo si el readiness lo permite.';
    else if (min > 0) competitiveLoadLabel = 'Pocos minutos: valorar compensatorio moderado.';
    else competitiveLoadLabel = 'Sin minutos: candidato a compensatorio si no hay dolor o restricción.';
  }

  const reasons: string[] = [];
  const restrictions: string[] = [];
  const nextFocus: string[] = [mdContextAdvice(sessionType)];
  let score = 100;

  if (!wellnessToday) {
    score -= 8;
    reasons.push('Sin wellness reciente: decisión con menor confianza.');
  } else if (wellnessToday < 3) {
    score -= 25;
    reasons.push(`Wellness bajo (${wellnessToday.toFixed(1)}/5).`);
  } else if (wellnessToday < 3.5) {
    score -= 12;
    reasons.push(`Wellness preventivo (${wellnessToday.toFixed(1)}/5).`);
  }

  if (wellnessDelta <= -1) {
    score -= 18;
    reasons.push(`Caída marcada frente a línea base (${wellnessDelta.toFixed(1)}).`);
  } else if (wellnessDelta <= -0.5) {
    score -= 8;
    reasons.push(`Caída leve frente a línea base (${wellnessDelta.toFixed(1)}).`);
  }

  if (acuteChronicRatio > 1.6) {
    score -= 25;
    reasons.push(`Carga 7d muy superior a habitual (ACR ${acuteChronicRatio}).`);
  } else if (acuteChronicRatio > 1.3) {
    score -= 12;
    reasons.push(`Incremento de carga 7d vs habitual (ACR ${acuteChronicRatio}).`);
  } else if (acuteChronicRatio > 0 && acuteChronicRatio < 0.75) {
    reasons.push(`Carga reciente baja frente a habitual (ACR ${acuteChronicRatio}): vigilar subestimulación.`);
    nextFocus.push('Planificar estímulo compensatorio/progresivo si está disponible.');
  }

  if (externalToleranceLabel.includes('RPE alto con carga externa baja')) {
    score -= 15;
    reasons.push(externalToleranceLabel);
  } else if (externalToleranceLabel.includes('Carga externa alta y RPE alto')) {
    score -= 8;
    reasons.push(externalToleranceLabel);
  }

  if (typeof velocity.daysSinceHighSpeed === 'number' && velocity.daysSinceHighSpeed >= 8) {
    reasons.push(`${velocity.daysSinceHighSpeed} días sin alta velocidad: evitar llegar subexpuesto a competencia.`);
    nextFocus.push('Incluir exposición progresiva a >85% Vmáx en el día apropiado del microciclo.');
  }
  if (typeof velocity.daysSinceSprint === 'number' && velocity.daysSinceSprint >= 10) {
    reasons.push(`${velocity.daysSinceSprint} días sin sprint: progresión antes de competir si no hay dolor.`);
  }
  if (player.targetWeeklyHsr && hsr7d > player.targetWeeklyHsr * 1.35) {
    score -= 8;
    reasons.push('Alta velocidad semanal por encima del objetivo individual.');
    restrictions.push('Controlar nueva exposición a alta velocidad.');
  }
  if (player.targetWeeklySprintDistance && sprint7d > player.targetWeeklySprintDistance * 1.35) {
    score -= 10;
    reasons.push('Sprint semanal por encima del objetivo individual.');
    restrictions.push('Limitar sprint máximo y velocidad máxima.');
  }

  if (latestBody && bodyDecision) {
    reasons.push(`${latestBody.region} ${latestBody.side}: ${latestBody.type} ${latestBody.intensity}/10.`);
    restrictions.push(bodyDecision.restriction);
    nextFocus.push(bodyDecision.rationale);
    if (bodyDecision.decision === 'No campo / fisioterapia') score = Math.min(score, 35);
    else if (bodyDecision.decision === 'Trabajo modificado') score = Math.min(score, 55);
    else if (bodyDecision.decision === 'Reducir carga') score = Math.min(score, 68);
    else if (bodyDecision.decision === 'Control preventivo') score = Math.min(score, 82);
  }

  if (player.status === 'Lesionado') {
    score = Math.min(score, 30);
    reasons.push('Estado del jugador: lesionado.');
  } else if (player.status === 'Readaptación') {
    score = Math.min(score, 55);
    reasons.push('Estado del jugador: readaptación.');
  } else if (player.status === 'Molestia') {
    score = Math.min(score, 70);
    reasons.push('Estado del jugador: molestia.');
  }

  if (player.maxTrainingPercent && player.maxTrainingPercent < 100) {
    const cap = player.maxTrainingPercent;
    restrictions.push(`Máximo permitido por ficha: ${cap}% de sesión.`);
    if (cap <= 40) score = Math.min(score, 35);
    else if (cap <= 60) score = Math.min(score, 55);
    else if (cap <= 80) score = Math.min(score, 70);
  }
  if (player.restrictions?.length) restrictions.push(...player.restrictions);
  if (player.riskAreas) nextFocus.push(`Vigilar zonas de riesgo: ${player.riskAreas}.`);

  let decision = decideFromScore(clamp(Math.round(score), 0, 100));
  if (competitiveLoadLabel.includes('Sin minutos') && score >= 74 && sessionType === 'MD+1') {
    decision = { state: 'Compensatorio', percent: '80-100%' };
    reasons.push('MD+1 con baja o nula carga competitiva: necesita compensatorio si está sin dolor.');
  }

  const availableSignals = [wellnessToday > 0, latestRpe !== undefined, latestExternal !== undefined, chronicWeeklyLoad > 0, player.status !== undefined, !latestBody || latestBody.status !== undefined].filter(Boolean).length;
  const dataQuality = Math.round((availableSignals / 6) * 100);
  const confidence: DecisionConfidence = dataQuality >= 80 ? 'Alta' : dataQuality >= 50 ? 'Media' : 'Baja';

  return {
    ...decision,
    score: clamp(Math.round(score), 0, 100),
    confidence,
    reasons: reasons.length ? Array.from(new Set(reasons)).slice(0, 6) : ['Sin alertas mayores: mantener plan con observación de campo.'],
    restrictions: Array.from(new Set(restrictions)).filter(Boolean).slice(0, 5),
    nextFocus: Array.from(new Set(nextFocus)).filter(Boolean).slice(0, 5),
    metrics: {
      wellnessToday,
      wellnessBaseline: baseline,
      wellnessDelta,
      loadToday,
      load7d,
      chronicWeeklyLoad,
      acuteChronicRatio,
      minutes7d,
      hsr7d,
      sprint7d,
      daysSinceHighSpeed: velocity.daysSinceHighSpeed,
      daysSinceSprint: velocity.daysSinceSprint,
      latestRpe,
      externalToleranceLabel,
      competitiveLoadLabel,
      dataQuality,
    },
  };
};
