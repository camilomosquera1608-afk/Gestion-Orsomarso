import { normalizeNutritionRecord } from './nutrition';
import {
  AppData,
  CMJRecord,
  CompetitionMatchSummary,
  CompetitionRecord,
  DailyExternalLoadRecord,
  DailyInternalLoadRecord,
  DailyWellnessRecord,
  FMSRecord,
  MatchResultType,
  Microcycle,
  NeuromuscularRecord,
  NutritionRecord,
  Player,
  TrainingSessionSummary,
  StrengthSession,
} from './types';

export const asArray = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const hasOwnArray = <K extends keyof AppData>(stored: Partial<AppData> | null | undefined, key: K): stored is Partial<AppData> & Record<K, unknown[]> => {
  return !!stored && Object.prototype.hasOwnProperty.call(stored, key) && Array.isArray(stored[key]);
};

const pickArray = <T, K extends keyof AppData>(stored: Partial<AppData> | null | undefined, fallback: AppData, key: K): T[] => {
  return hasOwnArray(stored, key) ? (stored[key] as T[]) : ((fallback[key] as T[] | undefined) ?? []);
};

export const isGoalkeeper = (player?: Pick<Player, 'position'> | null) => player?.position === 'Portero';

export const calculateMatchResult = (goalsFor: number, goalsAgainst: number): MatchResultType => {
  if (goalsFor > goalsAgainst) return 'Victoria';
  if (goalsFor < goalsAgainst) return 'Derrota';
  return 'Empate';
};

export const formatMatchScore = (match: Pick<CompetitionMatchSummary, 'goalsFor' | 'goalsAgainst' | 'result'>) => {
  if (typeof match.goalsFor === 'number' && typeof match.goalsAgainst === 'number') return `${match.goalsFor}-${match.goalsAgainst}`;
  return match.result?.trim() || '-';
};

export const isAllCategory = (category?: string | null) => !category || category === 'all';

export const microcycleBelongsToCategory = (microcycle: Pick<Microcycle, 'category'>, activeCategory?: string | null) => {
  if (isAllCategory(activeCategory)) return true;
  return (microcycle.category ?? 'Sub20') === activeCategory;
};

export const getMicrocyclesForCategory = (microcycles: Microcycle[], activeCategory?: string | null) =>
  asArray(microcycles).filter((microcycle) => microcycleBelongsToCategory(microcycle, activeCategory));

export const findMicrocycleByDate = (microcycles: Microcycle[], date: string, preferredMicrocycleId?: string, activeCategory?: string | null) => {
  if (!date) return undefined;

  const candidates = getMicrocyclesForCategory(microcycles, activeCategory).filter((microcycle) => microcycle.startDate && microcycle.endDate);
  const containsDate = (microcycle: Microcycle) => date >= microcycle.startDate && date <= microcycle.endDate;

  const preferred = preferredMicrocycleId
    ? candidates.find((microcycle) => microcycle.id === preferredMicrocycleId && containsDate(microcycle))
    : undefined;

  if (preferred) return preferred;

  return candidates
    .filter(containsDate)
    .sort((a, b) => {
      const byStartDate = b.startDate.localeCompare(a.startDate);
      if (byStartDate !== 0) return byStartDate;
      const byEndDate = b.endDate.localeCompare(a.endDate);
      if (byEndDate !== 0) return byEndDate;
      return b.id.localeCompare(a.id);
    })[0];
};

const ensureMicrocycles = (stored: Partial<AppData> | null | undefined, fallback: AppData): Microcycle[] => {
  const source = pickArray<Microcycle, 'microcycles'>(stored, fallback, 'microcycles');
  const byId = new Map<string, Microcycle>();
  source.forEach((item, index) => {
    if (!item) return;
    const id = item.id || `mc-${index + 1}`;
    byId.set(id, {
      id,
      name: item.name || `Microciclo ${index + 1}`,
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      objective: item.objective || '',
      notes: item.notes || '',
      status: item.status || '',
      weekNumber: item.weekNumber,
      category: item.category ?? 'Sub20',
    });
  });
  return Array.from(byId.values());
};

