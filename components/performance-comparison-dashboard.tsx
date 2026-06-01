'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Users, Target, Activity, HeartPulse, Zap } from 'lucide-react';
import { PerformanceMetrics, PerformanceComparison, calculatePerformanceMetrics, comparePlayerPerformance } from '@/lib/performance-profile';
import { Player, DailyInternalLoadRecord, DailyExternalLoadRecord, DailyWellnessRecord, CompetitionRecord } from '@/lib/schemas';

interface PerformanceComparisonDashboardProps {
  players: Player[];
  internalLoads: DailyInternalLoadRecord[];
  externalLoads: DailyExternalLoadRecord[];
  wellnessRecords: DailyWellnessRecord[];
  competitionRecords: CompetitionRecord[];
  referenceDate: string;
  selectedPlayerId?: string;
}

export function PerformanceComparisonDashboard({
  players,
  internalLoads,
  externalLoads,
  wellnessRecords,
  competitionRecords,
  referenceDate,
  selectedPlayerId,
}: PerformanceComparisonDashboardProps) {
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [comparisonView, setComparisonView] = useState<'position' | 'category' | 'team'>('position');

  // Calculate metrics for all players
  const allMetrics = useMemo(() => {
    return players.map(player =>
      calculatePerformanceMetrics(
        player,
        internalLoads,
        externalLoads,
        wellnessRecords,
        competitionRecords,
        referenceDate
      )
    );
  }, [players, internalLoads, externalLoads, wellnessRecords, competitionRecords, referenceDate]);

  // Filter players by position and category
  const filteredPlayers = useMemo(() => {
    return players.filter(player => {
      if (selectedPosition !== 'all' && player.position !== selectedPosition) return false;
      if (selectedCategory !== 'all' && player.category !== selectedCategory) return false;
      return true;
    });
  }, [players, selectedPosition, selectedCategory]);

  const filteredMetrics = useMemo(() => {
    return allMetrics.filter(metric => {
      const player = players.find(p => p.id === metric.playerId);
      if (!player) return false;
      if (selectedPosition !== 'all' && player.position !== selectedPosition) return false;
      if (selectedCategory !== 'all' && player.category !== selectedCategory) return false;
      return true;
    });
  }, [allMetrics, players, selectedPosition, selectedCategory]);

  // Calculate percentiles for each player
  const metricsWithPercentiles = useMemo(() => {
    const loadValues = filteredMetrics.map(m => m.avgWeeklyLoad);
    const wellnessValues = filteredMetrics.map(m => m.avgWellness);
    const physicalValues = filteredMetrics.map(m => m.avgDistance);

    return filteredMetrics.map(metric => ({
      ...metric,
      loadPercentile: calculatePercentile(metric.avgWeeklyLoad, loadValues),
      wellnessPercentile: calculatePercentile(metric.avgWellness, wellnessValues),
      physicalPercentile: calculatePercentile(metric.avgDistance, physicalValues),
    }));
  }, [filteredMetrics]);

  // Calculate group averages
  const positionGroups = useMemo(() => {
    const groups: Record<string, PerformanceMetrics[]> = {};
    filteredMetrics.forEach(metric => {
      const player = players.find(p => p.id === metric.playerId);
      if (player) {
        if (!groups[player.position]) groups[player.position] = [];
        groups[player.position].push(metric);
      }
    });
    return groups;
  }, [filteredMetrics, players]);

  const categoryGroups = useMemo(() => {
    const groups: Record<string, PerformanceMetrics[]> = {};
    filteredMetrics.forEach(metric => {
      const player = players.find(p => p.id === metric.playerId);
      if (player) {
        if (!groups[player.category || 'Sub20']) groups[player.category || 'Sub20'] = [];
        groups[player.category || 'Sub20'].push(metric);
      }
    });
    return groups;
  }, [filteredMetrics, players]);

  // Prepare chart data
  const comparisonChartData = useMemo(() => {
    if (comparisonView === 'position') {
      return Object.entries(positionGroups).map(([position, metrics]) => ({
        name: position,
        avgLoad: Math.round(metrics.reduce((sum, m) => sum + m.avgWeeklyLoad, 0) / metrics.length),
        avgWellness: Math.round(metrics.reduce((sum, m) => sum + m.avgWellness, 0) / metrics.length * 10) / 10,
        avgDistance: Math.round(metrics.reduce((sum, m) => sum + m.avgDistance, 0) / metrics.length),
        avgVelocity: Math.round(metrics.reduce((sum, m) => sum + m.avgMaxVelocity, 0) / metrics.length * 10) / 10,
      }));
    } else if (comparisonView === 'category') {
      return Object.entries(categoryGroups).map(([category, metrics]) => ({
        name: category,
        avgLoad: Math.round(metrics.reduce((sum, m) => sum + m.avgWeeklyLoad, 0) / metrics.length),
        avgWellness: Math.round(metrics.reduce((sum, m) => sum + m.avgWellness, 0) / metrics.length * 10) / 10,
        avgDistance: Math.round(metrics.reduce((sum, m) => sum + m.avgDistance, 0) / metrics.length),
        avgVelocity: Math.round(metrics.reduce((sum, m) => sum + m.avgMaxVelocity, 0) / metrics.length * 10) / 10,
      }));
    }
    return [{
      name: 'Team',
      avgLoad: Math.round(filteredMetrics.reduce((sum, m) => sum + m.avgWeeklyLoad, 0) / filteredMetrics.length),
      avgWellness: Math.round(filteredMetrics.reduce((sum, m) => sum + m.avgWellness, 0) / filteredMetrics.length * 10) / 10,
      avgDistance: Math.round(filteredMetrics.reduce((sum, m) => sum + m.avgDistance, 0) / filteredMetrics.length),
      avgVelocity: Math.round(filteredMetrics.reduce((sum, m) => sum + m.avgMaxVelocity, 0) / filteredMetrics.length * 10) / 10,
    }];
  }, [comparisonView, positionGroups, categoryGroups, filteredMetrics]);

  const topPlayersByLoad = useMemo(() => {
    return [...metricsWithPercentiles]
      .sort((a, b) => b.avgWeeklyLoad - a.avgWeeklyLoad)
      .slice(0, 5);
  }, [metricsWithPercentiles]);

  const topPlayersByWellness = useMemo(() => {
    return [...metricsWithPercentiles]
      .sort((a, b) => b.avgWellness - a.avgWellness)
      .slice(0, 5);
  }, [metricsWithPercentiles]);

  const positions = Array.from(new Set(players.map(p => p.position)));
  const categories = Array.from(new Set(players.map(p => p.category).filter(Boolean)));

  return (
    <div className="performance-comparison-dashboard">
      <div className="dashboard-header">
        <h2>Dashboard Comparativo de Rendimiento</h2>
        <div className="filters">
          <select
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value)}
            className="filter-select"
          >
            <option value="all">Todas las posiciones</option>
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            <option value="all">Todas las categorías</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="view-toggle">
            <button
              className={comparisonView === 'position' ? 'active' : ''}
              onClick={() => setComparisonView('position')}
            >
              Por Posición
            </button>
            <button
              className={comparisonView === 'category' ? 'active' : ''}
              onClick={() => setComparisonView('category')}
            >
              Por Categoría
            </button>
            <button
              className={comparisonView === 'team' ? 'active' : ''}
              onClick={() => setComparisonView('team')}
            >
              Equipo
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Comparison Chart */}
        <div className="chart-card">
          <h3>Comparación de Métricas por {comparisonView === 'position' ? 'Posición' : comparisonView === 'category' ? 'Categoría' : 'Equipo'}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparisonChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgLoad" name="Carga Promedio (UA)" fill="#2557d6" />
              <Bar dataKey="avgWellness" name="Wellness Promedio" fill="#0d9467" />
              <Bar dataKey="avgDistance" name="Distancia Promedio (m)" fill="#d97706" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Players by Load */}
        <div className="ranking-card">
          <h3>Top 5 por Carga Semanal</h3>
          <div className="ranking-list">
            {topPlayersByLoad.map((player, index) => (
              <div key={player.playerId} className="ranking-item">
                <span className="rank">#{index + 1}</span>
                <span className="name">{player.playerName}</span>
                <span className="value">{player.avgWeeklyLoad} UA</span>
                <span className="percentile">P{player.loadPercentile}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Players by Wellness */}
        <div className="ranking-card">
          <h3>Top 5 por Wellness</h3>
          <div className="ranking-list">
            {topPlayersByWellness.map((player, index) => (
              <div key={player.playerId} className="ranking-item">
                <span className="rank">#{index + 1}</span>
                <span className="name">{player.playerName}</span>
                <span className="value">{player.avgWellness.toFixed(1)}</span>
                <span className="percentile">P{player.wellnessPercentile}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Individual Player Comparison */}
        {selectedPlayerId && (
          <div className="player-comparison-card">
            <h3>Comparación Individual</h3>
            {(() => {
              const selectedMetric = metricsWithPercentiles.find(m => m.playerId === selectedPlayerId);
              if (!selectedMetric) return null;
              
              const player = players.find(p => p.id === selectedPlayerId);
              if (!player) return null;

              const positionMetrics = positionGroups[player.position] || [];
              const categoryMetrics = categoryGroups[player.category || 'Sub20'] || [];

              return (
                <div className="player-comparison-content">
                  <div className="player-info">
                    <h4>{player.name}</h4>
                    <p>{player.position} · {player.category}</p>
                  </div>
                  
                  <div className="comparison-metrics">
                    <div className="metric-group">
                      <h5>vs Posición</h5>
                      <MetricComparison
                        label="Carga"
                        value={selectedMetric.avgWeeklyLoad}
                        group={positionMetrics}
                        getter={(m) => m.avgWeeklyLoad}
                      />
                      <MetricComparison
                        label="Wellness"
                        value={selectedMetric.avgWellness}
                        group={positionMetrics}
                        getter={(m) => m.avgWellness}
                      />
                      <MetricComparison
                        label="Distancia"
                        value={selectedMetric.avgDistance}
                        group={positionMetrics}
                        getter={(m) => m.avgDistance}
                      />
                    </div>

                    <div className="metric-group">
                      <h5>vs Categoría</h5>
                      <MetricComparison
                        label="Carga"
                        value={selectedMetric.avgWeeklyLoad}
                        group={categoryMetrics}
                        getter={(m) => m.avgWeeklyLoad}
                      />
                      <MetricComparison
                        label="Wellness"
                        value={selectedMetric.avgWellness}
                        group={categoryMetrics}
                        getter={(m) => m.avgWellness}
                      />
                      <MetricComparison
                        label="Distancia"
                        value={selectedMetric.avgDistance}
                        group={categoryMetrics}
                        getter={(m) => m.avgDistance}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Radar Chart for Selected Player */}
        {selectedPlayerId && (
          <div className="radar-card">
            <h3>Perfil de Rendimiento</h3>
            {(() => {
              const selectedMetric = metricsWithPercentiles.find(m => m.playerId === selectedPlayerId);
              if (!selectedMetric) return null;

              const radarData = [
                {
                  subject: 'Carga',
                  value: (selectedMetric.loadPercentile / 100) * 100,
                  fullMark: 100,
                },
                {
                  subject: 'Wellness',
                  value: (selectedMetric.wellnessPercentile / 100) * 100,
                  fullMark: 100,
                },
                {
                  subject: 'Físico',
                  value: (selectedMetric.physicalPercentile / 100) * 100,
                  fullMark: 100,
                },
                {
                  subject: 'Minutos',
                  value: Math.min((selectedMetric.avgMinutesPlayed / 90) * 100, 100),
                  fullMark: 100,
                },
                {
                  subject: 'Goles/90',
                  value: Math.min((selectedMetric.goalsPer90 / 1) * 100, 100),
                  fullMark: 100,
                },
              ];

              return (
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis />
                    <Radar
                      name="Jugador"
                      dataKey="value"
                      stroke="#2557d6"
                      fill="#2557d6"
                      fillOpacity={0.6}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricComparison({
  label,
  value,
  group,
  getter,
}: {
  label: string;
  value: number;
  group: PerformanceMetrics[];
  getter: (m: PerformanceMetrics) => number;
}) {
  if (group.length === 0) return null;

  const groupAverage = group.reduce((sum, m) => sum + getter(m), 0) / group.length;
  const difference = value - groupAverage;
  const percentage = (difference / groupAverage) * 100;

  return (
    <div className="metric-comparison">
      <span className="label">{label}</span>
      <span className="value">{value.toFixed(1)}</span>
      <span className="average">Prom: {groupAverage.toFixed(1)}</span>
      <span className={`difference ${percentage >= 0 ? 'positive' : 'negative'}`}>
        {percentage >= 0 ? '+' : ''}{percentage.toFixed(1)}%
        {percentage >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      </span>
    </div>
  );
}

function calculatePercentile(value: number, values: number[]): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.indexOf(value);
  if (index === -1) return 50;
  return Math.round(((index + 1) / sorted.length) * 100);
}
