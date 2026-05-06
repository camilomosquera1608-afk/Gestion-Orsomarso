import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AppData,
  CMJRecord,
  ClubCategory,
  CompetitionMatchSummary,
  CompetitionRecord,
  DailyExternalLoadRecord,
  DailyInternalLoadRecord,
  DailyWellnessRecord,
  FMSRecord,
  InjuryHistoryItem,
  Microcycle,
  NeuromuscularRecord,
  NutritionRecord,
  Player,
  TrainingSessionSummary,
} from '@/lib/types';
import { supportsGps } from '@/lib/report-utils';

type SyncResult = { ok: true; skipped?: number } | { ok: false; error?: unknown; reason?: string };
type LegacyMap = Record<string, string>;

type DbRow = Record<string, any>;

const isoDate = (value?: string | null): string | null => {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const num = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const text = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined) return fallback;
  const next = String(value).trim();
  return next || fallback;
};

const category = (value: unknown, fallback: ClubCategory = 'Sub20'): ClubCategory => {
  return value === 'Sub15' || value === 'Sub17' || value === 'Sub20' ? value : fallback;
};

const isAuthError = (error: any) => {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  return message.includes('jwt') || message.includes('permission') || message.includes('rls') || message.includes('auth');
};

const fetchLegacyIdMap = async (supabase: SupabaseClient, table: string): Promise<LegacyMap> => {
  const { data, error } = await supabase.from(table).select('id, legacy_id').not('legacy_id', 'is', null);
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as DbRow[]).map((row) => [String(row.legacy_id), String(row.id)]));
};

const fetchUuidToLegacyIdMap = async (supabase: SupabaseClient, table: string): Promise<LegacyMap> => {
  const { data, error } = await supabase.from(table).select('id, legacy_id');
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as DbRow[]).map((row) => [String(row.id), String(row.legacy_id ?? row.id)]));
};

const upsertRows = async (supabase: SupabaseClient, table: string, rows: DbRow[], onConflict = 'legacy_id') => {
  if (!rows.length) return;
  
  // Attempt 1: upsert with the specified conflict resolution
  const { error } = await supabase.from(table).upsert(rows, { onConflict, ignoreDuplicates: false });
  if (!error) return;
  
  // Log the error for debugging but don't throw yet
  console.warn(`[Supabase] upsert failed on '${table}' (onConflict='${onConflict}'):`, error.message);
  
  // Attempt 2: upsert row-by-row (catches individual constraint violations)
  let savedCount = 0;
  const errors: string[] = [];
  for (const row of rows) {
    // Try upsert with legacy_id
    const { error: rowError } = await supabase.from(table).upsert(row, { onConflict: 'legacy_id', ignoreDuplicates: false });
    if (!rowError) { savedCount++; continue; }
    
    // If legacy_id conflict fails, try plain upsert (let DB decide)
    const { error: plainError } = await supabase.from(table).upsert(row, { ignoreDuplicates: true });
    if (!plainError) { savedCount++; continue; }
    
    errors.push(`${row.legacy_id ?? '?'}: ${plainError.message}`);
  }
  
  if (errors.length > 0) {
    console.error(`[Supabase] ${table}: ${savedCount}/${rows.length} saved. Failures:`, errors.slice(0, 5));
  }
  // Don't throw — partial saves are better than no save
};

