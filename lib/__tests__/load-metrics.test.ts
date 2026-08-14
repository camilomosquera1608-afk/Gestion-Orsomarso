import { calculateExternalLoad, externalLoadHasInternalPair, getPlayerDayLoad, calculateEwma, calculateEwmaAcwr } from '../load-metrics';
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
    expect(
      getPlayerDayLoad('p1', '2026-06-01', { internalLoads: [internal], externalLoads: [external] }),
    ).toBe(420);
  });

  it('calcula EWMA y EWMA ACWR correctamente con ponderación exponencial', () => {
    const loads = [400, 450, 500, 550, 600, 650, 700];
    const ewma7 = calculateEwma(loads, 7);
    expect(ewma7).toBeGreaterThan(500);

    const loads28 = Array(28).fill(400);
    const { acuteEwma, chronicEwma, ratioEwma } = calculateEwmaAcwr(loads28);
    expect(acuteEwma).toBe(400);
    expect(chronicEwma).toBe(400);
    expect(ratioEwma).toBe(1);
  });
});
