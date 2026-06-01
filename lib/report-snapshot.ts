import { readBodyMapRecords, type BodyMapRecord } from './body-map';
import { buildPlayerDecisionContext, type PlayerDecisionContext } from './player-decision';
import type { AppData, Player } from './types';

/** DTO unificado para informes PDF / export con la misma lógica que plan diario y ficha. */
export type PlayerReportDecisionSnapshot = {
  playerId: string;
  date: string;
  profile: PlayerDecisionContext['profile'];
  predictive: PlayerDecisionContext['predictive'];
  scientific: PlayerDecisionContext['scientific'];
  wellnessToday?: number;
  dynamicThresholds: PlayerDecisionContext['dynamicThresholds'];
  wellnessAdherence: PlayerDecisionContext['wellnessAdherence'];
};

export const buildPlayerReportDecisionSnapshot = (args: {
  data: AppData;
  player: Player;
  date: string;
  bodyRecords?: BodyMapRecord[];
}): PlayerReportDecisionSnapshot => {
  const ctx = buildPlayerDecisionContext({
    data: args.data,
    player: args.player,
    date: args.date,
    bodyRecords: args.bodyRecords,
  });
  return {
    playerId: args.player.id,
    date: args.date,
    profile: ctx.profile,
    predictive: ctx.predictive,
    scientific: ctx.scientific,
    wellnessToday: ctx.wellnessToday,
    dynamicThresholds: ctx.dynamicThresholds,
    wellnessAdherence: ctx.wellnessAdherence,
  };
};

export const buildReportSnapshotsForPlayers = (
  data: AppData,
  players: Player[],
  date: string,
  bodyRecords = readBodyMapRecords(),
): PlayerReportDecisionSnapshot[] =>
  players.map((player) =>
    buildPlayerReportDecisionSnapshot({ data, player, date, bodyRecords }),
  );
