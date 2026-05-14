import type { SupabaseClient } from "@supabase/supabase-js";
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
  StrengthSession,
} from "@/lib/types";
import { supportsGps } from "@/lib/report-utils";

type SyncResult =
  | { ok: true; skipped?: number }
  | { ok: false; error?: unknown; reason?: string };
type LegacyMap = Record<string, string>;

type DbRow = Record<string, any>;

const isoDate = (value?: string | null): string | null => {
  if (!value) return null;
  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return null;
};

const num = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const text = (value: unknown, fallback = ""): string => {
  if (value === null || value === undefined) return fallback;
  const next = String(value).trim();
  return next || fallback;
};

const category = (
  value: unknown,
  fallback: ClubCategory = "Sub20",
): ClubCategory => {
  return value === "Sub15" || value === "Sub17" || value === "Sub20"
    ? value
    : fallback;
};

const isAuthError = (error: any) => {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("jwt") ||
    message.includes("permission") ||
    message.includes("rls") ||
    message.includes("auth")
  );
};

const fetchLegacyIdMap = async (
  supabase: SupabaseClient,
  table: string,
): Promise<LegacyMap> => {
  const { data, error } = await supabase
    .from(table)
    .select("id, legacy_id")
    .not("legacy_id", "is", null);
  if (error) throw error;
  return Object.fromEntries(
    ((data ?? []) as DbRow[]).map((row) => [
      String(row.legacy_id),
      String(row.id),
    ]),
  );
};

const fetchUuidToLegacyIdMap = async (
  supabase: SupabaseClient,
  table: string,
): Promise<LegacyMap> => {
  const { data, error } = await supabase.from(table).select("id, legacy_id");
  if (error) throw error;
  return Object.fromEntries(
    ((data ?? []) as DbRow[]).map((row) => [
      String(row.id),
      String(row.legacy_id ?? row.id),
    ]),
  );
};

const missingColumnFromError = (error: unknown): string | null => {
  const message = String(
    (error as { message?: unknown } | null)?.message ?? "",
  );
  const schemaCacheMatch = message.match(
    /Could not find the '([^']+)' column/i,
  );
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];
  const relationMatch = message.match(/column "([^"]+)" of relation/i);
  if (relationMatch?.[1]) return relationMatch[1];
  const genericMatch = message.match(/column "([^"]+)" does not exist/i);
  if (genericMatch?.[1]) return genericMatch[1];
  return null;
};

const stripColumns = (rows: DbRow[], columns: Set<string>): DbRow[] =>
  rows.map(
    (row) =>
      Object.fromEntries(
        Object.entries(row).filter(([key]) => !columns.has(key)),
      ) as DbRow,
  );


const stripColumnsForConstraint = (
  table: string,
  error: unknown,
): string | null => {
  const message = String((error as { message?: unknown } | null)?.message ?? '').toLowerCase();
  if (!message.includes('check constraint')) return null;
  if (table === 'nutrition_records' && message.includes('fat_percentage_range'))
    return 'fat_percentage_range';
  return null;
};

const directUpdateOrInsertRow = async (
  supabase: SupabaseClient,
  table: string,
  row: DbRow,
): Promise<{ ok: true } | { ok: false; error: any }> => {
  if (!row.legacy_id) {
    const { error } = await supabase.from(table).insert(row);
    return error ? { ok: false, error } : { ok: true };
  }

  const existing = await supabase
    .from(table)
    .select('id')
    .eq('legacy_id', row.legacy_id)
    .limit(1)
    .maybeSingle();

  if (!existing.error && existing.data?.id) {
    const { error } = await supabase
      .from(table)
      .update(row)
      .eq('id', existing.data.id);
    return error ? { ok: false, error } : { ok: true };
  }

  const { error } = await supabase.from(table).insert(row);
  return error ? { ok: false, error } : { ok: true };
};

const upsertRows = async (
  supabase: SupabaseClient,
  table: string,
  rows: DbRow[],
  onConflict = "legacy_id",
): Promise<{ savedCount: number; strippedColumns: string[] }> => {
  if (!rows.length) return { savedCount: 0, strippedColumns: [] };

  const strippedColumns = new Set<string>();
  let workingRows = rows;

  // Attempt 1: upsert in bulk. If Supabase schema cache is missing a newer
  // optional column, strip only that column and retry so core records still save.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { error } = await supabase
      .from(table)
      .upsert(workingRows, { onConflict, ignoreDuplicates: false });
    if (!error) {
      if (strippedColumns.size) {
        console.warn(
          `[Supabase] '${table}' guardado sin columnas pendientes de SQL: ${Array.from(strippedColumns).join(", ")}`,
        );
      }
      return {
        savedCount: workingRows.length,
        strippedColumns: Array.from(strippedColumns),
      };
    }

    const constrainedColumn = stripColumnsForConstraint(table, error);
    const missingColumn = missingColumnFromError(error) ?? constrainedColumn;
    if (missingColumn && !strippedColumns.has(missingColumn)) {
      strippedColumns.add(missingColumn);
      workingRows = stripColumns(rows, strippedColumns);
      continue;
    }

    console.warn(
      `[Supabase] upsert failed on '${table}' (onConflict='${onConflict}'):`,
      error.message,
    );
    break;
  }

  // Attempt 2: upsert row-by-row (catches individual constraint violations)
  let savedCount = 0;
  const errors: string[] = [];
  for (const originalRow of workingRows) {
    let row = originalRow;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { error: rowError } = await supabase
        .from(table)
        .upsert(row, { onConflict: "legacy_id", ignoreDuplicates: false });
      if (!rowError) {
        savedCount++;
        break;
      }

      const rowConstrainedColumn = stripColumnsForConstraint(table, rowError);
      const missingColumn = missingColumnFromError(rowError) ?? rowConstrainedColumn;
      if (missingColumn && !strippedColumns.has(missingColumn)) {
        strippedColumns.add(missingColumn);
        row = stripColumns([originalRow], strippedColumns)[0];
        continue;
      }

      const directResult = await directUpdateOrInsertRow(supabase, table, row);
      if (directResult.ok) {
        savedCount++;
        break;
      }

      const directMissingColumn =
        missingColumnFromError(directResult.error) ??
        stripColumnsForConstraint(table, directResult.error);
      if (directMissingColumn && !strippedColumns.has(directMissingColumn)) {
        strippedColumns.add(directMissingColumn);
        row = stripColumns([originalRow], strippedColumns)[0];
        continue;
      }

      errors.push(`${row.legacy_id ?? "?"}: ${directResult.error?.message ?? 'error'}`);
      break;
    }
  }

  if (errors.length > 0) {
    console.error(
      `[Supabase] ${table}: ${savedCount}/${rows.length} saved. Failures:`,
      errors.slice(0, 5),
    );
  }
  if (strippedColumns.size) {
    console.warn(
      `[Supabase] '${table}' requiere actualizar SQL para persistir: ${Array.from(strippedColumns).join(", ")}`,
    );
  }
  return { savedCount, strippedColumns: Array.from(strippedColumns) };
};

