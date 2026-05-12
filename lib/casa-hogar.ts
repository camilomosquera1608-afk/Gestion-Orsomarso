import { hasSupabaseConfig, supabase, tableSchemaSyncEnabled } from '@/lib/supabase';
import type { ClubCategory, DailyWellnessRecord, Player } from '@/lib/types';

export type HousePlayerStatus = 'Activo' | 'Traslado' | 'Salida temporal' | 'Egresado';
export type HouseTrafficLight = 'Verde' | 'Amarillo' | 'Rojo' | 'Gris';
export type HousePermissionStatus = 'Pendiente' | 'Autorizado' | 'Rechazado' | 'Cumplido' | 'Vencido';
export type HouseNewsSeverity = 'Informativa' | 'Seguimiento' | 'Alerta' | 'Crítica';
export type HouseNewsStatus = 'Abierta' | 'En seguimiento' | 'Cerrada';
export type AcademicStatus = 'Estable' | 'Seguimiento' | 'Alerta';

export interface HousePlayerRecord {
  id: string;
  playerId: string;
  category?: ClubCategory;
  belongsHouse: boolean;
  room?: string;
  bed?: string;
  status: HousePlayerStatus;
  notes?: string;
  updatedAt?: string;
}

export interface HouseDailyMealRecord {
  id: string;
  playerId: string;
  date: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  notes?: string;
  responsible?: string;
}

export interface HouseMonthlyEvaluationRecord {
  id: string;
  playerId: string;
  month: number;
  year: number;
  convivenciaScore: number;
  responsabilidadScore: number;
  alimentacionHabitosScore: number;
  compromisoDeportivoScore: number;
  formacionIntegralScore: number;
  bienestarEmocionalScore: number;
  generalScore: number;
  trafficLight: HouseTrafficLight;
  observations?: string;
  commitments?: string;
  recommendations?: string;
  responsible?: string;
}

export interface HouseExitPermissionRecord {
  id: string;
  playerId: string;
  date: string;
  departureTime?: string;
  returnTime?: string;
  reason?: string;
  authorizedBy?: string;
  status: HousePermissionStatus;
  notes?: string;
}

export interface HouseAcademicTrackingRecord {
  id: string;
  playerId: string;
  month: number;
  year: number;
  academicAttendance?: number;
  academicPerformance?: number;
  pendingTasks?: string;
  academicAlerts?: string;
  tutorNotes?: string;
  familyContact?: string;
  status: AcademicStatus;
}

export interface HouseDailyNewsRecord {
  id: string;
  playerId: string;
  date: string;
  type: string;
  description: string;
  severity: HouseNewsSeverity;
  responsible?: string;
  followUpRequired: boolean;
  status: HouseNewsStatus;
}

export interface HouseRoomRecord {
  id: string;
  roomName: string;
  capacity: number;
  responsible?: string;
  status?: string;
  notes?: string;
}

export interface HouseHomeData {
  players: HousePlayerRecord[];
  meals: HouseDailyMealRecord[];
  evaluations: HouseMonthlyEvaluationRecord[];
  permissions: HouseExitPermissionRecord[];
  academic: HouseAcademicTrackingRecord[];
  news: HouseDailyNewsRecord[];
  rooms: HouseRoomRecord[];
}

export interface HouseAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  playerId?: string;
  room?: string;
}

const LOCAL_KEY = 'orsomarso-house-home-v1';

export const emptyHouseHomeData = (): HouseHomeData => ({
  players: [],
  meals: [],
  evaluations: [],
  permissions: [],
  academic: [],
  news: [],
  rooms: [],
});

export const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const getCurrentMonth = () => new Date().getMonth() + 1;
export const getCurrentYear = () => new Date().getFullYear();

export const getTodayInputDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const normalizeText = (value?: string) => (value ?? '').trim();

export const scoreTrafficLight = (score: number): HouseTrafficLight => {
  if (!score) return 'Gris';
  if (score >= 4) return 'Verde';
  if (score >= 3) return 'Amarillo';
  return 'Rojo';
};

