import type {
  AppData,
  ClubCategory,
  DailyExternalLoadRecord,
  DailyInternalLoadRecord,
  Microcycle,
  Player,
  TrainingSessionSummary,
} from "./types";
import { groupAverage } from "./utils";
import { findMicrocycleByDate } from "./performance-helpers";
import { recordMatchesTrainingSession } from "./relational-data";

export type DerivedSessionStatus =
  | "sin_actividad"
  | "planificada"
  | "parcial"
  | "completa"
  | "cerrada";

export const isAllCategory = (category?: string) =>
  !category || category === "all";
export const sameCategory = (activeCategory: string, itemCategory?: string) =>
  isAllCategory(activeCategory) ||
  !itemCategory ||
  itemCategory === activeCategory;

const recordCountForSession = (
  data: AppData,
  session: TrainingSessionSummary,
) =>
  data.externalLoads.filter((record) =>
    recordMatchesTrainingSession(record, session),
  ).length +
  data.internalLoads.filter((record) =>
    recordMatchesTrainingSession(record, session),
  ).length;

const sessionCanBelongToMicrocycle = (
  session: TrainingSessionSummary,
  microcycleId?: string | null,
) =>
  !microcycleId ||
  !session.microcycleId ||
  session.microcycleId === microcycleId;

export const getSessionForDateAndCategory = (
  data: AppData,
  date: string,
  category: ClubCategory | "all",
  preferredSessionId?: string | null,
  microcycleId?: string | null,
): TrainingSessionSummary | undefined => {
  if (!date) return undefined;
  if (preferredSessionId) {
    const preferred = data.trainingSessionSummaries.find(
      (session) => session.id === preferredSessionId,
    );
    if (
      preferred &&
      preferred.date === date &&
      sameCategory(category, preferred.category) &&
      sessionCanBelongToMicrocycle(preferred, microcycleId)
    )
      return preferred;
  }

  const categorySessions = data.trainingSessionSummaries
    .filter(
      (session) =>
        session.date === date &&
        sameCategory(category, session.category) &&
        sessionCanBelongToMicrocycle(session, microcycleId),
    )
    .sort((a, b) => {
      const countDiff =
        recordCountForSession(data, b) - recordCountForSession(data, a);
      if (countDiff !== 0) return countDiff;
      return (Number(b.sessionNumber) || 0) - (Number(a.sessionNumber) || 0);
    });
  return categorySessions[0];
};

const matchesTrainingSession = (
  record: {
    sessionId?: string;
    date: string;
    category?: string;
    actingCategory?: string;
    sessionNumber?: number;
    playerId: string;
  },
  playerIds: Set<string>,
  session?: TrainingSessionSummary,
  fallbackDate?: string,
  fallbackCategory?: ClubCategory | "all",
) => {
  if (session)
    return (
      playerIds.has(record.playerId) &&
      recordMatchesTrainingSession(record, session)
    );
  return (
    record.date === fallbackDate &&
    playerIds.has(record.playerId) &&
    sameCategory(
      fallbackCategory ?? "all",
      record.category ?? record.actingCategory,
    )
  );
};

