import { z } from 'zod';

// Enums
export const PlayerStatusSchema = z.enum(['Disponible', 'Lesionado', 'Molestia', 'Readaptación']);
export const PositionSchema = z.enum(['Portero', 'Defensa central', 'Lateral', 'Mediocampista', 'Extremo', 'Delantero']);
export const ClubCategorySchema = z.enum(['Sub15', 'Sub17', 'Sub20']);
export const StaffRoleSchema = z.enum(['sub15', 'sub17', 'sub20', 'master']);
export const NutritionPlanSchema = z.enum(['Normocalorico', 'Hipercalorico', 'Hipocalorico']);
export const TrainingSessionTypeSchema = z.enum(['MD+1', 'MD+2', 'MD-5', 'MD-4', 'MD-3', 'MD-2', 'MD-1', 'MD']);
export const SessionParticipationSchema = z.enum(['Completa', 'Parcial', 'No participa', 'Gimnasio', 'Readaptación']);
export const CompetitionVenueSchema = z.enum(['Local', 'Visitante']);
export const MatchResultTypeSchema = z.enum(['Victoria', 'Empate', 'Derrota']);
export const CompetitionPlayerRoleSchema = z.enum(['Titular', 'Suplente']);
export const CompetitionMedicalStatusSchema = z.enum(['Sin lesión', 'Lesionado']);
export const DominantFootSchema = z.enum(['Derecha', 'Izquierda', 'Ambidiestro']);
export const CompetitiveRoleSchema = z.enum(['Titular habitual', 'Rotación', 'Suplente', 'Proyección', 'Retorno a competencia']);
export const LoadToleranceSchema = z.enum(['Alta', 'Media', 'Baja', 'En construcción']);

// Player Schema
export const PlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  age: z.number().min(14).max(40),
  birthDate: z.string().optional(),
  position: PositionSchema,
  category: ClubCategorySchema.optional(),
  categoryHistory: z.array(ClubCategorySchema).optional(),
  jerseyNumber: z.number().min(1).max(99).optional(),
  documentId: z.string().optional(),
  nationality: z.string().optional(),
  birthplace: z.string().optional(),
  phone: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  height: z.number().min(100).max(250),
  weight: z.number().min(30).max(150),
  dominantFoot: DominantFootSchema.optional(),
  secondaryPosition: PositionSchema.optional(),
  competitiveRole: CompetitiveRoleSchema.optional(),
  dateJoined: z.string().optional(),
  status: PlayerStatusSchema,
  loadTolerance: LoadToleranceSchema.optional(),
  maxVelocityReference: z.number().optional(),
  baselineWellness: z.number().min(1).max(5).optional(),
  baselineRpe: z.number().min(1).max(10).optional(),
  targetWeeklyLoad: z.number().optional(),
  targetWeeklyHsr: z.number().optional(),
  targetWeeklySprintDistance: z.number().optional(),
  targetMinutes7d: z.number().optional(),
  maxTrainingPercent: z.number().optional(),
  maxCompetitionMinutes: z.number().optional(),
  returnToPlayPhase: z.string().optional(),
  restrictions: z.array(z.string()).optional(),
  medicalNotes: z.string().optional(),
  allergies: z.string().optional(),
  chronicConditions: z.string().optional(),
  riskAreas: z.string().optional(),
  photo: z.string(),
  photoUrl: z.string().optional(),
  injuryArea: z.string().optional(),
  injuryType: z.string().optional(),
  injurySeverity: z.string().optional(),
  returnDate: z.string().optional(),
  injuryHistory: z.array(z.object({
    id: z.string(),
    date: z.string(),
    injuryType: z.string(),
    area: z.string().optional(),
    severity: z.string().optional(),
    status: z.enum(['activa', 'cerrada']),
    medicalNote: z.string().optional(),
    expectedReturnDate: z.string().optional(),
  })).optional(),
});

