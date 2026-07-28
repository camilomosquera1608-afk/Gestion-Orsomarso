import type { CompetitionMatchSummary, CompetitionRecord, Player } from '@/lib/types';

export const isMeaningfulValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

export const mergeObjectWithLocalFallback = <T extends Record<string, unknown>>(
  remoteItem: T,
  localItem?: T,
): T => {
  if (!localItem) return remoteItem;
  const merged: Record<string, unknown> = { ...localItem, ...remoteItem };
  Object.entries(localItem).forEach(([key, value]) => {
    if (!isMeaningfulValue(value)) return;
    if (!isMeaningfulValue(merged[key])) merged[key] = value;
  });
  return merged as T;
};

const normalizedKeyPart = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

export const buildMergeKey = (...parts: unknown[]) =>
  parts.map(normalizedKeyPart).join('::');

const isPlainObjectRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const mergeByKeys = <T extends Record<string, unknown>>(
  remote: T[] | undefined,
  local: T[] | undefined,
  keyFns: Array<(item: T) => string | null | undefined>,
): T[] => {
  const remoteRows = (Array.isArray(remote) ? remote : []).filter(
    isPlainObjectRecord,
  ) as T[];
  const localRows = (Array.isArray(local) ? local : []).filter(
    isPlainObjectRecord,
  ) as T[];
  if (!localRows.length) return remoteRows;
  const localByKey = new Map<string, T>();
  localRows.forEach((item) => {
    keyFns.forEach((fn) => {
      const key = fn(item);
      if (key) localByKey.set(key, item);
    });
  });

  const usedLocal = new Set<T>();
  const merged = remoteRows.map((item) => {
    const match = keyFns
      .map((fn) => fn(item))
      .filter(Boolean)
      .map((key) => localByKey.get(key as string))
      .find(Boolean) as T | undefined;
    if (match) usedLocal.add(match);
    return mergeObjectWithLocalFallback(item, match);
  });

  localRows.forEach((item) => {
    if (usedLocal.has(item)) return;
    const itemKeys = keyFns.map((fn) => fn(item)).filter(Boolean);
    const exists = remoteRows.some((remoteItem) =>
      keyFns
        .map((fn) => fn(remoteItem))
        .filter(Boolean)
        .some((key) => itemKeys.includes(key)),
    );
    if (!exists) merged.push(item);
  });

  return merged;
};

export const mergeByIdWithLocalFallback = <T extends { id: string }>(
  remote: T[] | undefined,
  local: T[] | undefined,
): T[] =>
  mergeByKeys(
    remote as unknown as Record<string, unknown>[],
    local as unknown as Record<string, unknown>[] | undefined,
    [(item) => (item.id ? String(item.id) : null)],
  ) as unknown as T[];

export const mergeCompetitionMatches = (
  remote: CompetitionMatchSummary[],
  local: CompetitionMatchSummary[] | undefined,
): CompetitionMatchSummary[] =>
  mergeByKeys(
    (local?.length ? local : remote) as unknown as Record<string, unknown>[],
    (local?.length ? remote : local) as unknown as
      | Record<string, unknown>[]
      | undefined,
    [
      (item) => (item.id ? String(item.id) : null),
      (item) =>
        item.date && item.category && item.opponent
          ? buildMergeKey(item.date, item.category, item.opponent)
          : null,
    ],
  ) as unknown as CompetitionMatchSummary[];

export const mergeCompetitionRecords = (
  remote: CompetitionRecord[],
  local: CompetitionRecord[] | undefined,
): CompetitionRecord[] =>
  mergeByKeys(
    (local?.length ? local : remote) as unknown as Record<string, unknown>[],
    (local?.length ? remote : local) as unknown as
      | Record<string, unknown>[]
      | undefined,
    [
      (item) => (item.id ? String(item.id) : null),
      (item) =>
        item.matchId && item.playerId
          ? buildMergeKey(item.matchId, item.playerId)
          : null,
      (item) =>
        item.date && item.opponent && item.playerId
          ? buildMergeKey(item.date, item.opponent, item.playerId)
          : null,
    ],
  ) as unknown as CompetitionRecord[];

const normalizePlayerMergeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const playerMergeKeys = (player: Player) =>
  [
    player.id ? `id:${player.id}` : '',
    player.documentId
      ? `doc:${normalizePlayerMergeText(player.documentId)}`
      : '',
    player.name
      ? `name:${normalizePlayerMergeText(player.category)}:${normalizePlayerMergeText(player.name)}`
      : '',
  ].filter(Boolean);

export const mergePlayersPreferLocal = (
  remote: Player[] | undefined,
  local: Player[] | undefined,
): Player[] => {
  const rows = [
    ...(Array.isArray(remote) ? remote : []),
    ...(Array.isArray(local) ? local : []),
  ];
  const groups = new Map<string, Player>();
  const aliases = new Map<string, string>();

  rows.forEach((player) => {
    if (!player?.id) return;
    const keys = playerMergeKeys(player);
    const groupKey =
      keys.map((key) => aliases.get(key)).find(Boolean) ??
      keys[0] ??
      `id:${player.id}`;
    const existing = groups.get(groupKey);
    const merged = existing
      ? (mergeObjectWithLocalFallback(
          player as unknown as Record<string, unknown>,
          existing as unknown as Record<string, unknown>,
        ) as unknown as Player)
      : player;
    groups.set(groupKey, merged);
    keys.forEach((key) => aliases.set(key, groupKey));
  });

  return Array.from(groups.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
};
