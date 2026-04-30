import type { ClubCategory } from './types';

export const safeArray = <T>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];

export const safeNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const safeText = (value: unknown, fallback = '—'): string => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
};

export const formatDateSafe = (value?: string | null, fallback = 'Sin fecha'): string => {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

export const calculateAgeSafe = (birthDate?: string, age?: number): string => {
  if (birthDate) {
    const normalized = birthDate.includes('/') ? birthDate.split('/').reverse().join('-') : birthDate;
    const birth = new Date(`${normalized}T00:00:00`);
    const now = new Date();
    if (!Number.isNaN(birth.getTime()) && birth <= now) {
      let years = now.getFullYear() - birth.getFullYear();
      const monthDelta = now.getMonth() - birth.getMonth();
      if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) years -= 1;
      if (years >= 0 && years < 80) return `${years} años`;
    }
  }
  if (Number.isFinite(age) && Number(age) >= 0 && Number(age) < 80) return `${age} años`;
  return 'Edad no registrada';
};
export const pluralize = (count: number, singular: string, plural: string): string => `${count} ${count === 1 ? singular : plural}`;

export const supportsGps = (category?: string | null): boolean => String(category ?? '').toLowerCase() === 'sub20' || String(category ?? '').toLowerCase() === 'u20';

export const categoryAllowsGps = supportsGps;

export const reportDash = (value: unknown) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' && !Number.isFinite(value)) return '—';
  const text = String(value).trim();
  return text ? text : '—';
};

export const getPdfSafeText = (value: unknown, fallback = 'Sin registro'): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' && !Number.isFinite(value)) return fallback;
  const text = String(value).trim();
  if (!text || text === 'undefined' || text === 'null' || text === 'NaN') return fallback;
  return text;
};

export const formatPdfValue = (value: unknown, suffix = '', fallback = '—'): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? `${value}${suffix}` : fallback;
  const text = String(value).trim();
  if (!text || text === 'undefined' || text === 'null' || text === 'NaN') return fallback;
  return `${text}${suffix}`;
};

export const formatPdfDate = (value?: string | null, fallback = 'Sin fecha'): string => formatDateSafe(value, fallback);

export const hasPdfValue = (value: unknown): boolean => formatPdfValue(value, '', '').trim().length > 0;

export const sanitizeReportData = <T extends Record<string, unknown>>(data: T): T => Object.fromEntries(
  Object.entries(data).map(([key, value]) => [key, value === undefined || value === null || (typeof value === 'number' && !Number.isFinite(value)) ? '—' : value]),
) as T;

export const formatPdfNumber = (value: unknown, decimals = 0, fallback = '—'): string => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric.toLocaleString('es-CO', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
};

export const formatPdfPercentage = (value: unknown, decimals = 0, fallback = '—'): string => {
  const formatted = formatPdfNumber(value, decimals, '');
  return formatted ? `${formatted}%` : fallback;
};

export const formatPdfList = (values: Array<unknown> | null | undefined, fallback = 'Sin registro'): string => {
  const items = safeArray(values as string[] | null | undefined).map((item) => getPdfSafeText(item, '')).filter(Boolean);
  return items.length ? items.join(' · ') : fallback;
};

export const getReportSectionVisibility = (...values: unknown[]): boolean => values.some((value) => {
  if (Array.isArray(value)) return value.length > 0;
  return hasPdfValue(value);
});
