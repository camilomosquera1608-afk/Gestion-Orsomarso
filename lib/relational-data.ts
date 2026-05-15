import type {
  AppData,
  ClubCategory,
  CMJRecord,
  CompetitionRecord,
  DailyExternalLoadRecord,
  DailyInternalLoadRecord,
  DailyWellnessRecord,
  FMSRecord,
  NeuromuscularRecord,
  NutritionRecord,
  Player,
  StrengthPlayerAdjustment,
  StrengthPlayerResponse,
} from './types';
import { isGoalkeeper } from './performance-helpers';

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

const normalizePlayerName = (value: unknown) => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

export const playerIdentityKeys = (player?: Pick<Player, 'id' | 'name' | 'category' | 'documentId'> | null) => {
  if (!player) return [];
  const keys = new Set<string>();
  const documentKey = normalize(player.documentId);
  const nameKey = normalizePlayerName(player.name);
  const categoryKey = normalize(player.category);
  if (documentKey) keys.add(`doc:${documentKey}`);
  if (nameKey) keys.add(`name:${categoryKey}:${nameKey}`);
  if (player.id) keys.add(`id:${player.id}`);
  return Array.from(keys).filter(Boolean);
};

export const playerIdentityKey = (player?: Pick<Player, 'id' | 'name' | 'category' | 'documentId'> | null) => {
  if (!player) return '';
  const keys = playerIdentityKeys(player).filter((key) => !key.startsWith('id:'));
  return keys[0] ?? (player.id ? `id:${player.id}` : '');
};

const buildPlayerIdentityAliasMap = (players: Player[]) => {
  const aliases = new Map<string, string>();
  const groups = new Map<string, Player[]>();

  players.forEach((player) => {
    const keys = playerIdentityKeys(player);
    const existingGroup = keys.map((key) => aliases.get(key)).find(Boolean);
    const groupKey = existingGroup ?? keys.find((key) => !key.startsWith('id:')) ?? `id:${player.id}`;
    const current = groups.get(groupKey) ?? [];
    current.push(player);
    groups.set(groupKey, current);
    keys.forEach((key) => aliases.set(key, groupKey));
  });

  // Segunda pasada para unir cadenas de alias: jugador A comparte documento con B,
  // B comparte nombre/categoría con C. Todos deben leerse como el mismo jugador.
  let changed = true;
  while (changed) {
    changed = false;
    players.forEach((player) => {
      const keys = playerIdentityKeys(player);
      const groupKeys = Array.from(new Set(keys.map((key) => aliases.get(key)).filter(Boolean))) as string[];
      if (groupKeys.length <= 1) return;
      const target = groupKeys[0];
      groupKeys.slice(1).forEach((source) => {
        if (source === target) return;
        const sourcePlayers = groups.get(source) ?? [];
        const targetPlayers = groups.get(target) ?? [];
        groups.set(target, [...targetPlayers, ...sourcePlayers]);
        groups.delete(source);
        sourcePlayers.forEach((item) => playerIdentityKeys(item).forEach((key) => aliases.set(key, target)));
        changed = true;
      });
    });
  }

  return { aliases, groups };
};