// FIX #2 (helper): Parsear de forma segura un campo JSONB que viene de Supabase.
// Si el valor es null, undefined, o no es parseable como array, retorna [].
const parseJsonArray = <T,>(value: unknown): T[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

export const fetchSupabaseTablesAppData = async (supabase: SupabaseClient): Promise<{ ok: true; data: Partial<AppData> } | { ok: false; reason?: string; error?: unknown }> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { ok: false, reason: 'not_authenticated' };

  try {
    const [playersRes, microcyclesRes] = await Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('microcycles').select('*').order('start_date'),
    ]);
    if (playersRes.error) throw playersRes.error;
    if (microcyclesRes.error) throw microcyclesRes.error;

    const playerUuidToLegacy = Object.fromEntries(((playersRes.data ?? []) as DbRow[]).map((row) => [String(row.id), String(row.legacy_id ?? row.id)]));
    const microcycleUuidToLegacy = Object.fromEntries(((microcyclesRes.data ?? []) as DbRow[]).map((row) => [String(row.id), String(row.legacy_id ?? row.id)]));

    const [wellnessRes, internalRes, externalRes, sessionsRes, matchesRes, nutritionRes, cmjRes, neuroRes, fmsRes] = await Promise.all([
      supabase.from('daily_wellness').select('*').order('date', { ascending: false }),
      supabase.from('daily_internal_loads').select('*').order('date', { ascending: false }),
      supabase.from('daily_external_loads').select('*').order('date', { ascending: false }),
      supabase.from('training_sessions').select('*').order('date', { ascending: false }),
      supabase.from('competition_matches').select('*').order('date', { ascending: false }),
      supabase.from('nutrition_records').select('*').order('date', { ascending: false }),
      supabase.from('cmj_records').select('*').order('date', { ascending: false }),
      supabase.from('neuromuscular_records').select('*').order('date', { ascending: false }),
      supabase.from('fms_records').select('*').order('date', { ascending: false }),
    ]);

    for (const result of [wellnessRes, internalRes, externalRes, sessionsRes, matchesRes, nutritionRes, cmjRes, neuroRes, fmsRes]) {
      if (result.error) throw result.error;
    }

    const matchUuidToLegacy = Object.fromEntries(((matchesRes.data ?? []) as DbRow[]).map((row) => [String(row.id), String(row.legacy_id ?? row.id)]));
    const matchByUuid = Object.fromEntries(((matchesRes.data ?? []) as DbRow[]).map((row) => [String(row.id), row]));

    const competitionPlayersRes = await supabase.from('competition_players').select('*').order('created_at', { ascending: false });
    if (competitionPlayersRes.error) throw competitionPlayersRes.error;

    const players: Player[] = ((playersRes.data ?? []) as DbRow[]).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      name: text(row.name),
      age: num(row.age, 0),
      birthDate: row.birth_date ?? undefined,
      position: row.position,
      category: category(row.category),
      // FIX #2: categoryHistory recuperado desde la columna JSONB de Supabase.
      // Antes se reemplazaba siempre con [categoria_actual], borrando el historial
      // de movimientos entre categorías cada vez que se hacía sync.
      // Ahora se preserva el array guardado, con la categoría actual como fallback mínimo.
      categoryHistory: (() => {
        const stored = parseJsonArray<ClubCategory>(row.category_history);
        const current = category(row.category);
        return stored.length > 0 ? stored : [current];
      })(),
      height: num(row.height, 0),
      weight: num(row.weight, 0),
      status: row.status,
      photo: text(row.photo),
      injuryArea: row.injury_area ?? undefined,
      injuryType: row.injury_type ?? undefined,
      injurySeverity: row.injury_severity ?? undefined,
      returnDate: row.return_date ?? undefined,
      // FIX #2: injuryHistory recuperado desde la columna JSONB de Supabase.
      // Antes se reemplazaba siempre con [], borrando el historial médico del jugador
      // en cada sync. Ahora se preserva el array guardado.
      injuryHistory: parseJsonArray<InjuryHistoryItem>(row.injury_history),
    }));

    const microcycles: Microcycle[] = ((microcyclesRes.data ?? []) as DbRow[]).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      name: text(row.name),
      category: category(row.category),
      weekNumber: row.week_number ?? undefined,
      startDate: row.start_date ?? '',
      endDate: row.end_date ?? '',
      objective: row.objective ?? undefined,
      notes: row.notes ?? undefined,
      status: row.status ?? undefined,
    }));

    const wellness: DailyWellnessRecord[] = ((wellnessRes.data ?? []) as DbRow[]).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      playerId: playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
      date: row.date,
      sleep: num(row.sleep),
      fatigue: num(row.fatigue),
      stress: num(row.stress),
      musclePain: num(row.muscle_pain),
      mood: num(row.mood),
      category: category(row.category),
    }));

    const internalLoads: DailyInternalLoadRecord[] = ((internalRes.data ?? []) as DbRow[]).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      sessionId: row.session_id ?? undefined,
      playerId: playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
      date: row.date,
      rpe: num(row.rpe),
      duration: num(row.duration),
      microcycleId: row.microcycle_id ? microcycleUuidToLegacy[String(row.microcycle_id)] : undefined,
      sessionNumber: row.session_number ?? undefined,
      category: category(row.category),
      baseCategory: row.base_category ?? undefined,
      actingCategory: row.acting_category ?? undefined,
      movementType: row.movement_type ?? undefined,
      movementNote: row.movement_note ?? undefined,
      loggedBy: row.logged_by ?? undefined,
    }));

    const externalLoads: DailyExternalLoadRecord[] = ((externalRes.data ?? []) as DbRow[]).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      sessionId: row.session_id ?? undefined,
      playerId: playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
      date: row.date,
      min: num(row.minutes),
      acc: num(row.acc),
      dcc: num(row.dcc),
      sprints: num(row.sprints),
      rhie: num(row.rhie),
      ima: num(row.ima),
      rpe: row.rpe ?? undefined,
      totalDistance: row.total_distance ?? undefined,
      maxVelocity: row.max_velocity ?? undefined,
      playerLoad: row.player_load ?? undefined,
      participation: row.participation ?? undefined,
      microcycleId: row.microcycle_id ? microcycleUuidToLegacy[String(row.microcycle_id)] : undefined,
      sessionNumber: row.session_number ?? undefined,
      sessionType: row.session_type ?? undefined,
      category: category(row.category),
      baseCategory: row.base_category ?? undefined,
      actingCategory: row.acting_category ?? undefined,
      movementType: row.movement_type ?? undefined,
      movementNote: row.movement_note ?? undefined,
      loggedBy: row.logged_by ?? undefined,
    }));

    const trainingSessionSummaries: TrainingSessionSummary[] = ((sessionsRes.data ?? []) as DbRow[]).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      date: row.date,
      category: category(row.category),
      microcycleId: row.microcycle_id ? microcycleUuidToLegacy[String(row.microcycle_id)] : '',
      sessionNumber: num(row.session_number, 1),
      sessionType: row.session_type ?? 'cdEf',
      sessionRpe: row.session_rpe ?? undefined,
      objective: row.objective ?? undefined,
      observation: row.observation ?? undefined,
      status: row.status ?? undefined,
    }));

    const competitionMatchSummaries: CompetitionMatchSummary[] = ((matchesRes.data ?? []) as DbRow[]).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      date: row.date,
      category: category(row.category),
      competitionName: text(row.competition_name, 'Partido oficial'),
      opponent: text(row.opponent),
      venue: row.venue ?? undefined,
      goalsFor: row.goals_for ?? undefined,
      goalsAgainst: row.goals_against ?? undefined,
      resultType: row.result_type ?? undefined,
      result: row.goals_for !== null && row.goals_against !== null ? `${row.goals_for}-${row.goals_against}` : undefined,
      observation: row.observation ?? undefined,
      status: row.status ?? undefined,
    }));

    const competitionRecords: CompetitionRecord[] = ((competitionPlayersRes.data ?? []) as DbRow[]).map((row) => {
      const match = matchByUuid[String(row.match_id)] ?? {};
      return {
        id: String(row.legacy_id ?? row.id),
        matchId: matchUuidToLegacy[String(row.match_id)] ?? String(row.match_id),
        playerId: playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
        date: match.date ?? '',
        opponent: match.opponent ?? '',
        competitionName: match.competition_name ?? 'Partido oficial',
        minutesPlayed: num(row.minutes_played),
        goals: num(row.goals),
        assists: num(row.assists),
        yellowCards: num(row.yellow_cards),
        redCards: num(row.red_cards),
        goalsConceded: row.goals_conceded ?? undefined,
        goalsPrevented: row.goals_prevented ?? undefined,
        category: category(row.category),
        startingRole: row.starting_role ?? undefined,
        medicalStatus: row.medical_status ?? undefined,
        injuryKind: row.injury_kind ?? undefined,
        medicalObservation: row.medical_observation ?? undefined,
        acc: row.acc ?? undefined,
        dcc: row.dcc ?? undefined,
        sprints: row.sprints ?? undefined,
        rhie: row.rhie ?? undefined,
        ima: row.ima ?? undefined,
        totalDistance: row.total_distance ?? undefined,
        maxVelocity: row.max_velocity ?? undefined,
        playerLoad: row.player_load ?? undefined,
        loggedBy: row.logged_by ?? undefined,
      };
    });

    const nutritionRecords: NutritionRecord[] = ((nutritionRes.data ?? []) as DbRow[]).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      playerId: playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
      date: row.date,
      weight: num(row.weight),
      height: num(row.height),
      bodyFat: num(row.body_fat),
      skinfoldSum: num(row.skinfold_sum),
      plan: row.plan ?? 'Normocalorico',
      weightRange: row.weight_range ?? undefined,
      skinfoldRange: row.skinfold_range ?? undefined,
      fatPercentageRange: row.fat_percentage_range ?? undefined,
      muscleMassPercentage: row.muscle_mass_percentage === null || row.muscle_mass_percentage === undefined ? undefined : num(row.muscle_mass_percentage),
      muscleMassRange: row.muscle_mass_range ?? undefined,
      imo: row.imo === null || row.imo === undefined ? undefined : num(row.imo),
      diagnosis: row.diagnosis ?? undefined,
      category: category(row.category),
    }));

    const cmjRecords: CMJRecord[] = ((cmjRes.data ?? []) as DbRow[]).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      playerId: playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
      date: row.date,
      value: num(row.value),
      category: category(row.category),
    }));

    const neuromuscularRecords: NeuromuscularRecord[] = ((neuroRes.data ?? []) as DbRow[]).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      playerId: playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
      date: row.date,
      cmj: num(row.cmj),
      sj: num(row.sj),
      reactiveJumps: num(row.reactive_jumps),
      category: category(row.category),
    }));

    const fmsRecords: FMSRecord[] = ((fmsRes.data ?? []) as DbRow[]).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      playerId: playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
      date: row.date,
      shoulderMobility: num(row.shoulder_mobility),
      squat: num(row.squat),
      legRaise: num(row.leg_raise),
      hurdleStep: num(row.hurdle_step),
      lunge: num(row.lunge),
      trunkStability: num(row.trunk_stability),
      rotaryStability: num(row.rotary_stability),
      category: category(row.category),
    }));

    return {
      ok: true,
      data: {
        players,
        microcycles,
        wellness,
        internalLoads,
        externalLoads,
        trainingSessionSummaries,
        competitionMatchSummaries,
        competitionRecords,
        nutritionRecords,
        cmjRecords,
        neuromuscularRecords,
        fmsRecords,
      },
    };
  } catch (error) {
    return { ok: false, reason: isAuthError(error) ? 'not_authorized' : 'query_failed', error };
  }
};


