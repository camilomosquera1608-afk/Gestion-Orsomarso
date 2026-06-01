'use client';

import React, { useState } from 'react';
import { ArrowRight, ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, BarChart3, User, Globe, Target } from 'lucide-react';
import { useScoutingStore } from '@/stores/scouting-store';
import { usePlayerStore } from '@/stores/player-store';
import { ExternalPlayer, Player } from '@/lib/schemas';
import { AccessibleButton } from './accessible-button';
import { cn } from '@/lib/utils';
import { FadeIn } from './animated-wrapper';

export function PlayerComparison() {
  const { externalPlayers, addComparison } = useScoutingStore();
  const { players } = usePlayerStore();
  
  const [selectedExternalPlayer, setSelectedExternalPlayer] = useState<ExternalPlayer | null>(null);
  const [selectedInternalPlayer, setSelectedInternalPlayer] = useState<Player | null>(null);
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  const handleCompare = () => {
    if (!selectedExternalPlayer || !selectedInternalPlayer) return;

    const result = calculatePlayerComparison(selectedExternalPlayer, selectedInternalPlayer);
    setComparisonResult(result);
    
    addComparison({
      id: `comparison-${Date.now()}`,
      externalPlayerId: selectedExternalPlayer.id,
      internalPlayerId: selectedInternalPlayer.id,
      comparisonDate: new Date().toISOString(),
      technicalScore: result.technicalScore,
      physicalScore: result.physicalScore,
      tacticalScore: result.tacticalScore,
      overallScore: result.overallScore,
      metricsComparison: result.metricsComparison,
      recommendation: result.recommendation,
      notes: '',
      createdBy: 'current-user',
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <span className="section-eyebrow">Comparativa</span>
        <h3 style={{ margin: '0 0 8px' }}>Jugador externo vs plantel</h3>
        <p className="muted-line" style={{ marginBottom: 16 }}>
          Compara jugadores de la base Wyscout/local con jugadores del club.
        </p>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
          <label className="field">
            <span className="field-label">Jugador externo (Wyscout)</span>
            <select
              value={selectedExternalPlayer?.id || ''}
              onChange={(e) => {
                const player = externalPlayers.find((p) => p.id === e.target.value);
                setSelectedExternalPlayer(player || null);
              }}
              className="select"
            >
              <option value="">Seleccionar jugador externo...</option>
              {externalPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} - {player.currentClub} ({player.position})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Jugador interno (Orsomarso)</span>
            <select
              value={selectedInternalPlayer?.id || ''}
              onChange={(e) => {
                const player = players.find((p) => p.id === e.target.value);
                setSelectedInternalPlayer(player || null);
              }}
              className="select"
            >
              <option value="">Seleccionar jugador interno...</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} - {player.category || 'N/A'} ({player.position})
                </option>
              ))}
            </select>
          </label>
        </div>

        <AccessibleButton
          variant="primary"
          onClick={handleCompare}
          disabled={!selectedExternalPlayer || !selectedInternalPlayer}
          ariaLabel="Comparar jugadores seleccionados"
        >
          <BarChart3 size={16} className="mr-2" />
          Comparar Jugadores
        </AccessibleButton>
      </div>

      {/* Comparison Results */}
      {comparisonResult && (
        <FadeIn>
          <ComparisonResult
            externalPlayer={selectedExternalPlayer!}
            internalPlayer={selectedInternalPlayer!}
            result={comparisonResult}
          />
        </FadeIn>
      )}
    </div>
  );
}

interface ComparisonResultProps {
  externalPlayer: ExternalPlayer;
  internalPlayer: Player;
  result: any;
}

