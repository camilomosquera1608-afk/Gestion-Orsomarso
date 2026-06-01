import type { AppData, Player } from '../types';
import { computeDayLoadBreakdown, computePlayerLoadRiskProfile } from '../load-risk-engine';

const emptyData = (player: Player): AppData => ({
  players: [player],
  wellness: [],
  internalLoads: [],
  externalLoads: [],
  cmjRecords: [],
  nutritionRecords: [],
  neuromuscularRecords: [],
  fmsRecords: [],
  competitionRecords: [],
  competitionMatchSummaries: [],
  trainingSessionSummaries: [],
  microcycles: [],
  strengthSessions: [],
  technicalProfiles: [],
  technicalReports: [],
  scoutFollowUps: [],
  selectionCallRecords: [],
  playerCaptureLocations: [],
  technicalDecisions: [],
});

const player: Player = {
  id: 'p1',
  name: 'Jugador Test',
  age: 20,
  position: 'Extremo',
  category: 'Sub20',
  height: 178,
  weight: 72,
  status: 'Disponible',
  maxVelocityReference: 34,
  baselineWellness: 4,
  targetWeeklyLoad: 1200,
  photo: '',
};

const addInternal = (data: AppData, date: string, duration: number, rpe: number, sessionNumber = 1) => {
  data.internalLoads.push({
    id: `int-${date}-${sessionNumber}`,
    playerId: player.id,
    date,
    duration,
    rpe,
    sessionNumber,
    category: 'Sub20',
  });
};

const addWellness = (data: AppData, date: string, value: number) => {
  data.wellness.push({
    id: `well-${date}`,
    playerId: player.id,
    date,
    sleep: value,
    fatigue: value,
    stress: value,
    musclePain: value,
    mood: value,
    category: 'Sub20',
  });
};

describe('load-risk-engine', () => {
  it('does not duplicate sRPE when internal/external are paired', () => {
    const data = emptyData(player);
    addInternal(data, '2026-05-21', 60, 7, 1);
    data.externalLoads.push({
      id: 'gps-1',
      playerId: player.id,
      date: '2026-05-21',
      min: 60,
      rpe: 7,
      acc: 12,
      dcc: 10,
      sprints: 3,
      rhie: 2,
      totalDistance: 6200,
      highSpeedDistance: 450,
      sprintDistance: 120,
      maxVelocity: 31,
      sessionNumber: 1,
      category: 'Sub20',
    });
    const day = computeDayLoadBreakdown(data, player.id, '2026-05-21');
    expect(day.effectiveLoad).toBe(420);
    expect(day.minutes).toBe(60);
    expect(day.distance).toBe(6200);
  });

  it('flags ACWR danger on acute spike', () => {
    const data = emptyData(player);
    ['2026-04-17', '2026-04-24', '2026-05-01', '2026-05-08'].forEach((date) =>
      addInternal(data, date, 100, 7),
    );
    ['2026-05-15', '2026-05-17', '2026-05-19', '2026-05-21'].forEach((date) =>
      addInternal(data, date, 100, 7),
    );
    for (let i = 0; i < 28; i += 1) {
      addWellness(data, `2026-04-${String(23 + (i % 7)).padStart(2, '0')}`, 4);
    }
    const profile = computePlayerLoadRiskProfile({ data, player, date: '2026-05-21' });
    expect(profile.acwr.primary.rolling).toBe(4);
    expect(profile.acwr.primary.zone).toBe('danger');
    expect(profile.contributions.some((item) => item.key === 'acwr-srpe-danger')).toBe(true);
  });

  it('lowers confidence with limited history', () => {
    const data = emptyData(player);
    addInternal(data, '2026-05-21', 45, 5);
    const profile = computePlayerLoadRiskProfile({ data, player, date: '2026-05-21' });
    expect(profile.dataConfidence.label).toBe('Baja');
    expect(profile.contributions.some((item) => item.key === 'low-data-confidence')).toBe(true);
    expect(profile.decision).toBe('Control preventivo');
  });

  it('marks red risk for readaptation with hamstring pain and sprint return', () => {
    const data = emptyData({
      ...player,
      status: 'Readaptación',
      injuryHistory: [
        {
          id: 'inj-1',
          date: '2026-03-01',
          injuryType: 'Muscular',
          area: 'Isquiotibial',
          status: 'cerrada',
        },
      ],
    });
    data.externalLoads.push({
      id: 'gps-return',
      playerId: player.id,
      date: '2026-05-21',
      min: 30,
      acc: 20,
      dcc: 18,
      sprints: 7,
      rhie: 4,
      sprintDistance: 220,
      highSpeedDistance: 650,
      maxVelocity: 32,
      category: 'Sub20',
    });
    const profile = computePlayerLoadRiskProfile({
      data,
      player: data.players[0],
      date: '2026-05-21',
      bodyRecords: [
        {
          id: 'body-1',
          playerId: player.id,
          date: '2026-05-21',
          source: 'Fisioterapia',
          type: 'Molestia',
          region: 'Isquiotibial',
          side: 'Derecha',
          intensity: 7,
          limitation: false,
          increasesWithSprint: true,
          status: 'Abierto',
          createdAt: '2026-05-21T12:00:00.000Z',
        },
      ],
    });
    expect(profile.riskTone).toBe('red');
    expect(profile.recommendations.some((item) => item.includes('sprint'))).toBe(true);
  });
});
