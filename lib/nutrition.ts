import type { FatPercentageRange, MuscleMassRange, NutritionPlan, NutritionRecord, SkinfoldRange } from './types';

export const NUTRITION_PLANS: NutritionPlan[] = ['Normocalorico', 'Hipercalorico', 'Hipocalorico'];
export const SKINFOLD_RANGES: SkinfoldRange[] = ['30 - 35', '35 - 40', '40 - 45', '45 - 50'];
export const MUSCLE_MASS_RANGES: MuscleMassRange[] = ['50% - 55%', '55% - 60%'];
export const FAT_PERCENTAGE_RANGES: FatPercentageRange[] = ['Adecuado', 'Seguimiento', 'Alerta'];

export type NutritionTone = 'green' | 'yellow' | 'red' | 'neutral';

const PLAN_LABELS: Record<NutritionPlan, string> = {
  Normocalorico: 'Normocalórico',
  Hipercalorico: 'Hipercalórico',
  Hipocalorico: 'Hipocalórico',
};

const normalizeText = (value: unknown) => String(value ?? '').trim();

export const safeNutritionNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const isValidNutritionNumber = (value: unknown, { required = true, min = 0, max }: { required?: boolean; min?: number; max?: number } = {}) => {
  const raw = normalizeText(value);
  if (!raw) return !required;
  const parsed = Number(raw.replace(',', '.'));
  if (!Number.isFinite(parsed)) return false;
  if (parsed < min) return false;
  if (typeof max === 'number' && parsed > max) return false;
  return true;
};

export const normalizeNutritionPlan = (value: unknown): NutritionPlan => {
  const text = normalizeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (text === 'hipercalorico') return 'Hipercalorico';
  if (text === 'hipocalorico') return 'Hipocalorico';
  return 'Normocalorico';
};

export const getNutritionPlanLabel = (plan?: NutritionPlan | string | null) => PLAN_LABELS[normalizeNutritionPlan(plan)];

export const formatNutritionValue = (value: unknown, suffix = '', decimals = 1): string => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(parsed)) return 'No disponible';
  const fixed = Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(decimals);
  return `${fixed}${suffix}`;
};

export const formatNutritionText = (value: unknown) => {
  const text = normalizeText(value);
  return text || 'No disponible';
};

export const normalizeSkinfoldRange = (value: unknown): SkinfoldRange | undefined => {
  const text = normalizeText(value).replace(/\s*[-–—]\s*/g, ' - ');
  return SKINFOLD_RANGES.find((range) => range === text);
};

export const normalizeMuscleMassRange = (value: unknown): MuscleMassRange | undefined => {
  const text = normalizeText(value).replace(/\s*[-–—]\s*/g, ' - ');
  return MUSCLE_MASS_RANGES.find((range) => range === text);
};

export const normalizeFatPercentageRange = (value: unknown): FatPercentageRange | undefined => {
  const text = normalizeText(value);
  return FAT_PERCENTAGE_RANGES.find((range) => range === text);
};

export const normalizeNutritionRecord = (record: NutritionRecord): NutritionRecord => {
  const legacy = record as NutritionRecord & {
    fatSum?: number;
    fatSumRange?: SkinfoldRange;
    fatPercentage?: number;
    nutritionPlan?: NutritionPlan;
  };

  return {
    ...record,
    weight: safeNutritionNumber(record.weight),
    height: safeNutritionNumber(record.height),
    bodyFat: safeNutritionNumber(record.bodyFat ?? legacy.fatPercentage),
    skinfoldSum: safeNutritionNumber(record.skinfoldSum ?? legacy.fatSum),
    plan: normalizeNutritionPlan(record.plan ?? legacy.nutritionPlan),
    weightRange: record.weightRange ?? '',
    skinfoldRange: normalizeSkinfoldRange(record.skinfoldRange ?? legacy.fatSumRange),
    fatPercentageRange: normalizeFatPercentageRange(record.fatPercentageRange),
    muscleMassPercentage: record.muscleMassPercentage === undefined ? undefined : safeNutritionNumber(record.muscleMassPercentage),
    muscleMassRange: normalizeMuscleMassRange(record.muscleMassRange),
    imo: record.imo === undefined ? undefined : safeNutritionNumber(record.imo),
    diagnosis: record.diagnosis ?? '',
  };
};

export const getNutritionRangeLabel = (value?: string | null) => normalizeText(value) || 'Sin rango';

export const getNutritionRangeTone = (kind: 'skinfold' | 'muscle' | 'fat' | 'neutral', value?: string | null): NutritionTone => {
  if (!value) return 'neutral';
  if (kind === 'skinfold') {
    if (value === '30 - 35') return 'green';
    if (value === '45 - 50') return 'red';
    return 'yellow';
  }
  if (kind === 'muscle') return value === '55% - 60%' ? 'green' : 'yellow';
  if (kind === 'fat') {
    if (value === 'Adecuado') return 'green';
    if (value === 'Alerta') return 'red';
    return 'yellow';
  }
  return 'neutral';
};

export const getNutritionStatus = (record?: NutritionRecord | null) => {
  if (!record) return 'Sin registro';
  const normalized = normalizeNutritionRecord(record);
  const hasCore = normalized.weight > 0 && normalized.height > 0 && normalized.bodyFat >= 0 && normalized.skinfoldSum >= 0 && Boolean(normalized.plan);
  return hasCore ? 'Guardado' : 'Pendiente';
};

export const getNutritionTechnicalReading = (record?: NutritionRecord | null) => {
  if (!record) return 'Sin datos completos para lectura nutricional.';
  const normalized = normalizeNutritionRecord(record);
  const hasBodyComposition = normalized.weight > 0 && normalized.skinfoldSum > 0 && normalized.bodyFat >= 0;
  if (!hasBodyComposition) return 'Sin datos completos para lectura nutricional.';
  return `Seguimiento nutricional disponible. Plan actual: ${getNutritionPlanLabel(normalized.plan)}.`;
};
