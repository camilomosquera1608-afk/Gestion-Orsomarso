import { ClubCategory } from './types';

export const categoryLabel = (category?: ClubCategory | 'all' | string) => {
  if (category === 'Sub15') return 'U15';
  if (category === 'Sub17') return 'U17';
  if (category === 'Sub20') return 'U20';
  if (category === 'all') return 'Todas';
  return category ?? '';
};


export const formatBirthDateForDisplay = (iso?: string) => {
  if (!iso) return '';
  if (iso.includes('/')) return iso;
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
};

export const normalizeBirthDateInput = (value?: string) => {
  if (!value) return '';
  if (value.includes('-')) return value;
  const parts = value.split('/');
  if (parts.length !== 3) return value;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
};

export const parseBirthDate = (value?: string) => {
  if (!value) return null;
  const normalized = formatBirthDateForDisplay(value);
  const [dd, mm, yyyy] = normalized.split('/');
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const calcAge = (birthDate?: string) => {
  const date = parseBirthDate(birthDate);
  if (!date) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const hasHadBirthday =
    today.getMonth() > date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() >= date.getDate());
  if (!hasHadBirthday) age -= 1;
  return age;
};
