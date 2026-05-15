import {
  AppData,
  ClubCategory,
  CompetitionMatchSummary,
  CompetitionRecord,
  DailyExternalLoadRecord,
  DailyInternalLoadRecord,
  DailyWellnessRecord,
  GlobalFilters,
  Microcycle,
  Player,
  PlayerStatus,
} from "./types";
import {
  averageWellness,
  calculateInternalLoad,
  getPlayerDayLoad,
  groupAverage,
} from "./utils";
import {
  findMicrocycleByDate,
  formatMatchScore,
  isGoalkeeper,
} from "./performance-helpers";
import { supportsGps } from "./report-utils";
import { getMicrocycleDayStatus } from "./session-derived";
import {
  getCanonicalPlayers,
  getEffectiveExternalLoads,
  getInternalLoadsForDate,
  getRelatedPlayerIds,
  getRelatedPlayerIdSet,
  getWellnessRecordsForDate,
} from "./relational-data";

export type AlertLevel = "critical" | "warning" | "info";

export interface OperationalAlert {
  id: string;
  level: AlertLevel;
  title: string;
  description: string;
  action?: string;
}

export interface DataQualityItem {
  label: string;
  done: number;
  total: number;
  status?: "ok" | "missing" | "partial" | "na";
  note?: string;
}

export interface DailyOperations {
  players: Player[];
  activeMicrocycle?: Microcycle;
  statusCounts: Record<PlayerStatus | "Sin registro", number>;
  wellnessRecords: DailyWellnessRecord[];
  internalRecords: DailyInternalLoadRecord[];
  externalRecords: DailyExternalLoadRecord[];
  sessionSummaries: AppData["trainingSessionSummaries"];
  matchesToday: CompetitionMatchSummary[];
  matchRecordsToday: CompetitionRecord[];
  averages: {
    wellness: number;
    internalLoad: number;
    rpe: number;
    minutes: number;
    externalLoad: number;
  };
  missing: {
    wellness: Player[];
    internal: Player[];
    external: Player[];
  };
  lowWellnessPlayers: Player[];
  highLoadPlayers: Player[];
  alerts: OperationalAlert[];
  tasks: OperationalAlert[];
  dataQualityItems: DataQualityItem[];
  dataQualityPercent: number;
  recentActivity: string[];
}

const toDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const formatDateShort = (value: string) => {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

export const addDays = (value: string, amount: number) => {
  const date = toDate(value);
  if (!date) return "";
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
};

export const eachDateInRange = (startDate: string, endDate: string) => {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end || start > end) return [];
  const result: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && result.length < 42) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
};

export const isSameCategory = (activeCategory: string, category?: string) =>
  activeCategory === "all" || !category || category === activeCategory;

export const getVisiblePlayers = (
  data: AppData,
  filters: GlobalFilters,
  activeCategory: string,
) => {
  const selectedIds =
    filters.playerId === "all"
      ? undefined
      : getRelatedPlayerIds(data.players, filters.playerId);
  const filtered = data.players.filter(
    (player) =>
      isSameCategory(activeCategory, player.category) &&
      (!selectedIds || selectedIds.has(player.id)) &&
      (filters.position === "all" || player.position === filters.position) &&
      (filters.status === "all" || player.status === filters.status),
  );
  return getCanonicalPlayers(data, filtered);
};

const uniqueRecordsByPlayer = <T extends { playerId: string }>(
  records: T[],
) => {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.playerId)) return false;
    seen.add(record.playerId);
    return true;
  });
};

const asRatioItem = (
  label: string,
  done: number,
  total: number,
  note?: string,
): DataQualityItem => {
  const safeTotal = Math.max(total, 0);
  const safeDone = Math.max(0, Math.min(done, safeTotal));
  return {
    label,
    done: safeDone,
    total: safeTotal,
    note,
    status:
      safeTotal === 0
        ? "na"
        : safeDone === safeTotal
          ? "ok"
          : safeDone === 0
            ? "missing"
            : "partial",
  };
};

