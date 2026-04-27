import { AppData } from './types';

const playerPhotos = [
  'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80'
];

export const initialData: AppData = {
  trainingSessionSummaries: [
    { id: 'ts1', date: '2026-04-23', microcycleId: 'mc-14', sessionNumber: 1, sessionType: 'cdEf', objective: 'Ejecución de tareas tácticas y control de carga', observation: 'Buena respuesta general del grupo.' },
    { id: 'ts2', date: '2026-04-22', microcycleId: 'mc-14', sessionNumber: 2, sessionType: 'cdeF', objective: 'Desarrollo de condición física específica', observation: 'Dos jugadores quedaron por debajo del rango previsto.' }
  ],
  microcycles: [
    { id: 'mc-51', name: 'Microciclo 51', startDate: '2027-01-04', endDate: '2027-01-10' },
    { id: 'mc-50', name: 'Microciclo 50', startDate: '2026-12-28', endDate: '2027-01-03' },
    { id: 'mc-49', name: 'Microciclo 49', startDate: '2026-12-21', endDate: '2026-12-27' },
    { id: 'mc-48', name: 'Microciclo 48', startDate: '2026-12-14', endDate: '2026-12-20' },
    { id: 'mc-47', name: 'Microciclo 47', startDate: '2026-12-07', endDate: '2026-12-13' },
    { id: 'mc-46', name: 'Microciclo 46', startDate: '2026-11-30', endDate: '2026-12-06' },
    { id: 'mc-45', name: 'Microciclo 45', startDate: '2026-11-23', endDate: '2026-11-29' },
    { id: 'mc-44', name: 'Microciclo 44', startDate: '2026-11-16', endDate: '2026-11-22' },
    { id: 'mc-43', name: 'Microciclo 43', startDate: '2026-11-09', endDate: '2026-11-15' },
    { id: 'mc-42', name: 'Microciclo 42', startDate: '2026-11-02', endDate: '2026-11-08' },
    { id: 'mc-41', name: 'Microciclo 41', startDate: '2026-10-26', endDate: '2026-11-01' },
    { id: 'mc-40', name: 'Microciclo 40', startDate: '2026-10-19', endDate: '2026-10-25' },
    { id: 'mc-39', name: 'Microciclo 39', startDate: '2026-10-12', endDate: '2026-10-18' },
    { id: 'mc-38', name: 'Microciclo 38', startDate: '2026-10-05', endDate: '2026-10-11' },
    { id: 'mc-37', name: 'Microciclo 37', startDate: '2026-09-28', endDate: '2026-10-04' },
    { id: 'mc-36', name: 'Microciclo 36', startDate: '2026-09-21', endDate: '2026-09-27' },
    { id: 'mc-35', name: 'Microciclo 35', startDate: '2026-09-14', endDate: '2026-09-20' },
    { id: 'mc-34', name: 'Microciclo 34', startDate: '2026-09-07', endDate: '2026-09-13' },
    { id: 'mc-33', name: 'Microciclo 33', startDate: '2026-08-31', endDate: '2026-09-06' },
    { id: 'mc-32', name: 'Microciclo 32', startDate: '2026-08-24', endDate: '2026-08-30' },
    { id: 'mc-31', name: 'Microciclo 31', startDate: '2026-08-17', endDate: '2026-08-23' },
    { id: 'mc-30', name: 'Microciclo 30', startDate: '2026-08-10', endDate: '2026-08-16' },
    { id: 'mc-29', name: 'Microciclo 29', startDate: '2026-08-03', endDate: '2026-08-09' },
    { id: 'mc-28', name: 'Microciclo 28', startDate: '2026-07-27', endDate: '2026-08-02' },
    { id: 'mc-27', name: 'Microciclo 27', startDate: '2026-07-20', endDate: '2026-07-26' },
    { id: 'mc-26', name: 'Microciclo 26', startDate: '2026-07-13', endDate: '2026-07-19' },
    { id: 'mc-25', name: 'Microciclo 25', startDate: '2026-07-06', endDate: '2026-07-12' },
    { id: 'mc-24', name: 'Microciclo 24', startDate: '2026-06-29', endDate: '2026-07-05' },
    { id: 'mc-23', name: 'Microciclo 23', startDate: '2026-06-22', endDate: '2026-06-28' },
    { id: 'mc-22', name: 'Microciclo 22', startDate: '2026-06-15', endDate: '2026-06-21' },
    { id: 'mc-21', name: 'Microciclo 21', startDate: '2026-06-08', endDate: '2026-06-14' },
    { id: 'mc-20', name: 'Microciclo 20', startDate: '2026-06-01', endDate: '2026-06-07' },
    { id: 'mc-19', name: 'Microciclo 19', startDate: '2026-05-25', endDate: '2026-05-31' },
    { id: 'mc-18', name: 'Microciclo 18', startDate: '2026-05-18', endDate: '2026-05-24' },
    { id: 'mc-17', name: 'Microciclo 17', startDate: '2026-05-11', endDate: '2026-05-17' },
    { id: 'mc-16', name: 'Microciclo 16', startDate: '2026-05-04', endDate: '2026-05-10' },
    { id: 'mc-15', name: 'Microciclo 15', startDate: '2026-04-27', endDate: '2026-05-03' },
    { id: 'mc-14', name: 'Microciclo 14', startDate: '2026-04-20', endDate: '2026-04-26' },
    { id: 'mc-13', name: 'Microciclo 13', startDate: '2026-04-13', endDate: '2026-04-19' },
    { id: 'mc-12', name: 'Microciclo 12', startDate: '2026-04-06', endDate: '2026-04-12' },
    { id: 'mc-11', name: 'Microciclo 11', startDate: '2026-03-30', endDate: '2026-04-05' },
    { id: 'mc-10', name: 'Microciclo 10', startDate: '2026-03-23', endDate: '2026-03-29' },
    { id: 'mc-9', name: 'Microciclo 9', startDate: '2026-03-16', endDate: '2026-03-22' },
    { id: 'mc-8', name: 'Microciclo 8', startDate: '2026-03-09', endDate: '2026-03-15' },
    { id: 'mc-7', name: 'Microciclo 7', startDate: '2026-03-02', endDate: '2026-03-08' },
    { id: 'mc-6', name: 'Microciclo 6', startDate: '2026-02-23', endDate: '2026-03-01' },
    { id: 'mc-5', name: 'Microciclo 5', startDate: '2026-02-16', endDate: '2026-02-22' },
    { id: 'mc-4', name: 'Microciclo 4', startDate: '2026-02-09', endDate: '2026-02-15' },
    { id: 'mc-3', name: 'Microciclo 3', startDate: '2026-02-02', endDate: '2026-02-08' },
    { id: 'mc-2', name: 'Microciclo 2', startDate: '2026-01-26', endDate: '2026-02-01' },
    { id: 'mc-1', name: 'Microciclo 1', startDate: '2026-01-19', endDate: '2026-01-25' }
  ],
  players: [
    { id: 'p1', name: 'Juan Camilo Ruiz', age: 26, position: 'Portero', height: 189, weight: 84, status: 'Disponible', category: 'Sub20', birthDate: '15/03/2000', photo: playerPhotos[0] },
    { id: 'p2', name: 'Brayan Mosquera', age: 23, position: 'Defensa central', height: 184, weight: 79, status: 'Disponible', category: 'Sub20', birthDate: '09/09/2002', photo: playerPhotos[1] },
    { id: 'p3', name: 'Kevin Salazar', age: 21, position: 'Lateral', height: 176, weight: 72, status: 'Molestia', category: 'Sub17', birthDate: '20/01/2008', photo: playerPhotos[2] },
    { id: 'p4', name: 'Andrés Cuesta', age: 24, position: 'Mediocampista', height: 178, weight: 74, status: 'Disponible', category: 'Sub17', birthDate: '11/05/2008', photo: playerPhotos[3] },
    { id: 'p5', name: 'Johan Murillo', age: 27, position: 'Extremo', height: 175, weight: 70, status: 'Readaptación', category: 'Sub15', birthDate: '07/08/2010', photo: playerPhotos[4] },
    { id: 'p6', name: 'Santiago Arboleda', age: 25, position: 'Delantero', height: 181, weight: 77, status: 'Lesionado', category: 'Sub15', birthDate: '02/12/2010', photo: playerPhotos[0] }
  ],
  wellness: [
    { id: 'w1', playerId: 'p1', date: '2026-04-23', sleep: 4, fatigue: 4, stress: 5, musclePain: 4, mood: 5 },
    { id: 'w2', playerId: 'p2', date: '2026-04-23', sleep: 4, fatigue: 3, stress: 4, musclePain: 4, mood: 4 },
    { id: 'w3', playerId: 'p3', date: '2026-04-23', sleep: 3, fatigue: 2, stress: 3, musclePain: 2, mood: 3 },
    { id: 'w4', playerId: 'p4', date: '2026-04-23', sleep: 5, fatigue: 4, stress: 4, musclePain: 4, mood: 5 },
    { id: 'w5', playerId: 'p5', date: '2026-04-23', sleep: 3, fatigue: 3, stress: 3, musclePain: 3, mood: 4 },
    { id: 'w6', playerId: 'p6', date: '2026-04-23', sleep: 2, fatigue: 2, stress: 3, musclePain: 2, mood: 2 },
    { id: 'w7', playerId: 'p1', date: '2026-04-22', sleep: 4, fatigue: 4, stress: 4, musclePain: 4, mood: 4 },
    { id: 'w8', playerId: 'p2', date: '2026-04-22', sleep: 4, fatigue: 3, stress: 4, musclePain: 3, mood: 4 },
    { id: 'w9', playerId: 'p3', date: '2026-04-22', sleep: 3, fatigue: 3, stress: 3, musclePain: 3, mood: 3 },
    { id: 'w10', playerId: 'p4', date: '2026-04-22', sleep: 5, fatigue: 4, stress: 4, musclePain: 4, mood: 5 }
  ],
  internalLoads: [
    { id: 'i1', playerId: 'p1', date: '2026-04-23', rpe: 5, duration: 75 },
    { id: 'i2', playerId: 'p2', date: '2026-04-23', rpe: 6, duration: 82 },
    { id: 'i3', playerId: 'p3', date: '2026-04-23', rpe: 4, duration: 60 },
    { id: 'i4', playerId: 'p4', date: '2026-04-23', rpe: 7, duration: 78 },
    { id: 'i5', playerId: 'p5', date: '2026-04-23', rpe: 4, duration: 55 },
    { id: 'i6', playerId: 'p6', date: '2026-04-23', rpe: 3, duration: 45 }
  ],
  externalLoads: [
    { id: 'e1', playerId: 'p1', date: '2026-04-23', min: 75, rpe: 5, acc: 11, dcc: 10, sprints: 6, rhie: 7, ima: 14, microcycleId: 'mc-14', sessionNumber: 1, sessionType: 'cdEf' },
    { id: 'e2', playerId: 'p2', date: '2026-04-23', min: 82, rpe: 6, acc: 32, dcc: 28, sprints: 12, rhie: 17, ima: 21, microcycleId: 'mc-14', sessionNumber: 1, sessionType: 'cdEf' },
    { id: 'e3', playerId: 'p3', date: '2026-04-23', min: 60, rpe: 4, acc: 36, dcc: 35, sprints: 15, rhie: 20, ima: 26, microcycleId: 'mc-14', sessionNumber: 1, sessionType: 'cdEf', category: 'Sub17', baseCategory: 'Sub17', actingCategory: 'Sub20', movementType: 'subio_a_entrenar', movementNote: 'Apoyo de entrenamiento', movementModule: 'sesion' },
    { id: 'e4', playerId: 'p4', date: '2026-04-23', min: 78, rpe: 7, acc: 40, dcc: 39, sprints: 18, rhie: 24, ima: 29, microcycleId: 'mc-14', sessionNumber: 1, sessionType: 'cdEf' },
    { id: 'e5', playerId: 'p5', date: '2026-04-23', min: 55, rpe: 4, acc: 38, dcc: 37, sprints: 17, rhie: 25, ima: 27, microcycleId: 'mc-14', sessionNumber: 1, sessionType: 'cdEf' },
    { id: 'e6', playerId: 'p6', date: '2026-04-23', min: 45, rpe: 3, acc: 7, dcc: 8, sprints: 3, rhie: 4, ima: 8, microcycleId: 'mc-14', sessionNumber: 1, sessionType: 'cdEf' },
    { id: 'e7', playerId: 'p1', date: '2026-04-22', min: 80, rpe: 5, acc: 12, dcc: 11, sprints: 6, rhie: 8, ima: 15, microcycleId: 'mc-14', sessionNumber: 2, sessionType: 'cdeF' },
    { id: 'e8', playerId: 'p2', date: '2026-04-22', min: 85, rpe: 6, acc: 33, dcc: 29, sprints: 13, rhie: 18, ima: 22, microcycleId: 'mc-14', sessionNumber: 2, sessionType: 'cdeF' },
    { id: 'e9', playerId: 'p3', date: '2026-04-22', min: 60, rpe: 4, acc: 30, dcc: 31, sprints: 12, rhie: 17, ima: 20, microcycleId: 'mc-14', sessionNumber: 2, sessionType: 'cdeF' },
    { id: 'e10', playerId: 'p4', date: '2026-04-22', min: 85, rpe: 7, acc: 42, dcc: 40, sprints: 19, rhie: 22, ima: 30, microcycleId: 'mc-14', sessionNumber: 2, sessionType: 'cdeF' }
  ],
  cmjRecords: [
    { id: 'c1', playerId: 'p1', date: '2026-04-23', value: 39.8 },
    { id: 'c2', playerId: 'p2', date: '2026-04-23', value: 41.2 },
    { id: 'c3', playerId: 'p3', date: '2026-04-23', value: 36.1 },
    { id: 'c4', playerId: 'p4', date: '2026-04-23', value: 43.4 },
    { id: 'c5', playerId: 'p5', date: '2026-04-23', value: 40.5 },
    { id: 'c6', playerId: 'p6', date: '2026-04-23', value: 34.2 },
    { id: 'c7', playerId: 'p1', date: '2026-04-18', value: 39.1 },
    { id: 'c8', playerId: 'p2', date: '2026-04-18', value: 40.3 },
    { id: 'c9', playerId: 'p3', date: '2026-04-18', value: 37.0 },
    { id: 'c10', playerId: 'p4', date: '2026-04-18', value: 42.2 },
    { id: 'c11', playerId: 'p5', date: '2026-04-18', value: 39.8 },
    { id: 'c12', playerId: 'p6', date: '2026-04-18', value: 35.0 }
  ],
  nutritionRecords: [
    { id: 'n1', playerId: 'p1', date: '2026-04-23', weight: 84, height: 189, bodyFat: 10.8, skinfoldSum: 42, plan: 'Normocalorico' },
    { id: 'n2', playerId: 'p1', date: '2026-04-18', weight: 84.6, height: 189, bodyFat: 11.3, skinfoldSum: 45, plan: 'Normocalorico' },
    { id: 'n3', playerId: 'p2', date: '2026-04-23', weight: 79, height: 184, bodyFat: 11.9, skinfoldSum: 48, plan: 'Normocalorico' },
    { id: 'n4', playerId: 'p2', date: '2026-04-18', weight: 79.7, height: 184, bodyFat: 12.2, skinfoldSum: 50, plan: 'Normocalorico' },
    { id: 'n5', playerId: 'p3', date: '2026-04-23', weight: 72, height: 176, bodyFat: 9.7, skinfoldSum: 38, plan: 'Hipercalorico' },
    { id: 'n6', playerId: 'p4', date: '2026-04-23', weight: 74, height: 178, bodyFat: 10.2, skinfoldSum: 40, plan: 'Normocalorico' },
    { id: 'n7', playerId: 'p5', date: '2026-04-23', weight: 70, height: 175, bodyFat: 9.9, skinfoldSum: 39, plan: 'Hipercalorico' },
    { id: 'n8', playerId: 'p6', date: '2026-04-23', weight: 77, height: 181, bodyFat: 12.7, skinfoldSum: 54, plan: 'Hipocalorico' }
  ],
  neuromuscularRecords: [
    { id: 'neu1', playerId: 'p1', date: '2026-04-23', cmj: 39.8, sj: 34.1, reactiveJumps: 22 },
    { id: 'neu2', playerId: 'p1', date: '2026-04-18', cmj: 39.1, sj: 33.8, reactiveJumps: 20 },
    { id: 'neu3', playerId: 'p2', date: '2026-04-23', cmj: 41.2, sj: 35.6, reactiveJumps: 24 },
    { id: 'neu4', playerId: 'p2', date: '2026-04-18', cmj: 40.3, sj: 34.9, reactiveJumps: 23 },
    { id: 'neu5', playerId: 'p3', date: '2026-04-23', cmj: 36.1, sj: 31.8, reactiveJumps: 18 },
    { id: 'neu6', playerId: 'p4', date: '2026-04-23', cmj: 43.4, sj: 37.1, reactiveJumps: 26 },
    { id: 'neu7', playerId: 'p5', date: '2026-04-23', cmj: 40.5, sj: 34.4, reactiveJumps: 23 },
    { id: 'neu8', playerId: 'p6', date: '2026-04-23', cmj: 34.2, sj: 29.6, reactiveJumps: 16 }
  ],
  fmsRecords: [
    { id: 'f1', playerId: 'p1', date: '2026-04-23', shoulderMobility: 3, squat: 3, legRaise: 2, hurdleStep: 3, lunge: 3, trunkStability: 3, rotaryStability: 2 },
    { id: 'f2', playerId: 'p1', date: '2026-04-18', shoulderMobility: 2, squat: 3, legRaise: 2, hurdleStep: 2, lunge: 3, trunkStability: 2, rotaryStability: 2 },
    { id: 'f3', playerId: 'p2', date: '2026-04-23', shoulderMobility: 2, squat: 3, legRaise: 2, hurdleStep: 2, lunge: 3, trunkStability: 3, rotaryStability: 2 },
    { id: 'f4', playerId: 'p2', date: '2026-04-18', shoulderMobility: 2, squat: 2, legRaise: 2, hurdleStep: 2, lunge: 2, trunkStability: 3, rotaryStability: 2 },
    { id: 'f5', playerId: 'p3', date: '2026-04-23', shoulderMobility: 2, squat: 2, legRaise: 2, hurdleStep: 2, lunge: 2, trunkStability: 2, rotaryStability: 1 },
    { id: 'f6', playerId: 'p4', date: '2026-04-23', shoulderMobility: 3, squat: 3, legRaise: 3, hurdleStep: 3, lunge: 3, trunkStability: 3, rotaryStability: 3 },
    { id: 'f7', playerId: 'p5', date: '2026-04-23', shoulderMobility: 2, squat: 3, legRaise: 2, hurdleStep: 2, lunge: 2, trunkStability: 3, rotaryStability: 2 },
    { id: 'f8', playerId: 'p6', date: '2026-04-23', shoulderMobility: 1, squat: 2, legRaise: 1, hurdleStep: 1, lunge: 2, trunkStability: 2, rotaryStability: 1 }
  ],
  competitionRecords: [
    { id: 'co1', playerId: 'p2', date: '2026-04-21', opponent: 'Atlético FC', minutesPlayed: 90, goals: 0, assists: 0, yellowCards: 1, redCards: 0 },
    { id: 'co2', playerId: 'p4', date: '2026-04-21', opponent: 'Atlético FC', minutesPlayed: 88, goals: 1, assists: 1, yellowCards: 0, redCards: 0 },
    { id: 'co3', playerId: 'p5', date: '2026-04-21', opponent: 'Atlético FC', minutesPlayed: 64, goals: 0, assists: 1, yellowCards: 0, redCards: 0 },
    { id: 'co4', playerId: 'p1', date: '2026-04-21', opponent: 'Atlético FC', minutesPlayed: 90, goals: 0, assists: 0, yellowCards: 0, redCards: 0 }
  ]
};
