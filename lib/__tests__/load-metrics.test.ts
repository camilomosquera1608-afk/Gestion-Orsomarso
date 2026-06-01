import { calculateExternalLoad, externalLoadHasInternalPair, getPlayerDayLoad } from '../load-metrics';
import type { DailyExternalLoadRecord, DailyInternalLoadRecord } from '../types';

describe('load-metrics', () => {
  it('prioriza min x RPE en carga externa', () => {
    const record: DailyExternalLoadRecord = {
      id: 'ext-1',
      playerId: 'p1',
      date: '2026-06-01',
      min: 60,
      rpe: 7,
      acc: 0,
      dcc: 0,
      sprints: 0,
      rhie: 0,
    };
    expect(calculateExternalLoad(record)).toBe(420);
  });

  it('no duplica externa si ya hay interna en la misma sesión', () => {
    const internal: DailyInternalLoadRecord = {
      id: 'int-1',
      playerId: 'p1',
      date: '2026-06-01',
      rpe: 6,
      duration: 70,
      sessionNumber: 1,
      category: 'Sub20',
    };
    const external: DailyExternalLoadRecord = {
      id: 'ext-1',
      playerId: 'p1',
      date: '2026-06-01',
      min: 70,
      rpe: 6,
      acc: 0,
      dcc: 0,
      sprints: 0,
      rhie: 0,
      sessionNumber: 1,
      category: 'Sub20',
    };
    expect(externalLoadHasInternalPair(external, [internal])).toBe(true);
    expect(
      getPlayerDayLoad('p1', '2026-06-01', { internalLoads: [internal], externalLoads: [external] }),
    ).toBe(420);
  });
});