export const deleteSupabaseTableRowByLegacyId = async (supabase: SupabaseClient, table: string, legacyId: string): Promise<SyncResult> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { ok: false, reason: 'not_authenticated' };

  try {
    const { error } = await supabase.from(table).delete().eq('legacy_id', legacyId);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: isAuthError(error) ? 'not_authorized' : 'delete_failed', error };
  }
};

export const deleteSupabaseTrainingSessionCascade = async (
  supabase: SupabaseClient,
  input: { legacyId: string; date?: string; category?: ClubCategory; sessionNumber?: number },
): Promise<SyncResult> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { ok: false, reason: 'not_authenticated' };

  try {
    const sessionIds = new Set<string>();

    const legacyQuery = await supabase.from('training_sessions').select('id').eq('legacy_id', input.legacyId);
    if (legacyQuery.error) throw legacyQuery.error;
    (legacyQuery.data ?? []).forEach((row: DbRow) => sessionIds.add(String(row.id)));

    if (input.date && input.category) {
      let byNaturalKey = supabase
        .from('training_sessions')
        .select('id')
        .eq('date', input.date)
        .eq('category', input.category);
      if (input.sessionNumber !== undefined) byNaturalKey = byNaturalKey.eq('session_number', input.sessionNumber);
      const naturalResult = await byNaturalKey;
      if (naturalResult.error) throw naturalResult.error;
      (naturalResult.data ?? []).forEach((row: DbRow) => sessionIds.add(String(row.id)));
    }

    const ids = [...sessionIds];
    if (ids.length) {
      await supabase.from('session_players').delete().in('session_id', ids);
      await supabase.from('daily_internal_loads').delete().in('session_id', ids);
      await supabase.from('daily_external_loads').delete().in('session_id', ids);
      await supabase.from('training_sessions').delete().in('id', ids);
    }

    await supabase.from('training_sessions').delete().eq('legacy_id', input.legacyId);

    if (input.date && input.category) {
      let internalDelete = supabase
        .from('daily_internal_loads')
        .delete()
        .eq('date', input.date)
        .eq('category', input.category);
      let externalDelete = supabase
        .from('daily_external_loads')
        .delete()
        .eq('date', input.date)
        .eq('category', input.category);
      let sessionDelete = supabase
        .from('training_sessions')
        .delete()
        .eq('date', input.date)
        .eq('category', input.category);
      if (input.sessionNumber !== undefined) {
        internalDelete = internalDelete.eq('session_number', input.sessionNumber);
        externalDelete = externalDelete.eq('session_number', input.sessionNumber);
        sessionDelete = sessionDelete.eq('session_number', input.sessionNumber);
      }
      const [internalResult, externalResult, sessionResult] = await Promise.all([internalDelete, externalDelete, sessionDelete]);
      if (internalResult.error) throw internalResult.error;
      if (externalResult.error) throw externalResult.error;
      if (sessionResult.error) throw sessionResult.error;
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: isAuthError(error) ? 'not_authorized' : 'delete_failed', error };
  }
};