export const getDataQualityPercent = (items: DataQualityItem[]) => {
  const applicable = items.filter(
    (item) => item.status !== "na" && item.total > 0,
  );
  if (!applicable.length) return 0;
  const score =
    applicable.reduce((acc, item) => acc + item.done / item.total, 0) /
    applicable.length;
  return Math.round(score * 100);
};

export const buildDailyOperations = (
  data: AppData,
  filters: GlobalFilters,
  activeCategory: string,
): DailyOperations => {
  const players = getVisiblePlayers(data, filters, activeCategory);
  const playerIds = getRelatedPlayerIdSet(data.players, players);
  const date = filters.date;
  const gpsEnabled = supportsGps(activeCategory);
  const activeMicrocycle = date
    ? findMicrocycleByDate(
        data.microcycles,
        date,
        filters.microcycleId,
        activeCategory,
      )
    : data.microcycles.find(
        (microcycle) => microcycle.id === filters.microcycleId,
      );

  const wellnessRecords = uniqueRecordsByPlayer(
    getWellnessRecordsForDate(data, date, playerIds),
  );
  const internalRecords = getInternalLoadsForDate(data, date, playerIds);
  const externalRecords = getEffectiveExternalLoads(data, {
    activeCategory,
    date,
    playerIds,
  });
  const sessionSummaries = data.trainingSessionSummaries.filter(
    (summary) =>
      summary.date === date && isSameCategory(activeCategory, summary.category),
  );
  const matchesToday = data.competitionMatchSummaries.filter(
    (match) =>
      match.date === date && isSameCategory(activeCategory, match.category),
  );
  const matchIds = new Set(matchesToday.map((match) => match.id));
  const matchRecordsToday = data.competitionRecords.filter(
    (record) =>
      (matchIds.has(record.matchId ?? "") ||
        (record.date === date &&
          matchesToday.some((match) => match.opponent === record.opponent))) &&
      playerIds.has(record.playerId),
  );

  const missingWellness = players.filter((player) => {
    const relatedIds = getRelatedPlayerIds(data.players, player.id);
    return !wellnessRecords.some((record) => relatedIds.has(record.playerId));
  });
  const playersWithSessionLoad = new Set(
    externalRecords
      .filter((record) => (record.min ?? 0) > 0 || (record.rpe ?? 0) > 0)
      .map((record) => record.playerId),
  );
  const playersWithInternalLoad = new Set([
    ...internalRecords.map((record) => record.playerId),
    ...playersWithSessionLoad,
  ]);
  const missingInternal = players.filter((player) => {
    const relatedIds = getRelatedPlayerIds(data.players, player.id);
    return !Array.from(relatedIds).some((id) =>
      playersWithInternalLoad.has(id),
    );
  });
  const missingExternal = gpsEnabled
    ? players.filter((player) => {
        const relatedIds = getRelatedPlayerIds(data.players, player.id);
        return !externalRecords.some((record) =>
          relatedIds.has(record.playerId),
        );
      })
    : [];
  const lowWellnessPlayers = players.filter((player) => {
    const relatedIds = getRelatedPlayerIds(data.players, player.id);
    const value = averageWellness(
      wellnessRecords.find((record) => relatedIds.has(record.playerId)),
    );
    return value > 0 && value < 3;
  });
  const highLoadPlayers = players.filter((player) => {
    const relatedIds = getRelatedPlayerIds(data.players, player.id);
    const playerInternal = internalRecords.filter((record) =>
      relatedIds.has(record.playerId),
    );
    const playerExternal = externalRecords.filter((record) =>
      relatedIds.has(record.playerId),
    );
    const internalLoad = Math.max(
      ...Array.from(relatedIds).map((id) =>
        getPlayerDayLoad(id, date, {
          internalLoads: playerInternal,
          externalLoads: playerExternal,
        }),
      ),
      0,
    );
    return (
      internalLoad >= 450 ||
      playerExternal.some(
        (external) => (external.rpe ?? 0) >= 8 || (external.min ?? 0) >= 90,
      )
    );
  });

  const dataQualityItems = [
    asRatioItem(
      "Wellness",
      wellnessRecords.length,
      players.length,
      `${wellnessRecords.length}/${players.length} jugadores`,
    ),
    asRatioItem(
      "Carga interna",
      players.length - missingInternal.length,
      players.length,
      `${players.length - missingInternal.length}/${players.length} jugadores`,
    ),
    ...(gpsEnabled
      ? [
          asRatioItem(
            "Carga externa / GPS",
            players.length - missingExternal.length,
            players.length,
            `${players.length - missingExternal.length}/${players.length} jugadores`,
          ),
        ]
      : []),
    asRatioItem(
      "Sesión",
      sessionSummaries.length ? 1 : 0,
      1,
      sessionSummaries.length ? "Sesión registrada" : "Sin sesión del día",
    ),
    matchesToday.length
      ? asRatioItem(
          "Competencia",
          matchRecordsToday.length ? 1 : 0,
          1,
          matchRecordsToday.length
            ? "Partido con planilla"
            : "Partido sin jugadores",
        )
      : {
          label: "Competencia",
          done: 0,
          total: 0,
          status: "na" as const,
          note: "No aplica para esta fecha",
        },
  ];
  const dataQualityPercent = getDataQualityPercent(dataQualityItems);

  const statusCounts: DailyOperations["statusCounts"] = {
    Disponible: players.filter((player) => player.status === "Disponible")
      .length,
    Molestia: players.filter((player) => player.status === "Molestia").length,
    Readaptación: players.filter((player) => player.status === "Readaptación")
      .length,
    Lesionado: players.filter((player) => player.status === "Lesionado").length,
    "Sin registro": missingWellness.length,
  };

  const alerts: OperationalAlert[] = [
    ...players
      .filter((player) => player.status === "Lesionado")
      .map((player) => ({
        id: `injury-${player.id}`,
        level: "critical" as const,
        title: `${player.name} lesionado`,
        description:
          player.injuryArea || player.injuryType
            ? `${player.injuryArea ?? "Zona sin definir"} · ${player.injuryType ?? "Sin detalle"}`
            : "Jugador marcado como lesionado. Requiere seguimiento médico.",
        action: "Revisar perfil del jugador",
      })),
    ...players
      .filter((player) => player.status === "Molestia")
      .map((player) => ({
        id: `discomfort-${player.id}`,
        level: "warning" as const,
        title: `${player.name} con molestia`,
        description:
          "Revisar disponibilidad antes de cargar sesión o competencia.",
        action: "Control preventivo",
      })),
    ...lowWellnessPlayers.map((player) => ({
      id: `wellness-low-${player.id}`,
      level: "warning" as const,
      title: `${player.name} con wellness bajo`,
      description: `Wellness ${averageWellness(wellnessRecords.find((record) => getRelatedPlayerIds(data.players, player.id).has(record.playerId))).toFixed(1)} en la fecha activa.`,
      action: "Revisar carga y estado físico",
    })),
    ...highLoadPlayers.map((player) => ({
      id: `load-high-${player.id}`,
      level: "warning" as const,
      title: `${player.name} con carga elevada`,
      description:
        "La carga del día está en zona alta por MIN, RPE o carga interna.",
      action: "Validar recuperación",
    })),
    ...matchesToday
      .filter(
        (match) =>
          !matchRecordsToday.some((record) => record.matchId === match.id),
      )
      .map((match) => ({
        id: `match-empty-${match.id}`,
        level: "info" as const,
        title: `Partido vs ${match.opponent} sin planilla`,
        description: `${formatMatchScore(match)} · ${match.venue ?? "Local"}. Faltan jugadores del partido.`,
        action: "Revisar partido",
      })),
    ...(activeMicrocycle &&
    (!activeMicrocycle.startDate || !activeMicrocycle.endDate)
      ? [
          {
            id: `mc-range-${activeMicrocycle.id}`,
            level: "warning" as const,
            title: `${activeMicrocycle.name} sin rango de fechas`,
            description:
              "Asigna fecha de inicio y fin para conectar Microciclo, Diario y Sesión.",
            action: "Ir a Microciclo",
          },
        ]
      : []),
  ].slice(0, 12);

  const tasks: OperationalAlert[] = [
    missingWellness.length
      ? {
          id: "task-wellness",
          level: "warning",
          title: `${missingWellness.length} jugadores sin wellness`,
          description: "Registro de wellness pendiente.",
          action: "Cargar wellness",
        }
      : undefined,
    missingInternal.length
      ? {
          id: "task-internal",
          level: "warning",
          title: `${missingInternal.length} jugadores sin carga interna`,
          description:
            "Faltan RPE y duración para consolidar la carga interna.",
          action: "Registrar carga",
        }
      : undefined,
    !sessionSummaries.length
      ? {
          id: "task-session",
          level: "info",
          title: "Sesión del día sin resumen",
          description:
            "Guarda la ficha de sesión para cerrar el día operativo.",
          action: "Crear sesión",
        }
      : undefined,
    activeMicrocycle &&
    (!activeMicrocycle.startDate || !activeMicrocycle.endDate)
      ? {
          id: "task-microcycle",
          level: "warning",
          title: "Microciclo activo incompleto",
          description: "El microciclo seleccionado no tiene rango de fechas.",
          action: "Asignar fechas",
        }
      : undefined,
    matchesToday.some(
      (match) =>
        !matchRecordsToday.some((record) => record.matchId === match.id),
    )
      ? {
          id: "task-match",
          level: "info",
          title: "Partido cargado sin jugadores",
          description: "Planilla de partido pendiente.",
          action: "Actualizar partido",
        }
      : undefined,
  ].filter(Boolean) as OperationalAlert[];

  const recentActivity = [
    ...data.trainingSessionSummaries
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3)
      .map(
        (item) =>
          `Sesión ${item.sessionNumber} · ${formatDateShort(item.date)} · ${item.sessionType}`,
      ),
    ...data.competitionMatchSummaries
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3)
      .map(
        (item) =>
          `Partido vs ${item.opponent} · ${formatDateShort(item.date)} · ${formatMatchScore(item)}`,
      ),
    ...data.microcycles
      .slice()
      .filter((item) => item.startDate || item.endDate)
      .slice(-2)
      .map(
        (item) =>
          `${item.name} · ${formatDateShort(item.startDate)} - ${formatDateShort(item.endDate)}`,
      ),
  ].slice(0, 6);

  return {
    players,
    activeMicrocycle,
    statusCounts,
    wellnessRecords,
    internalRecords,
    externalRecords,
    sessionSummaries,
    matchesToday,
    matchRecordsToday,
    averages: {
      wellness: groupAverage(
        players.map((player) => {
          const relatedIds = getRelatedPlayerIds(data.players, player.id);
          return averageWellness(
            wellnessRecords.find((record) => relatedIds.has(record.playerId)),
          );
        }),
      ),
      internalLoad: groupAverage(
        players.map((player) => {
          const relatedIds = getRelatedPlayerIds(data.players, player.id);
          const playerInternal = internalRecords.filter((record) =>
            relatedIds.has(record.playerId),
          );
          const playerExternal = externalRecords.filter((record) =>
            relatedIds.has(record.playerId),
          );
          return Math.max(
            ...Array.from(relatedIds).map((id) =>
              getPlayerDayLoad(id, date, {
                internalLoads: playerInternal,
                externalLoads: playerExternal,
              }),
            ),
            0,
          );
        }),
      ),
      rpe: groupAverage(
        players.map((player) => {
          const relatedIds = getRelatedPlayerIds(data.players, player.id);
          return groupAverage(
            externalRecords
              .filter((record) => relatedIds.has(record.playerId))
              .map((record) => record.rpe ?? 0)
              .filter((value) => value > 0),
          );
        }),
      ),
      minutes: groupAverage(
        players.map((player) => {
          const relatedIds = getRelatedPlayerIds(data.players, player.id);
          return externalRecords
            .filter((record) => relatedIds.has(record.playerId))
            .reduce((sum, record) => sum + (record.min ?? 0), 0);
        }),
      ),
      externalLoad: groupAverage(
        players.map((player) => {
          const relatedIds = getRelatedPlayerIds(data.players, player.id);
          return externalRecords
            .filter((record) => relatedIds.has(record.playerId))
            .reduce((sum, record) => sum + (record.acc ?? 0), 0);
        }),
      ),
    },
    missing: {
      wellness: missingWellness,
      internal: missingInternal,
      external: missingExternal,
    },
    lowWellnessPlayers,
    highLoadPlayers,
    alerts,
    tasks,
    dataQualityItems,
    dataQualityPercent,
    recentActivity,
  };
};