// Wellness Record Schema
export const DailyWellnessRecordSchema = z.object({
  id: z.string().min(1),
  playerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sleep: z.number().min(1).max(5),
  fatigue: z.number().min(1).max(5),
  stress: z.number().min(1).max(5),
  musclePain: z.number().min(1).max(5),
  mood: z.number().min(1).max(5),
  category: ClubCategorySchema.optional(),
});

// Internal Load Record Schema
export const DailyInternalLoadRecordSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().optional(),
  playerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rpe: z.number().min(0).max(10),
  duration: z.number().min(0),
  microcycleId: z.string().optional(),
  sessionNumber: z.number().optional(),
  category: ClubCategorySchema.optional(),
  baseCategory: ClubCategorySchema.optional(),
  actingCategory: ClubCategorySchema.optional(),
  movementType: z.enum(['base', 'subio_a_entrenar', 'bajo_a_entrenar', 'subio_a_competir', 'bajo_a_competir']).optional(),
  movementNote: z.string().optional(),
  movementModule: z.enum(['sesion', 'competencia']).optional(),
  loggedBy: z.string().optional(),
});

// External Load Record Schema
export const DailyExternalLoadRecordSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().optional(),
  playerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  min: z.number().min(0),
  acc: z.number().min(0),
  dcc: z.number().min(0),
  sprints: z.number().min(0),
  rhie: z.number().min(0),
  rpe: z.number().min(0).max(10).optional(),
  totalDistance: z.number().min(0).optional(),
  maxVelocity: z.number().min(0).optional(),
  playerLoad: z.number().min(0).optional(),
  participation: SessionParticipationSchema.optional(),
  microcycleId: z.string().optional(),
  sessionNumber: z.number().optional(),
  sessionType: TrainingSessionTypeSchema.optional(),
  category: ClubCategorySchema.optional(),
  baseCategory: ClubCategorySchema.optional(),
  actingCategory: ClubCategorySchema.optional(),
  movementType: z.enum(['base', 'subio_a_entrenar', 'bajo_a_entrenar', 'subio_a_competir', 'bajo_a_competir']).optional(),
  movementNote: z.string().optional(),
  movementModule: z.enum(['sesion', 'competencia']).optional(),
  loggedBy: z.string().optional(),
  highSpeedDistance: z.number().min(0).optional(),
  sprintDistance: z.number().min(0).optional(),
  hsr: z.number().min(0).optional(),
  distancePerMin: z.number().min(0).optional(),
  playerLoadPerMin: z.number().min(0).optional(),
  ima: z.number().min(0).optional(),
});

// Competition Record Schema
export const CompetitionRecordSchema = z.object({
  id: z.string().min(1),
  matchId: z.string().optional(),
  playerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  opponent: z.string().min(1),
  competitionName: z.string().optional(),
  minutesPlayed: z.number().min(0),
  goals: z.number().min(0),
  assists: z.number().min(0),
  yellowCards: z.number().min(0),
  redCards: z.number().min(0),
  acc: z.number().min(0).optional(),
  dcc: z.number().min(0).optional(),
  sprints: z.number().min(0).optional(),
  rhie: z.number().min(0).optional(),
  ima: z.number().min(0).optional(),
  totalDistance: z.number().min(0).optional(),
  highSpeedDistance: z.number().min(0).optional(),
  hsr: z.number().min(0).optional(),
  sprintDistance: z.number().min(0).optional(),
  maxVelocity: z.number().min(0).optional(),
  playerLoad: z.number().min(0).optional(),
  goalsConceded: z.number().min(0).optional(),
  goalsPrevented: z.number().min(0).optional(),
  penaltiesSaved: z.number().min(0).optional(),
  crossesDefended: z.number().min(0).optional(),
  footworkActions: z.number().min(0).optional(),
  shotsOnTarget: z.number().min(0).optional(),
  category: ClubCategorySchema.optional(),
  baseCategory: ClubCategorySchema.optional(),
  actingCategory: ClubCategorySchema.optional(),
  movementType: z.enum(['base', 'subio_a_entrenar', 'bajo_a_entrenar', 'subio_a_competir', 'bajo_a_competir']).optional(),
  movementNote: z.string().optional(),
  movementModule: z.enum(['sesion', 'competencia']).optional(),
  loggedBy: z.string().optional(),
  startingRole: CompetitionPlayerRoleSchema.optional(),
  postCompetitionStatus: z.string().optional(),
  medicalStatus: CompetitionMedicalStatusSchema.optional(),
  injuryKind: z.enum(['Muscular', 'Articular', 'Tendinosa', 'Ósea']).optional(),
  medicalObservation: z.string().optional(),
});

