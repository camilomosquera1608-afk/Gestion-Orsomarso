export type PlayerStatus = 'Disponible' | 'Lesionado' | 'Molestia' | 'Readaptación';
export type Position = 'Portero' | 'Defensa central' | 'Lateral' | 'Mediocampista' | 'Extremo' | 'Delantero';
export type ClubCategory = 'Sub15' | 'Sub17' | 'Sub20';
export type StaffRole = 'sub15' | 'sub17' | 'sub20' | 'master';
export type NutritionPlan = 'Normocalorico' | 'Hipercalorico' | 'Hipocalorico';
export type SkinfoldRange = '30 - 35' | '35 - 40' | '40 - 45' | '45 - 50';
export type MuscleMassRange = '50% - 55%' | '55% - 60%';
export type FatPercentageRange = '5.7% - 6.2%' | '6.2% - 6.8%' | '6.8% - 7.3%' | '7.3% - 7.8%';
export type TrainingSessionType = 'MD+1' | 'MD+2' | 'MD-5' | 'MD-4' | 'MD-3' | 'MD-2' | 'MD-1' | 'MD';
export type SessionParticipation = 'Completa' | 'Parcial' | 'No participa' | 'Gimnasio' | 'Readaptación';
export type MovementType = 'base' | 'subio_a_entrenar' | 'bajo_a_entrenar' | 'subio_a_competir' | 'bajo_a_competir';
export type MovementModule = 'sesion' | 'competencia';
export type InjuryKind = 'Muscular' | 'Articular' | 'Tendinosa' | 'Ósea';
export type CompetitionVenue = 'Local' | 'Visitante';
export type MatchResultType = 'Victoria' | 'Empate' | 'Derrota';
export type CompetitionPlayerRole = 'Titular' | 'Suplente';
export type CompetitionMedicalStatus = 'Sin lesión' | 'Lesionado';
export type DominantFoot = 'Derecha' | 'Izquierda' | 'Ambidiestro';
export type CompetitiveRole = 'Titular habitual' | 'Rotación' | 'Suplente' | 'Proyección' | 'Retorno a competencia';
export type LoadTolerance = 'Alta' | 'Media' | 'Baja' | 'En construcción';

export type StrengthSessionType = 'Concéntrica' | 'Excéntrica' | 'Reactiva' | 'Hipertrofia recuperación';
export type StrengthGroup = 'Todo el plantel' | 'Titulares' | 'Suplentes' | 'No convocados' | 'Retorno/readaptación';
export type StrengthZone = 'Cadena posterior' | 'Cadena anterior' | 'Hipertrofia' | 'Zona lumbo-pélvica';
export type StrengthCompletion = 'Completa' | 'Parcial' | 'No completó';
export type StrengthMicrodoseIntent = 'Activación' | 'Potenciación' | 'Mantenimiento' | 'Preventivo' | 'Readaptación' | 'Recuperación';
export type StrengthMovementPattern = 'Aceleración' | 'Desaceleración' | 'Cambio de dirección' | 'Sprint / alta velocidad' | 'Salto / aterrizaje' | 'Duelo / contacto' | 'Golpeo' | 'Estabilidad lumbo-pélvica';

export interface StrengthExerciseDesign {
  id: string;
  name: string;
  zone?: StrengthZone;
  sets?: number;
  reps?: string;
  load?: string;
  movementPattern?: StrengthMovementPattern;
  rest?: string;
  note?: string;
}

export interface StrengthPlayerAdjustment {
  playerId: string;
  note: string;
  expectedRpe?: number;
  restriction?: string;
}

export interface StrengthPlayerResponse {
  id: string;
  sessionId: string;
  playerId: string;
  rpe: number;
  completed: StrengthCompletion;
  pain: boolean;
  painRegion?: string;
  painIntensity?: number;
  painType?: 'Fatiga' | 'Molestia' | 'Dolor';
  createdAt: string;
}

