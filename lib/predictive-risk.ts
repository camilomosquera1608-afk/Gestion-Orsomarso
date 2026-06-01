import type { AppData, DailyExternalLoadRecord, Player } from './types';
import type { BodyMapRecord } from './body-map';
import { computePlayerLoadRiskProfile, computeVariableAcwr } from './load-risk-engine';

export type PredictiveRiskTone = 'green' | 'amber' | 'red';

export interface PredictiveRiskFactor {
  key: string;
  label: string;
  points: number;
}

export interface PredictiveRiskResult {
  score: number;
  tone: PredictiveRiskTone;
  label: 'Bajo' | 'Moderado' | 'Alto';
  factors: PredictiveRiskFactor[];
  alerts: string[];
  metrics: {
    arc: number;
    acwr: number;
    acwrEwma: number;
    acuteLoad: number;
    chronicWeeklyLoad: number;
    monotony: number;
    strain: number;
    negativeWellnessStreak: number;
    wellnessToday?: number;
    wellnessBaseline?: number;
    wellnessDelta?: number;
    daysWithoutVelocityExposure?: number;
    daysSinceSprint?: number;
    abruptReturn: boolean;
    highPain?: number;
    highPainRegion?: string;
    neuromuscularToday: number;
    neuromuscularPreviousMax: number;
    readaptationHighNmWithoutProgression: boolean;
    dataConfidenceScore: number;
    dataConfidenceLabel: 'Alta' | 'Media' | 'Baja';
    riskDomains: Record<string, number>;
  };
}

export { neuromuscularLoad } from './load-metrics';

export const computeArcRatio = (data: AppData, player: Player, date: string) =>
  computePlayerLoadRiskProfile({ data, player, date }).acwr.primary.rolling;

export const computePredictiveRisk = (args: {
  data: AppData;
  player: Player;
  date: string;
  bodyRecords?: BodyMapRecord[];
}): PredictiveRiskResult => {
  const profile = computePlayerLoadRiskProfile(args);
  const highPain = args.bodyRecords
    ?.filter((record) => record.playerId === args.player.id && record.status !== 'Cerrado' && record.date <= args.date)
    .sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`))[0];
  const previousNm = Math.max(0, ...profile.load.last28.slice(0, -1).map((day) => day.neuromuscular));
  const readaptationHighNmWithoutProgression = args.player.status === 'Readaptación'
    && profile.load.today.neuromuscular > 0
    && profile.load.today.neuromuscular > Math.max(previousNm * 1.35, 60);

  return {
    score: profile.riskScore,
    tone: profile.riskTone,
    label: profile.riskLabel,
    factors: profile.contributions.map((item) => ({ key: item.key, label: item.label, points: item.points })),
    alerts: profile.alerts,
    metrics: {
      arc: profile.acwr.primary.rolling,
      acwr: profile.acwr.primary.rolling,
      acwrEwma: profile.acwr.primary.ewma,
      acuteLoad: profile.acwr.primary.acute,
      chronicWeeklyLoad: profile.acwr.primary.chronic,
      monotony: profile.monotony.monotony,
      strain: profile.monotony.strain,
      negativeWellnessStreak: profile.wellness.streakBelowBaseline,
      wellnessToday: profile.wellness.today,
      wellnessBaseline: profile.wellness.baseline,
      wellnessDelta: profile.wellness.delta,
      daysWithoutVelocityExposure: profile.velocity.daysSinceHighSpeed,
      daysSinceSprint: profile.velocity.daysSinceSprint,
      abruptReturn: profile.velocity.abruptHighSpeedReturn || profile.velocity.abruptSprintReturn,
      highPain: highPain?.intensity,
      highPainRegion: highPain?.region,
      neuromuscularToday: profile.load.today.neuromuscular,
      neuromuscularPreviousMax: previousNm,
      readaptationHighNmWithoutProgression,
      dataConfidenceScore: profile.dataConfidence.score,
      dataConfidenceLabel: profile.dataConfidence.label,
      riskDomains: profile.domainScores,
    },
  };
};

export const riskToneLabel = (tone: PredictiveRiskTone) => tone === 'red' ? 'Rojo' : tone === 'amber' ? 'Ambar' : 'Verde';

export { computeVariableAcwr };