// FIX #2 (helper): Parsear de forma segura un campo JSONB que viene de Supabase.
// Si el valor es null, undefined, o no es parseable como array, retorna [].
const parseJsonArray = <T>(value: unknown): T[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

export const fetchSupabaseTablesAppData = async (
  supabase: SupabaseClient,
): Promise<
  | { ok: true; data: Partial<AppData> }
  | { ok: false; reason?: string; error?: unknown }
> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { ok: false, reason: "not_authenticated" };

  try {
    const [playersRes, microcyclesRes] = await Promise.all([
      supabase.from("players").select("*").order("name"),
      supabase.from("microcycles").select("*").order("start_date"),
    ]);
    if (playersRes.error) throw playersRes.error;
    if (microcyclesRes.error) throw microcyclesRes.error;

    const playerUuidToLegacy = Object.fromEntries(
      ((playersRes.data ?? []) as DbRow[]).map((row) => [
        String(row.id),
        String(row.legacy_id ?? row.id),
      ]),
    );
    const microcycleUuidToLegacy = Object.fromEntries(
      ((microcyclesRes.data ?? []) as DbRow[]).map((row) => [
        String(row.id),
        String(row.legacy_id ?? row.id),
      ]),
    );

    const [
      wellnessRes,
      internalRes,
      externalRes,
      sessionsRes,
      matchesRes,
      nutritionRes,
      cmjRes,
      neuroRes,
      fmsRes,
    ] = await Promise.all([
      supabase
        .from("daily_wellness")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("daily_internal_loads")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("daily_external_loads")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("training_sessions")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("competition_matches")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("nutrition_records")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("cmj_records")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("neuromuscular_records")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("fms_records")
        .select("*")
        .order("date", { ascending: false }),
    ]);

    for (const result of [
      wellnessRes,
      internalRes,
      externalRes,
      sessionsRes,
      matchesRes,
      nutritionRes,
      cmjRes,
      neuroRes,
      fmsRes,
    ]) {
      if (result.error) throw result.error;
    }

    let strengthRows: DbRow[] = [];
    try {
      const strengthRes = await supabase
        .from("strength_sessions")
        .select("*")
        .order("date", { ascending: false });
      if (!strengthRes.error)
        strengthRows = (strengthRes.data ?? []) as DbRow[];
    } catch {
      // Tabla opcional. Si aún no existe, el resto de la app sigue funcionando en cache local.
      strengthRows = [];
    }

    const matchUuidToLegacy = Object.fromEntries(
      ((matchesRes.data ?? []) as DbRow[]).map((row) => [
        String(row.id),
        String(row.legacy_id ?? row.id),
      ]),
    );
    const matchByUuid = Object.fromEntries(
      ((matchesRes.data ?? []) as DbRow[]).map((row) => [String(row.id), row]),
    );
    const sessionUuidToLegacy = Object.fromEntries(
      ((sessionsRes.data ?? []) as DbRow[]).map((row) => [
        String(row.id),
        String(row.legacy_id ?? row.id),
      ]),
    );
    const sessionByUuid = Object.fromEntries(
      ((sessionsRes.data ?? []) as DbRow[]).map((row) => [String(row.id), row]),
    );

    const competitionPlayersRes = await supabase
      .from("competition_players")
      .select("*")
      .order("created_at", { ascending: false });
    if (competitionPlayersRes.error) throw competitionPlayersRes.error;

    // session_players es una tabla de seguridad para reconstruir la planilla
    // aunque daily_internal_loads/daily_external_loads lleguen tarde o fallen
    // parcialmente durante el sync. No debe romper la lectura si la tabla aun
    // no existe en un proyecto antiguo.
    const sessionPlayersRes = await supabase
      .from("session_players")
      .select("*");
    if (sessionPlayersRes.error) {
      console.warn(
        "[Supabase] session_players fallback no disponible:",
        sessionPlayersRes.error.message,
      );
    }

    const players: Player[] = ((playersRes.data ?? []) as DbRow[]).map(
      (row) => ({
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
        jerseyNumber: num(row.jersey_number) || undefined,
        documentId: row.document_id ?? undefined,
        nationality: row.nationality ?? undefined,
        birthplace: row.birthplace ?? undefined,
        phone: row.phone ?? undefined,
        guardianName: row.guardian_name ?? undefined,
        guardianPhone: row.guardian_phone ?? undefined,
        emergencyContactName: row.emergency_contact_name ?? undefined,
        emergencyContactPhone: row.emergency_contact_phone ?? undefined,
        height: num(row.height, 0),
        weight: num(row.weight, 0),
        dominantFoot: row.dominant_foot ?? undefined,
        secondaryPosition: row.secondary_position ?? undefined,
        competitiveRole: row.competitive_role ?? undefined,
        dateJoined: row.date_joined ?? undefined,
        loadTolerance: row.load_tolerance ?? undefined,
        maxVelocityReference: num(row.max_velocity_reference) || undefined,
        baselineWellness: num(row.baseline_wellness) || undefined,
        baselineRpe: num(row.baseline_rpe) || undefined,
        targetWeeklyLoad: num(row.target_weekly_load) || undefined,
        targetWeeklyHsr: num(row.target_weekly_hsr) || undefined,
        targetWeeklySprintDistance:
          num(row.target_weekly_sprint_distance) || undefined,
        targetMinutes7d: num(row.target_minutes_7d) || undefined,
        maxTrainingPercent: num(row.max_training_percent) || undefined,
        maxCompetitionMinutes: num(row.max_competition_minutes) || undefined,
        returnToPlayPhase: row.return_to_play_phase ?? undefined,
        restrictions: parseJsonArray<string>(row.restrictions),
        medicalNotes: row.medical_notes ?? undefined,
        allergies: row.allergies ?? undefined,
        chronicConditions: row.chronic_conditions ?? undefined,
        riskAreas: row.risk_areas ?? undefined,
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
      }),
    );

    const microcycles: Microcycle[] = (
      (microcyclesRes.data ?? []) as DbRow[]
    ).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      name: text(row.name),
      category: category(row.category),
      weekNumber: row.week_number ?? undefined,
      startDate: row.start_date ?? "",
      endDate: row.end_date ?? "",
      objective: row.objective ?? undefined,
      notes: row.notes ?? undefined,
      status: row.status ?? undefined,
    }));

    const wellness: DailyWellnessRecord[] = (
      (wellnessRes.data ?? []) as DbRow[]
    ).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      playerId:
        playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
      date: row.date,
      sleep: num(row.sleep),
      fatigue: num(row.fatigue),
      stress: num(row.stress),
      musclePain: num(row.muscle_pain),
      mood: num(row.mood),
      category: category(row.category),
    }));

    const internalLoads: DailyInternalLoadRecord[] = (
      (internalRes.data ?? []) as DbRow[]
    ).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      sessionId: row.session_id
        ? (sessionUuidToLegacy[String(row.session_id)] ??
          String(row.session_id))
        : undefined,
      playerId:
        playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
      date: row.date,
      rpe: num(row.rpe),
      duration: num(row.duration),
      microcycleId: row.microcycle_id
        ? microcycleUuidToLegacy[String(row.microcycle_id)]
        : undefined,
      sessionNumber: row.session_number ?? undefined,
      category: category(row.category),
      baseCategory: row.base_category ?? undefined,
      actingCategory: row.acting_category ?? undefined,
      movementType: row.movement_type ?? undefined,
      movementNote: row.movement_note ?? undefined,
      movementModule: row.movement_module ?? (String(row.legacy_id ?? row.id).startsWith('comp-load-') ? 'competencia' : undefined),
      loggedBy: row.logged_by ?? undefined,
    }));

    const rawExternalLoads: DailyExternalLoadRecord[] = (
      (externalRes.data ?? []) as DbRow[]
    ).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      sessionId: row.session_id
        ? (sessionUuidToLegacy[String(row.session_id)] ??
          String(row.session_id))
        : undefined,
      playerId:
        playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
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
      microcycleId: row.microcycle_id
        ? microcycleUuidToLegacy[String(row.microcycle_id)]
        : undefined,
      sessionNumber: row.session_number ?? undefined,
      sessionType: row.session_type ?? undefined,
      category: category(row.category),
      baseCategory: row.base_category ?? undefined,
      actingCategory: row.acting_category ?? undefined,
      movementType: row.movement_type ?? undefined,
      movementNote: row.movement_note ?? undefined,
      movementModule: row.movement_module ?? (String(row.legacy_id ?? row.id).startsWith('comp-load-') ? 'competencia' : undefined),
      loggedBy: row.logged_by ?? undefined,
    }));

    const sessionPlayerFallbackLoads: DailyExternalLoadRecord[] = (
      (sessionPlayersRes.error ? [] : (sessionPlayersRes.data ?? [])) as DbRow[]
    )
      .map((row) => {
        const sessionRow = sessionByUuid[String(row.session_id)];
        const sessionLegacy =
          sessionUuidToLegacy[String(row.session_id)] ?? String(row.session_id);
        const playerLegacy =
          playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id);
        if (!sessionRow || !playerLegacy) return null;
        return {
          id: `session-player-${sessionLegacy}-${playerLegacy}`,
          sessionId: sessionLegacy,
          playerId: playerLegacy,
          date: sessionRow.date ?? "",
          min: num(row.minutes),
          rpe: row.rpe ?? undefined,
          acc: num(row.acc),
          dcc: num(row.dcc),
          sprints: num(row.sprints),
          rhie: num(row.rhie),
          ima: num(row.ima),
          totalDistance: undefined,
          maxVelocity: undefined,
          playerLoad: undefined,
          participation: row.participation ?? "Completa",
          microcycleId: sessionRow.microcycle_id
            ? microcycleUuidToLegacy[String(sessionRow.microcycle_id)]
            : undefined,
          sessionNumber: sessionRow.session_number ?? undefined,
          sessionType: sessionRow.session_type ?? undefined,
          category: category(sessionRow.category),
          baseCategory: category(sessionRow.category),
          actingCategory: category(sessionRow.category),
          movementType: "base" as const,
          movementModule: "sesion" as const,
        } as DailyExternalLoadRecord;
      })
      .filter(Boolean) as DailyExternalLoadRecord[];
    const externalKey = new Set(
      rawExternalLoads.map(
        (record) => `${record.sessionId ?? ""}::${record.playerId}`,
      ),
    );
    const externalLoads = [
      ...rawExternalLoads,
      ...sessionPlayerFallbackLoads.filter(
        (record) =>
          !externalKey.has(`${record.sessionId ?? ""}::${record.playerId}`),
      ),
    ];

    const sessionPlayerInternalFallback: DailyInternalLoadRecord[] = (
      (sessionPlayersRes.error ? [] : (sessionPlayersRes.data ?? [])) as DbRow[]
    )
      .map((row) => {
        const sessionRow = sessionByUuid[String(row.session_id)];
        const sessionLegacy =
          sessionUuidToLegacy[String(row.session_id)] ?? String(row.session_id);
        const playerLegacy =
          playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id);
        if (!sessionRow || !playerLegacy) return null;
        return {
          id: `session-player-internal-${sessionLegacy}-${playerLegacy}`,
          sessionId: sessionLegacy,
          playerId: playerLegacy,
          date: sessionRow.date ?? "",
          rpe: num(row.rpe),
          duration: num(row.minutes),
          microcycleId: sessionRow.microcycle_id
            ? microcycleUuidToLegacy[String(sessionRow.microcycle_id)]
            : undefined,
          sessionNumber: sessionRow.session_number ?? undefined,
          category: category(sessionRow.category),
          baseCategory: category(sessionRow.category),
          actingCategory: category(sessionRow.category),
          movementType: "base" as const,
          movementModule: "sesion" as const,
        } as DailyInternalLoadRecord;
      })
      .filter(Boolean) as DailyInternalLoadRecord[];
    const internalKey = new Set(
      internalLoads.map(
        (record) => `${record.sessionId ?? ""}::${record.playerId}`,
      ),
    );
    const mergedInternalLoads = [
      ...internalLoads,
      ...sessionPlayerInternalFallback.filter(
        (record) =>
          !internalKey.has(`${record.sessionId ?? ""}::${record.playerId}`),
      ),
    ];

    const trainingSessionSummaries: TrainingSessionSummary[] = (
      (sessionsRes.data ?? []) as DbRow[]
    ).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      date: row.date,
      category: category(row.category),
      microcycleId: row.microcycle_id
        ? microcycleUuidToLegacy[String(row.microcycle_id)]
        : "",
      sessionNumber: num(row.session_number, 1),
      sessionType: row.session_type ?? "MD-3",
      sessionRpe: row.session_rpe ?? undefined,
      objective: row.objective ?? undefined,
      observation: row.observation ?? undefined,
      status: row.status ?? undefined,
      lineupFormation: row.lineup_formation ?? undefined,
      lineupSlots: Array.isArray(row.lineup_slots)
        ? row.lineup_slots
        : undefined,
      eyeballStats: row.eyeball_stats ?? undefined,
      eyeballFirstHalfStats: row.eyeball_first_half_stats ?? undefined,
      eyeballSecondHalfStats: row.eyeball_second_half_stats ?? undefined,
    }));

    const competitionMatchSummaries: CompetitionMatchSummary[] = (
      (matchesRes.data ?? []) as DbRow[]
    ).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      date: row.date,
      category: category(row.category),
      competitionName: text(row.competition_name, "Partido oficial"),
      opponent: text(row.opponent),
      venue: row.venue ?? undefined,
      goalsFor: row.goals_for ?? undefined,
      goalsAgainst: row.goals_against ?? undefined,
      resultType: row.result_type ?? undefined,
      result:
        row.goals_for !== null && row.goals_against !== null
          ? `${row.goals_for}-${row.goals_against}`
          : undefined,
      observation: row.observation ?? undefined,
      status: row.status ?? undefined,
      lineupFormation: row.lineup_formation ?? undefined,
      lineupSlots: Array.isArray(row.lineup_slots)
        ? row.lineup_slots
        : undefined,
      opponentLogo: row.opponent_logo ?? undefined,
      eyeballStats: row.eyeball_stats ?? undefined,
      eyeballFirstHalfStats: row.eyeball_first_half_stats ?? undefined,
      eyeballSecondHalfStats: row.eyeball_second_half_stats ?? undefined,
    }));

    const competitionRecords: CompetitionRecord[] = (
      (competitionPlayersRes.data ?? []) as DbRow[]
    ).map((row) => {
      const match = matchByUuid[String(row.match_id)] ?? {};
      return {
        id: String(row.legacy_id ?? row.id),
        matchId:
          matchUuidToLegacy[String(row.match_id)] ?? String(row.match_id),
        playerId:
          playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
        date: match.date ?? "",
        opponent: match.opponent ?? "",
        competitionName: match.competition_name ?? "Partido oficial",
        minutesPlayed: num(row.minutes_played),
        goals: num(row.goals),
        assists: num(row.assists),
        yellowCards: num(row.yellow_cards),
        redCards: num(row.red_cards),
        goalsConceded: row.goals_conceded ?? undefined,
        goalsPrevented: row.goals_prevented ?? undefined,
        penaltiesSaved: row.penalties_saved ?? undefined,
        crossesDefended: row.crosses_defended ?? undefined,
        footworkActions: row.footwork_actions ?? undefined,
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
        highSpeedDistance: row.high_speed_distance ?? row.hsr ?? undefined,
        hsr: row.hsr ?? row.high_speed_distance ?? undefined,
        sprintDistance: row.sprint_distance ?? undefined,
        maxVelocity: row.max_velocity ?? undefined,
        playerLoad: row.player_load ?? undefined,
        loggedBy: row.logged_by ?? undefined,
      };
    });

    const strengthSessions: StrengthSession[] = strengthRows.map((row) => ({
      id: String(row.legacy_id ?? row.id),
      date: String(row.date ?? ""),
      category: category(row.category),
      group: String(
        row.group_name ?? "Todo el plantel",
      ) as StrengthSession["group"],
      type: String(
        row.strength_type ?? "Concéntrica",
      ) as StrengthSession["type"],
      zone: String(row.zone ?? "Cadena posterior") as StrengthSession["zone"],
      intent: text(row.intent) as StrengthSession["intent"],
      movementPattern: text(
        row.movement_pattern,
      ) as StrengthSession["movementPattern"],
      duration: num(row.duration_min, 0),
      expectedRpe: num(row.expected_rpe, 0),
      objective: text(row.objective),
      restrictions: text(row.restrictions),
      playerIds: parseJsonArray<string>(row.player_ids),
      excludedPlayerIds: parseJsonArray<string>(row.excluded_player_ids),
      exercises: parseJsonArray(row.exercises),
      adjustments: parseJsonArray(row.adjustments),
      responses: parseJsonArray(row.responses),
      createdBy: text(row.created_by),
      createdAt: text(row.created_at, new Date().toISOString()),
      status: (text(row.status, "Planificada") ||
        "Planificada") as StrengthSession["status"],
    }));

    const nutritionRecords: NutritionRecord[] = (
      (nutritionRes.data ?? []) as DbRow[]
    ).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      playerId:
        playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
      date: row.date,
      weight: num(row.weight),
      height: num(row.height),
      bodyFat: num(row.body_fat),
      skinfoldSum: num(row.skinfold_sum),
      plan: row.plan ?? "Normocalorico",
      weightRange: row.weight_range ?? undefined,
      skinfoldRange: row.skinfold_range ?? undefined,
      fatPercentageRange: row.fat_percentage_range ?? undefined,
      muscleMassPercentage:
        row.muscle_mass_percentage === null ||
        row.muscle_mass_percentage === undefined
          ? undefined
          : num(row.muscle_mass_percentage),
      muscleMassRange: row.muscle_mass_range ?? undefined,
      imo: row.imo === null || row.imo === undefined ? undefined : num(row.imo),
      diagnosis: row.diagnosis ?? undefined,
      category: category(row.category),
    }));

    const cmjRecords: CMJRecord[] = ((cmjRes.data ?? []) as DbRow[]).map(
      (row) => ({
        id: String(row.legacy_id ?? row.id),
        playerId:
          playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
        date: row.date,
        value: num(row.value),
        category: category(row.category),
      }),
    );

    const neuromuscularRecords: NeuromuscularRecord[] = (
      (neuroRes.data ?? []) as DbRow[]
    ).map((row) => ({
      id: String(row.legacy_id ?? row.id),
      playerId:
        playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
      date: row.date,
      cmj: num(row.cmj),
      sj: num(row.sj),
      reactiveJumps: num(row.reactive_jumps),
      category: category(row.category),
    }));

    const fmsRecords: FMSRecord[] = ((fmsRes.data ?? []) as DbRow[]).map(
      (row) => ({
        id: String(row.legacy_id ?? row.id),
        playerId:
          playerUuidToLegacy[String(row.player_id)] ?? String(row.player_id),
        date: row.date,
        shoulderMobility: num(row.shoulder_mobility),
        squat: num(row.squat),
        legRaise: num(row.leg_raise),
        hurdleStep: num(row.hurdle_step),
        lunge: num(row.lunge),
        trunkStability: num(row.trunk_stability),
        rotaryStability: num(row.rotary_stability),
        category: category(row.category),
      }),
    );

    return {
      ok: true,
      data: {
        players,
        microcycles,
        wellness,
        internalLoads: mergedInternalLoads,
        externalLoads,
        trainingSessionSummaries,
        strengthSessions,
        competitionMatchSummaries,
        competitionRecords,
        nutritionRecords,
        cmjRecords,
        neuromuscularRecords,
        fmsRecords,
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: isAuthError(error) ? "not_authorized" : "query_failed",
      error,
    };
  }
};

