import type {
  AppData,
  ClubCategory,
  CompetitionRecord,
  DailyExternalLoadRecord,
  DailyInternalLoadRecord,
  DailyWellnessRecord,
  Player,
} from './types';
import { isGoalkeeper } from './performance-helpers';

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

const normalizePlayerName = (value: unknown) => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

export const playerIdentityKey = (player?: Pick<Player, 'id' | 'name' | 'category' | 'documentId'> | null) => {
  if (!player) return '';
  const documentKey = normalize(player.documentId);
  if (documentKey) return `doc:${documentKey}`;
  const nameKey = normalizePlayerName(player.name);
  const categoryKey = normalize(player.category);
  return nameKey ? `name:${categoryKey}:${nameKey}` : `id:${player.id}`;
};

export const getRelatedPlayerIds = (players: Player[], playerId: string) => {
  const player = players.find((item) => item.id === playerId);
  if (!player) return new Set([playerId]);
  const key = playerIdentityKey(player);
  return new Set(players.filter((item) => playerIdentityKey(item) === key).map((item) => item.id));
};

export const getRelatedPlayerIdSet = (allPlayers: Player[], visiblePlayers: Player[]) => {
  const ids = new Set<string>();
  visiblePlayers.forEach((player) => getRelatedPlayerIds(allPlayers, player.id).forEach((id) => ids.add(id)));
  return ids;
};

const recordCountForPlayer = (data: Pick<AppData, 'wellness' | 'internalLoads' | 'externalLoads' | 'competitionRecords'>, playerId: string) =>
  (data.wellness ?? []).filter((item) => item.playerId === playerId).length +
  (data.internalLoads ?? []).filter((item) => item.playerId === playerId).length +
  (data.externalLoads ?? []).filter((item) => item.playerId === playerId).length +
  (data.competitionRecords ?? []).filter((item) => item.playerId === playerId).length;

const playerCompletenessScore = (player: Player) => [
  player.documentId,
  player.birthDate,
  player.jerseyNumber,
  player.phone,
  player.height,
  player.weight,
  player.dominantFoot,
  player.competitiveRole,
  player.photoUrl || player.photo,
  player.medicalNotes,
].filter((value) => value !== undefined && value !== null && String(value).trim() !== '').length;

export const getCanonicalPlayers = (data: AppData, sourcePlayers?: Player[]) => {
  const players = sourcePlayers ?? data.players;
  const groups = new Map<string, Player[]>();
  players.forEach((player) => {
    const key = playerIdentityKey(player);
    groups.set(key, [...(groups.get(key) ?? []), player]);
  });

  return Array.from(groups.values()).map((group) => group.slice().sort((a, b) => {
    const recordDelta = recordCountForPlayer(data, b.id) - recordCountForPlayer(data, a.id);
    if (recordDelta) return recordDelta;
    const completenessDelta = playerCompletenessScore(b) - playerCompletenessScore(a);
    if (completenessDelta) return completenessDelta;
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  })[0]);
};

export const uniqueWellnessByPlayerIdentityDate = (players: Player[], records: DailyWellnessRecord[]) => {
  const byKey = new Map<string, DailyWellnessRecord>();
  records.forEach((record) => {
    const player = players.find((item) => item.id === record.playerId);
    const identity = player ? playerIdentityKey(player) : `id:${record.playerId}`;
    const key = `${identity}::${record.date}`;
    const existing = byKey.get(key);
    const score = [record.sleep, record.fatigue, record.stress, record.musclePain, record.mood].filter((value) => Number(value) > 0).length;
    const existingScore = existing ? [existing.sleep, existing.fatigue, existing.stress, existing.musclePain, existing.mood].filter((value) => Number(value) > 0).length : -1;
    if (!existing || score > existingScore || (score === existingScore && String(record.id).localeCompare(String(existing.id)) > 0)) byKey.set(key, record);
  });
  return Array.from(byKey.values());
};

export const isAllCategory = (category?: string | null) => !category || category === 'all';