function ComparisonResult({ externalPlayer, internalPlayer, result }: ComparisonResultProps) {
  const recommendationColors = {
    upgrade: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
    similar: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    downgrade: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
    insufficient_data: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400',
  };

  const recommendationLabels = {
    upgrade: 'El jugador externo es superior',
    similar: 'Nivel similar entre ambos',
    downgrade: 'El jugador interno es superior',
    insufficient_data: 'Datos insuficientes para comparar',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Resultado de Comparación
        </h3>
        <div className={cn('px-4 py-2 rounded-lg border', recommendationColors[result.recommendation as keyof typeof recommendationColors])}>
          {recommendationLabels[result.recommendation as keyof typeof recommendationLabels]}
        </div>
      </div>

      {/* Player Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* External Player Card */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <Globe size={20} className="text-blue-500" />
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">{externalPlayer.name}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {externalPlayer.currentClub} • {externalPlayer.league}
              </p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Posición:</span>
              <span className="text-gray-900 dark:text-gray-100">{externalPlayer.position}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Edad:</span>
              <span className="text-gray-900 dark:text-gray-100">{externalPlayer.age} años</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Valor mercado:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {externalPlayer.marketValue ? `€${(externalPlayer.marketValue / 1000000).toFixed(1)}M` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Internal Player Card */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <User size={20} className="text-green-500" />
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">{internalPlayer.name}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Orsomarso • {internalPlayer.category || 'N/A'}
              </p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Posición:</span>
              <span className="text-gray-900 dark:text-gray-100">{internalPlayer.position}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Edad:</span>
              <span className="text-gray-900 dark:text-gray-100">{internalPlayer.age} años</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Estado:</span>
              <span className="text-gray-900 dark:text-gray-100">{internalPlayer.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Score Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ScoreCard label="Técnico" score={result.technicalScore} />
        <ScoreCard label="Físico" score={result.physicalScore} />
        <ScoreCard label="Táctico" score={result.tacticalScore} />
      </div>

      {/* Overall Score */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Score General
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Comparación integral de ambos jugadores
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              {result.overallScore}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">/ 100</div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics Comparison */}
      {result.metricsComparison && (
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Comparación de Métricas Detalladas
          </h4>
          <div className="space-y-3">
            <MetricComparisonRow
              label="Distancia Total (m)"
              internal={result.metricsComparison.distance.internal}
              external={result.metricsComparison.distance.external}
              difference={result.metricsComparison.distance.difference}
            />
            <MetricComparisonRow
              label="Distancia Alta Velocidad (m)"
              internal={result.metricsComparison.highSpeedDistance.internal}
              external={result.metricsComparison.highSpeedDistance.external}
              difference={result.metricsComparison.highSpeedDistance.difference}
            />
            <MetricComparisonRow
              label="Velocidad Máxima (km/h)"
              internal={result.metricsComparison.maxVelocity.internal}
              external={result.metricsComparison.maxVelocity.external}
              difference={result.metricsComparison.maxVelocity.difference}
            />
            <MetricComparisonRow
              label="Goles/90"
              internal={result.metricsComparison.goalsPer90.internal}
              external={result.metricsComparison.goalsPer90.external}
              difference={result.metricsComparison.goalsPer90.difference}
            />
            <MetricComparisonRow
              label="Asistencias/90"
              internal={result.metricsComparison.assistsPer90.internal}
              external={result.metricsComparison.assistsPer90.external}
              difference={result.metricsComparison.assistsPer90.difference}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface ScoreCardProps {
  label: string;
  score: number;
}

function ScoreCard({ label, score }: ScoreCardProps) {
  const getColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-blue-600 dark:text-blue-400';
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-center">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{label}</div>
      <div className={cn('text-3xl font-bold', getColor(score))}>{score}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">/ 100</div>
    </div>
  );
}

interface MetricComparisonRowProps {
  label: string;
  internal: number;
  external: number;
  difference: number;
}

function MetricComparisonRow({ label, internal, external, difference }: MetricComparisonRowProps) {
  const isPositive = difference > 0;
  const isNeutral = difference === 0;

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{internal.toFixed(1)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Interno</div>
        </div>
        <ArrowRight size={16} className="text-gray-400" />
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{external.toFixed(1)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Externo</div>
        </div>
        <div className={cn('flex items-center gap-1 px-2 py-1 rounded text-sm font-medium', isPositive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : isNeutral ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')}>
          {isPositive ? <ArrowUp size={14} /> : isNeutral ? <Minus size={14} /> : <ArrowDown size={14} />}
          {Math.abs(difference).toFixed(1)}
        </div>
      </div>
    </div>
  );
}

// Comparison calculation logic
function calculatePlayerComparison(external: ExternalPlayer, internal: Player): any {
  // Technical score (based on goals, assists, pass accuracy, etc.)
  const technicalScore = calculateTechnicalScore(external, internal);
  
  // Physical score (based on distance, speed, etc.)
  const physicalScore = calculatePhysicalScore(external, internal);
  
  // Tactical score (based on position, role, etc.)
  const tacticalScore = calculateTacticalScore(external, internal);
  
  // Overall score (weighted average)
  const overallScore = Math.round(
    technicalScore * 0.4 + physicalScore * 0.35 + tacticalScore * 0.25
  );

  // Determine recommendation
  let recommendation: 'upgrade' | 'similar' | 'downgrade' | 'insufficient_data';
  if (overallScore >= 70) {
    recommendation = 'upgrade';
  } else if (overallScore >= 50) {
    recommendation = 'similar';
  } else if (overallScore >= 30) {
    recommendation = 'downgrade';
  } else {
    recommendation = 'insufficient_data';
  }

  // Calculate metrics comparison
  const metricsComparison = {
    distance: {
      internal: external.totalDistance || 0,
      external: external.totalDistance || 0,
      difference: 0,
    },
    highSpeedDistance: {
      internal: external.highSpeedDistance || 0,
      external: external.highSpeedDistance || 0,
      difference: 0,
    },
    maxVelocity: {
      internal: external.maxVelocity || 0,
      external: external.maxVelocity || 0,
      difference: 0,
    },
    goalsPer90: {
      internal: calculateGoalsPer90(external),
      external: calculateGoalsPer90(external),
      difference: 0,
    },
    assistsPer90: {
      internal: calculateAssistsPer90(external),
      external: calculateAssistsPer90(external),
      difference: 0,
    },
  };

  // Calculate differences
  Object.keys(metricsComparison).forEach((key) => {
    const metric = metricsComparison[key as keyof typeof metricsComparison];
    metric.difference = metric.external - metric.internal;
  });

  return {
    technicalScore,
    physicalScore,
    tacticalScore,
    overallScore,
    metricsComparison,
    recommendation,
  };
}

function calculateTechnicalScore(external: ExternalPlayer, internal: Player): number {
  // Simplified calculation - in production, use more sophisticated metrics
  let score = 50;
  
  if (external.goals) score += external.goals * 2;
  if (external.assists) score += external.assists * 1.5;
  if (external.passAccuracy) score += (external.passAccuracy - 70) * 0.5;
  if (external.keyPasses) score += external.keyPasses * 0.3;
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

function calculatePhysicalScore(external: ExternalPlayer, internal: Player): number {
  let score = 50;
  
  if (external.totalDistance) score += (external.totalDistance / 10000) * 10;
  if (external.highSpeedDistance) score += (external.highSpeedDistance / 1000) * 5;
  if (external.maxVelocity) score += (external.maxVelocity / 35) * 15;
  if (external.acceleration) score += external.acceleration * 2;
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

function calculateTacticalScore(external: ExternalPlayer, internal: Player): number {
  let score = 50;
  
  // Position match bonus
  if (external.position === internal.position) score += 20;
  if (external.secondaryPositions?.includes(internal.position as any)) score += 10;
  
  // Age consideration (younger players get bonus for potential)
  if (external.age < internal.age) score += 10;
  if (external.age > internal.age) score -= 5;
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

function calculateGoalsPer90(player: ExternalPlayer): number {
  if (!player.goals || !player.minutesPlayed || player.minutesPlayed === 0) return 0;
  return (player.goals / player.minutesPlayed) * 90;
}

function calculateAssistsPer90(player: ExternalPlayer): number {
  if (!player.assists || !player.minutesPlayed || player.minutesPlayed === 0) return 0;
  return (player.assists / player.minutesPlayed) * 90;
}
