const assertEqual = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
};

const assertOk = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};

import type { AppData, Player } from '../lib/types';
import { computeDayLoadBreakdown, computePlayerLoadRiskProfile } from '../lib/load-risk-engine';

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
  data.internalLoads.push({ id: `int-${date}-${sessionNumber}`, playerId: player.id, date, duration, rpe, sessionNumber, category: 'Sub20' });
};

const addWellness = (data: AppData, date: string, value: number) => {
  data.wellness.push({ id: `well-${date}`, playerId: player.id, date, sleep: value, fatigue: value, stress: value, musclePain: value, mood: value, category: 'Sub20' });
};

{
  const data = emptyData(player);
  addInternal(data, '2026-05-21', 60, 7, 1);
  data.externalLoads.push({ id: 'gps-1', playerId: player.id, date: '2026-05-21', min: 60, rpe: 7, acc: 12, dcc: 10, sprints: 3, rhie: 2, totalDistance: 6200, highSpeedDistance: 450, sprintDistance: 120, maxVelocity: 31, sessionNumber: 1, category: 'Sub20' });
  const day = computeDayLoadBreakdown(data, player.id, '2026-05-21');
  assertEqual(day.effectiveLoad, 420, 'paired internal/external session must not duplicate sRPE load');
  assertEqual(day.minutes, 60, 'paired GPS should not duplicate field minutes');
  assertEqual(day.distance, 6200, 'GPS external metrics must still be retained');
}

{
  const data = emptyData(player);
  ['2026-04-17', '2026-04-24', '2026-05-01', '2026-05-08'].forEach((date) => addInternal(data, date, 100, 7));
  ['2026-05-15', '2026-05-17', '2026-05-19', '2026-05-21'].forEach((date) => addInternal(data, date, 100, 7));
  for (let i = 0; i < 28; i += 1) addWellness(data, `2026-04-${String(23 + (i % 7)).padStart(2, '0')}`, 4);
  const profile = computePlayerLoadRiskProfile({ data, player, date: '2026-05-21' });
  assertEqual(profile.acwr.primary.rolling, 4, 'acute 2800 vs chronic 700 should produce ACWR 4.00');
  assertEqual(profile.acwr.primary.zone, 'danger', 'large acute spike should be danger zone');
  assertOk(profile.contributions.some((item) => item.key === 'acwr-srpe-danger'), 'risk should explain ACWR spike');
}

{
  const data = emptyData(player);
  addInternal(data, '2026-05-21', 45, 5);
  const profile = computePlayerLoadRiskProfile({ data, player, date: '2026-05-21' });
  assertEqual(profile.dataConfidence.label, 'Baja', 'limited history must lower confidence');
  assertOk(profile.contributions.some((item) => item.key === 'low-data-confidence'), 'limited history must be explicit in risk explanation');
  assertEqual(profile.decision, 'Control preventivo', 'low confidence should avoid a strong green recommendation');
}

{
  const data = emptyData({ ...player, status: 'Readaptación', injuryHistory: [{ id: 'inj-1', date: '2026-03-01', injuryType: 'Muscular', area: 'Isquiotibial', status: 'cerrada' }] });
  data.externalLoads.push({ id: 'gps-return', playerId: player.id, date: '2026-05-21', min: 30, acc: 20, dcc: 18, sprints: 7, rhie: 4, sprintDistance: 220, highSpeedDistance: 650, maxVelocity: 32, category: 'Sub20' });
  const profile = computePlayerLoadRiskProfile({ data, player: data.players[0], date: '2026-05-21', bodyRecords: [{ id: 'body-1', playerId: player.id, date: '2026-05-21', source: 'Fisioterapia', type: 'Molestia', region: 'Isquiotibial', side: 'Derecha', intensity: 7, limitation: false, increasesWithSprint: true, status: 'Abierto', createdAt: '2026-05-21T12:00:00.000Z' }] });
  assertEqual(profile.riskTone, 'red', 'readaptation + hamstring pain + sprint return should be red');
  assertOk(profile.recommendations.some((item) => item.includes('sprint')), 'recommendation should mention sprint/COD/contact restriction');
}

console.log('load-risk-engine tests OK');