const normalizeMatchSummary = (match: CompetitionMatchSummary): CompetitionMatchSummary => {
  const goalsFor = typeof match.goalsFor === 'number' ? match.goalsFor : undefined;
  const goalsAgainst = typeof match.goalsAgainst === 'number' ? match.goalsAgainst : undefined;
  const resultType = match.resultType ?? (typeof goalsFor === 'number' && typeof goalsAgainst === 'number' ? calculateMatchResult(goalsFor, goalsAgainst) : undefined);
  return {
    ...match,
    venue: match.venue === 'Visitante' ? 'Visitante' : 'Local',
    goalsFor,
    goalsAgainst,
    resultType,
    result: match.result || (typeof goalsFor === 'number' && typeof goalsAgainst === 'number' ? `${goalsFor}-${goalsAgainst}` : ''),
  };
};

export const normalizeAppData = (stored: Partial<AppData> | null | undefined, fallback: AppData): AppData => {
  const microcycles = ensureMicrocycles(stored, fallback);
  const defaultMicrocycleId = microcycles[0]?.id ?? fallback.microcycles[0]?.id ?? 'mc-1';
  const microcycleFor = (date: string, categoryValue?: string, preferredMicrocycleId?: string) =>
    findMicrocycleByDate(microcycles, date, preferredMicrocycleId, categoryValue)?.id ?? defaultMicrocycleId;

  const players = pickArray<Player, 'players'>(stored, fallback, 'players').map((player) => ({
    ...player,
    category: player.category ?? 'Sub20',
    categoryHistory: player.categoryHistory?.length ? player.categoryHistory : [player.category ?? 'Sub20'],
  }));

  const getPlayer = (playerId: string) => players.find((player) => player.id === playerId);

  const matchSummaries = pickArray<CompetitionMatchSummary, 'competitionMatchSummaries'>(stored, fallback, 'competitionMatchSummaries').map(normalizeMatchSummary);

  return {
    ...fallback,
    ...stored,
    players,
    wellness: pickArray<DailyWellnessRecord, 'wellness'>(stored, fallback, 'wellness'),
    internalLoads: pickArray<DailyInternalLoadRecord, 'internalLoads'>(stored, fallback, 'internalLoads').map((record) => ({
      ...record,
      microcycleId: record.microcycleId ?? microcycleFor(record.date, record.category ?? getPlayer(record.playerId)?.category),
      sessionNumber: record.sessionNumber ?? 1,
      category: record.category ?? getPlayer(record.playerId)?.category,
    })),
    externalLoads: pickArray<DailyExternalLoadRecord, 'externalLoads'>(stored, fallback, 'externalLoads').map((record) => ({
      ...record,
      microcycleId: record.microcycleId ?? microcycleFor(record.date, record.category ?? getPlayer(record.playerId)?.category),
      sessionNumber: record.sessionNumber ?? 1,
      category: record.category ?? getPlayer(record.playerId)?.category ?? 'Sub20',
      sessionType: record.sessionType ?? 'MD-3',
      participation: record.participation ?? 'Completa',
      sprints: record.sprints ?? 0,
      ima: record.ima ?? 0,
      hsr: record.hsr ?? record.highSpeedDistance ?? 0,
      highSpeedDistance: record.highSpeedDistance ?? record.hsr ?? 0,
      sprintDistance: record.sprintDistance ?? 0,
      distancePerMin: record.distancePerMin ?? (record.totalDistance && record.min ? Number((record.totalDistance / record.min).toFixed(1)) : undefined),
      maxVelocity: record.maxVelocity ?? undefined,
      playerLoad: record.playerLoad ?? undefined,
      playerLoadPerMin: record.playerLoadPerMin ?? (record.playerLoad && record.min ? Number((record.playerLoad / record.min).toFixed(2)) : undefined),
      baseCategory: record.baseCategory ?? record.category ?? getPlayer(record.playerId)?.category,
      actingCategory: record.actingCategory ?? record.category ?? getPlayer(record.playerId)?.category,
      movementType: record.movementType ?? 'base',
      movementModule: record.movementModule ?? (String(record.id ?? '').startsWith('comp-load-') ? 'competencia' : 'sesion'),
    })),
    cmjRecords: pickArray<CMJRecord, 'cmjRecords'>(stored, fallback, 'cmjRecords'),
    nutritionRecords: pickArray<NutritionRecord, 'nutritionRecords'>(stored, fallback, 'nutritionRecords').map(normalizeNutritionRecord),
    neuromuscularRecords: pickArray<NeuromuscularRecord, 'neuromuscularRecords'>(stored, fallback, 'neuromuscularRecords'),
    fmsRecords: pickArray<FMSRecord, 'fmsRecords'>(stored, fallback, 'fmsRecords'),
    competitionMatchSummaries: matchSummaries,
    competitionRecords: pickArray<CompetitionRecord, 'competitionRecords'>(stored, fallback, 'competitionRecords').map((record) => {
      const player = getPlayer(record.playerId);
      const match = matchSummaries.find((item) => item.id === record.matchId || (item.date === record.date && item.opponent === record.opponent));
      const goalkeeper = isGoalkeeper(player);
      return {
        ...record,
        matchId: record.matchId ?? match?.id,
        competitionName: record.competitionName ?? match?.competitionName ?? 'Competencia',
        goals: goalkeeper ? 0 : record.goals ?? 0,
        assists: goalkeeper ? 0 : record.assists ?? 0,
        yellowCards: record.yellowCards ?? 0,
        redCards: record.redCards ?? 0,
        goalsConceded: goalkeeper ? record.goalsConceded ?? 0 : undefined,
        goalsPrevented: goalkeeper ? record.goalsPrevented ?? 0 : undefined,
        penaltiesSaved: goalkeeper ? record.penaltiesSaved ?? 0 : undefined,
        crossesDefended: goalkeeper ? record.crossesDefended ?? 0 : undefined,
        footworkActions: goalkeeper ? record.footworkActions ?? 0 : undefined,
        startingRole: record.startingRole ?? (record.minutesPlayed >= 45 ? 'Titular' : 'Suplente'),
        postCompetitionStatus: record.postCompetitionStatus ?? (record.injuryKind || record.medicalObservation ? 'Lesionado' : 'Sin novedad'),
        medicalStatus: record.medicalStatus ?? ((record.injuryKind || record.medicalObservation || record.postCompetitionStatus === 'Lesionado') ? 'Lesionado' : 'Sin lesión'),
        medicalObservation: record.medicalObservation ?? '',
        category: record.category ?? match?.category ?? getPlayer(record.playerId)?.category ?? 'Sub20',
        baseCategory: record.baseCategory ?? getPlayer(record.playerId)?.category,
        actingCategory: record.actingCategory ?? record.category ?? match?.category ?? getPlayer(record.playerId)?.category,
        movementType: record.movementType ?? 'base',
        movementModule: record.movementModule ?? 'competencia',
      } as CompetitionRecord;
    }),
    trainingSessionSummaries: pickArray<TrainingSessionSummary, 'trainingSessionSummaries'>(stored, fallback, 'trainingSessionSummaries').map((record) => ({
      ...record,
      microcycleId: record.microcycleId ?? microcycleFor(record.date, record.category),
    })),
    strengthSessions: pickArray<StrengthSession, 'strengthSessions'>(stored, fallback, 'strengthSessions').map((record) => ({
      ...record,
      playerIds: Array.isArray(record.playerIds) ? record.playerIds : [],
      excludedPlayerIds: Array.isArray(record.excludedPlayerIds) ? record.excludedPlayerIds : [],
      exercises: Array.isArray(record.exercises) ? record.exercises : [],
      adjustments: Array.isArray(record.adjustments) ? record.adjustments : [],
      responses: Array.isArray(record.responses) ? record.responses : [],
      status: record.status ?? 'Planificada',
      category: record.category ?? 'Sub20',
    })),
    microcycles,
  };
};
