import type { DailyWellnessRecord } from './types';

export type WellnessSubscale = 'sleep' | 'fatigue' | 'stress' | 'musclePain' | 'mood';

const clampWellnessItem = (value?: number) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.max(1, Math.min(5, numeric));
};

/**
 * Puntuación canónica de wellness/readiness (1 = peor, 5 = mejor).
 * Solo promedia subescalas respondidas (> 0).
 * fatigue = energía/frescura; musclePain = estado muscular sin dolor.
 */
export const computeWellnessScore = (record?: Pick<DailyWellnessRecord, WellnessSubscale>) => {
  if (!record) return 0;
  const values = (
    ['sleep', 'fatigue', 'stress', 'musclePain', 'mood'] as const
  )
    .map((key) => clampWellnessItem(record[key]))
    .filter((value) => value > 0);
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
};

/** Alias histórico usado en informes y motor de riesgo. */
export const averageWellness = (record?: Pick<DailyWellnessRecord, WellnessSubscale>) =>
  computeWellnessScore(record);

export const wellnessSubscaleDeltas = (
  record?: Pick<DailyWellnessRecord, WellnessSubscale>,
  baseline?: Partial<Record<WellnessSubscale, number>>,
) => {
  const keys: WellnessSubscale[] = ['sleep', 'fatigue', 'stress', 'musclePain', 'mood'];
  return keys.reduce<Record<WellnessSubscale, { today?: number; baseline?: number; delta?: number }>>((acc, key) => {
    const today = clampWellnessItem(record?.[key]) || undefined;
    const base = baseline?.[key];
    acc[key] = {
      today: today || undefined,
      baseline: base,
      delta: today && base ? Number((today - base).toFixed(1)) : undefined,
    };
    return acc;
  }, {} as Record<WellnessSubscale, { today?: number; baseline?: number; delta?: number }>);
};

export const wellnessNaturalKey = (record: Pick<DailyWellnessRecord, 'playerId' | 'date' | 'category'>) =>
  `${record.playerId}::${record.date.slice(0, 10)}::${String(record.category ?? '').trim().toLowerCase()}`;
