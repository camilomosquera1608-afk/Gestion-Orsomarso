import { BodyMapRecord, getBodyMapDecision } from './body-map';
import { AppData, DailyExternalLoadRecord, DailyInternalLoadRecord, Player, StrengthSession } from './types';
import { getPlannedPlayerIds, strengthDecision, strengthLoad } from './strength';
import { computePredictiveRisk, type PredictiveRiskResult } from './predictive-risk';
import { computePlayerLoadRiskProfile } from './load-risk-engine';
import { computeDynamicThresholds, computeWellnessAdherence, type DynamicThresholdMetric } from './sport-science';

const sameDay = (date?: string, target?: string) => String(date ?? '') === String(target ?? '');
const num = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

export type DailyLoadDecision = 'Carga completa' | 'Control preventivo' | 'Carga reducida' | 'Trabajo modificado' | 'No campo' | 'Compensatorio';
export type ComponentStatus = 'Sí' | 'Limitado' | 'No';

export interface ComponentAvailability {
  sprint: ComponentStatus;
  cod: ComponentStatus;
  contact: ComponentStatus;
  eccentric: ComponentStatus;
  reactive: ComponentStatus;
  kicking: ComponentStatus;
  reason: string;
}

export interface PlayerDailyPlanRow {
  player: Player;
  wellness?: number;
  internal?: DailyInternalLoadRecord;
  external?: DailyExternalLoadRecord;
  strengthSessions: StrengthSession[];
  strengthResponseRpe?: number;
  bodyAlerts: BodyMapRecord[];
  componentAvailability: ComponentAvailability;
  decision: DailyLoadDecision;
  reason: string;
  action: string;
  quality: 'Alta' | 'Media' | 'Baja';
  predictiveRisk: PredictiveRiskResult;
  dynamicThresholds: Record<'wellness' | 'rpe' | 'load', DynamicThresholdMetric>;
  dataConfidence: { score: number; label: 'Alta' | 'Media' | 'Baja'; adherencePct: number };
  plannedVsExecuted: {
    fieldMinutes: number;
    fieldLoad: number;
    distance: number;
    neuromuscular: number;
    strengthPlanned: number;
    strengthPerceived: number;
    strengthDeltaPct?: number;
  };
  compensation: string;
  history: string[];
}

export const averageWellness = (records: AppData['wellness'], playerId: string, date: string) => {
  const record = records.find((item) => item.playerId === playerId && item.date === date);
  if (!record) return undefined;
  return (num(record.sleep) + num(record.fatigue) + num(record.stress) + num(record.musclePain) + num(record.mood)) / 5;
};

const worseStatus = (current: ComponentStatus, next: ComponentStatus): ComponentStatus => {
  const rank: Record<ComponentStatus, number> = { Sí: 0, Limitado: 1, No: 2 };
  return rank[next] > rank[current] ? next : current;
};

