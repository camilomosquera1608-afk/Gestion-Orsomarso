import type {
  CompetitionRecord,
  CompetitionTacticalStats,
  CompetitionPhysicalStats,
  CompetitionGoalkeeperStats,
  CompetitionMatchMetadata,
} from './types';

/**
 * Crea un registro de competencia con validación
 */
export function createCompetitionRecord(params: {
  playerId: string;
  date: string;
  opponent: string;
  minutesPlayed: number;
  tactical: CompetitionTacticalStats;
  physical?: CompetitionPhysicalStats;
  goalkeeper?: CompetitionGoalkeeperStats;
  metadata?: CompetitionMatchMetadata;
  category?: string;
  baseCategory?: string;
  actingCategory?: string;
  competitionName?: string;
  matchId?: string;
}): CompetitionRecord {
  const {
    playerId,
    date,
    opponent,
    minutesPlayed,
    tactical,
    physical,
    goalkeeper,
    metadata,
    category,
    baseCategory,
    actingCategory,
    competitionName,
    matchId,
  } = params;

  // Validaciones básicas
  if (!playerId) throw new Error('playerId es requerido');
  if (!date) throw new Error('date es requerido');
  if (!opponent) throw new Error('opponent es requerido');
  if (minutesPlayed < 0) throw new Error('minutesPlayed debe ser >= 0');

  // Validar métricas tácticas
  if (tactical.goals < 0) throw new Error('goals debe ser >= 0');
  if (tactical.assists < 0) throw new Error('assists debe ser >= 0');
  if (tactical.yellowCards < 0) throw new Error('yellowCards debe ser >= 0');
  if (tactical.redCards < 0) throw new Error('redCards debe ser >= 0');

  return {
    id: crypto.randomUUID(),
    matchId,
    playerId,
    date,
    opponent,
    competitionName,
    minutesPlayed,
    tactical,
    physical,
    goalkeeper,
    metadata,
    category: category as any,
    baseCategory: baseCategory as any,
    actingCategory: actingCategory as any,
  };
}

/**
 * Valida un registro de competencia
 */
