"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Search,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import { AppHero } from "@/components/app-hero";
import { KpiCard } from "@/components/kpi-card";
import {
  DataQualityPanel,
  EmptyState,
  MicrocycleSetupBanner,
  OperationalAlertPanel,
  useConfirm,
} from "@/components/pro-ui";
import { SessionReportTemplate } from "@/components/session-report";
import { ToneBadge } from "@/components/status-badge";
import { useApp } from "@/context/app-context";
import { downloadCsv } from "@/lib/export";
import { getStaffSession, isMasterRole } from "@/lib/auth";
import { categoryLabel } from "@/lib/labels";
import {
  type ClubCategory,
  type DailyExternalLoadRecord,
  type MovementType,
  type SessionParticipation,
  type TrainingSessionType,
} from "@/lib/types";
import { findMicrocycleByDate, groupAverage } from "@/lib/utils";
import { buildDailyOperations } from "@/lib/operational-helpers";
import {
  getCanonicalPlayers,
  getRelatedPlayerIds,
  getRelatedPlayerIdSet,
  getTrainingSessionsForMicrocycle,
  getWellnessRecordsForDate,
} from "@/lib/relational-data";
import { supportsGps } from "@/lib/report-utils";
import { findDuplicateTrainingSession } from "@/lib/operational-validation";
import {
  getSessionForDateAndCategory,
  getSessionNumberForDate,
  getSessionPlayersForSession,
  getInternalLoadsForSession,
} from "@/lib/session-derived";
import { CsvImporter } from "@/components/csv-importer";
import {
  buildAbruptLoadAlerts,
  buildAvailabilityIndex,
  buildDataInconsistencyAlerts,
  buildLoadWellnessRelation,
  buildPlayerReadinessSemaphores,
  buildPositionComparisonInsights,
  buildRoleLoadControl,
  buildReturnToPlayAlerts,
  buildSelfComparisonInsights,
  buildSessionTypeLoadControl,
  buildWeeklyMonotonyFatigue,
  wellnessReadiness,
} from "@/lib/logic-insights";

// ─── Constants ──────────────────────────────────────────────────────────────
const SESSION_TYPES: {
  value: TrainingSessionType;
  label: string;
  color: string;
}[] = [
  { value: "MD+1", label: "MD+1", color: "#059669" },
  { value: "MD+2", label: "MD+2", color: "#0f766e" },
  { value: "MD-5", label: "MD-5", color: "#2563eb" },
  { value: "MD-4", label: "MD-4", color: "#d97706" },
  { value: "MD-3", label: "MD-3", color: "#be123c" },
  { value: "MD-2", label: "MD-2", color: "#7c3aed" },
  { value: "MD-1", label: "MD-1", color: "#475569" },
  { value: "MD", label: "MD", color: "#111827" },
];
const normalizeSessionType = (value?: string | null): TrainingSessionType =>
  SESSION_TYPES.some((item) => item.value === value)
    ? (value as TrainingSessionType)
    : "MD-3";
const PARTICIPATION_OPTIONS: SessionParticipation[] = [
  "Completa",
  "Parcial",
  "No participa",
  "Gimnasio",
  "Readaptación",
];
const CATEGORIES: ClubCategory[] = ["Sub15", "Sub17", "Sub20"];
const MOVEMENT_OPTIONS: Array<{ value: MovementType; label: string }> = [
  { value: "subio_a_entrenar", label: "Subió a entrenar" },
  { value: "bajo_a_entrenar", label: "Bajó a entrenar" },
];
const GPS_FIELDS = [
  "acc",
  "dcc",
  "sprints",
  "rhie",
  "ima",
  "totalDistance",
  "maxVelocity",
  "playerLoad",
] as const;

const normalizeCat = (v: string | null): ClubCategory | undefined => {
  const n = (v ?? "").toLowerCase().replace(/\s+/g, "");
  if (n === "u20" || n === "sub20") return "Sub20";
  if (n === "u17" || n === "sub17") return "Sub17";
  if (n === "u15" || n === "sub15") return "Sub15";
};

// ─── Types ──────────────────────────────────────────────────────────────────
type RowState = {
  selected: boolean;
  participation: SessionParticipation;
  min: number;
  rpe: number;
  acc: number;
  dcc: number;
  sprints: number;
  rhie: number;
  ima: number;
  totalDistance: number;
  maxVelocity: number;
  playerLoad: number;
  movementType: MovementType;
  movementNote: string;
};
type Msg = { text: string; kind: "error" | "success" | "info" };
const DEFAULT_ROW: RowState = {
  selected: false,
  participation: "Completa",
  min: 0,
  rpe: 0,
  acc: 0,
  dcc: 0,
  sprints: 0,
  rhie: 0,
  ima: 0,
  totalDistance: 0,
  maxVelocity: 0,
  playerLoad: 0,
  movementType: "subio_a_entrenar",
  movementNote: "",
};
const n = (v: number) => (v === 0 ? "" : String(v));

