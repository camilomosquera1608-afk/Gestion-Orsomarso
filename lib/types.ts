export type PlayerStatus = 'Disponible' | 'Lesionado' | 'Molestia' | 'Readaptación';
export type Position = 'Portero' | 'Defensa central' | 'Lateral' | 'Mediocampista' | 'Extremo' | 'Delantero';
export type NutritionPlan = 'Normocalorico' | 'Hipercalorico' | 'Hipocalorico';
export type TrainingSessionType = 'cdef' | 'cdEf' | 'cdeF' | 'Cdef';
export type SessionParticipation = 'Completa' | 'Parcial' | 'No participa' | 'Gimnasio' | 'Readaptación';

export interface Player {
  id: string;
  name: string;
  age: number;
  position: Position;
  height: number;
  weight: number;
  status: PlayerStatus;
  photo: string;
  injuryArea?: string;
  injuryType?: string;
  injurySeverity?: string;
  returnDate?: string;
}

export interface DailyWellnessRecord {
  id: string;
  playerId: string;
  date: string;
  sleep: number;
  fatigue: number;
  stress: number;
  musclePain: number;
  mood: number;
}

export interface DailyInternalLoadRecord {
  id: string;
  playerId: string;
  date: string;
  rpe: number;
  duration: number;
  microcycleId?: string;
  sessionNumber?: number;
}

export interface DailyExternalLoadRecord {
  id: string;
  playerId: string;
  date: string;
  totalDistance: number;
  hsr: number;
  rhie: number;
  acc: number;
  dcc: number;
  min: number;
  rpe?: number;
  participation?: SessionParticipation;
  microcycleId?: string;
  sessionNumber?: number;
  sessionType?: TrainingSessionType;
}

export interface CMJRecord {
  id: string;
  playerId: string;
  date: string;
  value: number;
}

export interface NutritionRecord {
  id: string;
  playerId: string;
  date: string;
  weight: number;
  height: number;
  bodyFat: number;
  skinfoldSum: number;
  plan: NutritionPlan;
}

export interface NeuromuscularRecord {
  id: string;
  playerId: string;
  date: string;
  cmj: number;
  sj: number;
  reactiveJumps: number;
}

export interface FMSRecord {
  id: string;
  playerId: string;
  date: string;
  shoulderMobility: number;
  squat: number;
  legRaise: number;
  hurdleStep: number;
  lunge: number;
  trunkStability: number;
  rotaryStability: number;
}

export interface CompetitionRecord {
  id: string;
  playerId: string;
  date: string;
  opponent: string;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}

export interface TrainingSessionSummary {
  id: string;
  date: string;
  microcycleId: string;
  sessionNumber: number;
  sessionType: TrainingSessionType;
  objective?: string;
  observation?: string;
}

export interface Microcycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface AppData {
  players: Player[];
  wellness: DailyWellnessRecord[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  cmjRecords: CMJRecord[];
  nutritionRecords: NutritionRecord[];
  neuromuscularRecords: NeuromuscularRecord[];
  fmsRecords: FMSRecord[];
  competitionRecords: CompetitionRecord[];
  trainingSessionSummaries: TrainingSessionSummary[];
  microcycles: Microcycle[];
}

export interface GlobalFilters {
  date: string;
  microcycleId: string;
  playerId: string;
  position: string;
  status: string;
  sessionNumber: number;
}