export function validateCompetitionRecord(record: CompetitionRecord): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!record.id) errors.push('id es requerido');
  if (!record.playerId) errors.push('playerId es requerido');
  if (!record.date) errors.push('date es requerido');
  if (!record.opponent) errors.push('opponent es requerido');
  if (record.minutesPlayed < 0) errors.push('minutesPlayed debe ser >= 0');

  // Validar métricas tácticas
  if (!record.tactical) errors.push('tactical es requerido');
  else {
    if (record.tactical.goals < 0) errors.push('goals debe ser >= 0');
    if (record.tactical.assists < 0) errors.push('assists debe ser >= 0');
    if (record.tactical.yellowCards < 0) errors.push('yellowCards debe ser >= 0');
    if (record.tactical.redCards < 0) errors.push('redCards debe ser >= 0');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Crea métricas tácticas con valores por defecto
 */
export function createTacticalStats(params: {
  goals?: number;
  assists?: number;
  yellowCards?: number;
  redCards?: number;
  shotsOnTarget?: number;
}): CompetitionTacticalStats {
  return {
    goals: params.goals ?? 0,
    assists: params.assists ?? 0,
    yellowCards: params.yellowCards ?? 0,
    redCards: params.redCards ?? 0,
    shotsOnTarget: params.shotsOnTarget,
  };
}

/**
 * Crea métricas físicas (GPS)
 */
export function createPhysicalStats(params: {
  totalDistance?: number;
  highSpeedDistance?: number;
  hsr?: number;
  sprintDistance?: number;
  maxVelocity?: number;
  playerLoad?: number;
  acc?: number;
  dcc?: number;
  sprints?: number;
  rhie?: number;
  ima?: number;
}): CompetitionPhysicalStats {
  return {
    totalDistance: params.totalDistance,
    highSpeedDistance: params.highSpeedDistance,
    hsr: params.hsr,
    sprintDistance: params.sprintDistance,
    maxVelocity: params.maxVelocity,
    playerLoad: params.playerLoad,
    acc: params.acc,
    dcc: params.dcc,
    sprints: params.sprints,
    rhie: params.rhie,
    ima: params.ima,
  };
}

/**
 * Crea métricas de portero
 */
export function createGoalkeeperStats(params: {
  goalsConceded?: number;
  goalsPrevented?: number;
  penaltiesSaved?: number;
  crossesDefended?: number;
  footworkActions?: number;
}): CompetitionGoalkeeperStats {
  return {
    goalsConceded: params.goalsConceded,
    goalsPrevented: params.goalsPrevented,
    penaltiesSaved: params.penaltiesSaved,
    crossesDefended: params.crossesDefended,
    footworkActions: params.footworkActions,
  };
}

/**
 * Crea metadatos del partido
 */
export function createMatchMetadata(params: {
  startingRole?: string;
  postCompetitionStatus?: string;
  medicalStatus?: string;
  injuryKind?: string;
  medicalObservation?: string;
  movementType?: string;
  movementNote?: string;
  movementModule?: string;
  loggedBy?: string;
}): CompetitionMatchMetadata {
  return {
    startingRole: params.startingRole as any,
    postCompetitionStatus: params.postCompetitionStatus,
    medicalStatus: params.medicalStatus as any,
    injuryKind: params.injuryKind as any,
    medicalObservation: params.medicalObservation,
    movementType: params.movementType as any,
    movementNote: params.movementNote,
    movementModule: params.movementModule as any,
    loggedBy: params.loggedBy,
  };
}

/**
 * Convierte datos antiguos de CompetitionRecord al nuevo formato
 */
export function migrateLegacyCompetitionRecord(legacy: any): CompetitionRecord {
  return createCompetitionRecord({
    playerId: legacy.playerId,
    date: legacy.date,
    opponent: legacy.opponent,
    minutesPlayed: legacy.minutesPlayed,
    competitionName: legacy.competitionName,
    matchId: legacy.matchId,
    category: legacy.category,
    baseCategory: legacy.baseCategory,
    actingCategory: legacy.actingCategory,
    tactical: createTacticalStats({
      goals: legacy.goals,
      assists: legacy.assists,
      yellowCards: legacy.yellowCards,
      redCards: legacy.redCards,
      shotsOnTarget: legacy.shotsOnTarget,
    }),
    physical: createPhysicalStats({
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
    }),
    goalkeeper: createGoalkeeperStats({
      goalsConceded: legacy.goalsConceded,
      goalsPrevented: legacy.goalsPrevented,
      penaltiesSaved: legacy.penaltiesSaved,
      crossesDefended: legacy.crossesDefended,
      footworkActions: legacy.footworkActions,
    }),
    metadata: createMatchMetadata({
      startingRole: legacy.startingRole,
      postCompetitionStatus: legacy.postCompetitionStatus,
      medicalStatus: legacy.medicalStatus,
      injuryKind: legacy.injuryKind,
      medicalObservation: legacy.medicalObservation,
      movementType: legacy.movementType,
      movementNote: legacy.movementNote,
      movementModule: legacy.movementModule,
      loggedBy: legacy.loggedBy,
    }),
  });
}

/**
 * Formatea datos de competencia para UI
 */
export function formatCompetitionData(record: CompetitionRecord): {
  id: string;
  playerName?: string;
  date: string;
  opponent: string;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  totalDistance?: number;
  maxVelocity?: number;
  playerLoad?: number;
} {
  return {
    id: record.id,
    date: record.date,
    opponent: record.opponent,
    minutesPlayed: record.minutesPlayed,
    goals: record.tactical.goals,
    assists: record.tactical.assists,
    yellowCards: record.tactical.yellowCards,
    redCards: record.tactical.redCards,
    totalDistance: record.physical?.totalDistance,
    maxVelocity: record.physical?.maxVelocity,
    playerLoad: record.physical?.playerLoad,
  };
}

/**
 * Calcula estadísticas agregadas de competencia
 */
export function calculateCompetitionStats(records: CompetitionRecord[]): {
  totalMatches: number;
  totalMinutes: number;
  totalGoals: number;
  totalAssists: number;
  avgGoals: number;
  avgAssists: number;
  avgMinutes: number;
} {
  if (records.length === 0) {
    return {
      totalMatches: 0,
      totalMinutes: 0,
      totalGoals: 0,
      totalAssists: 0,
      avgGoals: 0,
      avgAssists: 0,
      avgMinutes: 0,
    };
  }

  const totalMinutes = records.reduce((sum, r) => sum + r.minutesPlayed, 0);
  const totalGoals = records.reduce((sum, r) => sum + r.tactical.goals, 0);
  const totalAssists = records.reduce((sum, r) => sum + r.tactical.assists, 0);

  return {
    totalMatches: records.length,
    totalMinutes,
    totalGoals,
    totalAssists,
    avgGoals: Math.round((totalGoals / records.length) * 10) / 10,
    avgAssists: Math.round((totalAssists / records.length) * 10) / 10,
    avgMinutes: Math.round(totalMinutes / records.length),
  };
}