// Technical Profile Schema
export const TechnicalProfileSchema = z.object({
  id: z.string().min(1),
  playerId: z.string().min(1),
  mainPosition: z.string().min(1),
  secondaryPositions: z.array(z.string()),
  dominantFoot: z.enum(['derecha', 'izquierda', 'ambas']),
  gameProfile: z.string(),
  tacticalRole: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  projection: z.enum(['baja', 'media', 'alta', 'muy_alta']),
  modelFit: z.enum(['bajo', 'medio', 'alto']),
  generalNotes: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
});

// Technical Report Schema
export const TechnicalReportSchema = z.object({
  id: z.string().min(1),
  playerId: z.string().min(1),
  authorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  context: z.enum(['partido', 'entrenamiento', 'torneo', 'video', 'prueba', 'otro']),
  technicalScore: z.number().min(1).max(10),
  tacticalScore: z.number().min(1).max(10),
  physicalScore: z.number().min(1).max(10),
  psychologicalScore: z.number().min(1).max(10),
  overallScore: z.number().min(1).max(10),
  recommendation: z.enum(['seguir_observando', 'priorizar', 'convocable', 'promover', 'descartar', 'revisar_mas_adelante']),
  strengths: z.array(z.string()),
  areasToImprove: z.array(z.string()),
  notes: z.string(),
  matchDetails: z.string().optional(),
  opponent: z.string().optional(),
  competition: z.string().optional(),
});

// Scout Follow Up Schema
export const ScoutFollowUpSchema = z.object({
  id: z.string().min(1),
  playerId: z.string().min(1),
  scoutId: z.string().min(1),
  status: z.enum(['sin_seguimiento', 'nuevo', 'observado', 'en_seguimiento', 'interesante', 'prioridad', 'convocable', 'promovible', 'descartado']),
  reason: z.enum(['proyeccion', 'necesidad_posicion', 'rendimiento_reciente', 'recomendacion_scout', 'seguimiento_seleccion', 'promocion_categoria', 'otro']).optional(),
  discardReason: z.enum(['no_encaja_modelo', 'bajo_nivel_competitivo', 'baja_proyeccion', 'problema_disciplinario', 'posicion_cubierta', 'falta_datos', 'otro']).optional(),
  notes: z.string().optional(),
  nextAction: z.string().optional(),
  nextActionDate: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Global Filters Schema
export const GlobalFiltersSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.union([ClubCategorySchema, z.literal('all')]),
  microcycleId: z.string().optional(),
});

// Type exports
export type Player = z.infer<typeof PlayerSchema>;
export type DailyWellnessRecord = z.infer<typeof DailyWellnessRecordSchema>;
export type DailyInternalLoadRecord = z.infer<typeof DailyInternalLoadRecordSchema>;
export type DailyExternalLoadRecord = z.infer<typeof DailyExternalLoadRecordSchema>;
export type CompetitionRecord = z.infer<typeof CompetitionRecordSchema>;
export type TechnicalProfile = z.infer<typeof TechnicalProfileSchema>;
export type TechnicalReport = z.infer<typeof TechnicalReportSchema>;
export type ScoutFollowUp = z.infer<typeof ScoutFollowUpSchema>;
export type GlobalFilters = z.infer<typeof GlobalFiltersSchema>;
