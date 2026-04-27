export type PlayerStatus = 'Disponible' | 'Lesionado' | 'Molestia' | 'Readaptación';
export type Position = 'Portero' | 'Defensa central' | 'Lateral' | 'Mediocampista' | 'Extremo' | 'Delantero';
export type ClubCategory = 'Sub15' | 'Sub17' | 'Sub20';
export type NutritionPlan = 'Normocalorico' | 'Hipercalorico' | 'Hipocalorico';
export type TrainingSessionType = 'cdef' | 'cdEf' | 'cdeF' | 'Cdef';
export type SessionParticipation = 'Completa' | 'Parcial' | 'No participa' | 'Gimnasio' | 'Readaptación';

export interface Player {
  id: string;
  name: string;
  age: number;
  position: Position;
  category?: ClubCategory;
  categoryHistory?: ClubCategory[];
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
  category?: ClubCategory;
}

export interface DailyInternalLoadRecord {
  id: string;
  playerId: string;
  date: string;
  rpe: number;
  duration: number;
  microcycleId?: string;
  sessionNumber?: number;
  category?: ClubCategory;
}

export interface DailyExternalLoadRecord {
  id: string;
  playerId: string;
  date: string;
  min: number;
  acc: number;
  dcc: number;
  sprints: number;
  rhie: number;
  ima: number;
  rpe?: number;
  totalDistance?: number;
  hsr?: number;
  participation?: SessionParticipation;
  microcycleId?: string;
  sessionNumber?: number;
  sessionType?: TrainingSessionType;
  category?: ClubCategory;
}

export interface CMJRecord {
  id: string;
  playerId: string;
  date: string;
  value: number;
  category?: ClubCategory;
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
  category?: ClubCategory;
}

export interface NeuromuscularRecord {
  id: string;
  playerId: string;
  date: string;
  cmj: number;
  sj: number;
  reactiveJumps: number;
  category?: ClubCategory;
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
  category?: ClubCategory;
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
  acc?: number;
  dcc?: number;
  sprints?: number;
  rhie?: number;
  ima?: number;
  goalsConceded?: number;
  goalsPrevented?: number;
  crossesDefended?: number;
  shotsOnTarget?: number;
  category?: ClubCategory;
}

export interface TrainingSessionSummary {
  id: string;
  date: string;
  microcycleId: string;
  sessionNumber: number;
  sessionType: TrainingSessionType;
  sessionRpe?: number;
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
  category: string;
  sessionNumber: number;
}
