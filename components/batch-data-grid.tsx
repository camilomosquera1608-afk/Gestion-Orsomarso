"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Player, DailyInternalLoadRecord, ClubCategory } from "@/lib/types";
import { todayInputDate } from "@/lib/dates";
import { Zap, Check, AlertCircle, Save, Calendar, Clock, Activity } from "lucide-react";
import { AccessibleButton } from "./accessible-button";

interface BatchDataGridProps {
  players: Player[];
  onSaveBatch: (
    records: Omit<DailyInternalLoadRecord, "id" | "updatedAt">[]
  ) => Promise<void>;
  currentCategory?: ClubCategory;
}

export function BatchDataGrid({
  players,
  onSaveBatch,
  currentCategory = "Sub17",
}: BatchDataGridProps) {

  const [date, setDate] = useState(todayInputDate());
  const [sessionName, setSessionName] = useState("Sesión Principal");
  const [defaultDuration, setDefaultDuration] = useState<number>(75);
  const [defaultRpe, setDefaultRpe] = useState<number>(6);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form State por Jugador (playerId -> { rpe, minutes, notes, selected })
  const [gridState, setGridState] = useState<
    Record<string, { rpe: number; minutes: number; notes: string; selected: boolean }>
  >({});

  // Inicializar estado para los jugadores actuales
  useEffect(() => {
    const initialState: Record<
      string,
      { rpe: number; minutes: number; notes: string; selected: boolean }
    > = {};
    players.forEach((p) => {
      initialState[p.id] = {
        rpe: defaultRpe,
        minutes: defaultDuration,
        notes: "",
        selected: true,
      };
    });
    setGridState(initialState);
  }, [players]);

  const applyDefaultsToAll = () => {
    setGridState((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        next[id] = {
          ...next[id],
          rpe: defaultRpe,
          minutes: defaultDuration,
        };
      });
      return next;
    });
  };

  const handlePlayerChange = (
    id: string,
    field: "rpe" | "minutes" | "notes" | "selected",
    val: any
  ) => {
    setGridState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: val,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      const recordsToSave: Omit<DailyInternalLoadRecord, "id" | "updatedAt">[] = [];

      players.forEach((player) => {
        const state = gridState[player.id];
        if (state && state.selected) {
          recordsToSave.push({
            date,
            playerId: player.id,
            rpe: Number(state.rpe),
            duration: Number(state.minutes),
            category: (player.category || currentCategory) as ClubCategory,
          });
        }
      });

      if (recordsToSave.length > 0) {
        await onSaveBatch(recordsToSave);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      }
    } catch (err) {
      console.error("Error guardando carga masiva:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6 shadow-2xl space-y-6 text-slate-100">
      {/* Header & Quick Batch Setup */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-emerald-400 animate-pulse" />
            <h2 className="text-xl font-bold text-white tracking-wide">
              Matriz de Carga Masiva Rápida
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Registro simultáneo de RPE y minutos para toda la plantilla ({players.length} jugadores)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AccessibleButton
            onClick={applyDefaultsToAll}
            className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-1 text-slate-200"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Aplicar Valores por Defecto
          </AccessibleButton>

          <AccessibleButton
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-500 font-semibold text-white text-sm px-5 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-all transform active:scale-95"
          >
            {isSaving ? (
              <span className="animate-spin">⏳</span>
            ) : savedSuccess ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {savedSuccess ? "¡Guardado!" : "Guardar Carga Masiva"}
          </AccessibleButton>
        </div>
      </div>

      {/* Global Controls Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Fecha de Sesión
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Nombre de la Sesión
          </label>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Ej: MD-3 Táctico"
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Minutos Objetivo (Defecto)
          </label>
          <input
            type="number"
            min={1}
            max={180}
            value={defaultDuration}
            onChange={(e) => setDefaultDuration(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            RPE Base (Escala Borg 1-10)
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={defaultRpe}
            onChange={(e) => setDefaultRpe(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Interactive Table Grid */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-[500px] overflow-y-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 sticky top-0 border-b border-slate-800 z-10">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={players.length > 0 && players.every((p) => gridState[p.id]?.selected)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setGridState((prev) => {
                      const next = { ...prev };
                      Object.keys(next).forEach((id) => {
                        next[id] = { ...next[id], selected: checked };
                      });
                      return next;
                    });
                  }}
                  className="rounded accent-emerald-500"
                />
              </th>
              <th className="p-3">Jugador</th>
              <th className="p-3">Posición</th>
              <th className="p-3 text-center w-32">RPE (1-10)</th>
              <th className="p-3 text-center w-32">Minutos</th>
              <th className="p-3 text-center w-32">Carga (sRPE)</th>
              <th className="p-3">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {players.map((player) => {
              const state = gridState[player.id] || {
                rpe: 6,
                minutes: 75,
                notes: "",
                selected: true,
              };
              const sRPE = state.rpe * state.minutes;

              return (
                <tr
                  key={player.id}
                  className={`hover:bg-slate-800/50 transition-colors ${
                    !state.selected ? "opacity-40" : ""
                  }`}
                >
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={state.selected}
                      onChange={(e) =>
                        handlePlayerChange(player.id, "selected", e.target.checked)
                      }
                      className="rounded accent-emerald-500"
                    />
                  </td>
                  <td className="p-3 font-semibold text-white">
                    {player.name}
                  </td>
                  <td className="p-3 text-xs text-slate-400">
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                      {player.position || "N/A"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={state.rpe}
                      disabled={!state.selected}
                      onChange={(e) =>
                        handlePlayerChange(player.id, "rpe", Number(e.target.value))
                      }
                      className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-bold text-emerald-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={state.minutes}
                      disabled={!state.selected}
                      onChange={(e) =>
                        handlePlayerChange(player.id, "minutes", Number(e.target.value))
                      }
                      className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-bold text-amber-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-white">
                    {sRPE} <span className="text-[10px] text-slate-500">UA</span>
                  </td>
                  <td className="p-3">
                    <input
                      type="text"
                      placeholder="Sin novedad"
                      value={state.notes}
                      disabled={!state.selected}
                      onChange={(e) =>
                        handlePlayerChange(player.id, "notes", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
