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
  ima?: number;  // legacy
  totalDistance?: number;
  highSpeedDistance?: number;
  hsr?: number;
  sprintDistance?: number;
  maxVelocity?: number;
  playerLoad?: number;
  goalsConceded?: number;
  goalsPrevented?: number;
  penaltiesSaved?: number;
  crossesDefended?: number;
  footworkActions?: number;
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



export type TechnicalProjection = 'baja' | 'media' | 'alta' | 'muy_alta';
export type TechnicalModelFit = 'bajo' | 'medio' | 'alto';
export type TechnicalReportContext = 'partido' | 'entrenamiento' | 'torneo' | 'video' | 'prueba' | 'otro';
export type TechnicalRecommendation = 'seguir_observando' | 'priorizar' | 'convocable' | 'promover' | 'descartar' | 'revisar_mas_adelante';
export type ScoutStatus = 'sin_seguimiento' | 'nuevo' | 'observado' | 'en_seguimiento' | 'interesante' | 'prioridad' | 'convocable' | 'promovible' | 'descartado';
export type ScoutReason = 'proyeccion' | 'necesidad_posicion' | 'rendimiento_reciente' | 'recomendacion_scout' | 'seguimiento_seleccion' | 'promocion_categoria' | 'otro';
export type ScoutDiscardReason = 'no_encaja_modelo' | 'bajo_nivel_competitivo' | 'baja_proyeccion' | 'problema_disciplinario' | 'posicion_cubierta' | 'falta_datos' | 'otro';
export type SelectionLevel = 'nacional' | 'departamental' | 'regional' | 'municipal' | 'otra';
export type SelectionCallType = 'microciclo' | 'competencia' | 'amistoso' | 'visoria' | 'entrenamiento' | 'otro';
export type SelectionCallStatus = 'preconvocado' | 'convocado' | 'participo' | 'no_asistio' | 'descartado' | 'pendiente';
export type CaptureSource = 'scouting' | 'recomendacion' | 'torneo' | 'escuela' | 'club_aliado' | 'prueba' | 'seleccion' | 'otro';
export type TechnicalDecisionType = 'mantener_en_observacion' | 'marcar_prioridad' | 'marcar_convocable' | 'promover_categoria' | 'descartar' | 'solicitar_nuevo_reporte' | 'enviar_a_revision' | 'cerrar_seguimiento';

export interface TechnicalProfile {
  id: string;
  playerId: string;
  mainPosition: string;
  secondaryPositions: string[];
  dominantFoot: 'derecha' | 'izquierda' | 'ambas';
  gameProfile: string;
  tacticalRole: string;
  strengths: string[];
  weaknesses: string[];
  projection: TechnicalProjection;
  modelFit: TechnicalModelFit;
  generalNotes: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TechnicalReport {
  id: string;
  playerId: string;
  authorId: string;
  date: string;
  context: TechnicalReportContext;
  observedPosition: string;
  minutesObserved?: number;
  opponentOrContext?: string;
  category?: string;
  technicalScore: number;
  tacticalScore: number;
  physicalScore: number;
  mentalScore: number;
  projectionScore: number;
  modelFitScore: number;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  recommendation: TechnicalRecommendation;
  createdAt: string;
  updatedAt?: string;
}

export interface ScoutFollowUp {
  id: string;
  playerId: string;
  status: ScoutStatus;
  reason?: ScoutReason;
  discardReason?: ScoutDiscardReason;
  priorityLevel: 'baja' | 'media' | 'alta';
  notes?: string;
  responsibleUserId?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SelectionCallRecord {
  id: string;
  playerId: string;
  selectionName: string;
  selectionLevel: SelectionLevel;
  category: string;
  callType: SelectionCallType;
  status: SelectionCallStatus;
  startDate: string;
  endDate?: string;
  eventName?: string;
  location?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

export interface PlayerCaptureLocation {
  id: string;
  playerId: string;
  country: string;
  department?: string;
  region?: string;
  municipality?: string;
  city?: string;
  neighborhood?: string;
  sourceClub?: string;
  school?: string;
  academy?: string;
  latitude?: number;
  longitude?: number;
  captureDate?: string;
  captureYear?: number;
  capturedBy?: string;
  captureSource: CaptureSource;
  isPrimary?: boolean;
  notes?: string;
}

export interface TechnicalDecision {
  id: string;
  playerId: string;
  decision: TechnicalDecisionType;
  reason: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
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
  technicalProfiles: TechnicalProfile[];
  technicalReports: TechnicalReport[];
  scoutFollowUps: ScoutFollowUp[];
  selectionCallRecords: SelectionCallRecord[];
  playerCaptureLocations: PlayerCaptureLocation[];
  technicalDecisions: TechnicalDecision[];
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
