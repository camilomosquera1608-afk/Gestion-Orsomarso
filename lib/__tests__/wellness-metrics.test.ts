import { computeWellnessScore } from '../wellness-metrics';

describe('wellness-metrics', () => {
  it('promedia solo subescalas respondidas', () => {
    const score = computeWellnessScore({
      sleep: 4,
      fatigue: 0,
      stress: 3,
      musclePain: 0,
      mood: 5,
    });
    expect(score).toBe(4);
  });

  it('devuelve 0 si no hay respuestas', () => {
    expect(computeWellnessScore({ sleep: 0, fatigue: 0, stress: 0, musclePain: 0, mood: 0 })).toBe(0);
  });
});