export const deleteSupabaseTableRowByLegacyId = async (
  supabase: SupabaseClient,
  table: string,
  legacyId: string,
): Promise<SyncResult> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { ok: false, reason: "not_authenticated" };

  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("legacy_id", legacyId);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: isAuthError(error) ? "not_authorized" : "delete_failed",
      error,
    };
  }
};

export const deleteSupabaseTrainingSessionCascade = async (
  supabase: SupabaseClient,
  input: {
    legacyId: string;
    date?: string;
    category?: ClubCategory;
    sessionNumber?: number;
  },
): Promise<SyncResult> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { ok: false, reason: "not_authenticated" };

  try {
    const sessionIds = new Set<string>();

    const legacyQuery = await supabase
      .from("training_sessions")
      .select("id")
      .eq("legacy_id", input.legacyId);
    if (legacyQuery.error) throw legacyQuery.error;
    (legacyQuery.data ?? []).forEach((row: DbRow) =>
      sessionIds.add(String(row.id)),
    );

    if (input.date && input.category) {
      let byNaturalKey = supabase
        .from("training_sessions")
        .select("id")
        .eq("date", input.date)
        .eq("category", input.category);
      if (input.sessionNumber !== undefined)
        byNaturalKey = byNaturalKey.eq("session_number", input.sessionNumber);
      const naturalResult = await byNaturalKey;
      if (naturalResult.error) throw naturalResult.error;
      (naturalResult.data ?? []).forEach((row: DbRow) =>
        sessionIds.add(String(row.id)),
      );
    }

    const ids = [...sessionIds];
    if (ids.length) {
      await supabase.from("session_players").delete().in("session_id", ids);
      await supabase
        .from("daily_internal_loads")
        .delete()
        .in("session_id", ids);
      await supabase
        .from("daily_external_loads")
        .delete()
        .in("session_id", ids);
      await supabase.from("training_sessions").delete().in("id", ids);
    }

    await supabase
      .from("training_sessions")
      .delete()
      .eq("legacy_id", input.legacyId);

    if (input.date && input.category) {
      let internalDelete = supabase
        .from("daily_internal_loads")
        .delete()
        .eq("date", input.date)
        .eq("category", input.category);
      let externalDelete = supabase
        .from("daily_external_loads")
        .delete()
        .eq("date", input.date)
        .eq("category", input.category);
      let sessionDelete = supabase
        .from("training_sessions")
        .delete()
        .eq("date", input.date)
        .eq("category", input.category);
      if (input.sessionNumber !== undefined) {
        internalDelete = internalDelete.eq(
          "session_number",
          input.sessionNumber,
        );
        externalDelete = externalDelete.eq(
          "session_number",
          input.sessionNumber,
        );
        sessionDelete = sessionDelete.eq("session_number", input.sessionNumber);
      }
      const [internalResult, externalResult, sessionResult] = await Promise.all(
        [internalDelete, externalDelete, sessionDelete],
      );
      if (internalResult.error) throw internalResult.error;
      if (externalResult.error) throw externalResult.error;
      if (sessionResult.error) throw sessionResult.error;
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: isAuthError(error) ? "not_authorized" : "delete_failed",
      error,
    };
  }
};