export interface StrengthSession {
  id: string;
  date: string;
  category?: ClubCategory;
  group: StrengthGroup;
  type: StrengthSessionType;
  zone: StrengthZone;
  intent?: StrengthMicrodoseIntent;
  movementPattern?: StrengthMovementPattern;
  duration: number;
  expectedRpe: number;
  objective?: string;
  restrictions?: string;
  playerIds: string[];
  excludedPlayerIds?: string[];
  exercises?: StrengthExerciseDesign[];
  adjustments?: StrengthPlayerAdjustment[];
  responses?: StrengthPlayerResponse[];
  createdBy?: string;
  createdAt: string;
  status?: 'Planificada' | 'En respuestas' | 'Cerrada';
}


export interface CompetitionLineupSlot {
  id: string;
  label: string;
  line: 'Arquero' | 'Defensa' | 'Mediocampo' | 'Ataque';
  x: number;
  y: number;
  playerId?: string;
}

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
  jerseyNumber?: number;
  documentId?: string;
  nationality?: string;
  birthplace?: string;
  phone?: string;
  guardianName?: string;
  guardianPhone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  height: number;
  weight: number;
  dominantFoot?: DominantFoot;
  secondaryPosition?: Position;
  competitiveRole?: CompetitiveRole;
  dateJoined?: string;
  status: PlayerStatus;
  loadTolerance?: LoadTolerance;
  maxVelocityReference?: number;
  baselineWellness?: number;
  baselineRpe?: number;
  targetWeeklyLoad?: number;
  targetWeeklyHsr?: number;
  targetWeeklySprintDistance?: number;
  targetMinutes7d?: number;
  maxTrainingPercent?: number;
  maxCompetitionMinutes?: number;
  returnToPlayPhase?: string;
  restrictions?: string[];
  medicalNotes?: string;
  allergies?: string;
  chronicConditions?: string;
  riskAreas?: string;
  photo: string;
  photoUrl?: string;
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
  rpe?: number;
  totalDistance?: number;
  maxVelocity?: number;
  playerLoad?: number;
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
  // Legacy GPS fields — kept for backward compat with historical Supabase data
  highSpeedDistance?: number;
  sprintDistance?: number;
  hsr?: number;
  distancePerMin?: number;
  playerLoadPerMin?: number;
  ima?: number;
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

// Métricas tácticas de competencia
export interface CompetitionTacticalStats {
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  shotsOnTarget?: number;
}

// Métricas físicas de competencia (GPS)
export interface CompetitionPhysicalStats {
  totalDistance?: number;
  highSpeedDistance?: number;
  hsr?: number;
  sprintDistance?: number;
  maxVelocity?: number;
  playerLoad?: number;
  acc?: number;
  dcc?: number;
  sprints?: number;
  rhie?: number;
  ima?: number;  // legacy - mantener para compatibilidad
}

// Métricas específicas de porteros
export interface CompetitionGoalkeeperStats {
  goalsConceded?: number;
  goalsPrevented?: number;
  penaltiesSaved?: number;
  crossesDefended?: number;
  footworkActions?: number;
}

// Metadatos del partido
export interface CompetitionMatchMetadata {
  startingRole?: CompetitionPlayerRole;
  postCompetitionStatus?: string;
  medicalStatus?: CompetitionMedicalStatus;
  injuryKind?: InjuryKind;
  medicalObservation?: string;
  movementType?: MovementType;
  movementNote?: string;
  movementModule?: MovementModule;
  loggedBy?: string;
}

// Registro principal de competencia
export interface CompetitionRecord {
  id: string;
  matchId?: string;
  playerId: string;
  date: string;
  opponent: string;
  competitionName?: string;
  minutesPlayed: number;
  // Métricas tácticas
  tactical: CompetitionTacticalStats;
  // Métricas físicas (opcional)
  physical?: CompetitionPhysicalStats;
  // Métricas de portero (opcional)
  goalkeeper?: CompetitionGoalkeeperStats;
  // Metadatos
  metadata?: CompetitionMatchMetadata;
  // Categoría
  category?: ClubCategory;
  baseCategory?: ClubCategory;
  actingCategory?: ClubCategory;
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
  lineupFormation?: string;
  lineupSlots?: CompetitionLineupSlot[];
  opponentLogo?: string;
  eyeballStats?: unknown;
  eyeballFirstHalfStats?: unknown;
  eyeballSecondHalfStats?: unknown;
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
  strengthSessions: StrengthSession[];
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