export const buildMicrocycleWeek = (
  data: AppData,
  microcycle: Microcycle,
  activeCategory: string,
) => {
  if (!microcycle.startDate || !microcycle.endDate) return [];
  const dates = eachDateInRange(microcycle.startDate, microcycle.endDate);
  return dates.map((date) => {
    const dayStatus = getMicrocycleDayStatus(
      data,
      date,
      activeCategory as ClubCategory | "all",
      microcycle.id,
    );
    return {
      date,
      label: formatDateShort(date),
      sessions: dayStatus.session ? [dayStatus.session] : [],
      matches: dayStatus.matches,
      registeredPlayers: dayStatus.registeredPlayers,
      playersCount: dayStatus.totalPlayers,
      avgRpe: dayStatus.avgRpe,
      avgMin: dayStatus.avgMin,
      status: dayStatus.status,
      statusLabel: dayStatus.label,
      actionLabel: dayStatus.actionLabel,
      sessionNumber: dayStatus.session?.sessionNumber,
      sessionId: dayStatus.session?.id,
      actionHref: dayStatus.session
        ? `/sesion-entrenamiento?date=${date}&category=${activeCategory}&sessionId=${dayStatus.session.id}`
        : `/sesion-entrenamiento?date=${date}&category=${activeCategory}`,
      completeness: dayStatus.completeness,
    };
  });
};

export const buildMatchCenterStats = (
  records: CompetitionRecord[],
  players: Player[],
) => {
  const starters = records.filter(
    (record) => record.startingRole === "Titular",
  );
  const substitutes = records.filter(
    (record) => record.startingRole === "Suplente",
  );
  const goalkeepers = records.filter((record) =>
    isGoalkeeper(players.find((player) => player.id === record.playerId)),
  );
  const fieldPlayers = records.filter(
    (record) =>
      !isGoalkeeper(players.find((player) => player.id === record.playerId)),
  );
  const medical = records.filter(
    (record) =>
      record.medicalStatus === "Lesionado" ||
      record.postCompetitionStatus === "Lesionado",
  );
  return {
    starters: starters.length,
    substitutes: substitutes.length,
    goalkeepers: goalkeepers.length,
    goals: fieldPlayers.reduce((acc, item) => acc + (item.goals ?? 0), 0),
    assists: fieldPlayers.reduce((acc, item) => acc + (item.assists ?? 0), 0),
    yellowCards: records.reduce(
      (acc, item) => acc + (item.yellowCards ?? 0),
      0,
    ),
    redCards: records.reduce((acc, item) => acc + (item.redCards ?? 0), 0),
    medical: medical.length,
  };
};