const toPlayerRows = (players: Player[]): DbRow[] =>
  players.map((player) => ({
    legacy_id: player.id,
    name: player.name,
    birth_date: isoDate(player.birthDate) ?? null,
    age: Number.isFinite(player.age) && player.age >= 0 ? player.age : null,
    position: player.position,
    category: category(player.category),
    jersey_number: player.jerseyNumber ?? null,
    document_id: player.documentId ?? null,
    nationality: player.nationality ?? null,
    birthplace: player.birthplace ?? null,
    phone: player.phone ?? null,
    guardian_name: player.guardianName ?? null,
    guardian_phone: player.guardianPhone ?? null,
    emergency_contact_name: player.emergencyContactName ?? null,
    emergency_contact_phone: player.emergencyContactPhone ?? null,
    height: num(player.height, 0),
    weight: num(player.weight, 0),
    dominant_foot: player.dominantFoot ?? null,
    secondary_position: player.secondaryPosition ?? null,
    competitive_role: player.competitiveRole ?? null,
    date_joined: isoDate(player.dateJoined),
    load_tolerance: player.loadTolerance ?? null,
    max_velocity_reference: player.maxVelocityReference ?? null,
    baseline_wellness: player.baselineWellness ?? null,
    baseline_rpe: player.baselineRpe ?? null,
    target_weekly_load: player.targetWeeklyLoad ?? null,
    target_weekly_hsr: player.targetWeeklyHsr ?? null,
    target_weekly_sprint_distance: player.targetWeeklySprintDistance ?? null,
    target_minutes_7d: player.targetMinutes7d ?? null,
    max_training_percent: player.maxTrainingPercent ?? null,
    max_competition_minutes: player.maxCompetitionMinutes ?? null,
    return_to_play_phase: player.returnToPlayPhase ?? null,
    restrictions: JSON.stringify(
      Array.isArray(player.restrictions) ? player.restrictions : [],
    ),
    medical_notes: player.medicalNotes ?? null,
    allergies: player.allergies ?? null,
    chronic_conditions: player.chronicConditions ?? null,
    risk_areas: player.riskAreas ?? null,
    status: player.status,
    photo: player.photo ?? "",
    injury_area: player.injuryArea ?? null,
    injury_type: player.injuryType ?? null,
    injury_severity: player.injurySeverity ?? null,
    return_date: isoDate(player.returnDate),
    category_history: JSON.stringify(
      Array.isArray(player.categoryHistory) && player.categoryHistory.length > 0
        ? player.categoryHistory
        : [category(player.category)],
    ),
    injury_history: JSON.stringify(
      Array.isArray(player.injuryHistory) ? player.injuryHistory : [],
    ),
  }));