export const sameCategory = (activeCategory: string, itemCategory?: string | null) =>
  isAllCategory(activeCategory) || !itemCategory || itemCategory === activeCategory;

export const playerCategory = (players: Player[], playerId: string): ClubCategory | undefined =>
  players.find((player) => player.id === playerId)?.category;

export const recordCategory = (
  players: Player[],
  record: { playerId?: string; category?: ClubCategory; actingCategory?: ClubCategory; baseCategory?: ClubCategory },
): ClubCategory | undefined =>
  record.category ?? record.actingCategory ?? record.baseCategory ?? (record.playerId ? playerCategory(players, record.playerId) : undefined);

export const recordBelongsToCategory = (
  players: Player[],
  activeCategory: string,
  record: { playerId?: string; category?: ClubCategory; actingCategory?: ClubCategory; baseCategory?: ClubCategory },
) => sameCategory(activeCategory, recordCategory(players, record));

export const isCompetitionExternalLoad = (record: Pick<DailyExternalLoadRecord, 'id' | 'movementModule'>) =>
  record.movementModule === 'competencia' || String(record.id ?? '').startsWith('comp-load-') || String(record.id ?? '').startsWith('competition-');

export const hasGpsValue = (record: Partial<DailyExternalLoadRecord> | Partial<CompetitionRecord>) =>
  Number(record.totalDistance ?? 0) > 0 ||
  Number(record.playerLoad ?? 0) > 0 ||
  Number(record.highSpeedDistance ?? record.hsr ?? 0) > 0 ||
  Number(record.sprintDistance ?? 0) > 0 ||
  Number(record.maxVelocity ?? 0) > 0 ||
  Number(record.acc ?? 0) > 0 ||
  Number(record.dcc ?? 0) > 0 ||
  Number(record.sprints ?? 0) > 0 ||
  Number(record.rhie ?? 0) > 0;

export const competitionRecordToExternalLoad = (
  record: CompetitionRecord,
  players: Player[] = [],
): DailyExternalLoadRecord | null => {
  const minutes = Number(record.minutesPlayed ?? 0);
  if (minutes <= 0 && !hasGpsValue(record)) return null;
  const player = players.find((item) => item.id === record.playerId);
  if (player && isGoalkeeper(player) && !hasGpsValue(record)) return null;

  return {
    id: `comp-load-${record.matchId ?? record.date}-${record.playerId}`,
    sessionId: record.matchId,
    playerId: record.playerId,
    date: record.date,
    min: minutes,
    rpe: 8,
    acc: record.acc ?? 0,
    dcc: record.dcc ?? 0,
    sprints: record.sprints ?? 0,
    rhie: record.rhie ?? 0,
    ima: record.ima ?? 0,
    totalDistance: record.totalDistance,
    highSpeedDistance: record.highSpeedDistance ?? record.hsr,
    hsr: record.hsr ?? record.highSpeedDistance,
    sprintDistance: record.sprintDistance,
    maxVelocity: record.maxVelocity,
    playerLoad: record.playerLoad,
    participation: 'Completa',
    sessionType: 'MD',
    category: record.category ?? player?.category,
    baseCategory: record.baseCategory,
    actingCategory: record.actingCategory ?? record.category ?? player?.category,
    movementType: record.movementType ?? 'base',
    movementNote: record.movementNote,
    movementModule: 'competencia',
    loggedBy: record.loggedBy,
  };
};

const externalIdentityKeys = (record: DailyExternalLoadRecord) => [
  record.id ? `id:${record.id}` : '',
  record.sessionId ? `session:${record.sessionId}:${record.playerId}` : '',
  record.sessionId ? `session-date:${record.sessionId}:${record.playerId}:${record.date}` : '',
  isCompetitionExternalLoad(record) ? `competition:${record.playerId}:${record.date}` : '',
].filter(Boolean);

