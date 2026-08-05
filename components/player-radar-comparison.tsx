"use client";

import React from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from "recharts";
import { User, Activity } from "lucide-react";

interface PlayerMetrics {
  name: string;
  category: string;
  rpeAverage: number; // 0 - 10
  wellnessScore: number; // 0 - 25
  cmjHeight: number; // cm
  sprintSpeed: number; // km/h
  totalDistance90: number; // km
  hsrDistance: number; // m
}

interface PlayerRadarComparisonProps {
  playerA: PlayerMetrics;
  playerB?: PlayerMetrics;
}

export function PlayerRadarComparison({ playerA, playerB }: PlayerRadarComparisonProps) {
  // Normalizar datos a escala 0 - 100 para el gráfico de radar
  const data = [
    {
      metric: "Intensidad (RPE)",
      PlayerA: (playerA.rpeAverage / 10) * 100,
      PlayerB: playerB ? (playerB.rpeAverage / 10) * 100 : 0,
    },
    {
      metric: "Wellness Estado",
      PlayerA: (playerA.wellnessScore / 25) * 100,
      PlayerB: playerB ? (playerB.wellnessScore / 25) * 100 : 0,
    },
    {
      metric: "Potencia CMJ",
      PlayerA: Math.min(100, (playerA.cmjHeight / 50) * 100),
      PlayerB: playerB ? Math.min(100, (playerB.cmjHeight / 50) * 100) : 0,
    },
    {
      metric: "Velocidad Máx",
      PlayerA: Math.min(100, (playerA.sprintSpeed / 34) * 100),
      PlayerB: playerB ? Math.min(100, (playerB.sprintSpeed / 34) * 100) : 0,
    },
    {
      metric: "Volumen Total",
      PlayerA: Math.min(100, (playerA.totalDistance90 / 12) * 100),
      PlayerB: playerB ? Math.min(100, (playerB.totalDistance90 / 12) * 100) : 0,
    },
    {
      metric: "Sprint HSR",
      PlayerA: Math.min(100, (playerA.hsrDistance / 900) * 100),
      PlayerB: playerB ? Math.min(100, (playerB.hsrDistance / 900) * 100) : 0,
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg text-white">Radar Comparativo de Jugadores</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Análisis de perfil físico y biomecánico multinivel
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
            {playerA.name} ({playerA.category})
          </span>
          {playerB && (
            <span className="flex items-center gap-1 text-amber-400 font-semibold">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              {playerB.name} ({playerB.category})
            </span>
          )}
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="metric" stroke="#94a3b8" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" />

            <Radar
              name={playerA.name}
              dataKey="PlayerA"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.4}
            />

            {playerB && (
              <Radar
                name={playerB.name}
                dataKey="PlayerB"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.3}
              />
            )}

            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