const normalizeOpponent = (value: unknown) =>
  String(value ?? '').trim().toLowerCase();

const upsertCompetitionMatchRows = async (
  supabase: SupabaseClient,
  rows: DbRow[],
): Promise<void> => {
  const result = await upsertRows(supabase, 'competition_matches', rows);
  if (result.savedCount === rows.length) return;

  for (const originalRow of rows) {
    let row = originalRow;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const existingByLegacy = row.legacy_id
        ? await supabase
            .from('competition_matches')
            .select('id')
            .eq('legacy_id', row.legacy_id)
            .limit(1)
            .maybeSingle()
        : { data: null, error: null } as any;
      if (!existingByLegacy.error && existingByLegacy.data?.id) {
        const { error } = await supabase
          .from('competition_matches')
          .update(row)
          .eq('id', existingByLegacy.data.id);
        if (!error) break;
        const missing = missingColumnFromError(error);
        if (missing) {
          row = stripColumns([row], new Set([missing]))[0];
          continue;
        }
      }

      const natural = await supabase
        .from('competition_matches')
        .select('id, opponent')
        .eq('date', row.date)
        .eq('category', row.category);
      if (!natural.error) {
        const match = ((natural.data ?? []) as DbRow[]).find(
          (item) => normalizeOpponent(item.opponent) === normalizeOpponent(row.opponent),
        );
        if (match?.id) {
          const { error } = await supabase
            .from('competition_matches')
            .update(row)
            .eq('id', match.id);
          if (!error) break;
          const missing = missingColumnFromError(error);
          if (missing) {
            row = stripColumns([row], new Set([missing]))[0];
            continue;
          }
        }
      }

      const { error } = await supabase.from('competition_matches').insert(row);
      if (!error) break;
      const missing = missingColumnFromError(error);
      if (missing) {
        row = stripColumns([row], new Set([missing]))[0];
        continue;
      }
      console.warn('[Supabase] competition_matches fallback failed:', error.message);
      break;
    }
  }
};

const competitionExternalLoadRows = (
  data: AppData,
  playerUuid: (legacyId: string) => string | null,
  playerCategoryById: Record<string, ClubCategory>,
): DbRow[] =>
  data.externalLoads
    .filter((record) =>
      (record.movementModule === 'competencia' || String(record.id).startsWith('comp-load-')) &&
      supportsGps(record.category ?? playerCategoryById[record.playerId]) &&
      playerUuid(record.playerId) &&
      isoDate(record.date),
    )
    .map((record) => ({
      legacy_id: record.id,
      player_id: playerUuid(record.playerId),
      microcycle_id: null,
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
      ima: num(record.ima),
      rpe: record.rpe ?? 8,
      total_distance: record.totalDistance ?? null,
      high_speed_distance: record.highSpeedDistance ?? record.hsr ?? null,
      hsr: record.hsr ?? record.highSpeedDistance ?? null,
      sprint_distance: record.sprintDistance ?? null,
      max_velocity: record.maxVelocity ?? null,
      player_load: record.playerLoad ?? null,
      participation: record.participation ?? 'Completa',
      session_type: record.sessionType ?? 'MD',
      movement_type: record.movementType ?? null,
      movement_note: record.movementNote ?? null,
      movement_module: 'competencia',
      logged_by: record.loggedBy ?? null,
    }));

