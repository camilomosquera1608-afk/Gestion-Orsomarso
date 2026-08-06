"use client";

import React, { useState } from "react";
import { supabase, hasSupabaseConfig, tableSchemaSyncEnabled } from "@/lib/supabase";
import { Database, CheckCircle2, XCircle, AlertTriangle, Copy, Check, RefreshCw } from "lucide-react";
import { AccessibleButton } from "./accessible-button";

interface TableStatus {
  name: string;
  status: "ok" | "error" | "loading";
  count?: number;
  message?: string;
}

export function SupabaseDiagnostic() {
  const [isChecking, setIsChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tableStatuses, setTableStatuses] = useState<TableStatus[]>([]);

  const tablesToCheck = [
    "players",
    "wellness",
    "internal_loads",
    "external_loads",
    "microcycles",
    "training_sessions",
    "competition_records",
    "strength_sessions",
    "cmj_records",
    "nutrition_records",
    "neuromuscular_records",
    "profiles",
  ];

  const runDiagnostic = async () => {
    if (!supabase || !hasSupabaseConfig) {
      setTableStatuses(
        tablesToCheck.map((t) => ({
          name: t,
          status: "error",
          message: "Supabase no está configurado o las claves son inválidas.",
        }))
      );
      return;
    }

    setIsChecking(true);
    const results: TableStatus[] = [];

    for (const tableName of tablesToCheck) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select("*", { count: "exact", head: true });

        if (error) {
          results.push({
            name: tableName,
            status: "error",
            message: error.message,
          });
        } else {
          results.push({
            name: tableName,
            status: "ok",
            count: count ?? 0,
            message: "Conectado correctamente",
          });
        }
      } catch (err: any) {
        results.push({
          name: tableName,
          status: "error",
          message: err?.message || "Error de red / Failed to fetch",
        });
      }
    }

    setTableStatuses(results);
    setIsChecking(false);
  };

  const copySqlSchema = () => {
    const sqlScript = `-- Script de emergencia para crear tablas en Supabase
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('Sub15', 'Sub17', 'Sub20')),
  position text NOT NULL,
  status text NOT NULL DEFAULT 'Disponible',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wellness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  player_id text NOT NULL,
  date date NOT NULL,
  sleep numeric NOT NULL,
  fatigue numeric NOT NULL,
  stress numeric NOT NULL,
  muscle_pain numeric NOT NULL,
  mood numeric NOT NULL,
  category text DEFAULT 'Sub20',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.internal_loads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  player_id text NOT NULL,
  date date NOT NULL,
  rpe numeric NOT NULL,
  duration numeric NOT NULL,
  category text DEFAULT 'Sub20',
  created_at timestamptz DEFAULT now()
);
`;
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-lg text-white">Diagnóstico de Tablas en Supabase</h3>
        </div>

        <div className="flex items-center gap-2">
          <AccessibleButton
            onClick={copySqlSchema}
            className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 text-slate-200"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "¡Copiado!" : "Copiar SQL de Tablas"}
          </AccessibleButton>

          <AccessibleButton
            onClick={runDiagnostic}
            disabled={isChecking}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
            Probando Conexión
          </AccessibleButton>
        </div>
      </div>

      {/* Overview Status Banner */}
      <div
        className={`p-3 rounded-lg border text-xs flex items-center gap-3 ${
          hasSupabaseConfig
            ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
            : "bg-amber-950/40 border-amber-800/60 text-amber-300"
        }`}
      >
        {hasSupabaseConfig ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
        )}
        <div>
          <span className="font-bold">
            {hasSupabaseConfig
              ? "Supabase Configurado en Modo Table Schema"
              : "Modo Local Resiliente (Sin credenciales remotas válidas)"}
          </span>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {hasSupabaseConfig
              ? "Sincronización remota activa con la base de datos de PostgreSQL."
              : "La aplicación está utilizando IndexedDB localmente sin depender de Supabase."}
          </p>
        </div>
      </div>

      {/* Table Results */}
      {tableStatuses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
          {tableStatuses.map((table) => (
            <div
              key={table.name}
              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                table.status === "ok"
                  ? "bg-slate-950 border-slate-800 text-slate-200"
                  : "bg-rose-950/30 border-rose-900/50 text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {table.status === "ok" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                )}
                <span className="font-mono font-semibold truncate">{table.name}</span>
              </div>

              <div className="text-[11px] font-mono">
                {table.status === "ok" ? (
                  <span className="text-emerald-400 font-bold">{table.count} filas</span>
                ) : (
                  <span className="text-rose-400 truncate max-w-[120px]" title={table.message}>
                    Error
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