// ─── Message banner ──────────────────────────────────────────────────────────
function MsgBanner({ msg, onClose }: { msg: Msg; onClose: () => void }) {
  const s = {
    error: {
      bg: "#fef2f2",
      bo: "#fecaca",
      tx: "#991b1b",
      ic: <AlertTriangle size={15} />,
    },
    success: {
      bg: "#f0fdf4",
      bo: "#bbf7d0",
      tx: "#065f46",
      ic: <CheckCircle2 size={15} />,
    },
    info: {
      bg: "#eff6ff",
      bo: "#bfdbfe",
      tx: "#1e40af",
      ic: <Zap size={15} />,
    },
  }[msg.kind];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 16px",
        borderRadius: 14,
        background: s.bg,
        border: `1px solid ${s.bo}`,
        color: s.tx,
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>{s.ic}</span>
      <span style={{ flex: 1, lineHeight: 1.45 }}>{msg.text}</span>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          padding: 0,
          display: "grid",
          placeItems: "center",
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function SesionEntrenamientoPage() {
  const searchParams = useSearchParams();
  const {
    data,
    filters,
    setFilters,
    addExternalLoad,
    updateExternalLoad,
    deleteExternalLoad,
    upsertInternalLoad,
    deleteInternalLoad,
    upsertTrainingSessionSummary,
    saveTrainingSessionBundle,
    deleteTrainingSessionSummary,
  } = useApp();

  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCat = (
    master
      ? filters.category === "all"
        ? "Sub20"
        : filters.category
      : session.category
  ) as ClubCategory;
  const ops = useMemo(
    () => buildDailyOperations(data, filters, activeCat),
    [data, filters, activeCat],
  );
  const gps = supportsGps(activeCat);
  const youth = !gps;
  const detectedMc = findMicrocycleByDate(
    data.microcycles,
    filters.date,
    filters.microcycleId,
    activeCat,
  );
  const activeMcId = detectedMc?.id ?? "";

  // UI state
  const [sourceCat, setSourceCat] = useState<ClubCategory>(activeCat);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [sessNumInput, setSessNumInput] = useState(
    filters.sessionNumber ? String(filters.sessionNumber) : "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sessType, setSessType] = useState<TrainingSessionType>("MD-3");
  const [objective, setObjective] = useState("");
  const [observation, setObservation] = useState("");
  const [search, setSearch] = useState("");
  const [globalRpe, setGlobalRpe] = useState("");
  const [globalMin, setGlobalMin] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [histPage, setHistPage] = useState(0);
  const justImported = useRef(false);
  // Evita que un refresco remoto/realtime de Supabase borre la planilla
  // mientras el usuario acaba de importar o guardar datos. En el video del
  // error, Supabase devolvia primero el encabezado de la sesion y la UI
  // reinicializaba las filas en blanco. Estos refs mantienen la planilla
  // local hasta que exista data real para hidratarla.
  const preserveRowsUntilRef = useRef(0);
  const lastHydrationKeyRef = useRef("");
  const rowStatesRef = useRef<Record<string, RowState>>({});
  const { confirm, ConfirmModal } = useConfirm();

  const flash = useCallback(
    (text: string, kind: Msg["kind"] = "info") => setMsg({ text, kind }),
    [],
  );

  // Query params
  useEffect(() => {
    const qd = searchParams.get("date"),
      qc = normalizeCat(searchParams.get("category")),
      qs = searchParams.get("sessionId");
    const next: Partial<typeof filters> = {};
    if (qd && qd !== filters.date) next.date = qd;
    if (master && qc && qc !== filters.category) next.category = qc;
    if (Object.keys(next).length) setFilters(next);
    if (qs && qs !== editingId) setEditingId(qs);
  }, [searchParams]); // eslint-disable-line

  useEffect(() => {
    setSourceCat(activeCat);
  }, [activeCat]);
  useEffect(() => {
    setSessNumInput(filters.sessionNumber ? String(filters.sessionNumber) : "");
  }, [filters.sessionNumber]);

  // Session records
  const summaryRecord = getSessionForDateAndCategory(
    data,
    filters.date,
    activeCat,
    editingId,
    activeMcId,
  );
  const dateSummary = getSessionForDateAndCategory(
    data,
    filters.date,
    activeCat,
    undefined,
    activeMcId,
  );

  useEffect(() => {
    if (dateSummary && editingId !== dateSummary.id) {
      setEditingId(dateSummary.id);
      setSessNumInput(String(dateSummary.sessionNumber || 1));
      setSessType(normalizeSessionType(dateSummary.sessionType));
      setObjective(dateSummary.objective ?? "");
      setObservation(dateSummary.observation ?? "");
      return;
    }
    if (!dateSummary && editingId) {
      const ed = data.trainingSessionSummaries.find((i) => i.id === editingId);
      if (!ed || ed.date !== filters.date || ed.category !== activeCat)
        setEditingId(null);
    }
  }, [
    dateSummary?.id,
    editingId,
    filters.date,
    activeCat,
    data.trainingSessionSummaries,
  ]); // eslint-disable-line

  useEffect(() => {
    setSessType(normalizeSessionType(summaryRecord?.sessionType));
    setObjective(summaryRecord?.objective ?? "");
    setObservation(summaryRecord?.observation ?? "");
  }, [
    summaryRecord?.id,
    summaryRecord?.sessionType,
    summaryRecord?.objective,
    summaryRecord?.observation,
  ]); // eslint-disable-line

  useEffect(() => {
    const sn = getSessionNumberForDate(
      data,
      filters.date,
      activeCat,
      activeMcId,
      editingId,
    );
    setSessNumInput(String(sn || 1));
    if (sn && sn !== filters.sessionNumber) setFilters({ sessionNumber: sn });
  }, [
    summaryRecord?.id,
    filters.date,
    activeCat,
    activeMcId,
    editingId,
    data.trainingSessionSummaries,
  ]); // eslint-disable-line

  const sessionHistory = useMemo(() => {
    const scoped = detectedMc
      ? getTrainingSessionsForMicrocycle(data, detectedMc, activeCat)
      : data.trainingSessionSummaries.filter(
          (i) => i.category === activeCat && !i.microcycleId,
        );
    return scoped.sort((a, b) => b.date.localeCompare(a.date));
  }, [data, detectedMc, activeCat]);
  const HIST_PAGE_SIZE = 12;
  const histPages = Math.ceil(sessionHistory.length / HIST_PAGE_SIZE);
  const histSlice = sessionHistory.slice(
    histPage * HIST_PAGE_SIZE,
    (histPage + 1) * HIST_PAGE_SIZE,
  );

  // Players & rows
  const sessionPlayers = useMemo(
    () =>
      getCanonicalPlayers(
        data,
        data.players.filter((p) => p.category === sourceCat),
      ),
    [data.players, sourceCat],
  );
  const existingRecs = useMemo(
    () =>
      getSessionPlayersForSession(data, summaryRecord, filters.date, activeCat),
    [
      data.externalLoads,
      data.players,
      summaryRecord?.id,
      filters.date,
      activeCat,
    ],
  ); // eslint-disable-line
  const existingInt = useMemo(
    () =>
      getInternalLoadsForSession(data, summaryRecord, filters.date, activeCat),
    [
      data.internalLoads,
      data.players,
      summaryRecord?.id,
      filters.date,
      activeCat,
    ],
  ); // eslint-disable-line

  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  useEffect(() => {
    rowStatesRef.current = rowStates;
  }, [rowStates]);

  const hasUsefulRowState = (states: Record<string, RowState>) =>
    Object.values(states).some(
      (row) =>
        row.selected ||
        row.min > 0 ||
        row.rpe > 0 ||
        row.acc > 0 ||
        row.dcc > 0 ||
        row.sprints > 0 ||
        row.rhie > 0 ||
        row.ima > 0 ||
        row.totalDistance > 0 ||
        row.maxVelocity > 0 ||
        row.playerLoad > 0,
    );

  useEffect(() => {
    const hydrationKey = `${summaryRecord?.id ?? editingId ?? "draft"}|${filters.date}|${activeCat}|${sourceCat}|${sessionPlayers.map((p) => p.id).join(",")}`;
    const keyChanged = lastHydrationKeyRef.current !== hydrationKey;
    const hasExistingRows = existingRecs.length > 0 || existingInt.length > 0;
    const hasCurrentRows = hasUsefulRowState(rowStatesRef.current);

    // Despues de importar/guardar, Supabase puede emitir un refresh con solo
    // el encabezado de la sesion. Si no hay filas reales para hidratar y la
    // planilla actual tiene datos, no la limpiamos.
    if (
      (justImported.current || Date.now() < preserveRowsUntilRef.current) &&
      hasCurrentRows &&
      !hasExistingRows
    ) {
      justImported.current = false;
      lastHydrationKeyRef.current = hydrationKey;
      return;
    }

    // Si seguimos en la misma sesion y llega un refresh vacio, conservar la
    // planilla actual. Solo se permite limpiar cuando cambia fecha/categoria/
    // sesion/fuente de jugadores.
    if (!keyChanged && hasCurrentRows && !hasExistingRows) return;

    const next: Record<string, RowState> = {};
    sessionPlayers.forEach((p) => {
      const ex = existingRecs.find((r) => r.playerId === p.id);
      const exInt = existingInt.find((r) => r.playerId === p.id);
      next[p.id] = {
        selected: !!(ex || exInt),
        participation: ex?.participation ?? "Completa",
        min: ex?.min ?? exInt?.duration ?? 0,
        rpe: ex?.rpe ?? exInt?.rpe ?? 0,
        acc: ex?.acc ?? 0,
        dcc: ex?.dcc ?? 0,
        sprints: ex?.sprints ?? 0,
        rhie: ex?.rhie ?? 0,
        ima: ex?.ima ?? 0,
        totalDistance: ex?.totalDistance ?? 0,
        maxVelocity: ex?.maxVelocity ?? 0,
        playerLoad: ex?.playerLoad ?? 0,
        movementType: (ex?.movementType ??
          exInt?.movementType ??
          "subio_a_entrenar") as MovementType,
        movementNote: ex?.movementNote ?? exInt?.movementNote ?? "",
      };
    });
    lastHydrationKeyRef.current = hydrationKey;
    justImported.current = false;
    setRowStates(next);
  }, [
    summaryRecord?.id,
    editingId,
    filters.date,
    activeCat,
    sourceCat,
    sessionPlayers,
    existingRecs,
    existingInt,
  ]);

  const markRowsDirty = () => {
    preserveRowsUntilRef.current = Date.now() + 60000;
  };

  const updateRow = useCallback((pid: string, patch: Partial<RowState>) => {
    preserveRowsUntilRef.current = Date.now() + 60000;
    setRowStates((prev) => ({
      ...prev,
      [pid]: { ...(prev[pid] ?? DEFAULT_ROW), ...patch },
    }));
  }, []);

  const rows = useMemo(
    () =>
      sessionPlayers.map((p) => ({
        player: p,
        ...(rowStates[p.id] ?? DEFAULT_ROW),
      })),
    [sessionPlayers, rowStates],
  );
  const filteredRows = useMemo(
    () =>
      search.trim()
        ? rows.filter((r) =>
            r.player.name.toLowerCase().includes(search.toLowerCase()),
          )
        : rows,
    [rows, search],
  );
  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const reportRows = selectedRows.length
    ? selectedRows
    : rows.filter((r) =>
        existingRecs.some((rec) =>
          getRelatedPlayerIds(data.players, r.player.id).has(rec.playerId),
        ),
      );
  const absentPlayers = sessionPlayers.filter(
    (p) => !reportRows.some((r) => r.player.id === p.id),
  );
  const sessionPlayerIds = getRelatedPlayerIdSet(data.players, sessionPlayers);
  const sessWellness = getWellnessRecordsForDate(
    data,
    filters.date,
    sessionPlayerIds,
  );

  const sessionLoadMetrics = useMemo(() => {
    const avgMinutes = groupAverage(selectedRows.map((r) => r.min));
    const avgRpe = groupAverage(selectedRows.map((r) => r.rpe));
    const avgInternalLoad = groupAverage(
      selectedRows.map((r) => r.min * r.rpe),
    );
    const avgDistance = groupAverage(selectedRows.map((r) => r.totalDistance));
    const avgAcc = groupAverage(selectedRows.map((r) => r.acc));
    const avgDcc = groupAverage(selectedRows.map((r) => r.dcc));
    const avgPlayerLoad = groupAverage(selectedRows.map((r) => r.playerLoad));
    const wellnessReadinessAvg = groupAverage(
      sessWellness.map((record) => wellnessReadiness(record)),
    );
    return {
      avgMinutes,
      avgRpe,
      avgInternalLoad,
      avgDistance,
      avgAcc,
      avgDcc,
      avgPlayerLoad,
      wellnessReadiness: wellnessReadinessAvg,
      individualLoads: selectedRows.map((r) => r.min * r.rpe),
    };
  }, [selectedRows, sessWellness]);

  const sessionTypeLoadControl = useMemo(
    () => buildSessionTypeLoadControl(sessType, sessionLoadMetrics),
    [sessType, sessionLoadMetrics],
  );

  const abruptLoadAlerts = useMemo(
    () =>
      buildAbruptLoadAlerts({
        players: data.players,
        internalLoads: data.internalLoads,
        externalLoads: data.externalLoads,
        referenceDate: filters.date,
        category: activeCat,
        limit: 5,
      }),
    [
      data.players,
      data.internalLoads,
      data.externalLoads,
      filters.date,
      activeCat,
    ],
  );

  const loadWellnessRelations = useMemo(
    () =>
      buildLoadWellnessRelation({
        players: data.players,
        wellness: data.wellness,
        internalLoads: data.internalLoads,
        externalLoads: data.externalLoads,
        date: filters.date,
        category: activeCat,
        limit: 5,
      }),
    [
      data.players,
      data.wellness,
      data.internalLoads,
      data.externalLoads,
      filters.date,
      activeCat,
    ],
  );

  const readinessRows = useMemo(
    () =>
      buildPlayerReadinessSemaphores({
        players: data.players,
        wellness: data.wellness,
        internalLoads: data.internalLoads,
        externalLoads: data.externalLoads,
        referenceDate: filters.date,
        category: activeCat,
        limit: 6,
      }),
    [
      data.players,
      data.wellness,
      data.internalLoads,
      data.externalLoads,
      filters.date,
      activeCat,
    ],
  );
  const availabilityIndex = useMemo(
    () =>
      buildAvailabilityIndex({
        players: data.players,
        wellness: data.wellness,
        internalLoads: data.internalLoads,
        externalLoads: data.externalLoads,
        referenceDate: filters.date,
        category: activeCat,
      }),
    [
      data.players,
      data.wellness,
      data.internalLoads,
      data.externalLoads,
      filters.date,
      activeCat,
    ],
  );
  const selfComparisonInsights = useMemo(
    () =>
      buildSelfComparisonInsights({
        players: data.players,
        internalLoads: data.internalLoads,
        externalLoads: data.externalLoads,
        referenceDate: filters.date,
        category: activeCat,
        limit: 4,
      }),
    [
      data.players,
      data.internalLoads,
      data.externalLoads,
      filters.date,
      activeCat,
    ],
  );
  const positionComparisonInsights = useMemo(
    () =>
      buildPositionComparisonInsights({
        players: data.players,
        externalLoads: data.externalLoads,
        referenceDate: filters.date,
        category: activeCat,
        limit: 4,
      }),
    [data.players, data.externalLoads, filters.date, activeCat],
  );
  const dataInconsistencyAlerts = useMemo(
    () =>
      buildDataInconsistencyAlerts({
        players: data.players,
        internalLoads: data.internalLoads,
        externalLoads: data.externalLoads,
        competitionRecords: data.competitionRecords,
        referenceDate: filters.date,
        category: activeCat,
        limit: 6,
      }),
    [
      data.players,
      data.internalLoads,
      data.externalLoads,
      data.competitionRecords,
      filters.date,
      activeCat,
    ],
  );

  const roleLoadInsights = useMemo(
    () =>
      buildRoleLoadControl({
        players: data.players,
        competitionRecords: data.competitionRecords,
        internalLoads: data.internalLoads,
        externalLoads: data.externalLoads,
        referenceDate: filters.date,
        category: activeCat,
        limit: 4,
      }),
    [
      data.players,
      data.competitionRecords,
      data.internalLoads,
      data.externalLoads,
      filters.date,
      activeCat,
    ],
  );
  const returnToPlayAlerts = useMemo(
    () =>
      buildReturnToPlayAlerts({
        players: data.players,
        competitionRecords: data.competitionRecords,
        internalLoads: data.internalLoads,
        externalLoads: data.externalLoads,
        referenceDate: filters.date,
        category: activeCat,
        limit: 4,
      }),
    [
      data.players,
      data.competitionRecords,
      data.internalLoads,
      data.externalLoads,
      filters.date,
      activeCat,
    ],
  );
  const weeklyMonotonyInsight = useMemo(
    () =>
      buildWeeklyMonotonyFatigue({
        players: data.players,
        internalLoads: data.internalLoads,
        externalLoads: data.externalLoads,
        referenceDate: filters.date,
        category: activeCat,
      }),
    [
      data.players,
      data.internalLoads,
      data.externalLoads,
      filters.date,
      activeCat,
    ],
  );

  const mcNotice = filters.date
    ? detectedMc
      ? `Microciclo: ${detectedMc.name}`
      : "Sin microciclo para esta fecha."
    : "Sin fecha seleccionada.";

  // Apply global RPE/MIN
  const applyGlobal = () => {
    markRowsDirty();
    const rpe = globalRpe
      ? Math.min(10, Math.max(0, Number(globalRpe) || 0))
      : null;
    const min = globalMin ? Math.max(0, Number(globalMin) || 0) : null;
    setRowStates((prev) => {
      const next = { ...prev };
      rows
        .filter((r) => r.selected)
        .forEach((r) => {
          next[r.player.id] = {
            ...(next[r.player.id] ?? DEFAULT_ROW),
            ...(rpe !== null ? { rpe } : {}),
            ...(min !== null ? { min } : {}),
          };
        });
      return next;
    });
    flash(`Aplicado a ${selectedRows.length} jugadores.`, "success");
  };

  const applyPreset = (preset: {
    label: string;
    min: number;
    rpe: number;
    participation?: SessionParticipation;
  }) => {
    markRowsDirty();
    setRowStates((prev) => {
      const next = { ...prev };
      rows
        .filter((r) => r.selected)
        .forEach((r) => {
          next[r.player.id] = {
            ...(next[r.player.id] ?? DEFAULT_ROW),
            min: preset.min,
            rpe: preset.rpe,
            participation: preset.participation ?? "Completa",
          };
        });
      return next;
    });
    flash(
      `${preset.label} aplicado a ${selectedRows.length} jugadores.`,
      "success",
    );
  };

  // Select all / none / by position
  const selectAll = () => {
    markRowsDirty();
    setRowStates((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        next[r.player.id] = {
          ...(next[r.player.id] ?? DEFAULT_ROW),
          selected: true,
        };
      });
      return next;
    });
  };
  const selectNone = () => {
    markRowsDirty();
    setRowStates((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        next[r.player.id] = {
          ...(next[r.player.id] ?? DEFAULT_ROW),
          selected: false,
        };
      });
      return next;
    });
  };

  // Save
  const saveSession = useCallback(() => {
    if (isSaving) return;
    const parsedNum = Number(sessNumInput);
    if (!sessNumInput.trim() || !Number.isFinite(parsedNum) || parsedNum <= 0) {
      flash("Número de sesión inválido.", "error");
      return;
    }
    if (!filters.date) {
      flash("Selecciona una fecha.", "error");
      return;
    }
    if (!detectedMc) {
      flash(
        "No hay microciclo para esta fecha. Crea el rango en Microciclo.",
        "error",
      );
      return;
    }
    if (!selectedRows.length) {
      flash("Selecciona al menos un jugador.", "error");
      return;
    }
    const badRow = selectedRows.find(
      (r) =>
        r.min < 0 ||
        r.min > 240 ||
        r.rpe < 0 ||
        r.rpe > 10 ||
        (!youth && GPS_FIELDS.some((f) => r[f] < 0)),
    );
    if (badRow) {
      flash(
        `Revisa datos de ${badRow.player.name}: MIN 0-240, RPE 0-10, GPS sin negativos.`,
        "error",
      );
      return;
    }
    const noPartRow = selectedRows.find(
      (r) => r.participation === "No participa" && (r.min > 0 || r.rpe > 0),
    );
    if (noPartRow) {
      flash(
        `${noPartRow.player.name}: "No participa" pero tiene MIN/RPE. Corrígelo.`,
        "error",
      );
      return;
    }
    const dup = findDuplicateTrainingSession(data.trainingSessionSummaries, {
      id: summaryRecord?.id ?? editingId ?? undefined,
      date: filters.date,
      category: activeCat,
      sessionNumber: Number(sessNumInput || filters.sessionNumber || 0),
    });
    if (dup && dup.id !== summaryRecord?.id) {
      setEditingId(dup.id);
      flash(
        `Sesión ${dup.sessionNumber} ya existe para esta fecha. Cargada para edición.`,
        "info",
      );
      return;
    }

    preserveRowsUntilRef.current = Date.now() + 90000;
    setIsSaving(true);
    if (parsedNum !== filters.sessionNumber)
      setFilters({ sessionNumber: parsedNum });
    const sessionId = summaryRecord?.id ?? editingId ?? crypto.randomUUID();
    const summary = {
      id: sessionId,
      date: filters.date,
      category: activeCat,
      microcycleId: activeMcId,
      sessionNumber: parsedNum,
      sessionType: sessType,
      objective,
      observation,
      status: summaryRecord?.status ?? ("Borrador" as const),
    };

    const externalRows = selectedRows.map((row) => {
      const ex = existingRecs.find((r) => r.playerId === row.player.id);
      const movType = sourceCat === activeCat ? "base" : row.movementType;
      return {
        id: ex?.id ?? crypto.randomUUID(),
        sessionId,
        playerId: row.player.id,
        date: filters.date,
        min: row.min,
        rpe: Math.min(10, Math.max(0, row.rpe)),
        acc: youth ? 0 : row.acc,
        dcc: youth ? 0 : row.dcc,
        sprints: youth ? 0 : row.sprints,
        rhie: youth ? 0 : row.rhie,
        ima: youth ? 0 : row.ima,
        totalDistance: youth ? undefined : row.totalDistance,
        maxVelocity: youth ? undefined : row.maxVelocity,
        playerLoad: youth ? undefined : row.playerLoad,
        participation: row.participation,
        microcycleId: activeMcId,
        sessionNumber: parsedNum,
        sessionType: sessType,
        category: activeCat,
        baseCategory: row.player.category ?? sourceCat,
        actingCategory: activeCat,
        movementType: movType,
        movementNote: row.movementNote,
        movementModule: "sesion" as const,
        loggedBy: session.displayName,
      };
    });

    const internalRows = selectedRows.map((row) => {
      const exInt = existingInt.find((r) => r.playerId === row.player.id);
      const movType = sourceCat === activeCat ? "base" : row.movementType;
      return {
        id: exInt?.id ?? crypto.randomUUID(),
        sessionId,
        playerId: row.player.id,
        date: filters.date,
        rpe: Math.min(10, Math.max(0, row.rpe)),
        duration: row.min,
        microcycleId: activeMcId,
        sessionNumber: parsedNum,
        category: activeCat,
        baseCategory: row.player.category ?? sourceCat,
        actingCategory: activeCat,
        movementType: movType,
        movementNote: row.movementNote,
        movementModule: "sesion" as const,
        loggedBy: session.displayName,
      };
    });

    saveTrainingSessionBundle(summary, externalRows, internalRows);

    // Mantener visible la planilla que el usuario acaba de guardar aunque
    // Supabase responda momentaneamente con el encabezado sin las filas.
    preserveRowsUntilRef.current = Date.now() + 90000;
    lastHydrationKeyRef.current = `${sessionId}|${filters.date}|${activeCat}|${sourceCat}|${sessionPlayers.map((p) => p.id).join(",")}`;
    setEditingId(sessionId);
    setIsSaving(false);
    flash(
      summaryRecord
        ? "Sesión actualizada correctamente. ✓ Guardado"
        : "Sesión guardada correctamente. ✓ Guardado",
      "success",
    );
  }, [
    isSaving,
    sessNumInput,
    filters,
    detectedMc,
    selectedRows,
    summaryRecord,
    editingId,
    activeCat,
    activeMcId,
    sessType,
    objective,
    observation,
    data.trainingSessionSummaries,
    existingRecs,
    existingInt,
    sourceCat,
    youth,
    session.displayName,
    addExternalLoad,
    upsertInternalLoad,
    saveTrainingSessionBundle,
    setFilters,
    flash,
  ]);

  const deleteSession = async (sessionId: string) => {
    const t = data.trainingSessionSummaries.find((i) => i.id === sessionId);
    if (!t) return;
    const ok = await confirm({
      title: `¿Eliminar sesión ${t.sessionNumber || "-"} del ${t.date}?`,
      description:
        "Se eliminará la sesión y toda su carga interna/GPS vinculada. No se borra wellness ni perfil del jugador.",
      danger: true,
    });
    if (!ok) return;
    deleteTrainingSessionSummary(sessionId);
    if (editingId === sessionId) setEditingId(null);
    flash("Sesión eliminada.", "info");
  };

  const editSession = (sessionId: string) => {
    preserveRowsUntilRef.current = 0;
    lastHydrationKeyRef.current = "";
    const t = data.trainingSessionSummaries.find((i) => i.id === sessionId);
    if (!t) return;
    setFilters({
      date: t.date,
      microcycleId: t.microcycleId,
      sessionNumber: t.sessionNumber,
      category: t.category ?? activeCat,
    });
    setSessType(normalizeSessionType(t.sessionType));
    setObjective(t.objective ?? "");
    setObservation(t.observation ?? "");
    setEditingId(t.id);
    setSessNumInput(String(t.sessionNumber || 1));
    flash(
      `Editando sesión ${t.sessionNumber || "-"} · ${categoryLabel(t.category ?? activeCat)} · ${t.date}`,
      "info",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const duplicateSession = async (sessionId: string) => {
    const t = data.trainingSessionSummaries.find((i) => i.id === sessionId);
    if (!t) return;
    const newId = crypto.randomUUID();
    const nextNum = (t.sessionNumber || 0) + 1;
    upsertTrainingSessionSummary({
      ...t,
      id: newId,
      date: filters.date,
      sessionNumber: nextNum,
      status: "Borrador",
      objective: t.objective,
      observation: "",
    });
    const loadsForSession = data.externalLoads.filter(
      (l) => l.sessionId === t.id,
    );
    loadsForSession.forEach((l) =>
      addExternalLoad({
        ...l,
        id: crypto.randomUUID(),
        sessionId: newId,
        date: filters.date,
        sessionNumber: nextNum,
      }),
    );
    const intForSession = data.internalLoads.filter(
      (l) => l.sessionId === t.id,
    );
    intForSession.forEach((l) =>
      upsertInternalLoad({
        ...l,
        id: crypto.randomUUID(),
        sessionId: newId,
        date: filters.date,
        sessionNumber: nextNum,
      }),
    );
    setEditingId(newId);
    setSessNumInput(String(nextNum));
    flash(
      `Sesión ${t.sessionNumber} duplicada como sesión ${nextNum} para ${filters.date}.`,
      "success",
    );
  };

  const handleCsvImport = (records: Omit<DailyExternalLoadRecord, "id">[]) => {
    justImported.current = true;
    preserveRowsUntilRef.current = Date.now() + 90000;
    setRowStates((prev) => {
      const next = { ...prev };
      records.forEach((r) => {
        next[r.playerId] = {
          selected: true,
          participation:
            (r.participation as SessionParticipation) ?? "Completa",
          min: r.min ?? 0,
          rpe:
            r.rpe && r.rpe > 0
              ? Math.min(10, Math.max(0, r.rpe))
              : (prev[r.playerId]?.rpe ?? 0),
          acc: r.acc ?? 0,
          dcc: r.dcc ?? 0,
          sprints: r.sprints ?? 0,
          rhie: r.rhie ?? 0,
          ima: r.ima ?? 0,
          totalDistance: r.totalDistance ?? 0,
          maxVelocity: r.maxVelocity ?? 0,
          playerLoad: r.playerLoad ?? 0,
          movementType:
            (r.movementType as MovementType) ??
            prev[r.playerId]?.movementType ??
            "subio_a_entrenar",
          movementNote: prev[r.playerId]?.movementNote ?? "",
        };
      });
      return next;
    });
    setShowCsv(false);
    flash(
      `${records.length} jugadores importados en la planilla. Revisa RPE y guarda la sesión para persistirlos en Supabase.`,
      "success",
    );
  };

  const updateStatus = (
    status: "Borrador" | "En revisión" | "Cerrada" | "Reabierta",
  ) => {
    if (!summaryRecord) return;
    upsertTrainingSessionSummary({ ...summaryRecord, status });
    flash(
      status === "Cerrada" ? "Sesión cerrada." : "Sesión reabierta.",
      "info",
    );
  };

  const sessTypeInfo =
    SESSION_TYPES.find((s) => s.value === sessType) || SESSION_TYPES[1];

  return (
    <>
      <div className="grid no-print">
        <AppHero
          title="Ficha técnica de entrenamiento"
          subtitle={`${categoryLabel(activeCat)}${gps ? " · GPS Catapult" : " · Carga interna"}`}
        />
        {ops.activeMicrocycle && (!ops.activeMicrocycle.startDate || !ops.activeMicrocycle.endDate) ? (
          <MicrocycleSetupBanner microcycleName={ops.activeMicrocycle.name} />
        ) : null}

        {/* Alerts row */}
        <div className="grid grid-2">
          <DataQualityPanel
            percent={ops.dataQualityPercent}
            items={ops.dataQualityItems}
          />
          <OperationalAlertPanel
            title="Alertas de sesión"
            alerts={ops.alerts}
          />
        </div>

        {msg && <MsgBanner msg={msg} onClose={() => setMsg(null)} />}

        {/* ── CONFIG CARD ──────────────────────────────────────────────── */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <div>
              <div className="section-eyebrow">Sesión</div>
              <h3 style={{ margin: "4px 0 0" }}>Configuración</h3>
              <div className="muted-line" style={{ marginTop: 6 }}>
                {mcNotice}
              </div>
              {summaryRecord && (
                <div
                  style={{
                    marginTop: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 12px",
                    borderRadius: 999,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#1d4ed8",
                  }}
                >
                  <CheckCircle2 size={13} />
                  Editando sesión {summaryRecord.sessionNumber} ·{" "}
                  {summaryRecord.date}
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      background:
                        summaryRecord.status === "Cerrada"
                          ? "#fee2e2"
                          : "#dcfce7",
                      color:
                        summaryRecord.status === "Cerrada"
                          ? "#991b1b"
                          : "#065f46",
                      fontSize: 11,
                    }}
                  >
                    {summaryRecord.status ?? "Borrador"}
                  </span>
                </div>
              )}
            </div>
            <div className="btn-row" style={{ flexWrap: "wrap" }}>
              {/* CSV import moved to planilla toolbar */}
              {summaryRecord && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() =>
                    updateStatus(
                      summaryRecord.status === "Cerrada"
                        ? "Reabierta"
                        : "Cerrada",
                    )
                  }
                >
                  {summaryRecord.status === "Cerrada"
                    ? "Reabrir"
                    : "Cerrar sesión"}
                </button>
              )}
              {summaryRecord && (
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => deleteSession(summaryRecord.id)}
                >
                  Eliminar
                </button>
              )}
              {summaryRecord && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    preserveRowsUntilRef.current = 0;
                    lastHydrationKeyRef.current = "";
                    setEditingId(null);
                    setMsg(null);
                  }}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </div>

          {/* Type pills */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            {SESSION_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSessType(t.value)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: `2px solid ${sessType === t.value ? t.color : "#e2e8f0"}`,
                  background: sessType === t.value ? t.color : "transparent",
                  color: sessType === t.value ? "#fff" : "#64748b",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all .15s",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-4">
            <div className="field">
              <label>Fecha</label>
              <input
                className="input"
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>N° de sesión</label>
              <input
                className="input"
                type="number"
                min="1"
                value={sessNumInput}
                onChange={(e) => {
                  setSessNumInput(e.target.value);
                  const nn = Number(e.target.value);
                  if (Number.isFinite(nn) && nn > 0)
                    setFilters({ sessionNumber: nn });
                }}
              />
              <div className="field-help">
                {summaryRecord ? "Editable" : "Siguiente sugerido"}
              </div>
            </div>
            <div className="field">
              <label>Objetivo</label>
              <input
                className="input"
                value={objective}
                placeholder="Objetivo del entrenamiento"
                onChange={(e) => setObjective(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Observación</label>
              <input
                className="input"
                value={observation}
                placeholder="Resumen del trabajo"
                onChange={(e) => setObservation(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── QUICK KPIS ──────────────────────────────────────────────── */}
        <div className="grid grid-4">
          <KpiCard
            label="Jugadores incluidos"
            value={String(selectedRows.length)}
            tone="green"
            trend="Seleccionados"
          />
          <KpiCard
            label="RPE promedio"
            value={groupAverage(selectedRows.map((r) => r.rpe)).toFixed(1)}
            tone="amber"
            trend="Esfuerzo"
          />
          <KpiCard
            label="MIN promedio"
            value={groupAverage(selectedRows.map((r) => r.min)).toFixed(0)}
            tone="dark"
            trend="Volumen"
          />
          <KpiCard
            label={gps ? "Dist. promedio" : "Carga total"}
            value={
              gps
                ? `${Math.round(groupAverage(selectedRows.map((r) => r.totalDistance)))} m`
                : `${Math.round(selectedRows.reduce((s, r) => s + r.min * r.rpe, 0))} UA`
            }
            tone="blue"
            trend={gps ? "GPS" : "Interna"}
          />
        </div>

        <div className="grid grid-2">
          <div className="card compact-card">
            <div className="section-eyebrow">Lógica de carga</div>
            <h3 style={{ margin: "4px 0 8px" }}>
              {sessionTypeLoadControl.title}
            </h3>
            <div
              className={`alert-item tone-${sessionTypeLoadControl.tone === "red" ? "red" : sessionTypeLoadControl.tone === "yellow" ? "yellow" : "green"}`}
            >
              <strong>{sessionTypeLoadControl.value}</strong> ·{" "}
              {sessionTypeLoadControl.description}
            </div>
            <div
              className={`alert-item tone-${availabilityIndex.tone === "red" ? "red" : availabilityIndex.tone === "yellow" ? "yellow" : "green"}`}
              style={{ marginTop: 8 }}
            >
              <strong>{availabilityIndex.title}</strong> ·{" "}
              {availabilityIndex.value}
              <br />
              {availabilityIndex.description}
            </div>
          </div>
          <div className="card compact-card">
            <div className="section-eyebrow">Semáforo integral</div>
            <h3 style={{ margin: "4px 0 8px" }}>Disponibilidad individual</h3>
            <div className="grid" style={{ gap: 8 }}>
              {readinessRows.slice(0, 5).map((row) => (
                <div
                  key={row.playerId}
                  className={`alert-item tone-${row.tone === "red" ? "red" : row.tone === "yellow" ? "yellow" : "green"}`}
                >
                  <strong>{row.name}</strong> · {row.label} ·{" "}
                  {Math.round(row.score)}%<br />
                  {row.detail}
                </div>
              ))}
              {!readinessRows.length ? (
                <div className="empty">
                  Sin datos suficientes para calcular semáforo integral.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card compact-card">
            <div className="section-eyebrow">Alertas automáticas</div>
            <h3 style={{ margin: "4px 0 8px" }}>
              Aumento brusco, wellness e incoherencias
            </h3>
            <div className="grid" style={{ gap: 8 }}>
              {[
                ...dataInconsistencyAlerts,
                ...abruptLoadAlerts,
                ...loadWellnessRelations,
              ]
                .slice(0, 5)
                .map((alert) => (
                  <div
                    key={alert.id}
                    className={`alert-item tone-${alert.tone === "red" ? "red" : alert.tone === "yellow" ? "yellow" : "blue"}`}
                  >
                    <strong>{alert.title}</strong>
                    {alert.value ? ` · ${alert.value}` : ""}
                    <br />
                    {alert.description}
                  </div>
                ))}
              {![
                ...dataInconsistencyAlerts,
                ...abruptLoadAlerts,
                ...loadWellnessRelations,
              ].length ? (
                <div className="empty">
                  Sin alertas críticas de carga, wellness o coherencia para la
                  fecha activa.
                </div>
              ) : null}
            </div>
          </div>
          <div className="card compact-card">
            <div className="section-eyebrow">Comparaciones inteligentes</div>
            <h3 style={{ margin: "4px 0 8px" }}>
              Jugador vs sí mismo y posición
            </h3>
            <div className="grid" style={{ gap: 8 }}>
              {[...selfComparisonInsights, ...positionComparisonInsights]
                .slice(0, 5)
                .map((insight) => (
                  <div
                    key={insight.id}
                    className={`alert-item tone-${insight.tone === "red" ? "red" : insight.tone === "yellow" ? "yellow" : "blue"}`}
                  >
                    <strong>{insight.title}</strong>
                    {insight.value ? ` · ${insight.value}` : ""}
                    <br />
                    {insight.description}
                  </div>
                ))}
              {![...selfComparisonInsights, ...positionComparisonInsights]
                .length ? (
                <div className="empty">
                  Sin desviaciones relevantes frente al historial individual o
                  pares de posición.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card compact-card">
            <div className="section-eyebrow">Retorno, rol y competencia</div>
            <h3 style={{ margin: "4px 0 8px" }}>
              Control individual por contexto
            </h3>
            <div className="grid" style={{ gap: 8 }}>
              {[...returnToPlayAlerts, ...roleLoadInsights]
                .slice(0, 5)
                .map((insight) => (
                  <div
                    key={insight.id}
                    className={`alert-item tone-${insight.tone === "red" ? "red" : insight.tone === "yellow" ? "yellow" : "blue"}`}
                  >
                    <strong>{insight.title}</strong>
                    {insight.value ? ` · ${insight.value}` : ""}
                    <br />
                    {insight.description}
                  </div>
                ))}
              {![...returnToPlayAlerts, ...roleLoadInsights].length ? (
                <div className="empty">
                  Sin alertas de retorno o rol competitivo para la fecha activa.
                </div>
              ) : null}
            </div>
          </div>
          <div className="card compact-card">
            <div className="section-eyebrow">Microciclo</div>
            <h3 style={{ margin: "4px 0 8px" }}>
              Monotonía, strain y decisión semanal
            </h3>
            <div
              className={`alert-item tone-${weeklyMonotonyInsight.tone === "red" ? "red" : weeklyMonotonyInsight.tone === "yellow" ? "yellow" : "green"}`}
            >
              <strong>{weeklyMonotonyInsight.title}</strong> ·{" "}
              {weeklyMonotonyInsight.value}
              <br />
              {weeklyMonotonyInsight.description}
            </div>
            <p className="muted-line" style={{ marginTop: 8 }}>
              Esta lectura ayuda a evitar semanas planas de carga, picos no
              progresivos y decisiones iguales para jugadores con respuestas
              distintas.
            </p>
          </div>
        </div>

        {/* ── PLANILLA CARD ────────────────────────────────────────────── */}
        <div className="card">
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div>
              <div className="section-eyebrow">Planilla</div>
              <h3 style={{ margin: "4px 0 0" }}>
                Participación y carga individual
              </h3>
              <div className="muted-line" style={{ marginTop: 4 }}>
                {categoryLabel(activeCat)} · {filters.date || "Sin fecha"} ·{" "}
                {detectedMc?.name ?? "Sin microciclo"} · Sesión{" "}
                {sessNumInput || "—"}
              </div>
            </div>
            <div className="btn-row" style={{ flexWrap: "wrap" }}>
              <div className="field" style={{ margin: 0 }}>
                <select
                  className="select"
                  value={sourceCat}
                  onChange={(e) => setSourceCat(e.target.value as ClubCategory)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  setViewMode((v) => (v === "cards" ? "table" : "cards"))
                }
              >
                {viewMode === "cards" ? "Vista tabla" : "Vista tarjetas"}
              </button>
              {gps && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowCsv(true)}
                >
                  <Upload size={14} /> Importar CSV GPS
                </button>
              )}
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  downloadCsv(
                    `sesion-${activeCat}.csv`,
                    selectedRows.map((r) => ({
                      fecha: filters.date,
                      jugador: r.player.name,
                      minutos: r.min,
                      rpe: r.rpe,
                    })),
                  )
                }
              >
                Exportar CSV
              </button>
              <button
                type="button"
                className="btn"
                disabled={isSaving}
                onClick={saveSession}
                style={{ minWidth: 140 }}
              >
                {isSaving
                  ? "Guardando…"
                  : summaryRecord
                    ? "Actualizar sesión"
                    : "Guardar sesión"}
              </button>
            </div>
          </div>

          {/* Toolbar: search + select all + global RPE/MIN */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 14,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            {/* Search */}
            <div style={{ position: "relative", flex: "1", minWidth: 180 }}>
              <Search
                size={13}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
              />
              <input
                className="input"
                placeholder="Buscar jugador…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 30, height: 38 }}
              />
            </div>
            {/* Select controls */}
            <div className="btn-row" style={{ gap: 6 }}>
              <button
                type="button"
                className="btn secondary"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={selectAll}
              >
                <Users size={12} /> Todos
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={selectNone}
              >
                Ninguno
              </button>
            </div>
            {/* Global apply */}
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                className="input"
                type="number"
                min={0}
                max={10}
                step={0.5}
                placeholder="RPE global"
                value={globalRpe}
                onChange={(e) => setGlobalRpe(e.target.value)}
                style={{ width: 110, height: 38 }}
              />
              <input
                className="input"
                type="number"
                min={0}
                max={240}
                placeholder="MIN global"
                value={globalMin}
                onChange={(e) => setGlobalMin(e.target.value)}
                style={{ width: 110, height: 38 }}
              />
              <button
                type="button"
                className="btn secondary"
                style={{ padding: "6px 12px", fontSize: 12, height: 38 }}
                onClick={applyGlobal}
                disabled={!selectedRows.length}
              >
                <Zap size={12} /> Aplicar a seleccionados
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ padding: "6px 12px", fontSize: 12, height: 38 }}
                disabled={!selectedRows.length}
                onClick={() => applyPreset({ label: "Base", min: 70, rpe: 4 })}
              >
                Base 70/4
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ padding: "6px 12px", fontSize: 12, height: 38 }}
                disabled={!selectedRows.length}
                onClick={() =>
                  applyPreset({ label: "Recuperación", min: 35, rpe: 3 })
                }
              >
                Rec 35/3
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ padding: "6px 12px", fontSize: 12, height: 38 }}
                disabled={!selectedRows.length}
                onClick={() =>
                  applyPreset({
                    label: "No participa",
                    min: 0,
                    rpe: 0,
                    participation: "No participa",
                  })
                }
              >
                No participa
              </button>
            </div>
          </div>

          {/* CARDS view */}
          {viewMode === "cards" && (
            <div className="session-player-grid mobile-clean-grid">
              {filteredRows.map((row) => {
                const invited = sourceCat !== activeCat;
                const hasGps = row.playerLoad > 0 || row.totalDistance > 0;
                const needRpe = row.selected && row.min > 0 && row.rpe === 0;
                const state = !row.selected
                  ? "state-empty"
                  : row.min > 0 && row.rpe > 0
                    ? "state-complete"
                    : "state-partial";
                const validateRow = () => {
                  if (row.min > 240) return "MIN máximo 240";
                  if (row.rpe > 10) return "RPE máximo 10";
                  if (row.participation === "No participa" && row.min > 0)
                    return '"No participa" con MIN > 0';
                  return null;
                };
                const err = validateRow();
                return (
                  <div
                    key={row.player.id}
                    className={`session-player-card ${state}${err ? " has-error" : ""}`}
                  >
                    <div className="session-player-header">
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <strong style={{ fontSize: 13 }}>
                            {row.player.name}
                          </strong>
                          {row.player.jerseyNumber ? (
                            <span className="jersey-badge">
                              #{row.player.jerseyNumber}
                            </span>
                          ) : null}
                        </div>
                        <div className="muted-line">
                          {row.player.position} ·{" "}
                          {categoryLabel(row.player.category)}
                        </div>
                        {invited && (
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#1d4ed8",
                            }}
                          >
                            Invitado en {categoryLabel(activeCat)}
                          </div>
                        )}
                        {hasGps && (
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#059669",
                            }}
                          >
                            📡 GPS · ingresa RPE
                          </div>
                        )}
                        {needRpe && (
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#dc2626",
                            }}
                          >
                            ⚠ RPE requerido
                          </div>
                        )}
                        {err && (
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#dc2626",
                            }}
                          >
                            ✗ {err}
                          </div>
                        )}
                      </div>
                      <div
                        className="btn-row"
                        style={{ alignItems: "flex-start", gap: 8 }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) =>
                              updateRow(row.player.id, {
                                selected: e.target.checked,
                              })
                            }
                          />
                          Incluir
                        </label>
                        <ToneBadge
                          text={row.player.status}
                          tone={
                            row.player.status === "Disponible"
                              ? "green"
                              : row.player.status === "Molestia"
                                ? "yellow"
                                : row.player.status === "Readaptación"
                                  ? "orange"
                                  : "red"
                          }
                        />
                      </div>
                    </div>
                    <div
                      className={`grid session-fields-grid ${youth ? "session-simple-grid" : "session-metrics-grid"}`}
                    >
                      <div className="field">
                        <label>Participación</label>
                        <select
                          className="select session-input-large"
                          value={row.participation}
                          onChange={(e) =>
                            updateRow(row.player.id, {
                              participation: e.target
                                .value as SessionParticipation,
                            })
                          }
                        >
                          {PARTICIPATION_OPTIONS.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Minutos</label>
                        <input
                          className="input session-input-large"
                          type="number"
                          value={n(row.min)}
                          style={
                            row.min > 240 ? { borderColor: "#fca5a5" } : {}
                          }
                          onChange={(e) =>
                            updateRow(row.player.id, {
                              min: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="field">
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          RPE
                          {needRpe && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#dc2626",
                                fontWeight: 800,
                              }}
                            >
                              *
                            </span>
                          )}
                        </label>
                        <input
                          className="input session-input-large"
                          type="number"
                          min={0}
                          max={10}
                          value={n(row.rpe)}
                          style={
                            needRpe
                              ? {
                                  borderColor: "#fca5a5",
                                  background: "#fff5f5",
                                }
                              : row.rpe > 10
                                ? { borderColor: "#fca5a5" }
                                : {}
                          }
                          onChange={(e) =>
                            updateRow(row.player.id, {
                              rpe: Math.min(
                                10,
                                Math.max(0, Number(e.target.value) || 0),
                              ),
                            })
                          }
                        />
                      </div>
                      {invited && (
                        <>
                          <div className="field">
                            <label>Movimiento</label>
                            <select
                              className="select session-input-large"
                              value={row.movementType}
                              onChange={(e) =>
                                updateRow(row.player.id, {
                                  movementType: e.target.value as MovementType,
                                })
                              }
                            >
                              {MOVEMENT_OPTIONS.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>Nota</label>
                            <input
                              className="input session-input-large"
                              value={row.movementNote}
                              onChange={(e) =>
                                updateRow(row.player.id, {
                                  movementNote: e.target.value,
                                })
                              }
                            />
                          </div>
                        </>
                      )}
                      {!youth && row.player.position !== "Portero" && (
                        <>
                          <div className="field">
                            <label>Aceleraciones</label>
                            <input
                              className="input session-input-large"
                              type="number"
                              value={n(row.acc)}
                              onChange={(e) =>
                                updateRow(row.player.id, {
                                  acc: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="field">
                            <label>Desaceleraciones</label>
                            <input
                              className="input session-input-large"
                              type="number"
                              value={n(row.dcc)}
                              onChange={(e) =>
                                updateRow(row.player.id, {
                                  dcc: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="field">
                            <label>Sprint efforts</label>
                            <input
                              className="input session-input-large"
                              type="number"
                              value={n(row.sprints)}
                              onChange={(e) =>
                                updateRow(row.player.id, {
                                  sprints: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="field">
                            <label>RHIE</label>
                            <input
                              className="input session-input-large"
                              type="number"
                              value={n(row.rhie)}
                              onChange={(e) =>
                                updateRow(row.player.id, {
                                  rhie: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="field">
                            <label>IMA</label>
                            <input
                              className="input session-input-large"
                              type="number"
                              value={n(row.ima)}
                              onChange={(e) =>
                                updateRow(row.player.id, {
                                  ima: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="field">
                            <label>Distancia (m)</label>
                            <input
                              className="input session-input-large"
                              type="number"
                              value={n(row.totalDistance)}
                              onChange={(e) =>
                                updateRow(row.player.id, {
                                  totalDistance: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="field">
                            <label>Vel. máxima (km/h)</label>
                            <input
                              className="input session-input-large"
                              type="number"
                              step="0.1"
                              value={n(row.maxVelocity)}
                              onChange={(e) =>
                                updateRow(row.player.id, {
                                  maxVelocity: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="field">
                            <label>Player Load</label>
                            <input
                              className="input session-input-large"
                              type="number"
                              value={n(row.playerLoad)}
                              onChange={(e) =>
                                updateRow(row.player.id, {
                                  playerLoad: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {!filteredRows.length && (
                <EmptyState title="Sin resultados" text="Ajusta la búsqueda." />
              )}
            </div>
          )}

          {/* TABLE view */}
          {viewMode === "table" && (
            <div className="table-wrap" style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 30 }}></th>
                    <th style={{ textAlign: "left", minWidth: 160 }}>
                      Jugador
                    </th>
                    <th>Participación</th>
                    <th>MIN</th>
                    <th>RPE</th>
                    {!youth && (
                      <>
                        <th>ACC</th>
                        <th>DCC</th>
                        <th>Sprint</th>
                        <th>RHIE</th>
                        <th>IMA</th>
                        <th>Dist.</th>
                        <th>Vel.</th>
                        <th>PL</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const needRpe =
                      row.selected && row.min > 0 && row.rpe === 0;
                    return (
                      <tr
                        key={row.player.id}
                        style={row.selected ? { background: "#f0f9ff" } : {}}
                      >
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) =>
                              updateRow(row.player.id, {
                                selected: e.target.checked,
                              })
                            }
                          />
                        </td>
                        <td>
                          <strong style={{ fontSize: 12 }}>
                            {row.player.name}
                          </strong>
                          <div style={{ fontSize: 10, color: "#94a3b8" }}>
                            {row.player.position}
                          </div>
                        </td>
                        <td>
                          <select
                            className="select"
                            style={{
                              fontSize: 11,
                              padding: "3px 6px",
                              height: 30,
                            }}
                            value={row.participation}
                            onChange={(e) =>
                              updateRow(row.player.id, {
                                participation: e.target
                                  .value as SessionParticipation,
                              })
                            }
                          >
                            {PARTICIPATION_OPTIONS.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            value={n(row.min)}
                            onChange={(e) =>
                              updateRow(row.player.id, {
                                min: Number(e.target.value) || 0,
                              })
                            }
                            style={{
                              width: 55,
                              padding: "3px 6px",
                              border: "1px solid #e2e8f0",
                              borderRadius: 8,
                              textAlign: "center",
                              fontSize: 12,
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={n(row.rpe)}
                            onChange={(e) =>
                              updateRow(row.player.id, {
                                rpe: Math.min(
                                  10,
                                  Math.max(0, Number(e.target.value) || 0),
                                ),
                              })
                            }
                            style={{
                              width: 45,
                              padding: "3px 6px",
                              border: `1px solid ${needRpe ? "#fca5a5" : "#e2e8f0"}`,
                              borderRadius: 8,
                              textAlign: "center",
                              fontSize: 12,
                              background: needRpe ? "#fff5f5" : "",
                            }}
                          />
                        </td>
                        {!youth && row.player.position !== "Portero" && (
                          <>
                            <td>
                              <input
                                type="number"
                                value={n(row.acc)}
                                onChange={(e) =>
                                  updateRow(row.player.id, {
                                    acc: Number(e.target.value) || 0,
                                  })
                                }
                                style={{
                                  width: 45,
                                  padding: "3px 6px",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: 8,
                                  textAlign: "center",
                                  fontSize: 12,
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={n(row.dcc)}
                                onChange={(e) =>
                                  updateRow(row.player.id, {
                                    dcc: Number(e.target.value) || 0,
                                  })
                                }
                                style={{
                                  width: 45,
                                  padding: "3px 6px",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: 8,
                                  textAlign: "center",
                                  fontSize: 12,
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={n(row.sprints)}
                                onChange={(e) =>
                                  updateRow(row.player.id, {
                                    sprints: Number(e.target.value) || 0,
                                  })
                                }
                                style={{
                                  width: 50,
                                  padding: "3px 6px",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: 8,
                                  textAlign: "center",
                                  fontSize: 12,
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={n(row.rhie)}
                                onChange={(e) =>
                                  updateRow(row.player.id, {
                                    rhie: Number(e.target.value) || 0,
                                  })
                                }
                                style={{
                                  width: 45,
                                  padding: "3px 6px",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: 8,
                                  textAlign: "center",
                                  fontSize: 12,
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={n(row.ima)}
                                onChange={(e) =>
                                  updateRow(row.player.id, {
                                    ima: Number(e.target.value) || 0,
                                  })
                                }
                                style={{
                                  width: 45,
                                  padding: "3px 6px",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: 8,
                                  textAlign: "center",
                                  fontSize: 12,
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={n(row.totalDistance)}
                                onChange={(e) =>
                                  updateRow(row.player.id, {
                                    totalDistance: Number(e.target.value) || 0,
                                  })
                                }
                                style={{
                                  width: 65,
                                  padding: "3px 6px",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: 8,
                                  textAlign: "center",
                                  fontSize: 12,
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.1"
                                value={n(row.maxVelocity)}
                                onChange={(e) =>
                                  updateRow(row.player.id, {
                                    maxVelocity: Number(e.target.value) || 0,
                                  })
                                }
                                style={{
                                  width: 55,
                                  padding: "3px 6px",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: 8,
                                  textAlign: "center",
                                  fontSize: 12,
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={n(row.playerLoad)}
                                onChange={(e) =>
                                  updateRow(row.player.id, {
                                    playerLoad: Number(e.target.value) || 0,
                                  })
                                }
                                style={{
                                  width: 55,
                                  padding: "3px 6px",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: 8,
                                  textAlign: "center",
                                  fontSize: 12,
                                }}
                              />
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Save bottom */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
              <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
              {selectedRows.length} de {rows.length} jugadores seleccionados
            </div>
            <button
              type="button"
              className="btn"
              disabled={isSaving}
              onClick={saveSession}
              style={{ minWidth: 180, padding: "12px 24px", fontSize: 14 }}
            >
              {isSaving
                ? "Guardando…"
                : summaryRecord
                  ? "✓ Actualizar sesión"
                  : "✓ Guardar sesión"}
            </button>
          </div>
        </div>

        {/* ── INFORME ───────────────────────────────────────────────────── */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="section-eyebrow">Informe</div>
              <h3 style={{ margin: "4px 0 0" }}>Informe grupal de sesión</h3>
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowReport((v) => !v)}
              >
                {showReport ? "Ocultar" : "Vista previa"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => window.print()}
              >
                Exportar PDF
              </button>
            </div>
          </div>
          {showReport && (
            <div className="report-preview-shell" style={{ marginTop: 16 }}>
              <SessionReportTemplate
                date={filters.date}
                category={activeCat}
                microcycle={detectedMc}
                sessionNumber={sessNumInput || filters.sessionNumber}
                sessionType={sessType}
                objective={objective}
                observation={observation}
                rows={reportRows}
                absentPlayers={absentPlayers}
                dataQualityPercent={ops.dataQualityPercent}
                wellnessRecords={sessWellness}
                allWellnessRecords={data.wellness}
                allInternalLoads={data.internalLoads}
                allExternalLoads={data.externalLoads}
                allPlayers={data.players}
                compact
              />
            </div>
          )}
        </div>

        {/* ── HISTORIAL ──────────────────────────────────────────────────── */}
        <div className="card table-wrap">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div>
              <div className="section-eyebrow">Historial</div>
              <h3 style={{ margin: "4px 0 0" }}>Sesiones guardadas</h3>
              <div className="muted-line" style={{ marginTop: 4 }}>
                {sessionHistory.length} sesiones · última actualización
              </div>
            </div>
          </div>
          {sessionHistory.length ? (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>N°</th>
                    <th>Tipo</th>
                    <th>Microciclo</th>
                    <th>Objetivo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {histSlice.map((item) => {
                    const mc = data.microcycles.find(
                      (m) => m.id === item.microcycleId,
                    );
                    const isEdit = editingId === item.id;
                    return (
                      <tr
                        key={item.id}
                        style={
                          isEdit
                            ? {
                                background: "#eff6ff",
                                outline: "2px solid #bfdbfe",
                              }
                            : {}
                        }
                      >
                        <td style={{ fontWeight: 700 }}>{item.date}</td>
                        <td
                          style={{
                            textAlign: "center",
                            fontWeight: 900,
                            fontSize: 15,
                          }}
                        >
                          {item.sessionNumber}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: "#f0f4fb",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {item.sessionType}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: "#64748b" }}>
                          {mc?.name ?? "—"}
                        </td>
                        <td
                          style={{
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: 12,
                          }}
                        >
                          {item.objective || "—"}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 700,
                              background:
                                item.status === "Cerrada"
                                  ? "#fee2e2"
                                  : "#dcfce7",
                              color:
                                item.status === "Cerrada"
                                  ? "#991b1b"
                                  : "#065f46",
                            }}
                          >
                            {item.status ?? "Borrador"}
                          </span>
                        </td>
                        <td>
                          <div className="btn-row" style={{ gap: 6 }}>
                            <button
                              type="button"
                              className="btn secondary"
                              style={{ padding: "5px 10px", fontSize: 12 }}
                              onClick={() => editSession(item.id)}
                            >
                              {isEdit ? "✓ Editando" : "Editar"}
                            </button>
                            <button
                              type="button"
                              className="btn secondary"
                              style={{ padding: "5px 10px", fontSize: 12 }}
                              onClick={() => duplicateSession(item.id)}
                              title="Duplicar sesión a fecha activa"
                            >
                              <ChevronDown size={12} />
                            </button>
                            <button
                              type="button"
                              className="btn danger"
                              style={{ padding: "5px 10px", fontSize: 12 }}
                              onClick={() => deleteSession(item.id)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {histPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={histPage === 0}
                    onClick={() => setHistPage((p) => p - 1)}
                  >
                    ‹ Anterior
                  </button>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontSize: 12,
                      color: "#64748b",
                      fontWeight: 700,
                    }}
                  >
                    Página {histPage + 1} de {histPages}
                  </span>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={histPage >= histPages - 1}
                    onClick={() => setHistPage((p) => p + 1)}
                  >
                    Siguiente ›
                  </button>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="Sin sesiones guardadas"
              text="Las sesiones guardadas aparecerán aquí."
            />
          )}
        </div>
      </div>

      {/* PDF print */}
      <SessionReportTemplate
        date={filters.date}
        category={activeCat}
        microcycle={detectedMc}
        sessionNumber={sessNumInput || filters.sessionNumber}
        sessionType={sessType}
        objective={objective}
        observation={observation}
        rows={reportRows}
        absentPlayers={absentPlayers}
        dataQualityPercent={ops.dataQualityPercent}
        wellnessRecords={sessWellness}
        allWellnessRecords={data.wellness}
        allInternalLoads={data.internalLoads}
        allExternalLoads={data.externalLoads}
        allPlayers={data.players}
        className="print-only"
      />

      {ConfirmModal}
      {showCsv && (
        <CsvImporter
          players={sessionPlayers}
          sessionId={
            summaryRecord?.id ??
            editingId ??
            `draft-${filters.date}-${activeCat}`
          }
          date={filters.date}
          microcycleId={activeMcId}
          sessionNumber={Number(sessNumInput) || filters.sessionNumber}
          category={activeCat}
          actingCategory={activeCat}
          sessionType={sessType}
          movementModule="sesion"
          title="Importar CSV GPS de entrenamiento"
          description="Carga el CTR Report de Catapult o un CSV GPS compatible. Los datos se cargan primero en la planilla; solo se guardan en Supabase cuando presionas Guardar sesión."
          importLabel="registros GPS en la planilla"
          onImport={handleCsvImport}
          onClose={() => setShowCsv(false)}
        />
      )}
    </>
  );
}