export const getRelatedPlayerIds = (players: Player[], playerId: string) => {
  const player = players.find((item) => item.id === playerId);
  if (!player) return new Set([playerId]);
  const { aliases, groups } = buildPlayerIdentityAliasMap(players);
  const groupKey = playerIdentityKeys(player).map((key) => aliases.get(key)).find(Boolean);
  const related = groupKey ? groups.get(groupKey) ?? [] : [];
  return new Set((related.length ? related : [player]).map((item) => item.id));
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

const mergePlayerGroup = (canonical: Player, group: Player[]): Player => {
  const merged: Record<string, unknown> = { ...(canonical as unknown as Record<string, unknown>) };
  group.forEach((player) => {
    Object.entries(player as unknown as Record<string, unknown>).forEach(([key, value]) => {
      if (key === 'id') return;
      const current = merged[key];
      const hasCurrent = hasMeaningfulValue(current);
      const hasValue = hasMeaningfulValue(value);
      if (!hasCurrent && hasValue) merged[key] = value;
    });
  });
  merged.id = canonical.id;
  merged.categoryHistory = Array.from(new Set(group.flatMap((player) => [player.category, ...(player.categoryHistory ?? [])]).filter(Boolean))) as ClubCategory[];
  return merged as unknown as Player;
};

export const getCanonicalPlayers = (data: AppData, sourcePlayers?: Player[]) => {
  const players = sourcePlayers ?? data.players;
  const { groups } = buildPlayerIdentityAliasMap(players);

  return Array.from(groups.values()).map((group) => {
    const canonical = group.slice().sort((a, b) => {
      const recordDelta = recordCountForPlayer(data, b.id) - recordCountForPlayer(data, a.id);
      if (recordDelta) return recordDelta;
      const completenessDelta = playerCompletenessScore(b) - playerCompletenessScore(a);
      if (completenessDelta) return completenessDelta;
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    })[0];
    return mergePlayerGroup(canonical, group);
  }).sort((a, b) => a.name.localeCompare(b.name));
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

const valueMeaningScore = (record: Record<string, unknown>): number =>
  Object.values(record).reduce<number>((score, value) => {
    if (value === undefined || value === null) return score;
    if (typeof value === 'number') return score + (Number.isFinite(value) && value !== 0 ? 2 : 0);
    if (typeof value === 'string') return score + (value.trim() ? 1 : 0);
    if (Array.isArray(value)) return score + value.length;
    if (typeof value === 'object') return score + 1;
    return score + 1;
  }, 0);

const hasMeaningfulValue = (value: unknown) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  return true;
};

const mergeSharedRecord = <T extends Record<string, unknown>>(current: T | undefined, incoming: T): T => {
  if (!current) return incoming;
  const currentScore = valueMeaningScore(current);
  const incomingScore = valueMeaningScore(incoming);
  const primary = incomingScore >= currentScore ? incoming : current;
  const fallback = incomingScore >= currentScore ? current : incoming;
  const merged: Record<string, unknown> = { ...fallback, ...primary };
  Object.entries(fallback).forEach(([key, value]) => {
    if (!hasMeaningfulValue(merged[key]) && hasMeaningfulValue(value)) merged[key] = value;
  });
  return merged as T;
};

const dedupeSharedRecords = <T extends Record<string, unknown>>(
  records: T[],
  keyFns: Array<(item: T) => string | undefined | null>,
): T[] => {
  const byKey = new Map<string, T>();
  const aliases = new Map<string, string>();

  records.forEach((record) => {
    const keys = keyFns.map((fn) => fn(record)).filter(Boolean) as string[];
    const primaryKey = keys.map((key) => aliases.get(key)).find(Boolean) ?? keys[0] ?? JSON.stringify(record);
    const next = mergeSharedRecord(byKey.get(primaryKey), record);
    byKey.set(primaryKey, next);
    keys.forEach((key) => aliases.set(key, primaryKey));
  });

  return Array.from(byKey.values());
};

const remapPlayerRecord = <T extends { playerId: string }>(record: T, idMap: Map<string, string>): T => ({
  ...record,
  playerId: idMap.get(record.playerId) ?? record.playerId,
});

const normalizeDate = (value: unknown) => String(value ?? '').slice(0, 10);
const normalizeCategoryKey = (value: unknown) => normalize(value);

const mapStrengthPlayerIds = (ids: string[] | undefined, idMap: Map<string, string>) =>
  Array.from(new Set((ids ?? []).map((id) => idMap.get(id) ?? id).filter(Boolean)));

export const normalizeSharedDataLinks = (data: AppData): AppData => {
  const originalPlayers = data.players ?? [];
  const canonicalPlayers = getCanonicalPlayers(data, originalPlayers);
  const idMap = new Map<string, string>();

  const { groups } = buildPlayerIdentityAliasMap(originalPlayers);
  Array.from(groups.values()).forEach((group) => {
    const groupIds = new Set(group.map((player) => player.id));
    const canonical = canonicalPlayers.find((player) => groupIds.has(player.id)) ?? group[0];
    group.forEach((player) => idMap.set(player.id, canonical.id));
  });

  const wellness = dedupeSharedRecords(
    (data.wellness ?? []).map((record) => remapPlayerRecord(record, idMap)) as unknown as Record<string, unknown>[],
    [
      (item) => item.playerId && item.date ? `natural:${item.playerId}:${normalizeDate(item.date)}:${normalizeCategoryKey(item.category)}` : undefined,
      (item) => item.id ? `id:${item.id}` : undefined,
    ],
  ) as unknown as DailyWellnessRecord[];

  const internalLoads = dedupeSharedRecords(
    (data.internalLoads ?? []).map((record) => remapPlayerRecord(record, idMap)) as unknown as Record<string, unknown>[],
    [
      (item) => item.sessionId && item.playerId ? `session:${item.sessionId}:${item.playerId}` : undefined,
      (item) => item.playerId && item.date && item.sessionNumber ? `daily-session:${item.playerId}:${normalizeDate(item.date)}:${normalizeCategoryKey(item.category ?? item.actingCategory)}:${item.sessionNumber}` : undefined,
      (item) => item.id ? `id:${item.id}` : undefined,
    ],
  ) as unknown as DailyInternalLoadRecord[];

  const externalLoads = dedupeSharedRecords(
    (data.externalLoads ?? []).map((record) => remapPlayerRecord(record, idMap)) as unknown as Record<string, unknown>[],
    [
      (item) => item.sessionId && item.playerId ? `session:${item.sessionId}:${item.playerId}:${normalize(item.movementModule)}` : undefined,
      (item) => item.playerId && item.date && item.sessionNumber ? `daily-session:${item.playerId}:${normalizeDate(item.date)}:${normalizeCategoryKey(item.category ?? item.actingCategory)}:${item.sessionNumber}:${normalize(item.movementModule)}` : undefined,
      (item) => item.id ? `id:${item.id}` : undefined,
    ],
  ) as unknown as DailyExternalLoadRecord[];

  const competitionRecords = dedupeSharedRecords(
    (data.competitionRecords ?? []).map((record) => remapPlayerRecord(record, idMap)) as unknown as Record<string, unknown>[],
    [
      (item) => item.matchId && item.playerId ? `match:${item.matchId}:${item.playerId}` : undefined,
      (item) => item.playerId && item.date && item.opponent ? `natural:${item.playerId}:${normalizeDate(item.date)}:${normalize(item.opponent)}` : undefined,
      (item) => item.id ? `id:${item.id}` : undefined,
    ],
  ) as unknown as CompetitionRecord[];

  const dedupeEvaluation = <T extends CMJRecord | NutritionRecord | NeuromuscularRecord | FMSRecord>(records: T[]) =>
    dedupeSharedRecords(
      records.map((record) => remapPlayerRecord(record, idMap)) as unknown as Record<string, unknown>[],
      [
        (item) => item.playerId && item.date ? `natural:${item.playerId}:${normalizeDate(item.date)}:${normalizeCategoryKey(item.category)}` : undefined,
        (item) => item.id ? `id:${item.id}` : undefined,
      ],
    ) as unknown as T[];

  const strengthSessions = (data.strengthSessions ?? []).map((session) => ({
    ...session,
    playerIds: mapStrengthPlayerIds(session.playerIds, idMap),
    excludedPlayerIds: session.excludedPlayerIds ? mapStrengthPlayerIds(session.excludedPlayerIds, idMap) : session.excludedPlayerIds,
    adjustments: session.adjustments?.map((item: StrengthPlayerAdjustment) => ({ ...item, playerId: idMap.get(item.playerId) ?? item.playerId })),
    responses: session.responses?.map((item: StrengthPlayerResponse) => ({ ...item, playerId: idMap.get(item.playerId) ?? item.playerId })),
  }));

  return {
    ...data,
    players: canonicalPlayers,
    wellness,
    internalLoads,
    externalLoads,
    competitionRecords,
    cmjRecords: dedupeEvaluation(data.cmjRecords ?? []),
    nutritionRecords: dedupeEvaluation(data.nutritionRecords ?? []),
    neuromuscularRecords: dedupeEvaluation(data.neuromuscularRecords ?? []),
    fmsRecords: dedupeEvaluation(data.fmsRecords ?? []),
    strengthSessions,
  };
};