export const mergeExternalLoads = (stored: DailyExternalLoadRecord[], derived: DailyExternalLoadRecord[]) => {
  const usedKeys = new Set<string>();
  const output: DailyExternalLoadRecord[] = [];

  const push = (record: DailyExternalLoadRecord) => {
    const keys = externalIdentityKeys(record);
    if (keys.some((key) => usedKeys.has(key))) return;
    keys.forEach((key) => usedKeys.add(key));
    output.push(record);
  };

  stored.forEach(push);
  derived.forEach(push);
  return output;
};

export const getEffectiveExternalLoads = (
  data: Pick<AppData, 'externalLoads' | 'competitionRecords' | 'players'>,
  options: { includeDerivedCompetition?: boolean; activeCategory?: string; date?: string; playerIds?: Set<string> } = {},
): DailyExternalLoadRecord[] => {
  const { includeDerivedCompetition = true, activeCategory = 'all', date, playerIds } = options;
  const stored = (data.externalLoads ?? []).filter((record) =>
    (!date || record.date === date) &&
    (!playerIds || playerIds.has(record.playerId)) &&
    recordBelongsToCategory(data.players ?? [], activeCategory, record),
  );

  if (!includeDerivedCompetition) return stored;

  const derived = (data.competitionRecords ?? [])
    .filter((record) =>
      (!date || record.date === date) &&
      (!playerIds || playerIds.has(record.playerId)) &&
      recordBelongsToCategory(data.players ?? [], activeCategory, record),
    )
    .map((record) => competitionRecordToExternalLoad(record, data.players ?? []))
    .filter(Boolean) as DailyExternalLoadRecord[];

  return mergeExternalLoads(stored, derived);
};

export const getEffectiveExternalLoadsForPlayer = (
  data: Pick<AppData, 'externalLoads' | 'competitionRecords' | 'players'>,
  playerId: string,
  options: { startDate?: string; endDate?: string; date?: string; activeCategory?: string } = {},
) => getEffectiveExternalLoads(data, {
    activeCategory: options.activeCategory ?? 'all',
    date: options.date,
    playerIds: new Set([playerId]),
  }).filter((record) => {
    if (options.startDate && record.date < options.startDate) return false;
    if (options.endDate && record.date > options.endDate) return false;
    return true;
  });

export const uniqueWellnessByPlayerDate = (records: DailyWellnessRecord[]) => {
  const byKey = new Map<string, DailyWellnessRecord>();
  records.forEach((record) => {
    const key = `${record.playerId}::${record.date}::${normalize(record.category)}`;
    const existing = byKey.get(key);
    if (!existing || String(record.id).localeCompare(String(existing.id)) > 0) byKey.set(key, record);
  });
  return Array.from(byKey.values());
};

export const getWellnessRecordsForDate = (
  data: Pick<AppData, 'wellness'> & Partial<Pick<AppData, 'players'>>,
  date: string,
  playerIds?: Set<string>,
) => {
  const filtered = (data.wellness ?? []).filter((record) => record.date === date && (!playerIds || playerIds.has(record.playerId)));
  return data.players?.length ? uniqueWellnessByPlayerIdentityDate(data.players, filtered) : uniqueWellnessByPlayerDate(filtered);
};

export const getInternalLoadsForDate = (
  data: Pick<AppData, 'internalLoads'>,
  date: string,
  playerIds?: Set<string>,
): DailyInternalLoadRecord[] =>
  (data.internalLoads ?? []).filter((record) => record.date === date && (!playerIds || playerIds.has(record.playerId)));

export interface SharedDataDiagnostic {
  id: string;
  severity: 'ok' | 'warning' | 'error';
  title: string;
  detail: string;
}

