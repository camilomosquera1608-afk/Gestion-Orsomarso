"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppHero } from "@/components/app-hero";
import { GlobalFiltersBar } from "@/components/global-filters";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState, SectionHeader } from "@/components/pro-ui";
import { useApp } from "@/context/app-context";
import { getStaffSession, isMasterRole } from "@/lib/auth";
import { categoryLabel } from "@/lib/labels";
import type { ClubCategory, Player } from "@/lib/types";
import {
  averageWellness,
  calculateInternalLoad,
  findMicrocycleByDate,
  groupAverage,
} from "@/lib/utils";
import { getVisiblePlayers } from "@/lib/operational-helpers";
import {
  getEffectiveExternalLoads,
  getRelatedPlayerIds,
  getRelatedPlayerIdSet,
  getTrainingSessionsForMicrocycle,
  getWellnessRecordsForDate,
} from "@/lib/relational-data";
import { supportsGps } from "@/lib/report-utils";

type ReportMode = "grupo" | "valoraciones" | "microciclo";

const fmt = (value: number, decimals = 0) =>
  Number.isFinite(value) ? value.toFixed(decimals) : "0";
const uniqueDates = (dates: string[]) =>
  Array.from(new Set(dates.filter(Boolean))).sort();

export default function GroupReportsPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = (
    master
      ? filters.category === "all"
        ? "Sub20"
        : filters.category
      : session.category
  ) as ClubCategory;
  const gpsEnabled = supportsGps(activeCategory);
  const [mode, setMode] = useState<ReportMode>("grupo");

  const microcycle =
    findMicrocycleByDate(
      data.microcycles,
      filters.date,
      filters.microcycleId,
      activeCategory,
    ) ??
    data.microcycles.find(
      (item) =>
        item.id === filters.microcycleId && item.category === activeCategory,
    ) ??
    data.microcycles.find((item) => item.category === activeCategory);
  const hasRange = Boolean(microcycle?.startDate && microcycle?.endDate);
  const inRange = (date: string) =>
    hasRange
      ? date >= microcycle!.startDate && date <= microcycle!.endDate
      : date === filters.date;

  const players = useMemo(
    () =>
      getVisiblePlayers(
        data,
        { ...filters, category: activeCategory, playerId: "all" },
        activeCategory,
      ),
    [data, filters, activeCategory],
  );
  const playerIdSet = getRelatedPlayerIdSet(data.players, players);
  const sessions = microcycle
    ? getTrainingSessionsForMicrocycle(data, microcycle, activeCategory)
    : [];
  const sessionIds = new Set(sessions.map((item) => item.id));

  const wellnessRows = uniqueDates(
    data.wellness
      .filter((item) => inRange(item.date) && playerIdSet.has(item.playerId))
      .map((item) => item.date),
  ).map((date) => {
    const rows = getWellnessRecordsForDate(data, date, playerIdSet);
    return {
      date: date.slice(5),
      wellness: groupAverage(
        rows.map((row) => averageWellness(row)).filter((value) => value > 0),
      ),
      registros: rows.length,
    };
  });

  const internalRows = data.internalLoads.filter(
    (item) => inRange(item.date) && playerIdSet.has(item.playerId),
  );
  const externalRows = getEffectiveExternalLoads(data, {
    activeCategory,
    playerIds: playerIdSet,
  }).filter(
    (item) =>
      inRange(item.date) &&
      (!item.sessionId ||
        sessionIds.size === 0 ||
        sessionIds.has(item.sessionId) ||
        item.movementModule === "competencia"),
  );
  const competitionRows = data.competitionRecords.filter(
    (item) => inRange(item.date) && playerIdSet.has(item.playerId),
  );
  const wellnessAvg = groupAverage(
    wellnessRows.map((item) => item.wellness).filter((value) => value > 0),
  );
  const internalTotal = internalRows.reduce(
    (sum, item) => sum + calculateInternalLoad(item),
    0,
  );
  const minutesTotal = externalRows.reduce(
    (sum, item) => sum + (item.min ?? 0),
    0,
  );
  const gpsDistance = externalRows.reduce(
    (sum, item) => sum + (item.totalDistance ?? 0),
    0,
  );

  const playerRows = players.map((player: Player) => {
    const ids = getRelatedPlayerIds(data.players, player.id);
    const pWellness = data.wellness.filter(
      (item) => inRange(item.date) && ids.has(item.playerId),
    );
    const pInternal = internalRows.filter((item) => ids.has(item.playerId));
    const pExternal = externalRows.filter((item) => ids.has(item.playerId));
    const pCompetition = competitionRows.filter((item) =>
      ids.has(item.playerId),
    );
    return {
      id: player.id,
      name: player.name,
      position: player.position,
      status: player.status,
      wellness: groupAverage(
        pWellness
          .map((item) => averageWellness(item))
          .filter((value) => value > 0),
      ),
      internalLoad: pInternal.reduce(
        (sum, item) => sum + calculateInternalLoad(item),
        0,
      ),
      minutes: pExternal.reduce((sum, item) => sum + (item.min ?? 0), 0),
      distance: pExternal.reduce(
        (sum, item) => sum + (item.totalDistance ?? 0),
        0,
      ),
      competitions: pCompetition.length,
    };
  });

  const evaluationRows = players.map((player) => {
    const ids = getRelatedPlayerIds(data.players, player.id);
    const nutrition = data.nutritionRecords
      .filter((item) => ids.has(item.playerId))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const cmj = data.cmjRecords
      .filter((item) => ids.has(item.playerId))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const fms = data.fmsRecords
      .filter((item) => ids.has(item.playerId))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const neuro = data.neuromuscularRecords
      .filter((item) => ids.has(item.playerId))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return { player, nutrition, cmj, fms, neuro };
  });

  const dailyLoad = uniqueDates([
    ...internalRows.map((item) => item.date),
    ...externalRows.map((item) => item.date),
  ]).map((date) => ({
    date: date.slice(5),
    interna: internalRows
      .filter((item) => item.date === date)
      .reduce((sum, item) => sum + calculateInternalLoad(item), 0),
    minutos: externalRows
      .filter((item) => item.date === date)
      .reduce((sum, item) => sum + (item.min ?? 0), 0),
    distancia: externalRows
      .filter((item) => item.date === date)
      .reduce((sum, item) => sum + (item.totalDistance ?? 0), 0),
  }));

  const printReport = () => window.print();

  return (
    <div className="grid group-report-page">
      <AppHero
        title="Informes grupales"
        subtitle={`${categoryLabel(activeCategory)} · grupo, valoraciones y microciclo${gpsEnabled ? " · con GPS" : " · modelo sin GPS"}`}
      />
      <GlobalFiltersBar />

      <div className="card no-print">
        <div
          className="btn-row"
          style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
        >
          <div className="btn-row" style={{ gap: 8, flexWrap: "wrap" }}>
            {(["grupo", "valoraciones", "microciclo"] as ReportMode[]).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  className={`btn ${mode === item ? "" : "secondary"}`}
                  onClick={() => setMode(item)}
                >
                  {item === "grupo"
                    ? "Informe grupo"
                    : item === "valoraciones"
                      ? "Valoraciones"
                      : "Microciclo"}
                </button>
              ),
            )}
          </div>
          <button type="button" className="btn secondary" onClick={printReport}>
            Exportar / imprimir PDF
          </button>
        </div>
      </div>

      <div className="grid grid-4">
        <KpiCard
          label="Jugadores"
          value={String(players.length)}
          tone="dark"
          trend={categoryLabel(activeCategory)}
        />
        <KpiCard
          label="Wellness promedio"
          value={wellnessAvg ? fmt(wellnessAvg, 1) : "—"}
          tone={wellnessAvg && wellnessAvg < 3.2 ? "amber" : "green"}
          trend="Rango activo"
        />
        <KpiCard
          label="Carga interna"
          value={`${Math.round(internalTotal)} UA`}
          tone="blue"
          trend={`${internalRows.length} registros`}
        />
        <KpiCard
          label={gpsEnabled ? "Distancia GPS" : "Minutos acumulados"}
          value={
            gpsEnabled
              ? `${Math.round(gpsDistance)} m`
              : `${Math.round(minutesTotal)} min`
          }
          tone="amber"
          trend={gpsEnabled ? "Carga externa" : "Sin GPS"}
        />
      </div>

      {!gpsEnabled ? (
        <div className="alert-item tone-blue">
          <strong>Informe adaptado sin GPS.</strong> Esta categoría no registra
          GPS; el análisis se basa en wellness, RPE, duración, asistencia,
          competencia, valoraciones y disponibilidad.
        </div>
      ) : null}

      {mode === "grupo" ? (
        <>
          <div className="grid grid-2">
            <div className="card">
              <SectionHeader
                eyebrow="Grupo"
                title="Wellness diario"
                subtitle="Promedio diario del grupo en el rango activo."
              />
              {wellnessRows.length ? (
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <LineChart data={wellnessRows}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="wellness"
                        strokeWidth={3}
                        name="Wellness"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="Sin wellness"
                  text="No hay wellness para el rango activo."
                />
              )}
            </div>
            <div className="card">
              <SectionHeader
                eyebrow="Carga"
                title={
                  gpsEnabled ? "Carga y distancia" : "Carga interna y minutos"
                }
                subtitle="Evolución por fecha."
              />
              {dailyLoad.length ? (
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={dailyLoad}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar
                        dataKey={gpsEnabled ? "distancia" : "interna"}
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="Sin carga"
                  text="No hay registros de carga en el rango."
                />
              )}
            </div>
          </div>
          <div className="card table-wrap">
            <SectionHeader
              eyebrow="Plantilla"
              title="Resumen por jugador"
              subtitle="Misma fuente efectiva usada por wellness, carga, disponibilidad y reportes."
            />
            <table>
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Posición</th>
                  <th>Estado</th>
                  <th>Wellness</th>
                  <th>Carga interna</th>
                  <th>Min</th>
                  {gpsEnabled ? <th>Distancia</th> : null}
                  <th>Competencia</th>
                </tr>
              </thead>
              <tbody>
                {playerRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                    </td>
                    <td>{row.position}</td>
                    <td>{row.status}</td>
                    <td>{row.wellness ? fmt(row.wellness, 1) : "—"}</td>
                    <td>{Math.round(row.internalLoad)}</td>
                    <td>{Math.round(row.minutes)}</td>
                    {gpsEnabled ? <td>{Math.round(row.distance)}</td> : null}
                    <td>{row.competitions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {mode === "valoraciones" ? (
        <div className="card table-wrap">
          <SectionHeader
            eyebrow="Valoraciones"
            title="Informe grupal de valoraciones"
            subtitle="Últimos registros disponibles por jugador."
          />
          <table>
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Nutrición</th>
                <th>Peso</th>
                <th>% grasa</th>
                <th>CMJ</th>
                <th>FMS</th>
                <th>Neuromuscular</th>
                <th>Lectura</th>
              </tr>
            </thead>
            <tbody>
              {evaluationRows.map(({ player, nutrition, cmj, fms, neuro }) => {
                const hasEvaluation = Boolean(nutrition || cmj || fms || neuro);
                return (
                  <tr key={player.id}>
                    <td>
                      <strong>{player.name}</strong>
                      <br />
                      <span className="muted-line">{player.position}</span>
                    </td>
                    <td>{nutrition?.date ?? "—"}</td>
                    <td>
                      {nutrition?.weight ? `${nutrition.weight} kg` : "—"}
                    </td>
                    <td>
                      {nutrition?.bodyFat ? `${nutrition.bodyFat}%` : "—"}
                    </td>
                    <td>{cmj?.value ? `${cmj.value} cm` : "—"}</td>
                    <td>
                      {fms
                        ? `${fms.shoulderMobility + fms.squat + fms.legRaise + fms.hurdleStep + fms.lunge + fms.trunkStability + fms.rotaryStability} pts`
                        : "—"}
                    </td>
                    <td>{neuro?.cmj ? `CMJ ${neuro.cmj}` : "—"}</td>
                    <td>
                      <span
                        className={`status-badge ui-tone-${hasEvaluation ? "green" : "amber"}`}
                      >
                        {hasEvaluation ? "Con valoración" : "Pendiente"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {mode === "microciclo" ? (
        <>
          <div className="card">
            <SectionHeader
              eyebrow="Microciclo"
              title={microcycle?.name ?? "Sin microciclo"}
              subtitle={
                microcycle
                  ? `${microcycle.startDate || "Sin inicio"} a ${microcycle.endDate || "Sin fin"} · ${sessions.length} sesión(es)`
                  : "No hay microciclo activo para la fecha."
              }
            />
            {microcycle?.objective ? (
              <p className="pdf-manual-note">{microcycle.objective}</p>
            ) : null}
            {microcycle?.notes ? (
              <p className="muted-line">{microcycle.notes}</p>
            ) : null}
          </div>
          <div className="card table-wrap">
            <SectionHeader
              eyebrow="Sesiones"
              title="Sesiones incluidas"
              subtitle="Solo sesiones dentro del rango y categoría del microciclo."
            />
            {sessions.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>N°</th>
                    <th>Tipo</th>
                    <th>Objetivo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id}>
                      <td>{session.date}</td>
                      <td>{session.sessionNumber}</td>
                      <td>{session.sessionType}</td>
                      <td>{session.objective ?? "—"}</td>
                      <td>{session.status ?? "Borrador"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="Sin sesiones"
                text="No hay sesiones válidas dentro del microciclo activo."
              />
            )}
          </div>
          <div className="card table-wrap">
            <SectionHeader
              eyebrow="Conclusiones"
              title="Lectura técnica del microciclo"
            />
            <table>
              <tbody>
                <tr>
                  <td>
                    <strong>Estado del grupo</strong>
                  </td>
                  <td>
                    {wellnessAvg && wellnessAvg < 3.2
                      ? "Atención: wellness bajo en el rango."
                      : "Respuesta grupal estable según wellness disponible."}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Carga</strong>
                  </td>
                  <td>
                    {internalRows.length
                      ? `${Math.round(internalTotal)} UA acumuladas en el microciclo.`
                      : "Carga interna pendiente."}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Competencia</strong>
                  </td>
                  <td>
                    {competitionRows.length
                      ? `${competitionRows.length} registros competitivos vinculados al rango.`
                      : "Sin competencia en el rango."}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