const upsertCompetitionTables = async (
  supabase: SupabaseClient,
  data: AppData,
): Promise<void> => {
  await upsertRows(supabase, 'players', toPlayerRows(data.players));
  const playerMap = await fetchLegacyIdMap(supabase, 'players');
  const playerCategoryById = Object.fromEntries(
    data.players.map((player) => [player.id, category(player.category)]),
  ) as Record<string, ClubCategory>;
  const playerUuid = (legacyId: string) => playerMap[legacyId] ?? null;

  const matchRows = data.competitionMatchSummaries
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
      lineup_formation: record.lineupFormation ?? null,
      lineup_slots: record.lineupSlots ?? [],
      opponent_logo: record.opponentLogo ?? null,
      eyeball_stats: record.eyeballStats ?? null,
      eyeball_first_half_stats: record.eyeballFirstHalfStats ?? null,
      eyeball_second_half_stats: record.eyeballSecondHalfStats ?? null,
    }));

  await upsertCompetitionMatchRows(supabase, matchRows);

  const matchRowsRes = await supabase
    .from('competition_matches')
    .select('id, legacy_id, date, category, opponent');
  if (matchRowsRes.error) throw matchRowsRes.error;

  const normalizeMatchKey = (date?: string | null, cat?: string | null, opponent?: string | null) =>
    `${date ?? ''}::${cat ?? ''}::${normalizeOpponent(opponent)}`;
  const matchLegacyMap: LegacyMap = {};
  const matchKeyMap: LegacyMap = {};
  ((matchRowsRes.data ?? []) as DbRow[]).forEach((row) => {
    if (row.legacy_id) matchLegacyMap[String(row.legacy_id)] = String(row.id);
    matchKeyMap[normalizeMatchKey(row.date, row.category, row.opponent)] = String(row.id);
  });
  const localMatchById = Object.fromEntries(
    data.competitionMatchSummaries.map((match) => [match.id, match]),
  );
  const matchUuid = (record: CompetitionRecord) => {
    if (record.matchId && matchLegacyMap[record.matchId]) return matchLegacyMap[record.matchId];
    const local = record.matchId ? localMatchById[record.matchId] : undefined;
    return matchKeyMap[normalizeMatchKey(local?.date ?? record.date, local?.category ?? record.category, local?.opponent ?? record.opponent)] ?? null;
  };

  await upsertRows(
    supabase,
    'competition_players',
    data.competitionRecords
      .filter((record) => matchUuid(record) && playerUuid(record.playerId))
      .map((record) => ({
        legacy_id: record.id,
        match_id: matchUuid(record),
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
        penalties_saved: record.penaltiesSaved ?? null,
        crosses_defended: record.crossesDefended ?? null,
        footwork_actions: record.footworkActions ?? null,
        medical_status: record.medicalStatus ?? 'Sin lesión',
        injury_kind: record.injuryKind ?? null,
        medical_observation: record.medicalObservation ?? null,
        acc: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? (record.acc ?? null) : null,
        dcc: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? (record.dcc ?? null) : null,
        sprints: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? (record.sprints ?? null) : null,
        rhie: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? (record.rhie ?? null) : null,
        ima: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? (record.ima ?? null) : null,
        total_distance: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? (record.totalDistance ?? null) : null,
        high_speed_distance: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? (record.highSpeedDistance ?? record.hsr ?? null) : null,
        hsr: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? (record.hsr ?? record.highSpeedDistance ?? null) : null,
        sprint_distance: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? (record.sprintDistance ?? null) : null,
        max_velocity: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? (record.maxVelocity ?? null) : null,
        player_load: supportsGps(record.category ?? playerCategoryById[record.playerId]) ? (record.playerLoad ?? null) : null,
        logged_by: record.loggedBy ?? null,
      })),
  );

  await upsertRows(supabase, 'daily_external_loads', competitionExternalLoadRows(data, playerUuid, playerCategoryById));
};

const upsertEvaluationTables = async (
  supabase: SupabaseClient,
  data: AppData,
): Promise<void> => {
  // Las valoraciones no deben re-guardar toda la ficha de todos los jugadores.
  // Primero usamos los jugadores ya existentes en Supabase; si falta alguno,
  // insertamos solo lo necesario para resolver la FK.
  let playerMap = await fetchLegacyIdMap(supabase, "players");
  const referencedPlayerIds = new Set([
    ...data.nutritionRecords.map((record) => record.playerId),
    ...data.cmjRecords.map((record) => record.playerId),
    ...data.neuromuscularRecords.map((record) => record.playerId),
    ...data.fmsRecords.map((record) => record.playerId),
  ]);
  const missingPlayers = data.players.filter(
    (player) => referencedPlayerIds.has(player.id) && !playerMap[player.id],
  );
  if (missingPlayers.length) {
    await upsertRows(supabase, "players", toPlayerRows(missingPlayers));
    playerMap = await fetchLegacyIdMap(supabase, "players");
  }
  const playerUuid = (legacyId: string) => playerMap[legacyId] ?? null;

  await upsertRows(
    supabase,
    "nutrition_records",
    data.nutritionRecords
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
      })),
  );

  await upsertRows(
    supabase,
    "cmj_records",
    data.cmjRecords
      .filter((record) => playerUuid(record.playerId) && isoDate(record.date))
      .map((record) => ({
        legacy_id: record.id,
        player_id: playerUuid(record.playerId),
        date: isoDate(record.date),
        category: category(record.category),
        value: record.value ?? null,
      })),
  );

  await upsertRows(
    supabase,
    "neuromuscular_records",
    data.neuromuscularRecords
      .filter((record) => playerUuid(record.playerId) && isoDate(record.date))
      .map((record) => ({
        legacy_id: record.id,
        player_id: playerUuid(record.playerId),
        date: isoDate(record.date),
        category: category(record.category),
        cmj: record.cmj ?? null,
        sj: record.sj ?? null,
        reactive_jumps: record.reactiveJumps ?? null,
      })),
  );

  await upsertRows(
    supabase,
    "fms_records",
    data.fmsRecords
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
      })),
  );
};

export const saveSupabasePlayersAppData = async (
  supabase: SupabaseClient,
  data: AppData,
  options: { onlyPlayerIds?: string[] } = {},
): Promise<SyncResult> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    console.error("[Supabase] saveSupabasePlayersAppData: not authenticated");
    return { ok: false, reason: "not_authenticated" };
  }

  try {
    const onlyIds = new Set((options.onlyPlayerIds ?? []).filter(Boolean));
    const playersToSave = onlyIds.size
      ? data.players.filter((player) => onlyIds.has(player.id))
      : data.players;
    const result = await upsertRows(supabase, "players", toPlayerRows(playersToSave));
    if (playersToSave.length > 0 && result.savedCount === 0) {
      return { ok: false, reason: "save_players_failed" };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: isAuthError(error) ? "not_authorized" : "save_players_failed",
      error,
    };
  }
};

export const saveSupabaseEvaluationsAppData = async (
  supabase: SupabaseClient,
  data: AppData,
): Promise<SyncResult> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    console.error("[Supabase] saveSupabaseEvaluationsAppData: not authenticated");
    return { ok: false, reason: "not_authenticated" };
  }

  try {
    await upsertEvaluationTables(supabase, data);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: isAuthError(error) ? "not_authorized" : "save_evaluations_failed",
      error,
    };
  }
};


export const saveSupabaseCompetitionAppData = async (
  supabase: SupabaseClient,
  data: AppData,
): Promise<SyncResult> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    console.error('[Supabase] saveSupabaseCompetitionAppData: not authenticated');
    return { ok: false, reason: 'not_authenticated' };
  }

  try {
    await upsertCompetitionTables(supabase, data);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: isAuthError(error) ? 'not_authorized' : 'save_competition_failed',
      error,
    };
  }
};

