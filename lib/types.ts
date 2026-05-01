export type PlayerStatus = 'Disponible' | 'Lesionado' | 'Molestia' | 'Readaptación';
export type Position = 'Portero' | 'Defensa central' | 'Lateral' | 'Mediocampista' | 'Extremo' | 'Delantero';
export type ClubCategory = 'Sub15' | 'Sub17' | 'Sub20';
export type StaffRole = 'sub15' | 'sub17' | 'sub20' | 'master';
export type NutritionPlan = 'Normocalorico' | 'Hipercalorico' | 'Hipocalorico';
export type SkinfoldRange = '30 - 35' | '35 - 40' | '40 - 45' | '45 - 50';
export type MuscleMassRange = '50% - 55%' | '55% - 60%';
export type FatPercentageRange = 'Adecuado' | 'Seguimiento' | 'Alerta';
export type TrainingSessionType = 'cdef' | 'cdEf' | 'cdeF' | 'Cdef';
export type SessionParticipation = 'Completa' | 'Parcial' | 'No participa' | 'Gimnasio' | 'Readaptación';
export type MovementType = 'base' | 'subio_a_entrenar' | 'bajo_a_entrenar' | 'subio_a_competir' | 'bajo_a_competir';
export type MovementModule = 'sesion' | 'competencia';
export type InjuryKind = 'Muscular' | 'Articular' | 'Tendinosa' | 'Ósea';
export type CompetitionVenue = 'Local' | 'Visitante';
export type MatchResultType = 'Victoria' | 'Empate' | 'Derrota';
export type CompetitionPlayerRole = 'Titular' | 'Suplente';
export type CompetitionMedicalStatus = 'Sin lesión' | 'Lesionado';
export type OperationalRecordStatus = 'Borrador' | 'En revisión' | 'Cerrada' | 'Reabierta';


export interface InjuryHistoryItem {
  id: string;
  date: string;
  injuryType: string;
  area?: string;
  severity?: string;
  status: 'activa' | 'cerrada';
  medicalNote?: string;
  expectedReturnDate?: string;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  birthDate?: string;
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
  injuryHistory?: InjuryHistoryItem[];
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
  sessionId?: string;
  playerId: string;
  date: string;
  rpe: number;
  duration: number;
  microcycleId?: string;
  sessionNumber?: number;
  category?: ClubCategory;
  baseCategory?: ClubCategory;
  actingCategory?: ClubCategory;
  movementType?: MovementType;
  movementNote?: string;
  movementModule?: MovementModule;
  loggedBy?: string;
}

export interface DailyExternalLoadRecord {
  id: string;
  sessionId?: string;
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
  distancePerMin?: number;
  maxVelocity?: number;
  playerLoad?: number;
  playerLoadPerMin?: number;
  highSpeedDistance?: number;
  sprintDistance?: number;
  hsr?: number;
  participation?: SessionParticipation;
  microcycleId?: string;
  sessionNumber?: number;
  sessionType?: TrainingSessionType;
  category?: ClubCategory;
  baseCategory?: ClubCategory;
  actingCategory?: ClubCategory;
  movementType?: MovementType;
  movementNote?: string;
  movementModule?: MovementModule;
  loggedBy?: string;
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
  weightRange?: string;
  skinfoldRange?: SkinfoldRange;
  fatPercentageRange?: FatPercentageRange;
  muscleMassPercentage?: number;
  muscleMassRange?: MuscleMassRange;
  imo?: number;
  diagnosis?: string;
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
  matchId?: string;
  playerId: string;
  date: string;
  opponent: string;
  competitionName?: string;
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
  baseCategory?: ClubCategory;
  actingCategory?: ClubCategory;
  movementType?: MovementType;
  movementNote?: string;
  movementModule?: MovementModule;
  loggedBy?: string;
  startingRole?: CompetitionPlayerRole;
  postCompetitionStatus?: string;
  medicalStatus?: CompetitionMedicalStatus;
  injuryKind?: InjuryKind;
  medicalObservation?: string;
}

export interface TrainingSessionSummary {
  id: string;
  date: string;
  category?: ClubCategory;
  microcycleId: string;
  sessionNumber: number;
  sessionType: TrainingSessionType;
  sessionRpe?: number;
  objective?: string;
  observation?: string;
  status?: OperationalRecordStatus;
}

export interface CompetitionMatchSummary {
  id: string;
  date: string;
  category: ClubCategory;
  competitionName: string;
  opponent: string;
  venue?: CompetitionVenue;
  goalsFor?: number;
  goalsAgainst?: number;
  resultType?: MatchResultType;
  result?: string;
  observation?: string;
  status?: OperationalRecordStatus;
}

export interface Microcycle {
  id: string;
  name: string;
  category?: ClubCategory;
  startDate: string;
  endDate: string;
  objective?: string;
  notes?: string;
  status?: string;
  weekNumber?: number;
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
  competitionMatchSummaries: CompetitionMatchSummary[];
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
  actingCategory: string;
  movementType: string;
  sessionNumber: number;
}