export const getSessionPlayersForSession = (
  data: AppData,
  session?: TrainingSessionSummary,
  fallbackDate?: string,
  fallbackCategory?: ClubCategory | "all",
): DailyExternalLoadRecord[] => {
  if (!session && !fallbackDate) return [];
  const playerIds = new Set(
    data.players
      .filter((player) =>
        sameCategory(
          fallbackCategory ?? session?.category ?? "all",
          player.category,
        ),
      )
      .map((player) => player.id),
  );
  const external = data.externalLoads
    .filter((record) =>
      matchesTrainingSession(
        record,
        playerIds,
        session,
        fallbackDate,
        fallbackCategory,
      ),
    )
    .filter(
      (record, index, records) =>
        records.findIndex(
          (item) =>
            item.playerId === record.playerId &&
            (item.sessionId || "") === (record.sessionId || "") &&
            item.date === record.date,
        ) === index,
    );

  if (external.length) return external;

  // Fallback clave para U15/U17 o para sincronizaciones parciales: esas categorias
  // pueden quedar solamente en cargas internas. Convertimos MIN/RPE en filas visibles
  // para que la sesion nunca aparezca vacia despues de refrescar.
  return data.internalLoads
    .filter((record) =>
      matchesTrainingSession(
        record,
        playerIds,
        session,
        fallbackDate,
        fallbackCategory,
      ),
    )
    .map((record) => ({
      id: `internal-${record.id}`,
      sessionId: record.sessionId,
      playerId: record.playerId,
      date: record.date,
      min: record.duration ?? 0,
      rpe: record.rpe ?? 0,
      acc: 0,
      dcc: 0,
      sprints: 0,
      rhie: 0,
      ima: 0,
      participation: "Completa",
      microcycleId: record.microcycleId,
      sessionNumber: record.sessionNumber,
      category: record.category,
      baseCategory: record.baseCategory,
      actingCategory: record.actingCategory,
      movementType: record.movementType,
      movementNote: record.movementNote,
      movementModule: record.movementModule,
      loggedBy: record.loggedBy,
    }));
};

export const getInternalLoadsForSession = (
  data: AppData,
  session?: TrainingSessionSummary,
  fallbackDate?: string,
  fallbackCategory?: ClubCategory | "all",
): DailyInternalLoadRecord[] => {
  if (!session && !fallbackDate) return [];
  const playerIds = new Set(
    data.players
      .filter((player) =>
        sameCategory(
          fallbackCategory ?? session?.category ?? "all",
          player.category,
        ),
      )
      .map((player) => player.id),
  );
  return data.internalLoads.filter((record) => {
    if (session?.id && record.sessionId === session.id) return true;
    if (session) {
      return (
        record.date === session.date &&
        playerIds.has(record.playerId) &&
        sameCategory(
          session.category ?? fallbackCategory ?? "all",
          record.category ?? record.actingCategory,
        ) &&
        (record.sessionNumber ?? session.sessionNumber) ===
          session.sessionNumber
      );
    }
    return (
      record.date === fallbackDate &&
      playerIds.has(record.playerId) &&
      sameCategory(
        fallbackCategory ?? "all",
        record.category ?? record.actingCategory,
      )
    );
  });
};

export const getSessionCompleteness = (
  registeredPlayers: number,
  totalPlayers: number,
  players?: Player[],
) => {
  const eligibleTotal =
    players?.filter(
      (player) =>
        player.status === "Disponible" || player.status === "Molestia",
    ).length ?? totalPlayers;
  if (!eligibleTotal) return 0;
  return Math.round((Math.max(0, registeredPlayers) / eligibleTotal) * 100);
};

export const getSessionStatusForDate = (
  data: AppData,
  date: string,
  category: ClubCategory | "all",
  microcycleId?: string | null,
) => {
  const session = getSessionForDateAndCategory(
    data,
    date,
    category,
    undefined,
    microcycleId,
  );
  const players = data.players.filter((player) =>
    sameCategory(category, player.category),
  );
  const records = getSessionPlayersForSession(data, session, date, category);
  const registeredPlayers = records.filter(
    (record) =>
      (record.min ?? 0) > 0 || (record.rpe ?? 0) > 0 || record.participation,
  ).length;
  const completeness = getSessionCompleteness(
    registeredPlayers,
    players.length,
    players,
  );
  const status: DerivedSessionStatus =
    !session && !registeredPlayers
      ? "sin_actividad"
      : session && !registeredPlayers
        ? "planificada"
        : completeness >= 70
          ? "completa"
          : "parcial";
  return {
    session,
    players,
    records,
    registeredPlayers,
    totalPlayers: players.length,
    completeness,
    status,
  };
};

export const getSessionStatusLabel = (status: DerivedSessionStatus) => {
  if (status === "sin_actividad") return "Sin actividad";
  if (status === "planificada") return "Planificada";
  if (status === "parcial") return "Actividad parcial";
  if (status === "completa") return "Completa";
  return "Cerrada";
};

