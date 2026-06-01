import { initialData } from '../mock-data';
import {
  saveCompetitionMatchBundle,
  saveTrainingSessionBundle,
  updateMicrocycleInData,
  upsertTrainingSessionSummary,
  upsertWellness,
} from '../domain-commands';
import type {
  CompetitionMatchSummary,
  CompetitionRecord,
  DailyInternalLoadRecord,
  DailyWellnessRecord,
  Microcycle,
  TrainingSessionSummary,
} from '../types';

describe('domain-commands', () => {
  it('rejects duplicate wellness natural key', () => {
    const record: DailyWellnessRecord = {
      id: 'w-1',
      playerId: 'player-test-1',
      date: '2026-06-01',
      category: 'Sub20',
      sleep: 4,
      fatigue: 3,
      stress: 3,
      musclePain: 3,
      mood: 4,
    };
    const first = upsertWellness(initialData, record);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const duplicate = upsertWellness(first.data, { ...record, id: 'w-2' });
    expect(duplicate.ok).toBe(false);
  });

  it('replaces session loads in bundle write', () => {
    const session: TrainingSessionSummary = {
      id: 'sess-1',
      date: '2026-06-02',
      category: 'Sub20',
      sessionNumber: 1,
      objective: 'MD-3',
    };
    const priorInternal: DailyInternalLoadRecord = {
      id: 'old-int',
      playerId: 'player-test-1',
      date: '2026-06-02',
      duration: 50,
      rpe: 6,
      sessionNumber: 1,
      category: 'Sub20',
      sessionId: 'sess-1',
    };
    const dataWithPrior = {
      ...initialData,
      trainingSessionSummaries: [session],
      internalLoads: [priorInternal],
    };
    const replacement: DailyInternalLoadRecord = {
      ...priorInternal,
      id: 'new-int',
      duration: 70,
      rpe: 8,
    };
    const result = saveTrainingSessionBundle(dataWithPrior, session, [], [replacement]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.internalLoads.some((s) => s.id === 'new-int')).toBe(true);
    expect(result.data.internalLoads.some((s) => s.id === 'old-int')).toBe(false);
  });

  it('rejects duplicate competition match', () => {
    const match: CompetitionMatchSummary = {
      id: 'match-1',
      date: '2026-06-03',
      category: 'Sub20',
      opponent: 'Rival A',
    };
    const first = saveCompetitionMatchBundle(initialData, match, []);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const duplicate = saveCompetitionMatchBundle(first.data, { ...match, id: 'match-2' }, []);
    expect(duplicate.ok).toBe(false);
  });

  it('rejects overlapping microcycle', () => {
    const mc: Microcycle = {
      id: 'mc-a',
      name: 'Semana 1',
      category: 'Sub20',
      startDate: '2026-06-01',
      endDate: '2026-06-07',
    };
    const first = updateMicrocycleInData(initialData, mc);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const overlap = updateMicrocycleInData(first.data, {
      ...mc,
      id: 'mc-b',
      name: 'Semana solapada',
      startDate: '2026-06-05',
      endDate: '2026-06-12',
    });
    expect(overlap.ok).toBe(false);
  });

  it('rejects duplicate training session summary', () => {
    const session: TrainingSessionSummary = {
      id: 'sess-dup',
      date: '2026-06-04',
      category: 'Sub20',
      sessionNumber: 1,
    };
    const first = upsertTrainingSessionSummary(initialData, session);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const duplicate = upsertTrainingSessionSummary(first.data, {
      ...session,
      id: 'sess-dup-2',
    });
    expect(duplicate.ok).toBe(false);
  });
});