export const saveSupabaseTablesAppData = async (
  supabase: SupabaseClient,
  data: AppData,
): Promise<SyncResult> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    console.error("[Supabase] saveSupabaseTablesAppData: not authenticated");
    return { ok: false, reason: "not_authenticated" };
  }

  try {
    console.log("[Supabase] Saving data:", {
      players: data.players.length,
      microcycles: data.microcycles.length,
      sessions: data.trainingSessionSummaries.length,
      externalLoads: data.externalLoads.length,
      internalLoads: data.internalLoads.length,
      competition: data.competitionRecords.length,
    });

    await upsertRows(supabase, "players", toPlayerRows(data.players));

    await upsertRows(
      supabase,
      "microcycles",
      data.microcycles
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
        })),
    );

    const playerMap = await fetchLegacyIdMap(supabase, "players");
    const playerCategoryById = Object.fromEntries(
      data.players.map((player) => [player.id, category(player.category)]),
    );
    const microcycleMap = await fetchLegacyIdMap(supabase, "microcycles");
    const playerUuid = (legacyId: string) => playerMap[legacyId] ?? null;
    const microcycleUuid = (legacyId?: string) =>
      legacyId ? (microcycleMap[legacyId] ?? null) : null;

    await upsertRows(
      supabase,
      "daily_wellness",
      data.wellness
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
        })),
    );

    await upsertRows(
      supabase,
      "daily_internal_loads",
      data.internalLoads
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
        })),
    );

    await upsertRows(
      supabase,
      "daily_external_loads",
      data.externalLoads
        .filter(
          (record) =>
            supportsGps(
              record.category ?? playerCategoryById[record.playerId],
            ) &&
            playerUuid(record.playerId) &&
            isoDate(record.date),
        )
        .map((record) => ({
          legacy_id: record.id,
          player_id: playerUuid(record.playerId),
          microcycle_id: microcycleUuid(record.microcycleId),
          date: isoDate(record.date),
          category: "Sub20",
          base_category: record.baseCategory ?? null,
          acting_category: record.actingCategory ?? null,
          session_number: record.sessionNumber ?? null,
          session_id: null,
          minutes: num(record.min),
          acc: num(record.acc),
          dcc: num(record.dcc),
          sprints: num(record.sprints),
          rhie: num(record.rhie),
          ima: num(record.ima),
          rpe: record.rpe ?? null,
          total_distance: record.totalDistance ?? null,
          max_velocity: record.maxVelocity ?? null,
          player_load: record.playerLoad ?? null,
          participation: record.participation ?? null,
          session_type: record.sessionType ?? null,
          movement_type: record.movementType ?? null,
          movement_note: record.movementNote ?? null,
          movement_module: record.movementModule ?? null,
          logged_by: record.loggedBy ?? null,
        })),
    );

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
        .from("training_sessions")
        .upsert(sessionRows, {
          onConflict: "category,date",
          ignoreDuplicates: false,
        });

      if (sessionError) {
        // Si falla (legacy_id podría no estar en la tabla o haber otro conflicto),
        // intentar fila por fila con UPDATE directo.
        for (const row of sessionRows) {
          // Primero INSERT, si falla por duplicate key, hacer UPDATE
          const { error: upsertErr } = await supabase
            .from("training_sessions")
            .upsert(row, {
              onConflict: "category,date",
              ignoreDuplicates: false,
            });

          if (upsertErr) {
            // Último recurso: UPDATE puro por category+date
            await supabase
              .from("training_sessions")
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
              .eq("category", row.category)
              .eq("date", row.date as string);
          }
        }
      }
    }

    // Link loads to the real Supabase training_sessions.id and maintain session_players.
    // This makes each saved session open with its player data instead of only the session header.
    const sessionsLookup = await supabase
      .from("training_sessions")
      .select("id, legacy_id, date, category, session_number");
    if (!sessionsLookup.error) {
      const sessionRowsDb = (sessionsLookup.data ?? []) as DbRow[];
      const sessionByLegacy = Object.fromEntries(
        sessionRowsDb.map((row) => [
          String(row.legacy_id ?? row.id),
          String(row.id),
        ]),
      );
      const sessionByNatural = Object.fromEntries(
        sessionRowsDb.map((row) => [
          `${row.date}::${row.category}::${row.session_number ?? 1}`,
          String(row.id),
        ]),
      );
      const sessionUuidFor = (record: {
        sessionId?: string;
        date: string;
        category?: ClubCategory;
        actingCategory?: ClubCategory;
        sessionNumber?: number;
      }) => {
        if (record.sessionId && sessionByLegacy[record.sessionId])
          return sessionByLegacy[record.sessionId];
        const cat = category(record.category ?? record.actingCategory);
        return (
          sessionByNatural[
            `${isoDate(record.date)}::${cat}::${record.sessionNumber ?? 1}`
          ] ?? null
        );
      };

      await upsertRows(
        supabase,
        "daily_internal_loads",
        data.internalLoads
          .filter(
            (record) => playerUuid(record.playerId) && isoDate(record.date),
          )
          .map((record) => ({
            legacy_id: record.id,
            player_id: playerUuid(record.playerId),
            microcycle_id: microcycleUuid(record.microcycleId),
            date: isoDate(record.date),
            category: category(record.category),
            base_category: record.baseCategory ?? null,
            acting_category: record.actingCategory ?? null,
            session_number: record.sessionNumber ?? null,
            session_id: sessionUuidFor(record),
            rpe: num(record.rpe),
            duration: num(record.duration),
            movement_type: record.movementType ?? null,
            movement_note: record.movementNote ?? null,
            logged_by: record.loggedBy ?? null,
          })),
      );

      await upsertRows(
        supabase,
        "daily_external_loads",
        data.externalLoads
          .filter(
            (record) =>
              supportsGps(
                record.category ?? playerCategoryById[record.playerId],
              ) &&
              playerUuid(record.playerId) &&
              isoDate(record.date),
          )
          .map((record) => ({
            legacy_id: record.id,
            player_id: playerUuid(record.playerId),
            microcycle_id: microcycleUuid(record.microcycleId),
            date: isoDate(record.date),
            category: "Sub20",
            base_category: record.baseCategory ?? null,
            acting_category: record.actingCategory ?? null,
            session_number: record.sessionNumber ?? null,
            session_id: sessionUuidFor(record),
            minutes: num(record.min),
            acc: num(record.acc),
            dcc: num(record.dcc),
            sprints: num(record.sprints),
            rhie: num(record.rhie),
            ima: num(record.ima),
            rpe: record.rpe ?? null,
            total_distance: record.totalDistance ?? null,
            max_velocity: record.maxVelocity ?? null,
            player_load: record.playerLoad ?? null,
            participation: record.participation ?? null,
            session_type: record.sessionType ?? null,
            movement_type: record.movementType ?? null,
            movement_note: record.movementNote ?? null,
            logged_by: record.loggedBy ?? null,
          })),
      );

      const sessionPlayerRows = new Map<string, DbRow>();
      const putSessionPlayer = (row: DbRow) => {
        const key = `${row.session_id}::${row.player_id}`;
        sessionPlayerRows.set(key, {
          ...(sessionPlayerRows.get(key) ?? {}),
          ...row,
        });
      };
      data.internalLoads.forEach((record) => {
        const sid = sessionUuidFor(record);
        const pid = playerUuid(record.playerId);
        if (!sid || !pid) return;
        putSessionPlayer({
          session_id: sid,
          player_id: pid,
          participation: "Completa",
          minutes: num(record.duration),
          rpe: num(record.rpe),
          status: "Registrado",
        });
      });
      data.externalLoads.forEach((record) => {
        const sid = sessionUuidFor(record);
        const pid = playerUuid(record.playerId);
        if (!sid || !pid) return;
        putSessionPlayer({
          session_id: sid,
          player_id: pid,
          participation: record.participation ?? "Completa",
          minutes: num(record.min),
          rpe: num(record.rpe),
          status: "Registrado",
          acc: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? num(record.acc)
            : null,
          dcc: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? num(record.dcc)
            : null,
          sprints: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? num(record.sprints)
            : null,
          rhie: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? num(record.rhie)
            : null,
          ima: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? num(record.ima)
            : null,
        });
      });
      await upsertRows(
        supabase,
        "session_players",
        [...sessionPlayerRows.values()],
        "session_id,player_id",
      );
    } else {
      console.warn(
        "[Supabase] training_sessions lookup failed:",
        sessionsLookup.error.message,
      );
    }

    await upsertRows(
      supabase,
      "competition_matches",
      data.competitionMatchSummaries
        .filter((record) => isoDate(record.date))
        .map((record) => ({
          legacy_id: record.id,
          date: isoDate(record.date),
          category: category(record.category),
          competition_name: record.competitionName ?? "Partido oficial",
          opponent: record.opponent,
          venue: record.venue ?? null,
          goals_for: record.goalsFor ?? null,
          goals_against: record.goalsAgainst ?? null,
          result_type: record.resultType ?? null,
          observation: record.observation ?? null,
          status: record.status ?? null,
          lineup_formation: record.lineupFormation ?? null,
          lineup_slots: record.lineupSlots ?? [],
          opponent_logo: record.opponentLogo ?? null,
          eyeball_stats: record.eyeballStats ?? null,
          eyeball_first_half_stats: record.eyeballFirstHalfStats ?? null,
          eyeball_second_half_stats: record.eyeballSecondHalfStats ?? null,
        })),
    );

    // Mapa robusto para competencia.
    // Si el partido ya existia por fecha+categoria+rival pero con otro legacy_id,
    // Supabase puede ignorar el upsert por el indice unico. En ese caso igual
    // debemos guardar la planilla usando la fila existente del partido.
    const matchRowsRes = await supabase
      .from("competition_matches")
      .select("id, legacy_id, date, category, opponent");
    if (matchRowsRes.error) throw matchRowsRes.error;
    const normalizeMatchKey = (
      date?: string | null,
      cat?: string | null,
      opponent?: string | null,
    ) =>
      `${date ?? ""}::${cat ?? ""}::${String(opponent ?? "")
        .trim()
        .toLowerCase()}`;
    const matchLegacyMap: LegacyMap = {};
    const matchKeyMap: LegacyMap = {};
    ((matchRowsRes.data ?? []) as DbRow[]).forEach((row) => {
      if (row.legacy_id) matchLegacyMap[String(row.legacy_id)] = String(row.id);
      matchKeyMap[normalizeMatchKey(row.date, row.category, row.opponent)] =
        String(row.id);
    });
    const localMatchById = Object.fromEntries(
      data.competitionMatchSummaries.map((match) => [match.id, match]),
    );
    const matchUuid = (record: CompetitionRecord) => {
      if (record.matchId && matchLegacyMap[record.matchId])
        return matchLegacyMap[record.matchId];
      const local = record.matchId ? localMatchById[record.matchId] : undefined;
      return (
        matchKeyMap[
          normalizeMatchKey(
            local?.date ?? record.date,
            local?.category ?? record.category,
            local?.opponent ?? record.opponent,
          )
        ] ?? null
      );
    };

    await upsertRows(
      supabase,
      "competition_players",
      data.competitionRecords
        .filter((record) => matchUuid(record) && playerUuid(record.playerId))
        .map((record) => ({
          legacy_id: record.id,
          match_id: matchUuid(record),
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
          penalties_saved: record.penaltiesSaved ?? null,
          crosses_defended: record.crossesDefended ?? null,
          footwork_actions: record.footworkActions ?? null,
          medical_status: record.medicalStatus ?? "Sin lesión",
          injury_kind: record.injuryKind ?? null,
          medical_observation: record.medicalObservation ?? null,
          acc: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? (record.acc ?? null)
            : null,
          dcc: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? (record.dcc ?? null)
            : null,
          sprints: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? (record.sprints ?? null)
            : null,
          rhie: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? (record.rhie ?? null)
            : null,
          ima: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? (record.ima ?? null)
            : null,
          total_distance: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? (record.totalDistance ?? null)
            : null,
          high_speed_distance: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? (record.highSpeedDistance ?? record.hsr ?? null)
            : null,
          hsr: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? (record.hsr ?? record.highSpeedDistance ?? null)
            : null,
          sprint_distance: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? (record.sprintDistance ?? null)
            : null,
          max_velocity: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? (record.maxVelocity ?? null)
            : null,
          player_load: supportsGps(
            record.category ?? playerCategoryById[record.playerId],
          )
            ? (record.playerLoad ?? null)
            : null,
          logged_by: record.loggedBy ?? null,
        })),
    );

    await upsertRows(
      supabase,
      "daily_external_loads",
      competitionExternalLoadRows(data, playerUuid, playerCategoryById),
    );

    await upsertRows(
      supabase,
      "nutrition_records",
      data.nutritionRecords
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
        })),
    );

    await upsertRows(
      supabase,
      "cmj_records",
      data.cmjRecords
        .filter((record) => playerUuid(record.playerId) && isoDate(record.date))
        .map((record) => ({
          legacy_id: record.id,
          player_id: playerUuid(record.playerId),
          date: isoDate(record.date),
          category: category(record.category),
          value: record.value ?? null,
        })),
    );

    await upsertRows(
      supabase,
      "neuromuscular_records",
      data.neuromuscularRecords
        .filter((record) => playerUuid(record.playerId) && isoDate(record.date))
        .map((record) => ({
          legacy_id: record.id,
          player_id: playerUuid(record.playerId),
          date: isoDate(record.date),
          category: category(record.category),
          cmj: record.cmj ?? null,
          sj: record.sj ?? null,
          reactive_jumps: record.reactiveJumps ?? null,
        })),
    );

    await upsertRows(
      supabase,
      "fms_records",
      data.fmsRecords
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
        })),
    );

    try {
      await upsertRows(
        supabase,
        "strength_sessions",
        (data.strengthSessions ?? []).map((record) => ({
          legacy_id: record.id,
          date: isoDate(record.date),
          category: category(record.category),
          group_name: record.group,
          strength_type: record.type,
          zone: record.zone,
          intent: record.intent ?? null,
          movement_pattern: record.movementPattern ?? null,
          duration_min: record.duration ?? null,
          expected_rpe: record.expectedRpe ?? null,
          objective: record.objective ?? null,
          restrictions: record.restrictions ?? null,
          player_ids: JSON.stringify(record.playerIds ?? []),
          excluded_player_ids: JSON.stringify(record.excludedPlayerIds ?? []),
          exercises: JSON.stringify(record.exercises ?? []),
          adjustments: JSON.stringify(record.adjustments ?? []),
          responses: JSON.stringify(record.responses ?? []),
          created_by: record.createdBy ?? null,
          created_at: record.createdAt ?? new Date().toISOString(),
          status: record.status ?? "Planificada",
        })),
      );
    } catch (error) {
      console.warn(
        "[Supabase] strength_sessions no disponible. Ejecuta SUPABASE_V112_STRENGTH_SESSIONS.sql para sincronizar fuerza.",
        error,
      );
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: isAuthError(error) ? "not_authorized" : "save_failed",
      error,
    };
  }
};
