import type {
  CompetitionRecord,
  CompetitionTacticalStats,
  CompetitionPhysicalStats,
  CompetitionGoalkeeperStats,
  CompetitionMatchMetadata,
} from './types';

/**
 * Interfaz legada para compatibilidad con componentes existentes
 * Esta interfaz mantiene la estructura antigua de CompetitionRecord
 */
export interface LegacyCompetitionRecord {
  id: string;
  matchId?: string;
  playerId: string;
  date: string;
  opponent: string;
  competitionName?: string;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  acc?: number;
  dcc?: number;
  sprints?: number;
  rhie?: number;
  ima?: number;
  totalDistance?: number;
  highSpeedDistance?: number;
  hsr?: number;
  sprintDistance?: number;
  maxVelocity?: number;
  playerLoad?: number;
  goalsConceded?: number;
  goalsPrevented?: number;
  penaltiesSaved?: number;
  crossesDefended?: number;
  footworkActions?: number;
  shotsOnTarget?: number;
  category?: string;
  baseCategory?: string;
  actingCategory?: string;
  movementType?: string;
  movementNote?: string;
  movementModule?: string;
  loggedBy?: string;
  startingRole?: string;
  postCompetitionStatus?: string;
  medicalStatus?: string;
  injuryKind?: string;
  medicalObservation?: string;
}

/**
 * Convierte del nuevo formato al formato legado (compatibilidad hacia atrás)
 */
export function toLegacyCompetitionRecord(record: CompetitionRecord): LegacyCompetitionRecord {
  return {
    id: record.id,
    matchId: record.matchId,
    playerId: record.playerId,
    date: record.date,
    opponent: record.opponent,
    competitionName: record.competitionName,
    minutesPlayed: record.minutesPlayed,
    // Métricas tácticas
    goals: record.tactical.goals,
    assists: record.tactical.assists,
    yellowCards: record.tactical.yellowCards,
    redCards: record.tactical.redCards,
    shotsOnTarget: record.tactical.shotsOnTarget,
    // Métricas físicas
    totalDistance: record.physical?.totalDistance,
    highSpeedDistance: record.physical?.highSpeedDistance,
    hsr: record.physical?.hsr,
    sprintDistance: record.physical?.sprintDistance,
    maxVelocity: record.physical?.maxVelocity,
    playerLoad: record.physical?.playerLoad,
    acc: record.physical?.acc,
    dcc: record.physical?.dcc,
    sprints: record.physical?.sprints,
    rhie: record.physical?.rhie,
    ima: record.physical?.ima,
    // Métricas de portero
    goalsConceded: record.goalkeeper?.goalsConceded,
    goalsPrevented: record.goalkeeper?.goalsPrevented,
    penaltiesSaved: record.goalkeeper?.penaltiesSaved,
    crossesDefended: record.goalkeeper?.crossesDefended,
    footworkActions: record.goalkeeper?.footworkActions,
    // Metadatos
    startingRole: record.metadata?.startingRole,
    postCompetitionStatus: record.metadata?.postCompetitionStatus,
    medicalStatus: record.metadata?.medicalStatus,
    injuryKind: record.metadata?.injuryKind,
    medicalObservation: record.metadata?.medicalObservation,
    movementType: record.metadata?.movementType,
    movementNote: record.metadata?.movementNote,
    movementModule: record.metadata?.movementModule,
    loggedBy: record.metadata?.loggedBy,
    // Categoría
    category: record.category,
    baseCategory: record.baseCategory,
    actingCategory: record.actingCategory,
  };
}

/**
 * Convierte del formato legado al nuevo formato
 */
export function fromLegacyCompetitionRecord(legacy: LegacyCompetitionRecord): CompetitionRecord {
  const tactical: CompetitionTacticalStats = {
    goals: legacy.goals,
    assists: legacy.assists,
    yellowCards: legacy.yellowCards,
    redCards: legacy.redCards,
    shotsOnTarget: legacy.shotsOnTarget,
  };

  const physical: CompetitionPhysicalStats | undefined = 
    (legacy.totalDistance || legacy.highSpeedDistance || legacy.hsr || 
     legacy.sprintDistance || legacy.maxVelocity || legacy.playerLoad ||
     legacy.acc || legacy.dcc || legacy.sprints || legacy.rhie || legacy.ima)
      ? {
          totalDistance: legacy.totalDistance,
          highSpeedDistance: legacy.highSpeedDistance,
          hsr: legacy.hsr,
          sprintDistance: legacy.sprintDistance,
          maxVelocity: legacy.maxVelocity,
          playerLoad: legacy.playerLoad,
          acc: legacy.acc,
          dcc: legacy.dcc,
          sprints: legacy.sprints,
          rhie: legacy.rhie,
          ima: legacy.ima,
        }
      : undefined;

  const goalkeeper: CompetitionGoalkeeperStats | undefined =
    (legacy.goalsConceded || legacy.goalsPrevented || legacy.penaltiesSaved ||
     legacy.crossesDefended || legacy.footworkActions)
      ? {
          goalsConceded: legacy.goalsConceded,
          goalsPrevented: legacy.goalsPrevented,
          penaltiesSaved: legacy.penaltiesSaved,
          crossesDefended: legacy.crossesDefended,
          footworkActions: legacy.footworkActions,
        }
      : undefined;

  const metadata: CompetitionMatchMetadata | undefined =
    (legacy.startingRole || legacy.postCompetitionStatus || legacy.medicalStatus ||
     legacy.injuryKind || legacy.medicalObservation || legacy.movementType ||
     legacy.movementNote || legacy.movementModule || legacy.loggedBy)
      ? {
          startingRole: legacy.startingRole as any,
          postCompetitionStatus: legacy.postCompetitionStatus,
          medicalStatus: legacy.medicalStatus as any,
          injuryKind: legacy.injuryKind as any,
          medicalObservation: legacy.medicalObservation,
          movementType: legacy.movementType as any,
          movementNote: legacy.movementNote,
          movementModule: legacy.movementModule as any,
          loggedBy: legacy.loggedBy,
        }
      : undefined;

  return {
    id: legacy.id,
    matchId: legacy.matchId,
    playerId: legacy.playerId,
    date: legacy.date,
    opponent: legacy.opponent,
    competitionName: legacy.competitionName,
    minutesPlayed: legacy.minutesPlayed,
    tactical,
    physical,
    goalkeeper,
    metadata,
    category: legacy.category as any,
    baseCategory: legacy.baseCategory as any,
    actingCategory: legacy.actingCategory as any,
  };
}

/**
 * Convierte un array de registros del nuevo formato al legado
 */
export function toLegacyCompetitionRecords(records: CompetitionRecord[]): LegacyCompetitionRecord[] {
  return records.map(toLegacyCompetitionRecord);
}

/**
 * Convierte un array de registros del formato legado al nuevo
 */
export function fromLegacyCompetitionRecords(legacyRecords: LegacyCompetitionRecord[]): CompetitionRecord[] {
  return legacyRecords.map(fromLegacyCompetitionRecord);
}