export const getSessionActionLabel = (status: DerivedSessionStatus) => {
  if (status === "sin_actividad") return "Planificar";
  if (status === "planificada") return "Completar sesión";
  if (status === "parcial" || status === "completa") return "Editar sesión";
  return "Ver sesión";
};

export const getSessionLoadSummary = (records: DailyExternalLoadRecord[]) => {
  const activeRecords = records.filter(
    (record) =>
      (record.min ?? 0) > 0 || (record.rpe ?? 0) > 0 || record.participation,
  );
  const totalMin = activeRecords.reduce(
    (acc, record) => acc + (record.min ?? 0),
    0,
  );
  const totalInternalLoad = activeRecords.reduce(
    (acc, record) => acc + (record.min ?? 0) * (record.rpe ?? 0),
    0,
  );
  return {
    records: activeRecords,
    registeredPlayers: activeRecords.length,
    totalMin,
    totalInternalLoad,
    avgMin: groupAverage(
      activeRecords
        .map((record) => record.min ?? 0)
        .filter((value) => value > 0),
    ),
    avgRpe: groupAverage(
      activeRecords
        .map((record) => record.rpe ?? 0)
        .filter((value) => value > 0),
    ),
    acc: activeRecords.reduce((acc, record) => acc + (record.acc ?? 0), 0),
    dcc: activeRecords.reduce((acc, record) => acc + (record.dcc ?? 0), 0),
    sprints: activeRecords.reduce(
      (acc, record) => acc + (record.sprints ?? 0),
      0,
    ),
    totalDistance: activeRecords.reduce(
      (acc, record) => acc + (record.totalDistance ?? 0),
      0,
    ),
    playerLoad: activeRecords.reduce(
      (acc, record) => acc + (record.playerLoad ?? 0),
      0,
    ),
    highSpeedDistance: activeRecords.reduce(
      (acc, record) => acc + (record.highSpeedDistance ?? record.hsr ?? 0),
      0,
    ),
  };
};

export const getNextSessionNumberForCategory = (
  data: AppData,
  category: ClubCategory | "all",
  microcycleId?: string,
) => {
  const sessions = data.trainingSessionSummaries.filter(
    (session) =>
      sameCategory(category, session.category) &&
      (!microcycleId || session.microcycleId === microcycleId),
  );
  const max = sessions.reduce(
    (acc, session) => Math.max(acc, Number(session.sessionNumber) || 0),
    0,
  );
  return max + 1;
};

export const getSessionNumberForDate = (
  data: AppData,
  date: string,
  category: ClubCategory | "all",
  microcycleId?: string,
  preferredSessionId?: string | null,
) => {
  const existing = getSessionForDateAndCategory(
    data,
    date,
    category,
    preferredSessionId,
    microcycleId,
  );
  if (existing?.sessionNumber) return existing.sessionNumber;
  return getNextSessionNumberForCategory(data, category, microcycleId);
};

export const getMicrocycleDayStatus = (
  data: AppData,
  date: string,
  category: ClubCategory | "all",
  microcycleId?: string | null,
) => {
  const sessionStatus = getSessionStatusForDate(
    data,
    date,
    category,
    microcycleId,
  );
  const summary = getSessionLoadSummary(sessionStatus.records);
  const matches = data.competitionMatchSummaries.filter(
    (match) => match.date === date && sameCategory(category, match.category),
  );
  return {
    ...sessionStatus,
    ...summary,
    matches,
    label: getSessionStatusLabel(sessionStatus.status),
    actionLabel: getSessionActionLabel(sessionStatus.status),
  };
};

export const getMicrocycleForSessionDate = (
  data: AppData,
  date: string,
  category: ClubCategory | "all",
  fallbackMicrocycleId?: string,
): Microcycle | undefined =>
  findMicrocycleByDate(data.microcycles, date, fallbackMicrocycleId, category);