export const avg = (values: number[]) => {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

export const computeEvaluationScore = (record: Pick<HouseMonthlyEvaluationRecord, 'convivenciaScore' | 'responsabilidadScore' | 'alimentacionHabitosScore' | 'compromisoDeportivoScore' | 'formacionIntegralScore' | 'bienestarEmocionalScore'>) => {
  const generalScore = Number(avg([
    record.convivenciaScore,
    record.responsabilidadScore,
    record.alimentacionHabitosScore,
    record.compromisoDeportivoScore,
    record.formacionIntegralScore,
    record.bienestarEmocionalScore,
  ]).toFixed(2));
  return { generalScore, trafficLight: scoreTrafficLight(generalScore) };
};

export const mealCompletion = (record?: HouseDailyMealRecord) => {
  if (!record) return 0;
  return [record.breakfast, record.lunch, record.dinner].filter(Boolean).length;
};

export const wellnessAverage = (record?: DailyWellnessRecord) => {
  if (!record) return 0;
  const readiness = [record.sleep, record.fatigue, record.stress, record.musclePain, record.mood];
  return Number(avg(readiness).toFixed(1));
};

export const buildHouseDashboard = (data: HouseHomeData, roster: Player[], date: string, month: number, year: number) => {
  const housePlayers = data.players.filter((item) => item.belongsHouse && item.status !== 'Egresado');
  const ids = new Set(housePlayers.map((item) => item.playerId));
  const todayMeals = data.meals.filter((item) => item.date === date && ids.has(item.playerId));
  const monthlyEvaluations = data.evaluations.filter((item) => item.month === month && item.year === year && ids.has(item.playerId));
  const roomsOccupied = new Set(housePlayers.map((item) => item.room).filter(Boolean)).size;
  const incompleteMeals = housePlayers.filter((house) => mealCompletion(todayMeals.find((meal) => meal.playerId === house.playerId)) < 3).length;
  const avgScore = Number(avg(monthlyEvaluations.map((item) => item.generalScore)).toFixed(2));
  const rosterCount = roster.filter((player) => ids.has(player.id)).length;
  return {
    totalHouse: housePlayers.length,
    rosterCount,
    breakfast: todayMeals.filter((item) => item.breakfast).length,
    lunch: todayMeals.filter((item) => item.lunch).length,
    dinner: todayMeals.filter((item) => item.dinner).length,
    incompleteMeals,
    roomsOccupied,
    evaluations: monthlyEvaluations.length,
    avgScore,
  };
};

export const buildHouseAlerts = (data: HouseHomeData, roster: Player[], wellness: DailyWellnessRecord[], date: string, month: number, year: number): HouseAlert[] => {
  const alerts: HouseAlert[] = [];
  const housePlayers = data.players.filter((item) => item.belongsHouse && item.status !== 'Egresado');
  const rosterById = new Map(roster.map((player) => [player.id, player]));
  const roomsByName = new Map(data.rooms.map((room) => [room.roomName, room]));
  const todayMeals = data.meals.filter((item) => item.date === date);
  const evaluations = data.evaluations.filter((item) => item.month === month && item.year === year);

  housePlayers.forEach((house) => {
    const player = rosterById.get(house.playerId);
    const name = player?.name ?? 'Jugador';
    const meal = todayMeals.find((item) => item.playerId === house.playerId);
    const eaten = mealCompletion(meal);
    const evaluation = evaluations.find((item) => item.playerId === house.playerId);
    const recentWellness = wellness.filter((item) => item.playerId === house.playerId).sort((a, b) => b.date.localeCompare(a.date))[0];
    const wellnessScore = wellnessAverage(recentWellness);

    if (!house.room) alerts.push({ id: `room-${house.playerId}`, level: 'warning', title: 'Jugador sin habitación', detail: `${name} no tiene información institucional complementaria registrada.`, playerId: house.playerId });
    if (eaten <= 1) alerts.push({ id: `meal-critical-${house.playerId}`, level: 'critical', title: 'Alimentación incompleta', detail: `${name} tiene dos o más comidas sin registrar en la fecha seleccionada.`, playerId: house.playerId });
    else if (eaten < 3) alerts.push({ id: `meal-warning-${house.playerId}`, level: 'warning', title: 'Comida pendiente', detail: `${name} tiene alimentación incompleta en el día.`, playerId: house.playerId });
    if (!evaluation) alerts.push({ id: `eval-missing-${house.playerId}`, level: 'warning', title: 'Evaluación mensual pendiente', detail: `${name} no tiene evaluación del mes seleccionado.`, playerId: house.playerId });
    else if (evaluation.generalScore < 3) alerts.push({ id: `eval-red-${house.playerId}`, level: 'critical', title: 'Evaluación mensual baja', detail: `${name} registra promedio ${evaluation.generalScore.toFixed(1)}. Requiere intervención.`, playerId: house.playerId });
    if (wellnessScore && wellnessScore < 5.5) alerts.push({ id: `wellness-${house.playerId}`, level: 'warning', title: 'Wellness bajo', detail: `${name} tiene readiness ${wellnessScore}. Revisar sueño, fatiga, estrés o dolor.`, playerId: house.playerId });
  });

  data.rooms.forEach((room) => {
    const assigned = housePlayers.filter((player) => player.room === room.roomName).length;
    if (room.capacity > 0 && assigned > room.capacity) {
      alerts.push({ id: `room-over-${room.id}`, level: 'critical', title: 'Habitación sobreocupada', detail: `${room.roomName} tiene ${assigned}/${room.capacity} jugadores asignados.`, room: room.roomName });
    }
  });

  data.permissions.filter((item) => item.date <= date && item.status !== 'Cumplido' && item.status !== 'Rechazado').forEach((item) => {
    const player = rosterById.get(item.playerId);
    if (item.status === 'Vencido') alerts.push({ id: `permission-${item.id}`, level: 'critical', title: 'Permiso vencido', detail: `${player?.name ?? 'Jugador'} tiene permiso vencido o regreso pendiente.`, playerId: item.playerId });
  });

  data.news.filter((item) => item.status !== 'Cerrada' && item.severity !== 'Informativa').forEach((item) => {
    const player = rosterById.get(item.playerId);
    alerts.push({ id: `news-${item.id}`, level: item.severity === 'Crítica' ? 'critical' : 'warning', title: `Novedad ${item.severity.toLowerCase()}`, detail: `${player?.name ?? 'Jugador'}: ${item.description}`, playerId: item.playerId });
  });

  return alerts.slice(0, 18);
};

export const buildPlayerHouseLight = (data: HouseHomeData, playerId: string, date: string, month: number, year: number, latestWellness?: DailyWellnessRecord) => {
  const house = data.players.find((item) => item.playerId === playerId && item.belongsHouse);
  if (!house) return { light: 'Gris' as HouseTrafficLight, label: 'No pertenece', score: 0 };
  const meal = data.meals.find((item) => item.playerId === playerId && item.date === date);
  const evaluation = data.evaluations.find((item) => item.playerId === playerId && item.month === month && item.year === year);
  const newsPenalty = data.news.some((item) => item.playerId === playerId && item.status !== 'Cerrada' && ['Alerta', 'Crítica'].includes(item.severity)) ? 1 : 0;
  const wellnessScore = wellnessAverage(latestWellness);
  const mealScore = mealCompletion(meal) / 3 * 5;
  const evaluationScore = evaluation?.generalScore ?? 3;
  const wellnessFive = wellnessScore ? wellnessScore / 2 : 3;
  const score = Math.max(0, Number((avg([mealScore, evaluationScore, wellnessFive]) - newsPenalty).toFixed(2)));
  return { light: scoreTrafficLight(score), label: score >= 4 ? 'Estable' : score >= 3 ? 'Seguimiento' : 'Intervención', score };
};

export const readLocalHouseHome = (): HouseHomeData => {
  if (typeof window === 'undefined') return emptyHouseHomeData();
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return emptyHouseHomeData();
    const parsed = JSON.parse(raw) as Partial<HouseHomeData>;
    return {
      players: parsed.players ?? [],
      meals: parsed.meals ?? [],
      evaluations: parsed.evaluations ?? [],
      permissions: parsed.permissions ?? [],
      academic: parsed.academic ?? [],
      news: parsed.news ?? [],
      rooms: parsed.rooms ?? [],
    };
  } catch {
    return emptyHouseHomeData();
  }
};