export const buildSharedDataDiagnostics = (data: AppData): SharedDataDiagnostic[] => {
  const playerIds = new Set(data.players.map((player) => player.id));
  const identityCounts = data.players.reduce((acc, player) => {
    const key = playerIdentityKey(player);
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());
  const duplicatePlayerIdentities = Array.from(identityCounts.values()).filter((count) => count > 1).length;
  const knownMicrocycleIds = new Set(data.microcycles.map((item) => item.id));
  const sessionIds = new Set(data.trainingSessionSummaries.map((item) => item.id));
  const matchIds = new Set(data.competitionMatchSummaries.map((item) => item.id));
  const effectiveExternal = getEffectiveExternalLoads(data);

  const orphanWellness = data.wellness.filter((record) => !playerIds.has(record.playerId)).length;
  const orphanInternal = data.internalLoads.filter((record) => !playerIds.has(record.playerId)).length;
  const orphanExternal = data.externalLoads.filter((record) => !playerIds.has(record.playerId)).length;
  const orphanCompetition = data.competitionRecords.filter((record) => !playerIds.has(record.playerId)).length;
  const unresolvedSessions = data.trainingSessionSummaries.filter((session) => session.microcycleId && !knownMicrocycleIds.has(session.microcycleId)).length;
  const internalWithoutSession = data.internalLoads.filter((record) => record.sessionId && !sessionIds.has(record.sessionId)).length;
  const externalWithoutSession = data.externalLoads.filter((record) => record.sessionId && !sessionIds.has(record.sessionId) && !isCompetitionExternalLoad(record)).length;
  const competitionWithoutMatch = data.competitionRecords.filter((record) => record.matchId && !matchIds.has(record.matchId)).length;
  const derivedCompetitionLoads = effectiveExternal.filter((record) => isCompetitionExternalLoad(record)).length;

  const item = (id: string, count: number, title: string, ok: string, bad: string, severity: SharedDataDiagnostic['severity'] = 'warning'): SharedDataDiagnostic => ({
    id,
    severity: count === 0 ? 'ok' : severity,
    title,
    detail: count === 0 ? ok : bad.replace('{count}', String(count)),
  });

  return [
    item('duplicate-player-identities', duplicatePlayerIdentities, 'Jugadores duplicados por identidad', 'No se detectan jugadores repetidos por nombre/categoría o documento.', '{count} identidades de jugador están duplicadas. La app las unifica para lectura, pero conviene limpiar la plantilla.', 'warning'),
    item('wellness-player-link', orphanWellness, 'Wellness ↔ jugadores', 'Todos los wellness están asociados a jugadores.', '{count} wellness no tienen jugador válido.', 'error'),
    item('internal-player-link', orphanInternal, 'Carga interna ↔ jugadores', 'Toda la carga interna está asociada a jugadores.', '{count} cargas internas no tienen jugador válido.', 'error'),
    item('external-player-link', orphanExternal, 'GPS/carga externa ↔ jugadores', 'Toda la carga externa está asociada a jugadores.', '{count} cargas externas no tienen jugador válido.', 'error'),
    item('competition-player-link', orphanCompetition, 'Competencia ↔ jugadores', 'Todos los registros de competencia están asociados a jugadores.', '{count} registros de competencia no tienen jugador válido.', 'error'),
    item('microcycle-session-link', unresolvedSessions, 'Microciclo ↔ sesión', 'Las sesiones apuntan a microciclos válidos.', '{count} sesiones apuntan a microciclos inexistentes.'),
    item('internal-session-link', internalWithoutSession, 'Carga interna ↔ sesión', 'Las cargas internas con sesión apuntan a una sesión válida.', '{count} cargas internas apuntan a sesiones inexistentes.'),
    item('external-session-link', externalWithoutSession, 'GPS ↔ sesión', 'Las cargas externas con sesión apuntan a una sesión válida.', '{count} cargas externas apuntan a sesiones inexistentes.'),
    item('competition-match-link', competitionWithoutMatch, 'Competencia ↔ partido', 'Todas las planillas apuntan a partidos válidos.', '{count} registros de competencia apuntan a partidos inexistentes.'),
    {
      id: 'competition-load-bridge',
      severity: 'ok',
      title: 'Competencia ↔ carga externa',
      detail: `${derivedCompetitionLoads} registros de competencia quedan disponibles para centros de carga, reportes y riesgo.`,
    },
  ];
};
