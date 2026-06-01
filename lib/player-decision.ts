import type { BodyMapRecord } from './body-map';
import type { AppData, Player, TrainingSessionType } from './types';
import { computePredictiveRisk, type PredictiveRiskResult } from './predictive-risk';
import { computePlayerScientificLoadDecision, type PlayerScientificLoadDecision } from './scientific-load';
import {
  computePlayerLoadRiskProfile,
  type DailyLoadDecisionState,
  type LoadRiskProfile,
} from './load-risk-engine';
import { computeDynamicThresholds, computeWellnessAdherence, type AdherencePlayerMetrics, type DynamicThresholdMetric } from './sport-science';
import { averageWellness } from './wellness-metrics';

export type { DailyLoadDecisionState };

export interface PlayerDecisionContext {
  profile: LoadRiskProfile;
  predictive: PredictiveRiskResult;
  scientific: PlayerScientificLoadDecision;
  wellnessToday?: number;
  dynamicThresholds: Record<'wellness' | 'rpe' | 'load', DynamicThresholdMetric>;
  wellnessAdherence: AdherencePlayerMetrics;
}

export const buildPlayerDecisionContext = (args: {
  data: AppData;
  player: Player;
  date: string;
  bodyRecords?: BodyMapRecord[];
  sessionType?: TrainingSessionType;
}): PlayerDecisionContext => {
  const openBody =
    args.bodyRecords?.filter(
      (record) => record.status !== 'Cerrado' && record.date <= args.date,
    ) ?? [];

  const profile = computePlayerLoadRiskProfile({
    data: args.data,
    player: args.player,
    date: args.date,
    bodyRecords: openBody,
  });

  const predictive = computePredictiveRisk({
    data: args.data,
    player: args.player,
    date: args.date,
    bodyRecords: openBody,
  });

  const scientific = computePlayerScientificLoadDecision({
    player: args.player,
    data: args.data,
    date: args.date,
    sessionType: args.sessionType,
    bodyRecords: openBody,
  });

  const wellnessRecord = args.data.wellness.find(
    (item) => item.playerId === args.player.id && item.date === args.date,
  );

  return {
    profile,
    predictive,
    scientific,
    wellnessToday: wellnessRecord ? averageWellness(wellnessRecord) : undefined,
    dynamicThresholds: computeDynamicThresholds(profile),
    wellnessAdherence: computeWellnessAdherence(args.data, args.player, args.date),
  };
};