export const saveLocalHouseHome = (payload: HouseHomeData) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
};

const toHousePlayerRow = (record: HousePlayerRecord) => ({
  id: record.id,
  player_id: record.playerId,
  category: record.category ?? null,
  belongs_house: record.belongsHouse,
  room: record.room || null,
  bed: record.bed || null,
  status: record.status,
  notes: record.notes || null,
  updated_at: new Date().toISOString(),
});

const mapHousePlayer = (row: any): HousePlayerRecord => ({
  id: row.id,
  playerId: row.player_id,
  category: row.category ?? undefined,
  belongsHouse: Boolean(row.belongs_house),
  room: row.room ?? undefined,
  bed: row.bed ?? undefined,
  status: (row.status ?? 'Activo') as HousePlayerStatus,
  notes: row.notes ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

const toMealRow = (record: HouseDailyMealRecord) => ({ id: record.id, player_id: record.playerId, date: record.date, breakfast: record.breakfast, lunch: record.lunch, dinner: record.dinner, notes: record.notes || null, responsible: record.responsible || null });
const mapMeal = (row: any): HouseDailyMealRecord => ({ id: row.id, playerId: row.player_id, date: row.date, breakfast: Boolean(row.breakfast), lunch: Boolean(row.lunch), dinner: Boolean(row.dinner), notes: row.notes ?? undefined, responsible: row.responsible ?? undefined });

const toEvaluationRow = (record: HouseMonthlyEvaluationRecord) => ({
  id: record.id,
  player_id: record.playerId,
  month: record.month,
  year: record.year,
  convivencia_score: record.convivenciaScore,
  responsabilidad_score: record.responsabilidadScore,
  alimentacion_habitos_score: record.alimentacionHabitosScore,
  compromiso_deportivo_score: record.compromisoDeportivoScore,
  formacion_integral_score: record.formacionIntegralScore,
  bienestar_emocional_score: record.bienestarEmocionalScore,
  general_score: record.generalScore,
  traffic_light: record.trafficLight,
  observations: record.observations || null,
  commitments: record.commitments || null,
  recommendations: record.recommendations || null,
  responsible: record.responsible || null,
});
const mapEvaluation = (row: any): HouseMonthlyEvaluationRecord => ({
  id: row.id,
  playerId: row.player_id,
  month: Number(row.month),
  year: Number(row.year),
  convivenciaScore: Number(row.convivencia_score ?? 0),
  responsabilidadScore: Number(row.responsabilidad_score ?? 0),
  alimentacionHabitosScore: Number(row.alimentacion_habitos_score ?? 0),
  compromisoDeportivoScore: Number(row.compromiso_deportivo_score ?? 0),
  formacionIntegralScore: Number(row.formacion_integral_score ?? 0),
  bienestarEmocionalScore: Number(row.bienestar_emocional_score ?? 0),
  generalScore: Number(row.general_score ?? 0),
  trafficLight: (row.traffic_light ?? 'Gris') as HouseTrafficLight,
  observations: row.observations ?? undefined,
  commitments: row.commitments ?? undefined,
  recommendations: row.recommendations ?? undefined,
  responsible: row.responsible ?? undefined,
});

const toPermissionRow = (record: HouseExitPermissionRecord) => ({ id: record.id, player_id: record.playerId, date: record.date, departure_time: record.departureTime || null, return_time: record.returnTime || null, reason: record.reason || null, authorized_by: record.authorizedBy || null, status: record.status, notes: record.notes || null });
const mapPermission = (row: any): HouseExitPermissionRecord => ({ id: row.id, playerId: row.player_id, date: row.date, departureTime: row.departure_time ?? undefined, returnTime: row.return_time ?? undefined, reason: row.reason ?? undefined, authorizedBy: row.authorized_by ?? undefined, status: (row.status ?? 'Pendiente') as HousePermissionStatus, notes: row.notes ?? undefined });

const toAcademicRow = (record: HouseAcademicTrackingRecord) => ({ id: record.id, player_id: record.playerId, month: record.month, year: record.year, academic_attendance: record.academicAttendance ?? null, academic_performance: record.academicPerformance ?? null, pending_tasks: record.pendingTasks || null, academic_alerts: record.academicAlerts || null, tutor_notes: record.tutorNotes || null, family_contact: record.familyContact || null, status: record.status });
const mapAcademic = (row: any): HouseAcademicTrackingRecord => ({ id: row.id, playerId: row.player_id, month: Number(row.month), year: Number(row.year), academicAttendance: row.academic_attendance ?? undefined, academicPerformance: row.academic_performance ?? undefined, pendingTasks: row.pending_tasks ?? undefined, academicAlerts: row.academic_alerts ?? undefined, tutorNotes: row.tutor_notes ?? undefined, familyContact: row.family_contact ?? undefined, status: (row.status ?? 'Estable') as AcademicStatus });

const toNewsRow = (record: HouseDailyNewsRecord) => ({ id: record.id, player_id: record.playerId, date: record.date, type: record.type, description: record.description, severity: record.severity, responsible: record.responsible || null, follow_up_required: record.followUpRequired, status: record.status });
const mapNews = (row: any): HouseDailyNewsRecord => ({ id: row.id, playerId: row.player_id, date: row.date, type: row.type, description: row.description, severity: (row.severity ?? 'Informativa') as HouseNewsSeverity, responsible: row.responsible ?? undefined, followUpRequired: Boolean(row.follow_up_required), status: (row.status ?? 'Abierta') as HouseNewsStatus });

const toRoomRow = (record: HouseRoomRecord) => ({ id: record.id, room_name: record.roomName, capacity: record.capacity, responsible: record.responsible || null, status: record.status || null, notes: record.notes || null });
const mapRoom = (row: any): HouseRoomRecord => ({ id: row.id, roomName: row.room_name, capacity: Number(row.capacity ?? 0), responsible: row.responsible ?? undefined, status: row.status ?? undefined, notes: row.notes ?? undefined });

export async function fetchHouseHomeData(): Promise<HouseHomeData> {
  if (!supabase || !hasSupabaseConfig || !tableSchemaSyncEnabled) return readLocalHouseHome();
  try {
    const [players, meals, evaluations, permissions, academic, news, rooms] = await Promise.all([
      supabase.from('house_players').select('*'),
      supabase.from('house_daily_meals').select('*'),
      supabase.from('house_monthly_evaluations').select('*'),
      supabase.from('house_exit_permissions').select('*'),
      supabase.from('house_academic_tracking').select('*'),
      supabase.from('house_daily_news').select('*'),
      supabase.from('house_rooms').select('*'),
    ]);
    const errors = [players.error, meals.error, evaluations.error, permissions.error, academic.error, news.error, rooms.error].filter(Boolean);
    if (errors.length) throw new Error(errors.map((error) => error?.message).join(' | '));
    const payload = {
      players: (players.data ?? []).map(mapHousePlayer),
      meals: (meals.data ?? []).map(mapMeal),
      evaluations: (evaluations.data ?? []).map(mapEvaluation),
      permissions: (permissions.data ?? []).map(mapPermission),
      academic: (academic.data ?? []).map(mapAcademic),
      news: (news.data ?? []).map(mapNews),
      rooms: (rooms.data ?? []).map(mapRoom),
    };
    saveLocalHouseHome(payload);
    return payload;
  } catch (error) {
    console.warn('[Alimentación] Usando respaldo local:', error);
    return readLocalHouseHome();
  }
}

export async function saveHouseHomeData(payload: HouseHomeData) {
  saveLocalHouseHome(payload);
  if (!supabase || !hasSupabaseConfig || !tableSchemaSyncEnabled) return { ok: true as const, mode: 'local' as const };
  const result = await Promise.all([
    supabase.from('house_players').upsert(payload.players.map(toHousePlayerRow), { onConflict: 'id' }),
    supabase.from('house_daily_meals').upsert(payload.meals.map(toMealRow), { onConflict: 'id' }),
    supabase.from('house_monthly_evaluations').upsert(payload.evaluations.map(toEvaluationRow), { onConflict: 'id' }),
    supabase.from('house_exit_permissions').upsert(payload.permissions.map(toPermissionRow), { onConflict: 'id' }),
    supabase.from('house_academic_tracking').upsert(payload.academic.map(toAcademicRow), { onConflict: 'id' }),
    supabase.from('house_daily_news').upsert(payload.news.map(toNewsRow), { onConflict: 'id' }),
    supabase.from('house_rooms').upsert(payload.rooms.map(toRoomRow), { onConflict: 'id' }),
  ]);
  const errors = result.map((item) => item.error).filter(Boolean);
  if (errors.length) return { ok: false as const, reason: errors.map((error) => error?.message).join(' | ') };
  return { ok: true as const, mode: 'supabase' as const };
}
