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