export const saveSupabaseTablesAppData = async (supabase: SupabaseClient, data: AppData): Promise<SyncResult> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    console.error('[Supabase] saveSupabaseTablesAppData: not authenticated');
    return { ok: false, reason: 'not_authenticated' };
  }

  try {
    console.log('[Supabase] Saving data:', {
      players: data.players.length,
      microcycles: data.microcycles.length,
      sessions: data.trainingSessionSummaries.length,
      externalLoads: data.externalLoads.length,
      internalLoads: data.internalLoads.length,
      competition: data.competitionRecords.length,
    });

    await upsertRows(supabase, 'players', data.players.map((player) => ({
      legacy_id: player.id,
      name: player.name,
      birth_date: isoDate(player.birthDate) ?? null,
      age: Number.isFinite(player.age) && player.age >= 0 ? player.age : null,
      position: player.position,
      category: category(player.category),
      height: num(player.height, 0),
      weight: num(player.weight, 0),
      status: player.status,
      photo: player.photo ?? '',
      injury_area: player.injuryArea ?? null,
      injury_type: player.injuryType ?? null,
      injury_severity: player.injurySeverity ?? null,
      return_date: isoDate(player.returnDate),
      // FIX #2: Guardar categoryHistory e injuryHistory como JSONB en Supabase.
      // Estos campos no se guardaban antes, por eso al hacer fetch
      // siempre aparecían vacíos. Con esto se preservan entre sesiones.
      // IMPORTANTE: Para que esto funcione, debes agregar estas columnas a tu tabla
      // 'players' en Supabase si aún no existen. Ejecuta en el SQL Editor de Supabase:
      //   ALTER TABLE players ADD COLUMN IF NOT EXISTS category_history jsonb DEFAULT '[]';
      //   ALTER TABLE players ADD COLUMN IF NOT EXISTS injury_history jsonb DEFAULT '[]';
      category_history: JSON.stringify(
        Array.isArray(player.categoryHistory) && player.categoryHistory.length > 0
          ? player.categoryHistory
          : [category(player.category)],
      ),
      injury_history: JSON.stringify(
        Array.isArray(player.injuryHistory) ? player.injuryHistory : [],
      ),
    })));

    await upsertRows(supabase, 'microcycles', data.microcycles
      .filter((item) => isoDate(item.startDate) && isoDate(item.endDate))
      .map((item) => ({
        legacy_id: item.id,
        name: item.name,
        week_number: item.weekNumber ?? null,
        start_date: isoDate(item.startDate),
        end_date: isoDate(item.endDate),
        category: category(item.category),
        objective: item.objective ?? null,
        notes: item.notes ?? null,
        status: item.status ?? null,
      })));

    const playerMap = await fetchLegacyIdMap(supabase, 'players');
    const playerCategoryById = Object.fromEntries(data.players.map((player) => [player.id, category(player.category)]));
    const microcycleMap = await fetchLegacyIdMap(supabase, 'microcycles');
    const playerUuid = (legacyId: string) => playerMap[legacyId] ?? null;
    const microcycleUuid = (legacyId?: string) => legacyId ? microcycleMap[legacyId] ?? null : null;

    await upsertRows(supabase, 'daily_wellness', data.wellness
      .filter((record) => playerUuid(record.playerId) && isoDate(record.date))
      .map((record) => ({
        legacy_id: record.id,
        player_id: playerUuid(record.playerId),
        date: isoDate(record.date),
        category: category(record.category),
        sleep: num(record.sleep),
        fatigue: num(record.fatigue),
        stress: num(record.stress),
        muscle_pain: num(record.musclePain),
        mood: num(record.mood),
      })));

    await upsertRows(supabase, 'daily_internal_loads', data.internalLoads
      .filter((record) => playerUuid(record.playerId) && isoDate(record.date))
      .map((record) => ({
        legacy_id: record.id,
        player_id: playerUuid(record.playerId),
        microcycle_id: microcycleUuid(record.microcycleId),
        date: isoDate(record.date),
        category: category(record.category),
        base_category: record.baseCategory ?? null,
        acting_category: record.actingCategory ?? null,
        session_number: record.sessionNumber ?? null,
        session_id: null,
        rpe: num(record.rpe),
        duration: num(record.duration),
        movement_type: record.movementType ?? null,
        movement_note: record.movementNote ?? null,
        logged_by: record.loggedBy ?? null,
      })));

    await upsertRows(supabase, 'daily_external_loads', data.externalLoads
      .filter((record) => supportsGps(record.category ?? playerCategoryById[record.playerId]) && playerUuid(record.playerId) && isoDate(record.date))
      .map((record) => ({
        legacy_id: record.id,
        player_id: playerUuid(record.playerId),
        microcycle_id: microcycleUuid(record.microcycleId),
        date: isoDate(record.date),
        category: 'Sub20',
        base_category: record.baseCategory ?? null,
        acting_category: record.actingCategory ?? null,
        session_number: record.sessionNumber ?? null,
        session_id: null,
        minutes: num(record.min),
        acc: num(record.acc),
        dcc: num(record.dcc),
        sprints: num(record.sprints),
        rhie: num(record.rhie),
        rpe: record.rpe ?? null,
        total_distance: record.totalDistance ?? null,
        max_velocity: record.maxVelocity ?? null,
        player_load: record.playerLoad ?? null,
        participation: record.participation ?? null,
        session_type: record.sessionType ?? null,
        movement_type: record.movementType ?? null,
        movement_note: record.movementNote ?? null,
        logged_by: record.loggedBy ?? null,
      })));

    // FIX DEFINITIVO: training_sessions upsert.
    // El único índice UNIQUE garantizado en la tabla es (category, date).
    // Usamos ese índice para el onConflict y actualizamos legacy_id en cada upsert.
    // Esto garantiza que la sesión siempre llega a Supabase independientemente
    // de si legacy_id tiene o no restricción UNIQUE.
    const sessionRows = data.trainingSessionSummaries
      .filter((record) => isoDate(record.date) && category(record.category))
      .map((record) => ({
        legacy_id: record.id,
        date: isoDate(record.date),
        category: category(record.category),
        microcycle_id: microcycleUuid(record.microcycleId),
        session_number: record.sessionNumber ?? 1,
        session_type: record.sessionType ?? null,
        session_rpe: record.sessionRpe ?? null,
        objective: record.objective ?? null,
        observation: record.observation ?? null,
        status: record.status ?? null,
      }));

    if (sessionRows.length > 0) {
      // Upsert usando (category, date) como clave de conflicto — siempre existe como índice único.
      // Actualiza legacy_id para que futuros fetches puedan correlacionar el id local con Supabase.
      const { error: sessionError } = await supabase
        .from('training_sessions')
        .upsert(sessionRows, { onConflict: 'category,date', ignoreDuplicates: false });

      if (sessionError) {
        // Si falla (legacy_id podría no estar en la tabla o haber otro conflicto),
        // intentar fila por fila con UPDATE directo.
        for (const row of sessionRows) {
          // Primero INSERT, si falla por duplicate key, hacer UPDATE
          const { error: upsertErr } = await supabase
            .from('training_sessions')
            .upsert(row, { onConflict: 'category,date', ignoreDuplicates: false });
          
          if (upsertErr) {
            // Último recurso: UPDATE puro por category+date
            await supabase
              .from('training_sessions')
              .update({
                legacy_id: row.legacy_id,
                microcycle_id: row.microcycle_id,
                session_number: row.session_number,
                session_type: row.session_type,
                session_rpe: row.session_rpe,
                objective: row.objective,
                observation: row.observation,
                status: row.status,
              })
              .eq('category', row.category)
              .eq('date', row.date as string);
          }
        }
      }
    }

    await upsertRows(supabase, 'competition_matches', data.competitionMatchSummaries
      .filter((record) => isoDate(record.date))
      .map((record) => ({
        legacy_id: record.id,
        date: isoDate(record.date),
        category: category(record.category),
        competition_name: record.competitionName ?? 'Partido oficial',
        opponent: record.opponent,
        venue: record.venue ?? null,
        goals_for: record.goalsFor ?? null,
        goals_against: record.goalsAgainst ?? null,
        result_type: record.resultType ?? null,
        observation: record.observation ?? null,
        status: record.status ?? null,
      })));

    const matchMap = await fetchLegacyIdMap(supabase, 'competition_matches');
    const matchUuid = (legacyId?: string) => legacyId ? matchMap[legacyId] ?? null : null;

    await upsertRows(supabase, 'competition_players', data.competitionRecords
      .filter((record) => matchUuid(record.matchId) && playerUuid(record.playerId))
      .map((record) => ({
        legacy_id: record.id,
        match_id: matchUuid(record.matchId),
        player_id: playerUuid(record.playerId),
        category: category(record.category),
        starting_role: record.startingRole ?? null,
        minutes_played: num(record.minutesPlayed),
        goals: num(record.goals),
        assists: num(record.assists),
        yellow_cards: num(record.yellowCards),
        red_cards: num(record.redCards),
        goals_conceded: record.goalsConceded ?? null,
        goals_prevented: record.goalsPrevented ?? null,
        medical_status: record.medicalStatus ?? 'Sin lesión',
        injury_kind: record.injuryKind ?? null,
        medical_observation: record.medicalObservation ?? null,
        acc: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? record.acc ?? null : null,
        dcc: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? record.dcc ?? null : null,
        sprints: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? record.sprints ?? null : null,
        rhie: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? record.rhie ?? null : null,
        ima: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? record.ima ?? null : null,
        total_distance: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? record.totalDistance ?? null : null,
        max_velocity: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? record.maxVelocity ?? null : null,
        player_load: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? record.playerLoad ?? null : null,
        logged_by: record.loggedBy ?? null,
      })));

    await upsertRows(supabase, 'nutrition_records', data.nutritionRecords
      .filter((record) => playerUuid(record.playerId) && isoDate(record.date))
      .map((record) => ({
        legacy_id: record.id,
        player_id: playerUuid(record.playerId),
        date: isoDate(record.date),
        category: category(record.category),
        weight: record.weight ?? null,
        height: record.height ?? null,
        body_fat: record.bodyFat ?? null,
        skinfold_sum: record.skinfoldSum ?? null,
        plan: record.plan ?? null,
        weight_range: record.weightRange || null,
        skinfold_range: record.skinfoldRange || null,
        fat_percentage_range: record.fatPercentageRange || null,
        muscle_mass_percentage: record.muscleMassPercentage ?? null,
        muscle_mass_range: record.muscleMassRange || null,
        imo: record.imo ?? null,
        diagnosis: record.diagnosis || null,
      })));

    await upsertRows(supabase, 'cmj_records', data.cmjRecords
      .filter((record) => playerUuid(record.playerId) && isoDate(record.date))
      .map((record) => ({
        legacy_id: record.id,
        player_id: playerUuid(record.playerId),
        date: isoDate(record.date),
        category: category(record.category),
        value: record.value ?? null,
      })));

    await upsertRows(supabase, 'neuromuscular_records', data.neuromuscularRecords
      .filter((record) => playerUuid(record.playerId) && isoDate(record.date))
      .map((record) => ({
        legacy_id: record.id,
        player_id: playerUuid(record.playerId),
        date: isoDate(record.date),
        category: category(record.category),
        cmj: record.cmj ?? null,
        sj: record.sj ?? null,
        reactive_jumps: record.reactiveJumps ?? null,
      })));

    await upsertRows(supabase, 'fms_records', data.fmsRecords
      .filter((record) => playerUuid(record.playerId) && isoDate(record.date))
      .map((record) => ({
        legacy_id: record.id,
        player_id: playerUuid(record.playerId),
        date: isoDate(record.date),
        category: category(record.category),
        shoulder_mobility: record.shoulderMobility ?? null,
        squat: record.squat ?? null,
        leg_raise: record.legRaise ?? null,
        hurdle_step: record.hurdleStep ?? null,
        lunge: record.lunge ?? null,
        trunk_stability: record.trunkStability ?? null,
        rotary_stability: record.rotaryStability ?? null,
      })));

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: isAuthError(error) ? 'not_authorized' : 'save_failed', error };
  }
};