export const buildComponentAvailability = (player: Player, alerts: BodyMapRecord[]): ComponentAvailability => {
  let sprint: ComponentStatus = 'Sí';
  let cod: ComponentStatus = 'Sí';
  let contact: ComponentStatus = 'Sí';
  let eccentric: ComponentStatus = 'Sí';
  let reactive: ComponentStatus = 'Sí';
  let kicking: ComponentStatus = 'Sí';
  const reasons: string[] = [];

  if (player.status === 'Lesionado') {
    sprint = cod = contact = eccentric = reactive = kicking = 'No';
    reasons.push('lesionado');
  } else if (player.status === 'Readaptación') {
    sprint = worseStatus(sprint, 'Limitado');
    cod = worseStatus(cod, 'Limitado');
    contact = worseStatus(contact, 'Limitado');
    reactive = worseStatus(reactive, 'Limitado');
    reasons.push('readaptación');
  } else if (player.status === 'Molestia') {
    sprint = worseStatus(sprint, 'Limitado');
    cod = worseStatus(cod, 'Limitado');
    reasons.push('molestia activa');
  }

  (player.restrictions ?? []).forEach((restriction) => {
    const text = restriction.toLowerCase();
    if (text.includes('sprint') || text.includes('velocidad')) sprint = worseStatus(sprint, 'No');
    if (text.includes('cambio') || text.includes('dirección') || text.includes('giro')) cod = worseStatus(cod, 'No');
    if (text.includes('contacto') || text.includes('duelo')) contact = worseStatus(contact, 'No');
    if (text.includes('excéntr')) eccentric = worseStatus(eccentric, 'No');
    if (text.includes('reactiv') || text.includes('salto')) reactive = worseStatus(reactive, 'No');
    if (text.includes('golpeo')) kicking = worseStatus(kicking, 'No');
    reasons.push(restriction);
  });

  alerts.forEach((alert) => {
    const decision = getBodyMapDecision(alert);
    const high = decision.decision === 'No campo / fisioterapia' || decision.decision === 'Trabajo modificado';
    const limited = decision.decision === 'Reducir carga' || decision.decision === 'Control preventivo';
    const region = alert.region;
    if (region === 'Isquiotibial' || alert.increasesWithSprint) sprint = worseStatus(sprint, high ? 'No' : limited ? 'Limitado' : 'Sí');
    if (region === 'Aductor' || alert.increasesWithChangeOfDirection) cod = worseStatus(cod, high ? 'No' : limited ? 'Limitado' : 'Sí');
    if (['Rodilla', 'Tobillo', 'Gemelo/Sóleo', 'Aquiles'].includes(region)) reactive = worseStatus(reactive, high ? 'No' : 'Limitado');
    if (['Aductor', 'Cuádriceps', 'Cadera/Glúteo'].includes(region)) kicking = worseStatus(kicking, high ? 'No' : 'Limitado');
    if (['Lumbar', 'Cadera/Glúteo', 'Hombro', 'Pectoral'].includes(region)) contact = worseStatus(contact, high ? 'No' : 'Limitado');
    if (['Isquiotibial', 'Aductor', 'Cuádriceps', 'Gemelo/Sóleo'].includes(region)) eccentric = worseStatus(eccentric, high ? 'No' : 'Limitado');
    reasons.push(`${region} ${alert.intensity}/10`);
  });

  return { sprint, cod, contact, eccentric, reactive, kicking, reason: reasons.length ? uniq(reasons).slice(0, 3).join(' · ') : 'sin restricción específica' };
};

export const componentStatusTone = (status: ComponentStatus): 'green' | 'amber' | 'red' => status === 'Sí' ? 'green' : status === 'Limitado' ? 'amber' : 'red';

const strengthForPlayer = (sessions: StrengthSession[], player: Player, players: Player[]) =>
  sessions.filter((session) => getPlannedPlayerIds(session, players).includes(player.id));

export const compensationRecommendation = (player: Player, latestMinutes?: number, decision?: DailyLoadDecision) => {
  if (decision === 'No campo' || decision === 'Trabajo modificado') return 'No compensatorio intenso; priorizar restricción/valoración.';
  if (player.status === 'Readaptación') return 'Progresión controlada según fase de retorno.';
  const role = player.competitiveRole ?? '';
  if (latestMinutes !== undefined) {
    if (latestMinutes >= 75) return 'Recuperación prioritaria.';
    if (latestMinutes >= 45) return 'Complemento bajo si el wellness lo permite.';
    if (latestMinutes >= 15) return 'Compensatorio moderado si no hay dolor.';
    return 'Compensatorio completo/controlado si no hay alertas.';
  }
  if (role.includes('Suplente')) return 'Vigilar subestimulación; considerar compensatorio si acumula pocos minutos.';
  if (role.includes('Retorno')) return 'Progresión controlada, no compensatorio libre.';
  return 'Según minutos recientes y disponibilidad.';
};

