import { ClubCategory } from './types';

export const categoryLabel = (category?: ClubCategory | 'all' | string) => {
  if (category === 'Sub15') return 'U15';
  if (category === 'Sub17') return 'U17';
  if (category === 'Sub20') return 'U20';
  if (category === 'all') return 'Todas';
  return category ?? '';
};


export const normalizeBirthDateInput = (value?: string | null) => {
  if (!value) return '';
  const text = String(value).trim();
  if (!text) return '';
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
};

export const formatBirthDateForDisplay = (value?: string | null) => {
  const iso = normalizeBirthDateInput(value);
  if (!iso) return '';
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
};

export const parseBirthDate = (value?: string | null) => {
  const iso = normalizeBirthDateInput(value);
  if (!iso) return null;
  const [yyyy, mm, dd] = iso.split('-');
  const year = Number(yyyy);
  const month = Number(mm);
  const day = Number(dd);
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
