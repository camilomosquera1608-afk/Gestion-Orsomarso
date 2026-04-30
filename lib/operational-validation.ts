import type { ClubCategory, CompetitionMatchSummary, Microcycle, TrainingSessionSummary } from '@/lib/types';

export const datesOverlap = (startA?: string, endA?: string, startB?: string, endB?: string) => {
  if (!startA || !endA || !startB || !endB) return false;
  return startA <= endB && startB <= endA;
};

export const findDuplicateTrainingSession = (
  sessions: TrainingSessionSummary[],
  params: { id?: string; date: string; category?: ClubCategory },
) => sessions.find((item) => item.id !== params.id && item.date === params.date && item.category === params.category);

export const findDuplicateMatch = (
  matches: CompetitionMatchSummary[],
  params: { id?: string; date: string; category: ClubCategory; opponent: string },
) => {
  const opponent = params.opponent.trim().toLowerCase();
  return matches.find((item) => item.id !== params.id && item.date === params.date && item.category === params.category && item.opponent.trim().toLowerCase() === opponent);
};

export const findOverlappingMicrocycle = (
  microcycles: Microcycle[],
  params: { id?: string; category?: ClubCategory; name?: string; startDate?: string; endDate?: string },
) => microcycles.find((item) => {
  if (item.id === params.id) return false;
  if (item.category !== params.category) return false;
  const sameName = Boolean(params.name && item.name.trim().toLowerCase() === params.name.trim().toLowerCase());
  const overlaps = datesOverlap(item.startDate, item.endDate, params.startDate, params.endDate);
  return sameName || overlaps;
});