export const latestCompetitionMinutes = (data: AppData, playerId: string, date: string) => {
  const records = data.competitionRecords
    .filter((record) => record.playerId === playerId && record.date <= date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return records[0]?.minutesPlayed;
};

const recentHistory = (data: AppData, player: Player, date: string, bodyAlerts: BodyMapRecord[]) => {
  const lastLoads = data.internalLoads
    .filter((record) => record.playerId === player.id && record.date <= date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 3)
    .map((record) => `${record.date}: RPE ${record.rpe} · ${record.duration} min`);
  const lastStrength = (data.strengthSessions ?? [])
    .flatMap((session) => (session.responses ?? []).filter((response) => response.playerId === player.id).map((response) => `${session.date}: fuerza RPE ${response.rpe}${response.pain ? ' + dolor' : ''}`))
    .slice(0, 2);
  const lastBody = bodyAlerts.slice(0, 2).map((record) => `${record.date}: ${record.region} ${record.intensity}/10`);
  return [...lastBody, ...lastStrength, ...lastLoads].slice(0, 4);
};

export const buildDailyPlan = (data: AppData, date: string, bodyRecords: BodyMapRecord[] = [], category: string = 'all'): PlayerDailyPlanRow[] => {
  const players = data.players.filter((player) => category === 'all' || player.category === category);
  const dayStrength = (data.strengthSessions ?? []).filter((session) => sameDay(session.date, date));
  const openBodyRecords = bodyRecords.filter((record) => record.status !== 'Cerrado' && record.date <= date);

  return players.map((player) => {
    const wellness = averageWellness(data.wellness, player.id, date);
    const internal = data.internalLoads.find((record) => record.playerId === player.id && sameDay(record.date, date));
    const external = data.externalLoads.find((record) => record.playerId === player.id && sameDay(record.date, date));
    const playerStrength = strengthForPlayer(dayStrength, player, players);
    const bodyAlerts = openBodyRecords.filter((record) => record.playerId === player.id).slice(0, 3);
    const componentAvailability = buildComponentAvailability(player, bodyAlerts);
    const loadRiskProfile = computePlayerLoadRiskProfile({ data, player, date, bodyRecords: openBodyRecords });
    const predictiveRisk = computePredictiveRisk({ data, player, date, bodyRecords: openBodyRecords });
    const dynamicThresholds = computeDynamicThresholds(data, player, date);
    const adherence = computeWellnessAdherence(data, player, date);
    const latestMinutes = latestCompetitionMinutes(data, player.id, date);

    const fieldMinutes = loadRiskProfile.load.today.minutes;
    const fieldLoad = loadRiskProfile.load.today.effectiveLoad;
    const distance = loadRiskProfile.load.today.distance;
    const neuromuscular = loadRiskProfile.load.today.neuromuscular;

    const strengthPlanned = playerStrength.reduce((sum, session) => sum + strengthLoad(session.duration, session.expectedRpe, session.type), 0);
    const responses = playerStrength.flatMap((session) => (session.responses ?? []).filter((response) => response.playerId === player.id).map((response) => ({ session, response })));
    const strengthPerceived = responses.reduce((sum, item) => sum + strengthLoad(item.session.duration, item.response.rpe, item.session.type), 0);
    const strengthResponseRpe = responses[0]?.response.rpe;
    const strengthDeltaPct = strengthPlanned > 0 && strengthPerceived > 0 ? Math.round(((strengthPerceived - strengthPlanned) / strengthPlanned) * 100) : undefined;

    const reasons: string[] = [];
    let decision: DailyLoadDecision = 'Carga completa';
    if (player.status === 'Lesionado' || componentAvailability.sprint === 'No' && componentAvailability.cod === 'No' && componentAvailability.reactive === 'No') {
      decision = 'No campo';
      reasons.push(player.status === 'Lesionado' ? 'lesionado' : 'restricción amplia');
    } else if (bodyAlerts.some((record) => getBodyMapDecision(record).decision === 'Trabajo modificado' || getBodyMapDecision(record).decision === 'No campo / fisioterapia')) {
      decision = 'Trabajo modificado';
      reasons.push('alerta corporal');
    } else if (loadRiskProfile.decision === 'Carga reducida' || predictiveRisk.tone === 'red') {
      decision = 'Carga reducida';
      reasons.push(`riesgo predictivo ${predictiveRisk.score}/100`);
    } else if (dynamicThresholds.wellness.outsideNormal && wellness !== undefined && (dynamicThresholds.wellness.zScore ?? 0) < -1.5) {
      decision = 'Carga reducida';
      reasons.push(`wellness fuera de rango individual (z ${dynamicThresholds.wellness.zScore})`);
    } else if (dynamicThresholds.rpe.outsideNormal && internal && (dynamicThresholds.rpe.zScore ?? 0) > 1.5) {
      decision = 'Carga reducida';
      reasons.push(`RPE fuera de rango individual (z ${dynamicThresholds.rpe.zScore})`);
    } else if ((wellness !== undefined && wellness < 3 && dynamicThresholds.wellness.count < 5) || (internal && internal.rpe >= 9 && dynamicThresholds.rpe.count < 5)) {
      decision = 'Carga reducida';
      reasons.push(wellness !== undefined && wellness < 3 ? `wellness ${wellness.toFixed(1)}` : `RPE ${internal?.rpe}`);
    } else if (loadRiskProfile.decision === 'Control preventivo' || predictiveRisk.tone === 'amber') {
      decision = 'Control preventivo';
      reasons.push(`riesgo predictivo ${predictiveRisk.score}/100`);
    } else if ((dynamicThresholds.load.outsideNormal && (dynamicThresholds.load.zScore ?? 0) > 1.5) || (strengthDeltaPct !== undefined && strengthDeltaPct >= 30)) {
      decision = 'Control preventivo';
      reasons.push(dynamicThresholds.load.outsideNormal ? `carga fuera de rango individual (z ${dynamicThresholds.load.zScore})` : `fuerza +${strengthDeltaPct}%`);
    } else if ((wellness !== undefined && wellness <= 3.2 && dynamicThresholds.wellness.count < 5) || (internal && internal.rpe >= 8 && dynamicThresholds.rpe.count < 5)) {
      decision = 'Control preventivo';
      reasons.push(wellness !== undefined && wellness <= 3.2 ? `wellness ${wellness.toFixed(1)}` : `RPE ${internal?.rpe}`);
    }

    if (decision === 'Carga completa') {
      const comp = compensationRecommendation(player, latestMinutes, decision);
      if (comp.includes('Compensatorio') || comp.includes('subestimulación')) {
        decision = 'Compensatorio';
        reasons.push('minutos/rol');
      }
    }

    const action = decision === 'No campo' ? 'No exponer a campo hasta validación.'
      : decision === 'Trabajo modificado' ? 'Modificar tarea y restringir componente limitado.'
      : decision === 'Carga reducida' ? 'Reducir volumen/intensidad y controlar respuesta.'
      : decision === 'Control preventivo' ? 'Entrena con seguimiento y evitar repetir picos.'
      : decision === 'Compensatorio' ? 'Completar estímulo sin ignorar dolor ni wellness.'
      : 'Mantener planificación.';

    const hasGpsIssue = external && fieldMinutes >= 45 && distance < 300 && num(external.playerLoad) < 50;
    const quality: 'Alta' | 'Media' | 'Baja' = hasGpsIssue ? 'Baja' : loadRiskProfile.dataConfidence.label;
    const confidenceScore = hasGpsIssue ? Math.min(loadRiskProfile.dataConfidence.score, 60) : loadRiskProfile.dataConfidence.score;
    const confidenceLabel: 'Alta' | 'Media' | 'Baja' = confidenceScore >= 80 ? 'Alta' : confidenceScore >= 55 ? 'Media' : 'Baja';

    return {
      player,
      wellness,
      internal,
      external,
      strengthSessions: playerStrength,
      strengthResponseRpe,
      bodyAlerts,
      componentAvailability,
      decision,
      reason: reasons.length ? uniq(reasons).join(' · ') : 'sin alerta crítica',
      action,
      quality,
      predictiveRisk,
      dynamicThresholds,
      dataConfidence: { score: confidenceScore, label: confidenceLabel, adherencePct: loadRiskProfile.wellness.adherence28d },
      plannedVsExecuted: { fieldMinutes, fieldLoad, distance, neuromuscular, strengthPlanned, strengthPerceived, strengthDeltaPct },
      compensation: compensationRecommendation(player, latestMinutes, decision),
      history: recentHistory(data, player, date, bodyAlerts),
    };
  }).sort((a, b) => {
    const order: Record<DailyLoadDecision, number> = { 'No campo': 0, 'Trabajo modificado': 1, 'Carga reducida': 2, 'Control preventivo': 3, 'Compensatorio': 4, 'Carga completa': 5 };
    return order[a.decision] - order[b.decision] || a.player.name.localeCompare(b.player.name);
  });
};

export const decisionTone = (decision: DailyLoadDecision): 'green' | 'amber' | 'red' | 'blue' | 'neutral' => {
  if (decision === 'Carga completa') return 'green';
  if (decision === 'Compensatorio') return 'blue';
  if (decision === 'Control preventivo') return 'amber';
  if (decision === 'Carga reducida') return 'amber';
  if (decision === 'Trabajo modificado') return 'red';
  return 'red';
};
