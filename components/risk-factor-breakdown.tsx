"use client";

import React from "react";
import { AlertTriangle, TrendingUp, Heart, BatteryCharging, CheckCircle2, ShieldAlert } from "lucide-react";

interface RiskFactorBreakdownProps {
  playerName: string;
  category: string;
  position?: string;
  riskScore: number; // 0 - 100
  riskLevel: "Bajo" | "Moderado" | "Alto" | "Extremo";
  acwr: number;
  cmjDeltaPercentage?: number;
  wellnessScore7d?: number;
  accumulatedFatigue7d?: number;
  recommendations: string[];
}

export function RiskFactorBreakdown({
  playerName,
  category,
  position = "N/A",
  riskScore,
  riskLevel,
  acwr,
  cmjDeltaPercentage = -8,
  wellnessScore7d = 14,
  accumulatedFatigue7d = 2650,
  recommendations,
}: RiskFactorBreakdownProps) {
  const getBadgeColor = () => {
    switch (riskLevel) {
      case "Extremo":
      case "Alto":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      case "Moderado":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      default:
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-lg text-white">{playerName}</h3>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
              {category} • {position}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Explicabilidad del Motor de Riesgo de Carga Fisiológica
          </p>
        </div>

        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeColor()}`}>
          Riesgo {riskLevel} ({riskScore}%)
        </div>
      </div>

      {/* Top 3 Drivers of Risk */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Factores Determinantes de la Alerta (Top 3 Drivers)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Driver 1: ACWR */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>ACWR Actual</span>
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-amber-400 font-mono">{acwr.toFixed(2)}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {acwr > 1.5 ? "⚠️ Zona de Peligro (>1.5)" : "✓ En Rango Óptimo (0.8–1.3)"}
            </div>
          </div>

          {/* Driver 2: CMJ Jump */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Rendimiento CMJ</span>
              <BatteryCharging className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div
              className={`text-lg font-bold font-mono ${
                cmjDeltaPercentage < -10 ? "text-rose-400" : "text-slate-200"
              }`}
            >
              {cmjDeltaPercentage}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {cmjDeltaPercentage < -10 ? "⚠️ Caída neuromuscular" : "✓ Potencia normal"}
            </div>
          </div>

          {/* Driver 3: Wellness */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Fatiga Acumulada 7d</span>
              <Heart className="w-3.5 h-3.5 text-pink-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">{accumulatedFatigue7d} UA</div>
            <div className="text-[11px] text-slate-500 mt-1">Wellness: {wellnessScore7d}/25 pts</div>
          </div>
        </div>
      </div>

      {/* Actionable Recommendations for Staff */}
      <div className="bg-emerald-950/30 border border-emerald-800/40 p-4 rounded-xl">
        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Recomendaciones de Acción Inmediata para el Cuerpo Técnico
        </h4>
        <ul className="space-y-1.5">
          {recommendations.map((rec, i) => (
            <li key={i} className="text-xs text-slate-200 flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              {rec}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
